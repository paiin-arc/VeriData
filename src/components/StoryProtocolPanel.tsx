"use client"

import { useEffect, useState } from "react"
import { useWallet } from "@aptos-labs/wallet-adapter-react"
import { PILFlavor, WIP_TOKEN_ADDRESS } from "@story-protocol/core-sdk"
import { parseEther, parseUnits, zeroAddress, type Address } from "viem"
import { useAccount, useWalletClient } from "wagmi"

import {
  getDatasetKey,
  getStoryAccessReceipts,
  getStoryCollectionForWallet,
  getStoryRegistration,
  saveStoryAccessReceipt,
  saveStoryCollectionForWallet,
  saveStoryRegistration,
  type StoryAccessReceipt,
  type StoryRegistrationRecord
} from "@/lib/storyAccessStore"
import {
  buildStoryCollectionContractUri,
  buildStoryRegistrationMetadata,
  createStoryClient,
  getStoryAddressUrl,
  getStoryTransactionUrl
} from "@/lib/storyClient"
import { storyAeneid } from "@/lib/storyWagmi"

import styles from "./StoryProtocolPanel.module.css"

type SelectedDataset = {
  name: string
  owner: string
  sizeBytes: number
  merkleRoot: string
  shelbyExplorerUrl: string
  status: string
}

type StoryProtocolPanelProps = {
  dataset: SelectedDataset | null
  aptosWalletAddress?: string
}

type Feedback = {
  tone: "error" | "success"
  message: string
}

function sameAddress(left?: string, right?: string): boolean {
  return Boolean(left && right && left.trim().toLowerCase() === right.trim().toLowerCase())
}

function shortenValue(value: string, prefixLength = 8, suffixLength = 6): string {
  if (value.length <= prefixLength + suffixLength) {
    return value
  }

  return `${value.slice(0, prefixLength)}...${value.slice(-suffixLength)}`
}

export default function StoryProtocolPanel({
  dataset,
  aptosWalletAddress
}: StoryProtocolPanelProps) {
  const { signAndSubmitTransaction } = useWallet()
  const { address: storyAddress, isConnected: isStoryConnected, chainId: storyChainId } = useAccount()
  const { data: storyWalletClient } = useWalletClient()

  const [storyMintFee, setStoryMintFee] = useState("0.1")
  const [aptPrice, setAptPrice] = useState("1")
  const [commercialRevShare, setCommercialRevShare] = useState("10")
  const [registration, setRegistration] = useState<StoryRegistrationRecord | null>(null)
  const [receipts, setReceipts] = useState<StoryAccessReceipt[]>([])
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [busyAction, setBusyAction] = useState<null | "register" | "story-license" | "apt-payment">(null)

  const datasetKey = dataset ? getDatasetKey(dataset.owner, dataset.name) : null
  const hasCorrectStoryChain = storyChainId === storyAeneid.id
  const canRegisterDataset = Boolean(dataset && aptosWalletAddress && sameAddress(dataset.owner, aptosWalletAddress))
  const canMintStoryLicense = Boolean(registration && storyWalletClient && storyAddress && isStoryConnected && hasCorrectStoryChain)
  const canPayWithApt = Boolean(registration && aptosWalletAddress && dataset && !sameAddress(aptosWalletAddress, dataset.owner))

  useEffect(() => {
    if (!datasetKey) {
      setRegistration(null)
      setReceipts([])
      setStoryMintFee("0.1")
      setAptPrice("1")
      setCommercialRevShare("10")
      return
    }

    const nextRegistration = getStoryRegistration(datasetKey)

    setRegistration(nextRegistration)
    setReceipts(getStoryAccessReceipts(datasetKey))
    setStoryMintFee(nextRegistration?.storyMintFee ?? "0.1")
    setAptPrice(nextRegistration?.aptPrice ?? "1")
    setCommercialRevShare(String(nextRegistration?.commercialRevShare ?? 10))
  }, [datasetKey])

  const currentStoryAccess = Boolean(
    registration &&
    storyAddress &&
    (
      sameAddress(registration.storyOwner, storyAddress) ||
      receipts.some((receipt) => receipt.mode === "story-license" && sameAddress(receipt.walletAddress, storyAddress))
    )
  )

  const currentAptAccess = Boolean(
    registration &&
    aptosWalletAddress &&
    dataset &&
    (
      sameAddress(dataset.owner, aptosWalletAddress) ||
      receipts.some((receipt) => receipt.mode === "apt-payment" && sameAddress(receipt.walletAddress, aptosWalletAddress))
    )
  )

  const ensureStoryCollection = async (ownerAddress: string) => {
    if (!storyWalletClient) {
      throw new Error("Connect a Story wallet before creating an IP collection.")
    }

    const savedCollection = getStoryCollectionForWallet(ownerAddress)

    if (savedCollection) {
      return savedCollection as Address
    }

    const client = createStoryClient(storyWalletClient)
    const response = await client.nftClient.createNFTCollection({
      name: "VeriData Rights",
      symbol: "VDATA",
      isPublicMinting: false,
      mintOpen: true,
      mintFeeRecipient: zeroAddress,
      owner: ownerAddress as Address,
      contractURI: buildStoryCollectionContractUri(ownerAddress)
    })

    if (!response.spgNftContract) {
      throw new Error("Story collection creation completed without returning a contract address.")
    }

    saveStoryCollectionForWallet(ownerAddress, response.spgNftContract)
    return response.spgNftContract
  }

  const handleRegister = async () => {
    if (!dataset || !datasetKey) {
      setFeedback({
        tone: "error",
        message: "Select a dataset first."
      })
      return
    }

    if (!canRegisterDataset) {
      setFeedback({
        tone: "error",
        message: "Connect the Shelby owner wallet for this dataset before registering it on Story."
      })
      return
    }

    if (!storyWalletClient || !storyAddress || !isStoryConnected) {
      setFeedback({
        tone: "error",
        message: "Connect a Story wallet so the IP is registered under your own ownership."
      })
      return
    }

    if (!hasCorrectStoryChain) {
      setFeedback({
        tone: "error",
        message: "Switch your Story wallet to Story Aeneid before registering."
      })
      return
    }

    try {
      setBusyAction("register")
      setFeedback(null)

      const parsedStoryMintFee = parseEther(storyMintFee)
      const parsedRevShare = Number(commercialRevShare)

      if (!Number.isFinite(parsedRevShare) || parsedRevShare < 0 || parsedRevShare > 100) {
        throw new Error("Commercial revenue share must be between 0 and 100.")
      }

      const client = createStoryClient(storyWalletClient)
      const spgNftContract = await ensureStoryCollection(storyAddress)
      const metadata = await buildStoryRegistrationMetadata({
        blobName: dataset.name,
        shelbyOwner: dataset.owner,
        storyOwner: storyAddress,
        shelbyExplorerUrl: dataset.shelbyExplorerUrl,
        merkleRoot: dataset.merkleRoot,
        sizeBytes: dataset.sizeBytes,
        storyMintFee,
        aptPrice,
        commercialRevShare: parsedRevShare
      })

      const response = await client.ipAsset.registerIpAsset({
        nft: {
          type: "mint",
          spgNftContract,
          recipient: storyAddress,
          allowDuplicates: false
        },
        licenseTermsData: [
          {
            terms: PILFlavor.commercialRemix({
              defaultMintingFee: parsedStoryMintFee,
              commercialRevShare: parsedRevShare,
              currency: WIP_TOKEN_ADDRESS
            }),
            maxLicenseTokens: 10_000
          }
        ],
        ipMetadata: metadata,
        options: {
          wipOptions: {
            useMulticallWhenPossible: true
          }
        }
      })

      if (!response.ipId || !response.txHash || !response.licenseTermsIds?.[0]) {
        throw new Error("Story registration did not return a valid IP id or license terms id.")
      }

      const record = saveStoryRegistration({
        datasetKey,
        datasetName: dataset.name,
        shelbyOwner: dataset.owner,
        shelbyExplorerUrl: dataset.shelbyExplorerUrl,
        merkleRoot: dataset.merkleRoot,
        storyOwner: storyAddress,
        spgNftContract,
        ipId: response.ipId,
        tokenId: String(response.tokenId ?? ""),
        txHash: response.txHash,
        licenseTermsId: String(response.licenseTermsIds[0]),
        storyMintFee,
        aptPrice,
        commercialRevShare: parsedRevShare,
        createdAt: Date.now()
      })

      setRegistration(record)
      setFeedback({
        tone: "success",
        message: `${dataset.name} is now registered on Story and ready for paid licensing in WIP.`
      })
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Story registration failed"
      })
    } finally {
      setBusyAction(null)
    }
  }

  const handleMintStoryLicense = async () => {
    if (!registration || !storyWalletClient || !storyAddress) {
      setFeedback({
        tone: "error",
        message: "Connect a Story wallet to mint a license."
      })
      return
    }

    try {
      setBusyAction("story-license")
      setFeedback(null)

      const client = createStoryClient(storyWalletClient)
      const response = await client.license.mintLicenseTokens({
        licensorIpId: registration.ipId as Address,
        licenseTermsId: BigInt(registration.licenseTermsId),
        maxMintingFee: parseEther(registration.storyMintFee),
        amount: 1,
        receiver: storyAddress,
        options: {
          wipOptions: {
            useMulticallWhenPossible: true
          }
        }
      })

      if (!response.txHash) {
        throw new Error("Story license minting completed without returning a transaction hash.")
      }

      const receipt = saveStoryAccessReceipt({
        datasetKey: registration.datasetKey,
        walletAddress: storyAddress,
        mode: "story-license",
        tokenSymbol: "WIP",
        amount: registration.storyMintFee,
        txHash: response.txHash,
        createdAt: Date.now()
      })

      setReceipts((currentReceipts) => [receipt, ...currentReceipts])
      setFeedback({
        tone: "success",
        message: `Story license minted successfully for ${registration.datasetName}.`
      })
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Story license mint failed"
      })
    } finally {
      setBusyAction(null)
    }
  }

  const handlePayWithApt = async () => {
    if (!registration || !dataset || !aptosWalletAddress || !signAndSubmitTransaction) {
      setFeedback({
        tone: "error",
        message: "Connect an Aptos wallet to pay the Shelby owner."
      })
      return
    }

    try {
      setBusyAction("apt-payment")
      setFeedback(null)

      const amount = parseUnits(registration.aptPrice, 8)
      const response = await signAndSubmitTransaction({
        sender: aptosWalletAddress,
        data: {
          function: "0x1::aptos_account::transfer",
          functionArguments: [dataset.owner, amount.toString()]
        }
      })

      const receipt = saveStoryAccessReceipt({
        datasetKey: registration.datasetKey,
        walletAddress: aptosWalletAddress,
        mode: "apt-payment",
        tokenSymbol: "APT",
        amount: registration.aptPrice,
        txHash: response.hash,
        createdAt: Date.now()
      })

      setReceipts((currentReceipts) => [receipt, ...currentReceipts])
      setFeedback({
        tone: "success",
        message: `APT payment submitted to the Shelby owner for ${registration.datasetName}.`
      })
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "APT payment failed"
      })
    } finally {
      setBusyAction(null)
    }
  }

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Story x Shelby</p>
          <h3 className={styles.title}>Register IP and monetize dataset usage</h3>
        </div>
        <span className={styles.statusPill}>{registration ? "Story Active" : "Registration Pending"}</span>
      </div>

      <p className={styles.summary}>
        Shelby keeps the bytes stored. Story turns the selected dataset into a licensable IP asset. Buyers can mint a Story license in WIP, or pay directly in APT through the Shelby wallet rail.
      </p>

      {!dataset ? (
        <div className={styles.emptyState}>
          Select a dataset from search or the registry to register it on Story and configure paid access.
        </div>
      ) : (
        <>
          <div className={styles.datasetStrip}>
            <div className={styles.datasetCard}>
              <span className={styles.label}>Selected dataset</span>
              <span className={styles.value}>{dataset.name}</span>
            </div>
            <div className={styles.datasetCard}>
              <span className={styles.label}>Shelby owner</span>
              <span className={styles.value}>{shortenValue(dataset.owner)}</span>
            </div>
            <div className={styles.datasetCard}>
              <span className={styles.label}>Access status</span>
              <span className={styles.value}>{dataset.status}</span>
            </div>
          </div>

          <div className={styles.columns}>
            <div className={styles.column}>
              <div className={styles.columnHeader}>
                <div>
                  <p className={styles.sectionEyebrow}>Owner Actions</p>
                  <h4 className={styles.sectionTitle}>Story IP registration</h4>
                </div>
                <span className={styles.helpPill}>Owner-only</span>
              </div>

              <p className={styles.sectionBody}>
                Connect the Shelby owner wallet plus a Story wallet to mint a Story-owned NFT and attach commercial remix license terms.
              </p>

              <div className={styles.formGrid}>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Story minting fee (WIP)</span>
                  <input
                    value={storyMintFee}
                    onChange={(event) => setStoryMintFee(event.target.value)}
                    className={styles.input}
                    placeholder="0.1"
                  />
                </label>

                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Commercial revenue share</span>
                  <input
                    value={commercialRevShare}
                    onChange={(event) => setCommercialRevShare(event.target.value)}
                    className={styles.input}
                    placeholder="10"
                  />
                </label>

                <label className={`${styles.field} ${styles.fieldWide}`}>
                  <span className={styles.fieldLabel}>APT access price</span>
                  <input
                    value={aptPrice}
                    onChange={(event) => setAptPrice(event.target.value)}
                    className={styles.input}
                    placeholder="1"
                  />
                </label>
              </div>

              <div className={styles.noteCard}>
                Story-native licensing is priced in WIP on Story. The APT option stays on Aptos and transfers payment directly to the Shelby owner, which keeps the cross-chain payment rail simple.
              </div>

              <button
                type="button"
                onClick={() => {
                  void handleRegister()
                }}
                disabled={busyAction === "register"}
                className={styles.primaryButton}
              >
                {busyAction === "register" ? "Registering on Story..." : registration ? "Re-register Story IP" : "Register on Story"}
              </button>

              {!canRegisterDataset ? (
                <p className={styles.helperText}>
                  Connect the Aptos wallet that owns this Shelby dataset before registering it on Story.
                </p>
              ) : null}

              {registration ? (
                <div className={styles.registrationCard}>
                  <div className={styles.linkRow}>
                    <span className={styles.label}>IP Asset</span>
                    <a href={getStoryAddressUrl(registration.ipId)} target="_blank" rel="noreferrer" className={styles.inlineLink}>
                      {shortenValue(registration.ipId)}
                    </a>
                  </div>
                  <div className={styles.linkRow}>
                    <span className={styles.label}>License terms</span>
                    <span className={styles.value}>{registration.licenseTermsId}</span>
                  </div>
                  <div className={styles.linkRow}>
                    <span className={styles.label}>Registration tx</span>
                    <a href={getStoryTransactionUrl(registration.txHash)} target="_blank" rel="noreferrer" className={styles.inlineLink}>
                      View on Storyscan
                    </a>
                  </div>
                </div>
              ) : null}
            </div>

            <div className={styles.column}>
              <div className={styles.columnHeader}>
                <div>
                  <p className={styles.sectionEyebrow}>Buyer Access</p>
                  <h4 className={styles.sectionTitle}>License or pay for usage</h4>
                </div>
                <span className={styles.helpPill}>Unlock rights</span>
              </div>

              <p className={styles.sectionBody}>
                Buyers can unlock usage via a Story license mint in WIP, or by paying the Shelby owner in APT for an app-level access receipt.
              </p>

              <div className={styles.unlockGrid}>
                <div className={styles.unlockCard}>
                  <span className={styles.label}>Story license</span>
                  <span className={styles.unlockValue}>{registration ? `${registration.storyMintFee} WIP` : "Register first"}</span>
                  <span className={styles.unlockState}>{currentStoryAccess ? "Unlocked for this Story wallet" : "Not unlocked yet"}</span>
                  <button
                    type="button"
                    onClick={() => {
                      void handleMintStoryLicense()
                    }}
                    disabled={!canMintStoryLicense || busyAction === "story-license"}
                    className={styles.secondaryButton}
                  >
                    {busyAction === "story-license" ? "Minting..." : "Mint Story License"}
                  </button>
                </div>

                <div className={styles.unlockCard}>
                  <span className={styles.label}>APT payment</span>
                  <span className={styles.unlockValue}>{registration ? `${registration.aptPrice} APT` : "Register first"}</span>
                  <span className={styles.unlockState}>{currentAptAccess ? "Unlocked for this Aptos wallet" : "Not unlocked yet"}</span>
                  <button
                    type="button"
                    onClick={() => {
                      void handlePayWithApt()
                    }}
                    disabled={!canPayWithApt || busyAction === "apt-payment"}
                    className={styles.secondaryButton}
                  >
                    {busyAction === "apt-payment" ? "Paying..." : "Pay with APT"}
                  </button>
                </div>
              </div>

              <div className={styles.receiptPanel}>
                <div className={styles.receiptTitle}>Recent access receipts</div>
                {receipts.length > 0 ? (
                  <div className={styles.receiptList}>
                    {receipts.slice(0, 4).map((receipt) => (
                      <div key={`${receipt.mode}-${receipt.txHash}`} className={styles.receiptItem}>
                        <div>
                          <div className={styles.receiptMode}>
                            {receipt.mode === "story-license" ? "Story license minted" : "APT payment sent"}
                          </div>
                          <div className={styles.receiptMeta}>
                            {shortenValue(receipt.walletAddress)} paid {receipt.amount} {receipt.tokenSymbol}
                          </div>
                        </div>
                        <span className={styles.receiptHash}>{shortenValue(receipt.txHash, 10, 6)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={styles.emptyReceipts}>
                    No Story licenses or APT usage payments have been recorded for this dataset yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {feedback ? (
        <p className={feedback.tone === "success" ? styles.successMessage : styles.errorMessage}>
          {feedback.message}
        </p>
      ) : null}
    </div>
  )
}

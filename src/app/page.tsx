"use client"

import { useEffect, useState } from "react"
import { useWallet } from "@aptos-labs/wallet-adapter-react"
import { useAccountBlobs, useBlobMetadata, useShelbyClient } from "@shelby-protocol/react"
import {
  type BlobMetadata,
  type Blobs_Bool_Exp,
  getShelbyBlobExplorerUrl,
  Order_By
} from "@shelby-protocol/sdk/browser"

import UploadDataset from "@/components/UploadDataset"
import WalletButton from "@/components/WalletButton"
import WalletTransactions from "@/components/WalletTransactions"

import styles from "./page.module.css"

type BlobReference = {
  account: string
  name: string
}

type DashboardTab = {
  label: string
  href: string
  active?: boolean
  external?: boolean
}

type SparklineProps = {
  values: number[]
  color: string
}

const primaryTabs: readonly DashboardTab[] = [
  { label: "Dashboard", href: "#overview", active: true },
  { label: "Registry", href: "#dataset-registry" },
  { label: "Search", href: "#search" },
  { label: "Upload", href: "#upload-dataset" },
  { label: "Activity", href: "#activity" }
] as const

const secondaryTabs: readonly DashboardTab[] = [
  { label: "Overview", href: "#overview", active: true },
  { label: "Storage", href: "#dataset-registry" },
  { label: "Ownership", href: "#dataset-details" },
  { label: "Wallet", href: "#activity" },
  { label: "Explorer", href: "https://explorer.shelby.xyz", external: true }
] as const

function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }

  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function formatMerkleRoot(value: Uint8Array): string {
  const hex = Array.from(value, (byte) => byte.toString(16).padStart(2, "0")).join("")

  return `0x${hex}`
}

function formatMicrosTimestamp(value: number): string {
  return new Date(value / 1000).toLocaleString()
}

function formatBlobEncoding(encoding: BlobMetadata["encoding"]): string {
  return Object.entries(encoding)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(", ")
}

function shortenValue(value: string, prefixLength = 12, suffixLength = 8): string {
  if (value.length <= prefixLength + suffixLength) {
    return value
  }

  return `${value.slice(0, prefixLength)}...${value.slice(-suffixLength)}`
}

function isWalletAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]+$/.test(value)
}

function buildDatasetSearchWhere(query: string): Blobs_Bool_Exp {
  const trimmedQuery = query.trim()
  const normalizedQuery = trimmedQuery.toLowerCase()
  const hashCandidates = Array.from(
    new Set(
      [
        trimmedQuery,
        normalizedQuery,
        trimmedQuery.startsWith("0x") ? trimmedQuery.slice(2) : null,
        normalizedQuery.startsWith("0x") ? normalizedQuery.slice(2) : null
      ].filter((candidate): candidate is string => Boolean(candidate))
    )
  )

  const filters: Blobs_Bool_Exp[] = [
    {
      blob_name: {
        _ilike: `%${trimmedQuery}%`
      }
    }
  ]

  for (const candidate of hashCandidates) {
    filters.push({
      blob_commitment: {
        _eq: candidate
      }
    })
  }

  if (isWalletAddress(trimmedQuery)) {
    filters.push({
      owner: {
        _eq: trimmedQuery
      }
    })
    filters.push({
      owner: {
        _eq: normalizedQuery
      }
    })
  }

  return {
    _or: filters
  }
}

function getBlobStatus(blob: BlobMetadata): string {
  if (blob.isDeleted) {
    return "Deleted"
  }

  if (blob.isWritten) {
    return "Written"
  }

  return "Registered"
}

function getBlobReference(blob: BlobMetadata): BlobReference {
  return {
    account: blob.owner.toString(),
    name: blob.blobNameSuffix
  }
}

function getBlobKey(reference: BlobReference): string {
  return `${reference.account}/${reference.name}`
}

function createPath(values: number[], width: number, height: number): string {
  if (values.length === 0) {
    return ""
  }

  const max = Math.max(...values)
  const min = Math.min(...values)
  const range = max - min || 1

  return values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * width
      const y = height - ((value - min) / range) * height
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`
    })
    .join(" ")
}

function Sparkline({ values, color }: SparklineProps) {
  const path = createPath(values, 170, 44)

  return (
    <svg viewBox="0 0 170 44" className={styles.sparkline} aria-hidden="true">
      <path d={path} fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function Home() {
  const { account } = useWallet()
  const shelbyClient = useShelbyClient()
  const owner = account?.address?.toString()

  const [searchInput, setSearchInput] = useState("")
  const [searchResults, setSearchResults] = useState<BlobMetadata[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [submittedQuery, setSubmittedQuery] = useState("")
  const [selectedBlobReference, setSelectedBlobReference] = useState<BlobReference | null>(null)

  const {
    data: blobs = [],
    isLoading,
    isFetching,
    error: accountBlobsError,
    refetch
  } = useAccountBlobs({
    account: owner ?? "0x0",
    enabled: Boolean(owner),
    pagination: {
      limit: 100
    },
    refetchInterval: owner ? 15_000 : false
  })

  const registryBlobs = [...blobs]
    .filter((blob) => !blob.isDeleted)
    .sort((left, right) => right.creationMicros - left.creationMicros)

  const registrySignature = registryBlobs
    .map((blob) => getBlobKey(getBlobReference(blob)))
    .join("|")

  const searchSignature = searchResults
    .map((blob) => getBlobKey(getBlobReference(blob)))
    .join("|")

  useEffect(() => {
    const availableBlobs = [...searchResults, ...registryBlobs]

    setSelectedBlobReference((currentReference) => {
      if (currentReference) {
        const exists = availableBlobs.some((blob) => (
          blob.owner.toString() === currentReference.account &&
          blob.blobNameSuffix === currentReference.name
        ))

        if (exists) {
          return currentReference
        }
      }

      const nextBlob = availableBlobs[0]
      return nextBlob ? getBlobReference(nextBlob) : null
    })
  }, [registrySignature, searchSignature])

  const selectedRegistryBlob = [...searchResults, ...registryBlobs].find((blob) => (
    selectedBlobReference &&
    blob.owner.toString() === selectedBlobReference.account &&
    blob.blobNameSuffix === selectedBlobReference.name
  )) ?? null

  const {
    data: selectedMetadata,
    isLoading: selectedMetadataLoading,
    error: selectedMetadataError
  } = useBlobMetadata({
    account: selectedBlobReference?.account ?? "0x0",
    name: selectedBlobReference?.name ?? "placeholder",
    enabled: Boolean(selectedBlobReference),
    refetchInterval: selectedBlobReference ? 15_000 : false
  })

  const activeMetadata = selectedMetadata ?? selectedRegistryBlob ?? null
  const explorerUrl = activeMetadata
    ? getShelbyBlobExplorerUrl(
        shelbyClient.config.network,
        activeMetadata.owner.toString(),
        activeMetadata.blobNameSuffix
      )
    : null

  const totalBytes = registryBlobs.reduce((sum, blob) => sum + blob.size, 0)
  const writtenCount = registryBlobs.filter((blob) => blob.isWritten).length
  const expiringSoonCount = registryBlobs.filter((blob) => {
    const sevenDaysFromNowMicros = Date.now() * 1000 + 7 * 24 * 60 * 60 * 1_000_000
    return blob.expirationMicros <= sevenDaysFromNowMicros
  }).length
  const uniqueOwners = new Set(registryBlobs.map((blob) => blob.owner.toString())).size

  const sizeSeries = registryBlobs.length > 0
    ? registryBlobs.slice(0, 10).reverse().map((blob) => Math.max(blob.size / (1024 * 1024), 0.4))
    : [1, 1.5, 1.3, 2.1, 1.8, 2.2, 2, 2.7, 2.5, 3]

  const writtenSeries = registryBlobs.length > 0
    ? registryBlobs.slice(0, 10).reverse().map((blob) => blob.isWritten ? 10 : 4)
    : [3, 4, 5, 7, 6, 8, 7, 9, 10, 9]

  const expirySeries = registryBlobs.length > 0
    ? registryBlobs.slice(0, 10).reverse().map((blob) => {
        const days = (blob.expirationMicros - Date.now() * 1000) / (24 * 60 * 60 * 1_000_000)
        return Math.max(Math.min(days, 30), 0)
      })
    : [24, 22, 21, 18, 16, 15, 14, 12, 9, 7]

  const searchSeries = searchResults.length > 0
    ? searchResults.slice(0, 10).reverse().map((blob) => Math.max(blob.size / (1024 * 1024), 0.2))
    : [0.8, 1.1, 1, 1.4, 1.2, 1.6, 1.8, 1.7, 2, 1.9]

  const handleDatasetSearch = async () => {
    const query = searchInput.trim()

    if (!query) {
      setSubmittedQuery("")
      setSearchResults([])
      setSearchError(null)
      return
    }

    setSearching(true)
    setSearchError(null)
    setSubmittedQuery(query)

    try {
      const blobs = await shelbyClient.coordination.getBlobs({
        where: buildDatasetSearchWhere(query),
        pagination: {
          limit: 20
        },
        orderBy: {
          updated_at: Order_By.Desc
        }
      })

      const uniqueBlobs = Array.from(
        new Map(
          blobs.map((blob) => [getBlobKey(getBlobReference(blob)), blob])
        ).values()
      )

      setSearchResults(uniqueBlobs)

      if (uniqueBlobs[0]) {
        setSelectedBlobReference(getBlobReference(uniqueBlobs[0]))
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to search Shelby datasets"

      setSearchError(message)
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.chrome}>
        <div className={styles.primaryTabs}>
          {primaryTabs.map((tab) => (
            <a
              key={tab.label}
              href={tab.href}
              className={`${styles.primaryTab} ${tab.active ? styles.primaryTabActive : ""}`}
            >
              {tab.label}
            </a>
          ))}

          <div className={styles.primaryActions}>
            <WalletButton />
          </div>
        </div>

        <div className={styles.secondaryTabs}>
          {secondaryTabs.map((tab) => (
            <a
              key={tab.label}
              href={tab.href}
              target={tab.external ? "_blank" : undefined}
              rel={tab.external ? "noreferrer" : undefined}
              className={`${styles.secondaryTab} ${tab.active ? styles.secondaryTabActive : ""}`}
            >
              {tab.label}
            </a>
          ))}
        </div>

        <div id="overview" className={styles.content}>
          <section className={styles.summaryBar}>
            <div>
              <p className={styles.kicker}>Storage Overview</p>
              <h1 className={styles.title}>VeriData Shelby Console</h1>
              <p className={styles.subtitle}>
                A cleaner storage dashboard for dataset registration, search, ownership details, and wallet activity.
              </p>
            </div>

            <div className={styles.summaryMeta}>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Connected wallet</span>
                <span className={styles.metaValue}>{owner ? shortenValue(owner, 8, 6) : "Not connected"}</span>
              </div>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Selected dataset</span>
                <span className={styles.metaValue}>{activeMetadata ? activeMetadata.blobNameSuffix : "None"}</span>
              </div>
            </div>
          </section>

          <section className={styles.metricGrid}>
            <article className={styles.metricCard}>
              <div className={styles.metricHeader}>
                <span className={styles.metricLabel}>Dataset Count</span>
                <span className={styles.metricStatusGreen}>LIVE</span>
              </div>
              <div className={styles.metricValue}>{registryBlobs.length}</div>
              <div className={styles.metricSubtext}>Registered blobs in your connected Shelby namespace.</div>
              <Sparkline values={sizeSeries} color="#2fb14f" />
            </article>

            <article className={styles.metricCard}>
              <div className={styles.metricHeader}>
                <span className={styles.metricLabel}>Storage Reserved</span>
                <span className={styles.metricStatusPurple}>MB</span>
              </div>
              <div className={styles.metricValue}>{formatFileSize(totalBytes)}</div>
              <div className={styles.metricSubtext}>Live size of all active datasets in the registry.</div>
              <Sparkline values={searchSeries} color="#df6ea9" />
            </article>

            <article className={styles.metricCard}>
              <div className={styles.metricHeader}>
                <span className={styles.metricLabel}>Written Datasets</span>
                <span className={styles.metricStatusGreen}>ACK</span>
              </div>
              <div className={styles.metricValue}>{writtenCount}</div>
              <div className={styles.metricSubtext}>Datasets fully acknowledged by Shelby storage providers.</div>
              <Sparkline values={writtenSeries} color="#2fb14f" />
            </article>

            <article className={styles.metricCard}>
              <div className={styles.metricHeader}>
                <span className={styles.metricLabel}>Expiring Soon</span>
                <span className={styles.metricStatusAmber}>7D</span>
              </div>
              <div className={styles.metricValue}>{expiringSoonCount}</div>
              <div className={styles.metricSubtext}>{uniqueOwners} owner{uniqueOwners === 1 ? "" : "s"} currently represented.</div>
              <Sparkline values={expirySeries} color="#da7b10" />
            </article>
          </section>

          <section className={styles.topGrid}>
            <article id="search" className={`${styles.panel} ${styles.panelSearch}`}>
              <div className={styles.panelHeader}>
                <div>
                  <p className={styles.panelKicker}>Quick Search</p>
                  <h2 className={styles.panelTitle}>Search wallet, blob, or hash</h2>
                </div>
                {submittedQuery ? <span className={styles.panelBadge}>{submittedQuery}</span> : null}
              </div>

              <div className={styles.searchControls}>
                <input
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault()
                      void handleDatasetSearch()
                    }
                  }}
                  placeholder="Wallet address, blob name, or merkle hash"
                  className={styles.searchInput}
                />

                <button
                  onClick={() => {
                    void handleDatasetSearch()
                  }}
                  disabled={searching}
                  className={styles.searchButton}
                >
                  {searching ? "Searching..." : "Search"}
                </button>
              </div>

              {searchError ? <p className={styles.errorMessage}>{searchError}</p> : null}

              {!searchError && submittedQuery && searchResults.length === 0 && !searching ? (
                <p className={styles.emptyState}>No dataset matched that search.</p>
              ) : null}

              {searchResults.length > 0 ? (
                <div className={styles.searchResults}>
                  {searchResults.slice(0, 6).map((blob) => {
                    const reference = getBlobReference(blob)
                    const isActive = selectedBlobReference
                      ? getBlobKey(selectedBlobReference) === getBlobKey(reference)
                      : false

                    return (
                      <button
                        key={getBlobKey(reference)}
                        className={`${styles.resultRow} ${isActive ? styles.resultRowActive : ""}`}
                        onClick={() => setSelectedBlobReference(reference)}
                      >
                        <div>
                          <div className={styles.resultName}>{blob.blobNameSuffix}</div>
                          <div className={styles.resultMeta}>
                            {shortenValue(blob.owner.toString(), 8, 6)} • {formatFileSize(blob.size)}
                          </div>
                        </div>
                        <span className={styles.rowBadge}>{getBlobStatus(blob)}</span>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div className={styles.searchHintPanel}>
                  Search a connected wallet address, a blob file name, or a blob commitment hash to bring dataset details into view.
                </div>
              )}
            </article>

            <article id="dataset-details" className={`${styles.panel} ${styles.panelDetails}`}>
              <div className={styles.panelHeader}>
                <div>
                  <p className={styles.panelKicker}>Ownership Detail</p>
                  <h2 className={styles.panelTitle}>Selected dataset metadata</h2>
                </div>
                {activeMetadata ? <span className={styles.panelBadge}>{getBlobStatus(activeMetadata)}</span> : null}
              </div>

              {!selectedBlobReference ? (
                <p className={styles.emptyState}>Select a dataset from search or the registry.</p>
              ) : null}

              {selectedMetadataError ? (
                <p className={styles.errorMessage}>
                  {selectedMetadataError instanceof Error ? selectedMetadataError.message : "Failed to load blob metadata"}
                </p>
              ) : null}

              {selectedBlobReference && selectedMetadataLoading && !activeMetadata ? (
                <p className={styles.emptyState}>Loading dataset metadata...</p>
              ) : null}

              {activeMetadata ? (
                <div className={styles.detailGrid}>
                  <div className={styles.detailCell}>
                    <span className={styles.detailLabel}>Owner</span>
                    <span className={styles.detailValueBreak}>{activeMetadata.owner.toString()}</span>
                  </div>
                  <div className={styles.detailCell}>
                    <span className={styles.detailLabel}>Blob Name</span>
                    <span className={styles.detailValueBreak}>{activeMetadata.blobNameSuffix}</span>
                  </div>
                  <div className={styles.detailCell}>
                    <span className={styles.detailLabel}>Size</span>
                    <span className={styles.detailValue}>{formatFileSize(activeMetadata.size)}</span>
                  </div>
                  <div className={styles.detailCell}>
                    <span className={styles.detailLabel}>Encoding</span>
                    <span className={styles.detailValue}>{formatBlobEncoding(activeMetadata.encoding)}</span>
                  </div>
                  <div className={styles.detailCell}>
                    <span className={styles.detailLabel}>Created</span>
                    <span className={styles.detailValue}>{formatMicrosTimestamp(activeMetadata.creationMicros)}</span>
                  </div>
                  <div className={styles.detailCell}>
                    <span className={styles.detailLabel}>Expires</span>
                    <span className={styles.detailValue}>{formatMicrosTimestamp(activeMetadata.expirationMicros)}</span>
                  </div>
                  <div className={`${styles.detailCell} ${styles.detailCellWide}`}>
                    <span className={styles.detailLabel}>Merkle Root</span>
                    <span className={styles.detailValueBreak}>{formatMerkleRoot(activeMetadata.blobMerkleRoot)}</span>
                  </div>
                  <div className={`${styles.detailCell} ${styles.detailCellWide}`}>
                    <span className={styles.detailLabel}>Slice Address</span>
                    <span className={styles.detailValueBreak}>{activeMetadata.sliceAddress.toString()}</span>
                  </div>
                </div>
              ) : null}

              {explorerUrl ? (
                <div className={styles.panelActionRow}>
                  <a href={explorerUrl} target="_blank" rel="noreferrer" className={styles.linkButton}>
                    Open in Shelby Explorer
                  </a>
                </div>
              ) : null}
            </article>

            <article id="upload-dataset" className={`${styles.panel} ${styles.panelUpload}`}>
              <div className={styles.panelHeader}>
                <div>
                  <p className={styles.panelKicker}>Upload</p>
                  <h2 className={styles.panelTitle}>Register a new dataset</h2>
                </div>
              </div>

              <UploadDataset
                onUpload={async () => {
                  const refreshed = await refetch()
                  const latestBlob = [...(refreshed.data ?? [])]
                    .filter((blob) => !blob.isDeleted)
                    .sort((left, right) => right.creationMicros - left.creationMicros)[0]

                  if (latestBlob) {
                    setSelectedBlobReference(getBlobReference(latestBlob))
                  }
                }}
              />
            </article>
          </section>

          <section className={styles.bottomGrid}>
            <article id="dataset-registry" className={`${styles.panel} ${styles.registryPanel}`}>
              <div className={styles.panelHeader}>
                <div>
                  <p className={styles.panelKicker}>Dataset Registry</p>
                  <h2 className={styles.panelTitle}>Live Shelby records</h2>
                </div>
                <button
                  onClick={() => {
                    void refetch()
                  }}
                  className={styles.refreshButton}
                >
                  {isFetching ? "Refreshing..." : "Refresh"}
                </button>
              </div>

              {!owner ? <p className={styles.emptyState}>Connect your wallet to load the live registry.</p> : null}
              {owner && isLoading ? <p className={styles.emptyState}>Loading registry...</p> : null}
              {accountBlobsError ? (
                <p className={styles.errorMessage}>
                  {accountBlobsError instanceof Error ? accountBlobsError.message : "Failed to load account blobs"}
                </p>
              ) : null}
              {owner && !isLoading && !accountBlobsError && registryBlobs.length === 0 ? (
                <p className={styles.emptyState}>No registered datasets yet.</p>
              ) : null}

              {registryBlobs.length > 0 ? (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Owner</th>
                        <th>Status</th>
                        <th>Size</th>
                        <th>Created</th>
                        <th>Expires</th>
                      </tr>
                    </thead>

                    <tbody>
                      {registryBlobs.map((blob) => {
                        const reference = getBlobReference(blob)
                        const isActive = selectedBlobReference
                          ? getBlobKey(selectedBlobReference) === getBlobKey(reference)
                          : false

                        return (
                          <tr
                            key={getBlobKey(reference)}
                            className={isActive ? styles.tableRowActive : undefined}
                            onClick={() => setSelectedBlobReference(reference)}
                          >
                            <td>{blob.blobNameSuffix}</td>
                            <td>{shortenValue(blob.owner.toString(), 8, 6)}</td>
                            <td>{getBlobStatus(blob)}</td>
                            <td>{formatFileSize(blob.size)}</td>
                            <td>{formatMicrosTimestamp(blob.creationMicros)}</td>
                            <td>{formatMicrosTimestamp(blob.expirationMicros)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </article>

            <div id="activity" className={styles.activityPanel}>
              <WalletTransactions />
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

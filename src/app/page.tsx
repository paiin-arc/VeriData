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
import { ArrowRight, Command, Search } from "lucide-react"
import { useAccount } from "wagmi"

import StoryProtocolPanel from "@/components/StoryProtocolPanel"
import StoryWalletButton from "@/components/StoryWalletButton"
import UploadDataset from "@/components/UploadDataset"
import WalletButton from "@/components/WalletButton"
import WalletTransactions from "@/components/WalletTransactions"

import styles from "./page.module.css"

type BlobReference = {
  account: string
  name: string
}

type WorkspaceView =
  | "overview"
  | "search"
  | "details"
  | "upload"
  | "registry"
  | "activity"

type DashboardTab = {
  label: string
  view: WorkspaceView
  hash: string
}

type SparklineProps = {
  values: number[]
  color: string
}

type MetricInsight = "count" | "storage" | "written" | "expiring"

const primaryTabs: readonly DashboardTab[] = [
  { label: "Overview", view: "overview", hash: "#overview" },
  { label: "Search", view: "search", hash: "#search" },
  { label: "Details", view: "details", hash: "#dataset-details" },
  { label: "Upload", view: "upload", hash: "#upload-dataset" },
  { label: "Registry", view: "registry", hash: "#dataset-registry" },
  { label: "Activity", view: "activity", hash: "#activity" }
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
  const date = new Date(Math.floor(value / 1000))

  if (Number.isNaN(date.getTime())) {
    return "Invalid date"
  }

  const isoValue = date.toISOString()
  return `${isoValue.slice(0, 10)} ${isoValue.slice(11, 19)} UTC`
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

function getViewFromHash(hash: string): WorkspaceView {
  switch (hash) {
    case "#search":
      return "search"
    case "#dataset-details":
      return "details"
    case "#upload-dataset":
      return "upload"
    case "#dataset-registry":
      return "registry"
    case "#activity":
      return "activity"
    case "#overview":
    default:
      return "overview"
  }
}

export default function Home() {
  const { account } = useWallet()
  const { address: storyAddress } = useAccount()
  const shelbyClient = useShelbyClient()
  const owner = account?.address?.toString()

  const [hasMounted, setHasMounted] = useState(false)
  const [currentTimeMicros, setCurrentTimeMicros] = useState(0)
  const [activeView, setActiveView] = useState<WorkspaceView>("overview")
  const [selectedInsight, setSelectedInsight] = useState<MetricInsight>("count")
  const [searchInput, setSearchInput] = useState("")
  const [searchResults, setSearchResults] = useState<BlobMetadata[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [submittedQuery, setSubmittedQuery] = useState("")
  const [selectedBlobReference, setSelectedBlobReference] = useState<BlobReference | null>(null)
  const hydratedOwner = hasMounted ? owner : undefined
  const hydratedStoryAddress = hasMounted ? storyAddress : undefined

  const {
    data: blobs = [],
    isLoading,
    isFetching,
    error: accountBlobsError,
    refetch
  } = useAccountBlobs({
    account: hydratedOwner ?? "0x0",
    enabled: Boolean(hydratedOwner),
    pagination: {
      limit: 100
    },
    refetchInterval: hydratedOwner ? 15_000 : false
  })

  const registryBlobs = [...blobs]
    .filter((blob) => !blob.isDeleted)
    .sort((left, right) => right.creationMicros - left.creationMicros)

  useEffect(() => {
    setHasMounted(true)
    setCurrentTimeMicros(Date.now() * 1000)

    const syncActiveView = () => {
      setActiveView(getViewFromHash(window.location.hash))
    }

    syncActiveView()
    window.addEventListener("hashchange", syncActiveView)

    return () => {
      window.removeEventListener("hashchange", syncActiveView)
    }
  }, [])

  useEffect(() => {
    const availableRegistryBlobs = [...blobs]
      .filter((blob) => !blob.isDeleted)
      .sort((left, right) => right.creationMicros - left.creationMicros)
    const availableBlobs = [...searchResults, ...availableRegistryBlobs]

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
  }, [blobs, searchResults])

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

  const selectedDataset = activeMetadata
    ? {
        name: activeMetadata.blobNameSuffix,
        owner: activeMetadata.owner.toString(),
        sizeBytes: activeMetadata.size,
        merkleRoot: formatMerkleRoot(activeMetadata.blobMerkleRoot),
        shelbyExplorerUrl: explorerUrl ?? "",
        status: getBlobStatus(activeMetadata)
      }
    : null

  const setView = (view: WorkspaceView) => {
    setActiveView(view)

    const tab = primaryTabs.find((item) => item.view === view)

    if (tab) {
      window.history.replaceState(null, "", tab.hash)
      window.dispatchEvent(new Event("veridatahashchange"))
    }
  }

  const totalBytes = registryBlobs.reduce((sum, blob) => sum + blob.size, 0)
  const writtenCount = registryBlobs.filter((blob) => blob.isWritten).length
  const expiringSoonCount = registryBlobs.filter((blob) => {
    const sevenDaysFromNowMicros = currentTimeMicros + 7 * 24 * 60 * 60 * 1_000_000
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
        const days = (blob.expirationMicros - currentTimeMicros) / (24 * 60 * 60 * 1_000_000)
        return Math.max(Math.min(days, 30), 0)
      })
    : [24, 22, 21, 18, 16, 15, 14, 12, 9, 7]

  const searchSeries = searchResults.length > 0
    ? searchResults.slice(0, 10).reverse().map((blob) => Math.max(blob.size / (1024 * 1024), 0.2))
    : [0.8, 1.1, 1, 1.4, 1.2, 1.6, 1.8, 1.7, 2, 1.9]

  const selectedInsightContent = {
    count: {
      title: "Dataset count",
      summary: "See how many datasets are currently active in your Shelby space.",
      value: `${registryBlobs.length}`,
      helper: "Use Registry to open any item and view only that dataset's full details."
    },
    storage: {
      title: "Storage reserved",
      summary: "This helps students understand how much space all uploaded datasets are using together.",
      value: formatFileSize(totalBytes),
      helper: "Large files are easier to review from Details after selecting one item."
    },
    written: {
      title: "Written datasets",
      summary: "These files have been acknowledged by Shelby storage providers.",
      value: `${writtenCount}`,
      helper: "Open Details to inspect the selected file's owner, size, timestamps, and hash."
    },
    expiring: {
      title: "Expiring soon",
      summary: "These datasets will need attention soon so they do not lapse unexpectedly.",
      value: `${expiringSoonCount}`,
      helper: `${uniqueOwners} owner${uniqueOwners === 1 ? "" : "s"} currently represented in the registry.`
    }
  } satisfies Record<MetricInsight, { title: string; summary: string; value: string; helper: string }>

  const featuredCollections = [
    {
      eyebrow: registryBlobs[0] ? "Registry spotlight" : "Featured collection",
      title: registryBlobs[0]?.blobNameSuffix ?? "Shelby Registry",
      description: registryBlobs[0]
        ? `${shortenValue(registryBlobs[0].owner.toString(), 8, 6)} • ${formatFileSize(registryBlobs[0].size)} • ${getBlobStatus(registryBlobs[0])}`
        : "Browse datasets, ownership details, and commitments from one clean registry view.",
      meta: registryBlobs.length > 0 ? `${registryBlobs.length} live dataset${registryBlobs.length === 1 ? "" : "s"}` : "Connect a wallet to load assets",
      view: "registry" as const,
      toneClassName: styles.collectionSky,
      actionLabel: "Open registry"
    },
    {
      eyebrow: selectedDataset ? "Licensing ready" : "Story licensing",
      title: selectedDataset?.name ?? "Register On Story",
      description: selectedDataset
        ? `${shortenValue(selectedDataset.owner, 8, 6)} • ${selectedDataset.status} • ${formatFileSize(selectedDataset.sizeBytes)}`
        : "Turn a Shelby dataset into a licensable Story IP asset with clear owner controls.",
      meta: hydratedStoryAddress ? shortenValue(hydratedStoryAddress, 8, 6) : "Connect Story wallet",
      view: selectedDataset ? "details" : "upload",
      toneClassName: styles.collectionGold,
      actionLabel: selectedDataset ? "Open details" : "Prepare upload"
    },
    {
      eyebrow: hydratedOwner ? "Wallet activity" : "Discovery",
      title: hydratedOwner ? "Recent Aptos Transactions" : "Search Assets",
      description: hydratedOwner
        ? "Track gas usage, transaction hashes, and recent network activity from the connected owner wallet."
        : "Search by wallet, blob name, or merkle root to jump straight into the matching dataset.",
      meta: submittedQuery ? `Latest query: ${submittedQuery}` : hydratedOwner ? shortenValue(hydratedOwner, 8, 6) : "No wallet connected",
      view: hydratedOwner ? "activity" : "search",
      toneClassName: styles.collectionCrimson,
      actionLabel: hydratedOwner ? "View activity" : "Search now"
    }
  ] as const

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
        setView("details")
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
        <header className={styles.topbar}>
          <form
            className={styles.commandBar}
            onSubmit={(event) => {
              event.preventDefault()
              setView("search")
              void handleDatasetSearch()
            }}
          >
            <Search size={15} className={styles.commandIcon} />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search for assets using wallet, title, or merkle root"
              className={styles.commandInput}
              aria-label="Search for assets"
            />
            <button type="submit" className={styles.commandShortcut}>
              <Command size={12} />
              <span>K</span>
            </button>
          </form>

          <div className={styles.primaryActions}>
            <StoryWalletButton />
            <WalletButton />
          </div>
        </header>

        <div id="overview" className={styles.content}>
          <section className={styles.summaryBar}>
            <div className={styles.heroCopy}>
              <div className={styles.heroBadgeRow}>
                <span className={styles.heroBadge}>Story x Shelby</span>
                <span className={styles.heroBadge}>AI-ready provenance</span>
              </div>

              <p className={styles.kicker}>Intelligent Rights Workspace</p>
              <h1 className={styles.title}>Register, track, and license data in the age of AI</h1>
              <p className={styles.subtitle}>
                Register your datasets on Shelby, trace ownership, and unlock Story licensing without losing the clarity of a modern marketplace interface.
              </p>

              <div className={styles.heroActions}>
                <button
                  type="button"
                  className={styles.heroPrimaryButton}
                  onClick={() => setView(selectedDataset ? "details" : "upload")}
                >
                  Register on Story
                </button>
                <button
                  type="button"
                  className={styles.heroSecondaryButton}
                  onClick={() => setView("registry")}
                >
                  Browse registry
                </button>
              </div>
            </div>

            <div className={styles.summaryMeta}>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Connected wallet</span>
                <span className={styles.metaValue}>{hydratedOwner ? shortenValue(hydratedOwner, 8, 6) : "Not connected"}</span>
              </div>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Selected dataset</span>
                <span className={styles.metaValue}>{activeMetadata ? activeMetadata.blobNameSuffix : "None"}</span>
              </div>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Story wallet</span>
                <span className={styles.metaValue}>{hydratedStoryAddress ? shortenValue(hydratedStoryAddress, 8, 6) : "Not connected"}</span>
              </div>
            </div>
          </section>

          <section className={styles.collectionsSection}>
            <div className={styles.collectionsHeader}>
              <div>
                <p className={styles.panelKicker}>Featured Collections</p>
                <h2 className={styles.panelTitle}>Curated paths into your Shelby and Story workspace</h2>
              </div>
              <p className={styles.collectionsCopy}>
                Each card opens a live part of the product, so the landing experience stays visual while still driving into real data and actions.
              </p>
            </div>

            <div className={styles.collectionGrid}>
              {featuredCollections.map((collection) => (
                <button
                  key={collection.title}
                  type="button"
                  onClick={() => setView(collection.view)}
                  className={`${styles.collectionCard} ${collection.toneClassName}`}
                >
                  <div className={styles.collectionTop}>
                    <span className={styles.collectionEyebrow}>{collection.eyebrow}</span>
                    <span className={styles.collectionMeta}>{collection.meta}</span>
                  </div>
                  <div className={styles.collectionArtwork} aria-hidden="true" />
                  <div className={styles.collectionBody}>
                    <div className={styles.collectionTitle}>{collection.title}</div>
                    <div className={styles.collectionDescription}>{collection.description}</div>
                  </div>
                  <span className={styles.collectionAction}>
                    {collection.actionLabel}
                    <ArrowRight size={16} />
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className={styles.metricGrid}>
            <button
              type="button"
              onClick={() => {
                setSelectedInsight("count")
                setView("overview")
              }}
              className={`${styles.metricCard} ${styles.metricCardButton} ${selectedInsight === "count" && activeView === "overview" ? styles.metricCardActive : ""}`}
            >
              <div className={styles.metricHeader}>
                <span className={styles.metricLabel}>Dataset Count</span>
                <span className={styles.metricStatusGreen}>LIVE</span>
              </div>
              <div className={styles.metricValue}>{registryBlobs.length}</div>
              <div className={styles.metricSubtext}>Registered blobs in your connected Shelby namespace.</div>
              <Sparkline values={sizeSeries} color="#2fb14f" />
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedInsight("storage")
                setView("overview")
              }}
              className={`${styles.metricCard} ${styles.metricCardButton} ${selectedInsight === "storage" && activeView === "overview" ? styles.metricCardActive : ""}`}
            >
              <div className={styles.metricHeader}>
                <span className={styles.metricLabel}>Storage Reserved</span>
                <span className={styles.metricStatusPurple}>MB</span>
              </div>
              <div className={styles.metricValue}>{formatFileSize(totalBytes)}</div>
              <div className={styles.metricSubtext}>Live size of all active datasets in the registry.</div>
              <Sparkline values={searchSeries} color="#df6ea9" />
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedInsight("written")
                setView("overview")
              }}
              className={`${styles.metricCard} ${styles.metricCardButton} ${selectedInsight === "written" && activeView === "overview" ? styles.metricCardActive : ""}`}
            >
              <div className={styles.metricHeader}>
                <span className={styles.metricLabel}>Written Datasets</span>
                <span className={styles.metricStatusGreen}>ACK</span>
              </div>
              <div className={styles.metricValue}>{writtenCount}</div>
              <div className={styles.metricSubtext}>Datasets fully acknowledged by Shelby storage providers.</div>
              <Sparkline values={writtenSeries} color="#2fb14f" />
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedInsight("expiring")
                setView("overview")
              }}
              className={`${styles.metricCard} ${styles.metricCardButton} ${selectedInsight === "expiring" && activeView === "overview" ? styles.metricCardActive : ""}`}
            >
              <div className={styles.metricHeader}>
                <span className={styles.metricLabel}>Expiring Soon</span>
                <span className={styles.metricStatusAmber}>7D</span>
              </div>
              <div className={styles.metricValue}>{expiringSoonCount}</div>
              <div className={styles.metricSubtext}>{uniqueOwners} owner{uniqueOwners === 1 ? "" : "s"} currently represented.</div>
              <Sparkline values={expirySeries} color="#da7b10" />
            </button>
          </section>

          <section className={styles.workspaceBar}>
            <p className={styles.workspaceLabel}>Focused workspace</p>
            <div className={styles.workspaceTabs}>
              {primaryTabs.map((tab) => (
                <button
                  key={`workspace-${tab.view}`}
                  type="button"
                  onClick={() => setView(tab.view)}
                  className={`${styles.workspaceTab} ${activeView === tab.view ? styles.workspaceTabActive : ""}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </section>

          {activeView === "overview" ? (
            <section className={styles.focusPanel}>
              <article className={styles.focusCard}>
                <p className={styles.panelKicker}>Selected Insight</p>
                <h2 className={styles.panelTitle}>{selectedInsightContent[selectedInsight].title}</h2>
                <div className={styles.focusValue}>{selectedInsightContent[selectedInsight].value}</div>
                <p className={styles.focusCopy}>{selectedInsightContent[selectedInsight].summary}</p>
                <p className={styles.focusHelper}>{selectedInsightContent[selectedInsight].helper}</p>
              </article>

              <article className={styles.focusCard}>
                <p className={styles.panelKicker}>Quick Start</p>
                <h2 className={styles.panelTitle}>How to use this dashboard</h2>
                <div className={styles.stepsList}>
                  <button type="button" className={styles.stepItem} onClick={() => setView("upload")}>
                    <span className={styles.stepNumber}>1</span>
                    <span className={styles.stepText}>Upload your file first.</span>
                  </button>
                  <button type="button" className={styles.stepItem} onClick={() => setView("registry")}>
                    <span className={styles.stepNumber}>2</span>
                    <span className={styles.stepText}>Open Registry to choose one dataset.</span>
                  </button>
                  <button type="button" className={styles.stepItem} onClick={() => setView("details")}>
                    <span className={styles.stepNumber}>3</span>
                    <span className={styles.stepText}>Use Details to inspect and monetize only that item.</span>
                  </button>
                </div>
              </article>

              <article className={styles.focusCard}>
                <p className={styles.panelKicker}>Current Selection</p>
                <h2 className={styles.panelTitle}>Dataset preview</h2>
                {selectedDataset ? (
                  <div className={styles.previewCard}>
                    <div className={styles.previewName}>{selectedDataset.name}</div>
                    <div className={styles.previewMeta}>
                      {shortenValue(selectedDataset.owner, 8, 6)} • {formatFileSize(selectedDataset.sizeBytes)} • {selectedDataset.status}
                    </div>
                    <button type="button" className={styles.linkButton} onClick={() => setView("details")}>
                      Open selected dataset
                    </button>
                  </div>
                ) : (
                  <div className={styles.emptyState}>Choose a dataset from Search or Registry to keep the interface focused.</div>
                )}
              </article>
            </section>
          ) : null}

          {activeView === "search" ? (
            <section className={styles.workspacePanelWrap}>
              <article id="search" className={styles.panel}>
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
                        onClick={() => {
                          setSelectedBlobReference(reference)
                          setView("details")
                        }}
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
            </section>
          ) : null}

          {activeView === "details" ? (
            <section className={styles.detailStack}>
              <article id="dataset-details" className={styles.panel}>
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
              <StoryProtocolPanel dataset={selectedDataset} aptosWalletAddress={hydratedOwner} />
            </section>
          ) : null}

          {activeView === "upload" ? (
            <section className={styles.workspacePanelWrap}>
              <article id="upload-dataset" className={styles.panel}>
                <div className={styles.panelHeader}>
                  <div>
                    <p className={styles.panelKicker}>Upload</p>
                    <h2 className={styles.panelTitle}>Register a new dataset</h2>
                  </div>
                </div>

                <div className={styles.helpCard}>
                  Upload one file at a time. After upload, open Registry or Details to inspect that specific dataset clearly.
                </div>

                <UploadDataset
                  onUpload={async () => {
                    const refreshed = await refetch()
                    const latestBlob = [...(refreshed.data ?? [])]
                      .filter((blob) => !blob.isDeleted)
                      .sort((left, right) => right.creationMicros - left.creationMicros)[0]

                    if (latestBlob) {
                      setSelectedBlobReference(getBlobReference(latestBlob))
                      setView("details")
                    }
                  }}
                />
              </article>
            </section>
          ) : null}

          {activeView === "registry" ? (
            <section className={styles.workspacePanelWrap}>
              <article id="dataset-registry" className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <p className={styles.panelKicker}>Dataset Registry</p>
                  <h2 className={styles.panelTitle}>Choose one dataset to inspect</h2>
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

              {!hydratedOwner ? <p className={styles.emptyState}>Connect your wallet to load the live registry.</p> : null}
              {hydratedOwner && isLoading ? <p className={styles.emptyState}>Loading registry...</p> : null}
              {accountBlobsError ? (
                <p className={styles.errorMessage}>
                  {accountBlobsError instanceof Error ? accountBlobsError.message : "Failed to load account blobs"}
                </p>
              ) : null}
              {hydratedOwner && !isLoading && !accountBlobsError && registryBlobs.length === 0 ? (
                <p className={styles.emptyState}>No registered datasets yet.</p>
              ) : null}

              {registryBlobs.length > 0 ? (
                <div className={styles.registryList}>
                  {registryBlobs.map((blob) => {
                    const reference = getBlobReference(blob)
                    const isActive = selectedBlobReference
                      ? getBlobKey(selectedBlobReference) === getBlobKey(reference)
                      : false

                    return (
                      <button
                        type="button"
                        key={getBlobKey(reference)}
                        className={`${styles.registryItem} ${isActive ? styles.registryItemActive : ""}`}
                        onClick={() => {
                          setSelectedBlobReference(reference)
                          setView("details")
                        }}
                      >
                        <div className={styles.registryMain}>
                          <div className={styles.resultName}>{blob.blobNameSuffix}</div>
                          <div className={styles.resultMeta}>
                            {shortenValue(blob.owner.toString(), 8, 6)} • {formatFileSize(blob.size)}
                          </div>
                        </div>
                        <div className={styles.registrySide}>
                          <span className={styles.rowBadge}>{getBlobStatus(blob)}</span>
                          <span className={styles.registryDate}>Created {formatMicrosTimestamp(blob.creationMicros)}</span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              ) : null}
            </article>
            </section>
          ) : null}

          {activeView === "activity" ? (
            <section className={styles.workspacePanelWrap}>
              <div id="activity" className={styles.activityPanel}>
              <WalletTransactions />
              </div>
            </section>
          ) : null}

          <footer className={styles.pageFooter}>
            <div className={styles.footerLinks}>
              <a href="https://docs.shelby.xyz" target="_blank" rel="noreferrer" className={styles.footerLink}>Docs</a>
              <a href="https://explorer.shelby.xyz" target="_blank" rel="noreferrer" className={styles.footerLink}>Shelby Explorer</a>
              <a href="https://www.story.foundation" target="_blank" rel="noreferrer" className={styles.footerLink}>Story Protocol</a>
            </div>

            <div className={styles.footerStatus}>
              <span className={styles.footerPill}>Shelby Storage</span>
              <span className={styles.footerPill}>Story Licensing</span>
            </div>
          </footer>
        </div>
      </div>
    </div>
  )
}

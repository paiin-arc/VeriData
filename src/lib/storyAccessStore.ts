"use client"

export type StoryRegistrationRecord = {
  datasetKey: string
  datasetName: string
  shelbyOwner: string
  shelbyExplorerUrl: string
  merkleRoot: string
  storyOwner: string
  spgNftContract: string
  ipId: string
  tokenId: string
  txHash: string
  licenseTermsId: string
  storyMintFee: string
  aptPrice: string
  commercialRevShare: number
  createdAt: number
}

export type StoryAccessReceipt = {
  datasetKey: string
  walletAddress: string
  mode: "story-license" | "apt-payment"
  tokenSymbol: "WIP" | "APT"
  amount: string
  txHash: string
  createdAt: number
}

const REGISTRATIONS_KEY = "veridata:story:registrations"
const COLLECTIONS_KEY = "veridata:story:collections"
const RECEIPTS_KEY = "veridata:story:receipts"

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined"
}

function readJson<T>(key: string, fallback: T): T {
  if (!canUseStorage()) {
    return fallback
  }

  const raw = window.localStorage.getItem(key)

  if (!raw) {
    return fallback
  }

  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function writeJson<T>(key: string, value: T) {
  if (!canUseStorage()) {
    return
  }

  window.localStorage.setItem(key, JSON.stringify(value))
}

export function getDatasetKey(owner: string, name: string): string {
  return `${owner.trim().toLowerCase()}::${name.trim()}`
}

export function getStoryRegistration(datasetKey: string): StoryRegistrationRecord | null {
  const registrations = readJson<Record<string, StoryRegistrationRecord>>(REGISTRATIONS_KEY, {})
  return registrations[datasetKey] ?? null
}

export function saveStoryRegistration(record: StoryRegistrationRecord): StoryRegistrationRecord {
  const registrations = readJson<Record<string, StoryRegistrationRecord>>(REGISTRATIONS_KEY, {})

  registrations[record.datasetKey] = record
  writeJson(REGISTRATIONS_KEY, registrations)

  return record
}

export function getStoryCollectionForWallet(walletAddress: string): string | null {
  const collections = readJson<Record<string, string>>(COLLECTIONS_KEY, {})
  return collections[walletAddress.trim().toLowerCase()] ?? null
}

export function saveStoryCollectionForWallet(walletAddress: string, spgNftContract: string) {
  const collections = readJson<Record<string, string>>(COLLECTIONS_KEY, {})

  collections[walletAddress.trim().toLowerCase()] = spgNftContract
  writeJson(COLLECTIONS_KEY, collections)
}

export function getStoryAccessReceipts(datasetKey: string): StoryAccessReceipt[] {
  const receipts = readJson<StoryAccessReceipt[]>(RECEIPTS_KEY, [])

  return receipts
    .filter((receipt) => receipt.datasetKey === datasetKey)
    .sort((left, right) => right.createdAt - left.createdAt)
}

export function saveStoryAccessReceipt(receipt: StoryAccessReceipt): StoryAccessReceipt {
  const receipts = readJson<StoryAccessReceipt[]>(RECEIPTS_KEY, [])

  receipts.unshift(receipt)
  writeJson(RECEIPTS_KEY, receipts)

  return receipt
}

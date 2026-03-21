"use client"

import { StoryClient } from "@story-protocol/core-sdk"
import { custom, type Hex, type WalletClient } from "viem"

const STORY_SCAN_BASE_URL = "https://aeneid.storyscan.io"

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ""

  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary)
}

function encodeJsonDataUri(value: unknown): string {
  const json = JSON.stringify(value)
  const bytes = new TextEncoder().encode(json)
  return `data:application/json;base64,${bytesToBase64(bytes)}`
}

export async function sha256Hex(value: string | Uint8Array): Promise<Hex> {
  const source = typeof value === "string" ? new TextEncoder().encode(value) : value
  const digestInput = source.slice().buffer as ArrayBuffer
  const digest = await crypto.subtle.digest("SHA-256", digestInput)

  return `0x${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")}` as Hex
}

export function createStoryClient(wallet: WalletClient) {
  return StoryClient.newClient({
    wallet,
    transport: custom(wallet.transport),
    chainId: "aeneid"
  })
}

export function getStoryTransactionUrl(txHash: string): string {
  return `${STORY_SCAN_BASE_URL}/tx/${txHash}`
}

export function getStoryAddressUrl(address: string): string {
  return `${STORY_SCAN_BASE_URL}/address/${address}`
}

export function buildStoryCollectionContractUri(ownerAddress: string): string {
  return encodeJsonDataUri({
    name: "VeriData Rights Collection",
    description: "Shelby-backed datasets registered as Story IP assets through VeriData.",
    external_link: STORY_SCAN_BASE_URL,
    owner: ownerAddress
  })
}

type BuildStoryRegistrationMetadataInput = {
  blobName: string
  shelbyOwner: string
  storyOwner: string
  shelbyExplorerUrl: string
  merkleRoot: string
  sizeBytes: number
  storyMintFee: string
  aptPrice: string
  commercialRevShare: number
}

export async function buildStoryRegistrationMetadata(
  input: BuildStoryRegistrationMetadataInput
) {
  const ipMetadata = {
    title: input.blobName,
    description: "Shelby dataset registered on Story through VeriData.",
    mediaUrl: input.shelbyExplorerUrl,
    mediaHash: input.merkleRoot,
    mediaType: "application/octet-stream",
    external_url: input.shelbyExplorerUrl
  }

  const nftMetadata = {
    name: `${input.blobName} Ownership NFT`,
    description: `Ownership NFT for ${input.blobName}.`,
    external_url: input.shelbyExplorerUrl
  }

  return {
    ipMetadataURI: encodeJsonDataUri(ipMetadata),
    ipMetadataHash: await sha256Hex(JSON.stringify(ipMetadata)),
    nftMetadataURI: encodeJsonDataUri(nftMetadata),
    nftMetadataHash: await sha256Hex(JSON.stringify(nftMetadata))
  }
}

"use client"

import { Network } from "@aptos-labs/ts-sdk"
import { ShelbyClient } from "@shelby-protocol/sdk/browser"

function requireShelbyApiKey(): string {
  const apiKey =
    process.env.NEXT_PUBLIC_TESTNET_API_KEY ??
    process.env.NEXT_PUBLIC_SHELBY_API_KEY

  if (!apiKey) {
    throw new Error(
      "Missing Shelby browser API key. Set NEXT_PUBLIC_TESTNET_API_KEY or NEXT_PUBLIC_SHELBY_API_KEY."
    )
  }

  return apiKey
}

export const shelbyBrowserClient = new ShelbyClient({
  network: Network.TESTNET,
  apiKey: requireShelbyApiKey()
})

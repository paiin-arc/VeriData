import "server-only"

import { Account, Ed25519PrivateKey, Network } from "@aptos-labs/ts-sdk"
import { ShelbyNodeClient } from "@shelby-protocol/sdk/node"

type ServerEnvKey = "APTOS_PRIVATE_KEY" | "SHELBY_API_KEY"

let shelbyClient: ShelbyNodeClient | undefined
let backendSigner: Account | undefined

function requireEnv(key: ServerEnvKey): string {
  const value = process.env[key]

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`)
  }

  return value
}

export function getShelbyClient(): ShelbyNodeClient {
  if (!shelbyClient) {
    shelbyClient = new ShelbyNodeClient({
      network: Network.TESTNET,
      apiKey: requireEnv("SHELBY_API_KEY")
    })
  }

  return shelbyClient
}

export function getBackendSigner(): Account {
  if (!backendSigner) {
    backendSigner = Account.fromPrivateKey({
      privateKey: new Ed25519PrivateKey(requireEnv("APTOS_PRIVATE_KEY"))
    })
  }

  return backendSigner
}

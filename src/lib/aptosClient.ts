import "server-only"

import { Aptos, AptosConfig, ClientConfig, Network } from "@aptos-labs/ts-sdk"

const DEFAULT_APTOS_FULLNODE_URL = "https://api.testnet.aptoslabs.com/v1"
const DEFAULT_APTOS_INDEXER_URL = "https://api.testnet.aptoslabs.com/v1/graphql"

let aptosClient: Aptos | undefined

function normalizeEnvValue(value: string | undefined): string | undefined {
  if (!value) {
    return undefined
  }

  if (
    value.includes("your-server-testnet-key") ||
    value.includes("your_geomi_aptos_testnet_api_key")
  ) {
    return undefined
  }

  return value
}

function getAptosApiKey(): string | undefined {
  return normalizeEnvValue(
    process.env.APTOS_API_KEY ??
    process.env.TESTNET_API_KEY
  )
}

export function getAptosClient(): Aptos {
  if (!aptosClient) {
    const apiKey = getAptosApiKey()
    const clientConfig: ClientConfig | undefined = apiKey
      ? {
          API_KEY: apiKey
        }
      : undefined

    aptosClient = new Aptos(
      new AptosConfig({
        network: Network.TESTNET,
        fullnode: process.env.APTOS_FULLNODE_URL ?? DEFAULT_APTOS_FULLNODE_URL,
        indexer: process.env.APTOS_INDEXER_API_URL ?? DEFAULT_APTOS_INDEXER_URL,
        clientConfig
      })
    )
  }

  return aptosClient
}

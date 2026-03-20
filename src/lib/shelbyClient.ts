import { ShelbyNodeClient } from "@shelby-protocol/sdk/node"
import { Network } from "@aptos-labs/ts-sdk"

export const shelbyClient = new ShelbyNodeClient({
  network: Network.TESTNET,
  apiKey: process.env.SHELBY_API_KEY!
})

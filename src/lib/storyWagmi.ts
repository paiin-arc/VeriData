"use client"

import { createConfig, http, injected } from "wagmi"
import { storyAeneid } from "viem/chains"

export const storyRpcUrl =
  process.env.NEXT_PUBLIC_STORY_RPC_URL ??
  storyAeneid.rpcUrls.default.http[0]

export const storyWagmiConfig = createConfig({
  chains: [storyAeneid],
  connectors: [injected()],
  transports: {
    [storyAeneid.id]: http(storyRpcUrl)
  }
})

export { storyAeneid }

"use client"

import { AptosWalletAdapterProvider } from "@aptos-labs/wallet-adapter-react"
import { ShelbyClientProvider } from "@shelby-protocol/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import { shelbyBrowserClient } from "@/lib/shelbyBrowserClient"

const queryClient = new QueryClient()

export default function WalletProvider({
  children,
}: {
  children: React.ReactNode
}) {

  return (
    <AptosWalletAdapterProvider autoConnect={false}>
      <QueryClientProvider client={queryClient}>
        <ShelbyClientProvider client={shelbyBrowserClient}>
          {children}
        </ShelbyClientProvider>
      </QueryClientProvider>
    </AptosWalletAdapterProvider>
  )
}

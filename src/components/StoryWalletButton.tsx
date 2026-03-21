"use client"

import { useState, useSyncExternalStore } from "react"
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi"

import { storyAeneid } from "@/lib/storyWagmi"

import styles from "./StoryWalletButton.module.css"

function shortenAddress(value: string): string {
  return `${value.slice(0, 6)}...${value.slice(-4)}`
}

function subscribeToHydration() {
  return () => {}
}

export default function StoryWalletButton() {
  const [localError, setLocalError] = useState<string | null>(null)
  const { address, isConnected, chainId } = useAccount()
  const { connectors, connectAsync, isPending: isConnecting, error: connectError } = useConnect()
  const { disconnect } = useDisconnect()
  const { switchChainAsync, isPending: isSwitching, error: switchError } = useSwitchChain()
  const hasMounted = useSyncExternalStore(subscribeToHydration, () => true, () => false)

  const hydratedIsConnected = hasMounted && isConnected
  const isWrongChain = hydratedIsConnected && chainId !== storyAeneid.id
  const feedback = localError ?? connectError?.message ?? switchError?.message ?? null

  const handleConnect = async () => {
    const connector = connectors[0]

    if (!connector) {
      setLocalError("Install an injected EVM wallet like MetaMask to connect Story.")
      return
    }

    try {
      setLocalError(null)
      await connectAsync({ connector, chainId: storyAeneid.id })
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "Story wallet connection failed")
    }
  }

  const handleSwitchChain = async () => {
    try {
      setLocalError(null)
      await switchChainAsync({ chainId: storyAeneid.id })
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "Failed to switch to Story Aeneid")
    }
  }

  return (
      <div className={styles.wrap}>
      {!hydratedIsConnected ? (
        <button
          type="button"
          onClick={() => {
            void handleConnect()
          }}
          disabled={isConnecting}
          className={styles.primaryButton}
        >
          {isConnecting ? "Connecting..." : "Story"}
        </button>
      ) : null}

      {hydratedIsConnected && isWrongChain ? (
        <div className={styles.connectedState}>
          <span className={styles.chainPill}>Wrong chain</span>
          <button
            type="button"
            onClick={() => {
              void handleSwitchChain()
            }}
            disabled={isSwitching}
            className={styles.secondaryButton}
          >
            {isSwitching ? "Switching..." : "Switch Story"}
          </button>
        </div>
      ) : null}

      {hydratedIsConnected && !isWrongChain && address ? (
        <div className={styles.connectedState}>
          <span className={styles.addressPill}>{shortenAddress(address)}</span>
          <button type="button" onClick={() => disconnect()} className={styles.secondaryButton}>
            Disconnect
          </button>
        </div>
      ) : null}

      {feedback ? <p className={styles.error}>{feedback}</p> : null}
    </div>
  )
}

"use client"

import { useState } from "react"
import { useWallet } from "@aptos-labs/wallet-adapter-react"

import styles from "./WalletButton.module.css"

function shortenAddress(value: string): string {
  return `${value.slice(0, 6)}...${value.slice(-4)}`
}

export default function WalletButton() {
  const { connect, disconnect, account, connected, wallets } = useWallet()
  const [error, setError] = useState<string | null>(null)

  const connectWallet = async () => {
    if (wallets.length === 0) {
      setError("No Aptos wallet was detected in this browser.")
      return
    }

    try {
      setError(null)
      await connect(wallets[0].name)
    } catch (connectError) {
      setError(connectError instanceof Error ? connectError.message : "Wallet connection failed")
    }
  }

  const address = account?.address?.toString()

  return (
    <div className={styles.wrap}>
      {!connected && (
        <button onClick={connectWallet} className={styles.primaryButton}>
          Connect Wallet
        </button>
      )}

      {connected && address ? (
        <div className={styles.connectedState}>
          <span className={styles.addressPill}>{shortenAddress(address)}</span>
          <button onClick={disconnect} className={styles.secondaryButton}>
            Disconnect
          </button>
        </div>
      ) : null}

      {error ? <p className={styles.error}>{error}</p> : null}
    </div>
  )
}

"use client"

import { useEffect, useState } from "react"
import { useWallet } from "@aptos-labs/wallet-adapter-react"

import styles from "./WalletTransactions.module.css"

type WalletTransaction = {
  version: string
  hash: string
  type: string
  sender: string | null
  success: boolean | null
  vmStatus: string | null
  timestamp: string | null
  sequenceNumber: string | null
  gasUsed: string | null
  function: string | null
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Failed to load wallet transactions"
}

function shortenValue(value: string, prefixLength = 10, suffixLength = 8): string {
  if (value.length <= prefixLength + suffixLength) {
    return value
  }

  return `${value.slice(0, prefixLength)}...${value.slice(-suffixLength)}`
}

function formatTimestamp(timestamp: string | null): string {
  if (!timestamp) {
    return "Pending"
  }

  const milliseconds = Number(timestamp) / 1000

  if (!Number.isFinite(milliseconds)) {
    return timestamp
  }

  return new Date(milliseconds).toLocaleString()
}

export default function WalletTransactions() {
  const { account } = useWallet()
  const address = account?.address?.toString()

  const [transactions, setTransactions] = useState<WalletTransaction[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!address) {
      setTransactions([])
      setError(null)
      return
    }

    let cancelled = false
    const controller = new AbortController()

    const loadTransactions = async () => {
      setLoading(true)
      setError(null)

      try {
        const response = await fetch(
          `/api/wallet-transactions?address=${encodeURIComponent(address)}`,
          {
            signal: controller.signal
          }
        )

        const body = await response.text()
        let data: { error?: string; transactions?: WalletTransaction[] } = {}

        if (body) {
          try {
            data = JSON.parse(body) as { error?: string; transactions?: WalletTransaction[] }
          } catch {
            data = {
              error: body
            }
          }
        }

        if (!response.ok) {
          throw new Error(data.error ?? "Failed to load wallet transactions")
        }

        if (!cancelled) {
          setTransactions(data.transactions ?? [])
        }
      } catch (loadError) {
        if (!cancelled && !controller.signal.aborted) {
          setError(getErrorMessage(loadError))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadTransactions()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [address])

  return (
    <section className={styles.card}>
      <div className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Wallet Activity</p>
          <h2 className={styles.title}>Recent Aptos transactions</h2>
        </div>
        {address ? <span className={styles.address}>{shortenValue(address)}</span> : null}
      </div>

      {!address ? <p className={styles.emptyState}>Connect your wallet to load Aptos Testnet transactions.</p> : null}
      {address && loading ? <p className={styles.emptyState}>Loading wallet transactions...</p> : null}
      {error ? <p className={styles.error}>{error}</p> : null}
      {address && !loading && !error && transactions.length === 0 ? (
        <p className={styles.emptyState}>No recent wallet transactions found.</p>
      ) : null}

      {transactions.length > 0 ? (
        <div className={styles.list}>
          {transactions.map((transaction) => (
            <article key={transaction.hash} className={styles.item}>
              <div className={styles.itemHeader}>
                <p className={styles.functionName}>{transaction.function ?? transaction.type}</p>
                <span className={transaction.success ? styles.successBadge : styles.pendingBadge}>
                  {transaction.success ? "Success" : transaction.vmStatus ?? "Pending"}
                </span>
              </div>

              <div className={styles.metaGrid}>
                <div>
                  <span className={styles.metaLabel}>Hash</span>
                  <span className={styles.metaValue}>{shortenValue(transaction.hash)}</span>
                </div>
                <div>
                  <span className={styles.metaLabel}>Version</span>
                  <span className={styles.metaValue}>{transaction.version}</span>
                </div>
                <div>
                  <span className={styles.metaLabel}>Gas Used</span>
                  <span className={styles.metaValue}>{transaction.gasUsed ?? "--"}</span>
                </div>
                <div>
                  <span className={styles.metaLabel}>Time</span>
                  <span className={styles.metaValue}>{formatTimestamp(transaction.timestamp)}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  )
}

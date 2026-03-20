"use client"

import { useState } from "react"
import { useWallet } from "@aptos-labs/wallet-adapter-react"
import { useUploadBlobs } from "@shelby-protocol/react"

import styles from "./UploadDataset.module.css"

type UploadDatasetProps = {
  onUpload?: () => void | Promise<void>
}

const DEFAULT_UPLOAD_MAX_GAS_AMOUNT = 20_000

function getUploadMaxGasAmount(): number {
  const configuredValue = process.env.NEXT_PUBLIC_SHELBY_UPLOAD_MAX_GAS_AMOUNT

  if (!configuredValue) {
    return DEFAULT_UPLOAD_MAX_GAS_AMOUNT
  }

  const parsedValue = Number(configuredValue)

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return DEFAULT_UPLOAD_MAX_GAS_AMOUNT
  }

  return parsedValue
}

function getErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "Upload failed"

  if (message.includes("MAX_GAS_UNITS_BELOW_MIN_TRANSACTION_GAS_UNITS")) {
    return "Upload simulation failed because the wallet used too little gas. Increase NEXT_PUBLIC_SHELBY_UPLOAD_MAX_GAS_AMOUNT if this persists."
  }

  return message
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }

  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export default function UploadDataset({ onUpload }: UploadDatasetProps) {
  const { account, connected, signAndSubmitTransaction } = useWallet()
  const uploadBlobs = useUploadBlobs({})

  const [file, setFile] = useState<File | null>(null)
  const [feedback, setFeedback] = useState<{ tone: "error" | "success"; message: string } | null>(null)
  const [inputKey, setInputKey] = useState(0)

  const upload = async () => {
    if (!connected || !account || !signAndSubmitTransaction) {
      setFeedback({
        tone: "error",
        message: "Connect your wallet before registering data on Shelby."
      })
      return
    }

    if (!file) {
      setFeedback({
        tone: "error",
        message: "Choose a file first."
      })
      return
    }

    try {
      setFeedback(null)

      const blobData = new Uint8Array(await file.arrayBuffer())

      await uploadBlobs.mutateAsync({
        signer: {
          account,
          signAndSubmitTransaction
        },
        blobs: [
          {
            blobName: file.name,
            blobData
          }
        ],
        expirationMicros: Date.now() * 1000 + 86400_000_000,
        options: {
          build: {
            options: {
              maxGasAmount: getUploadMaxGasAmount()
            }
          }
        }
      })

      await onUpload?.()

      setFeedback({
        tone: "success",
        message: `${file.name} was registered and uploaded to Shelby successfully.`
      })
      setFile(null)
      setInputKey((currentKey) => currentKey + 1)
    } catch (error) {
      console.error("Upload error:", error)
      setFeedback({
        tone: "error",
        message: getErrorMessage(error)
      })
    }
  }

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Shelby SDK Registration</p>
          <h3 className={styles.title}>Register a dataset</h3>
        </div>
        <span className={styles.gasPill}>Max gas {getUploadMaxGasAmount()}</span>
      </div>

      <p className={styles.summary}>
        Upload a file, sign once with your wallet, and let Shelby create the live ownership record.
      </p>

      <div className={styles.controls}>
        <label className={styles.filePicker}>
          <input
            key={inputKey}
            type="file"
            onChange={(event) => {
              setFile(event.target.files?.[0] || null)
              setFeedback(null)
            }}
            className={styles.hiddenInput}
          />
          <span className={styles.filePickerText}>Choose file</span>
        </label>

        <button
          onClick={upload}
          disabled={uploadBlobs.isPending}
          className={styles.uploadButton}
        >
          {uploadBlobs.isPending ? "Registering..." : "Register Dataset"}
        </button>
      </div>

      <div className={styles.fileMetaCard}>
        <div className={styles.fileMetaLabel}>Selected asset</div>
        <div className={styles.fileMetaValue}>{file ? file.name : "No file selected yet"}</div>
        <div className={styles.fileMetaHint}>{file ? formatFileSize(file.size) : "Any dataset format is supported"}</div>
      </div>

      {feedback ? (
        <p
          className={feedback.tone === "success" ? styles.successMessage : styles.errorMessage}
        >
          {feedback.message}
        </p>
      ) : null}
    </div>
  )
}

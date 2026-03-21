"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import {
  Activity,
  Compass,
  Database,
  FileStack,
  Info,
  Plus,
  type LucideIcon
} from "lucide-react"

import styles from "./Sidebar.module.css"

type NavItem = {
  label: string
  href: string
  icon: LucideIcon
  activeHash: string
  external?: boolean
}

const workspaceItems: readonly NavItem[] = [
  { label: "Home", href: "/#overview", icon: Compass, activeHash: "#overview" },
  { label: "Upload", href: "/#upload-dataset", icon: Plus, activeHash: "#upload-dataset" },
  { label: "Registry", href: "/#dataset-registry", icon: Database, activeHash: "#dataset-registry" },
  { label: "Details", href: "/#dataset-details", icon: FileStack, activeHash: "#dataset-details" },
  { label: "Activity", href: "/#activity", icon: Activity, activeHash: "#activity" }
] as const

const utilityItems: readonly NavItem[] = [
  { label: "Docs", href: "https://docs.shelby.xyz", icon: Info, activeHash: "", external: true }
] as const

export default function Sidebar() {
  const [activeHash, setActiveHash] = useState("#overview")

  useEffect(() => {
    const syncHash = () => {
      setActiveHash(window.location.hash || "#overview")
    }

    syncHash()
    window.addEventListener("hashchange", syncHash)
    window.addEventListener("veridatahashchange", syncHash)

    return () => {
      window.removeEventListener("hashchange", syncHash)
      window.removeEventListener("veridatahashchange", syncHash)
    }
  }, [])

  return (
    <aside className={styles.sidebar}>
      <Link href="/#overview" className={styles.logoButton} aria-label="Open VeriData home">
        <span className={styles.logoShell}>
          <Image src="/shelby-logo.png" alt="Shelby Logo" width={34} height={34} />
        </span>
      </Link>

      <nav className={styles.rail} aria-label="Workspace navigation">
        {workspaceItems.map((item) => {
          const Icon = item.icon
          const isActive = activeHash === item.activeHash

          return (
            <Link
              key={item.label}
              href={item.href}
              title={item.label}
              onClick={() => setActiveHash(item.activeHash)}
              className={`${styles.railButton} ${isActive ? styles.railButtonActive : ""}`}
            >
              <Icon size={22} strokeWidth={2.2} />
              <span className={styles.railLabel}>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      <div className={styles.sidebarSpacer} />

      <div className={styles.footerDock}>
        {utilityItems.map((item) => {
          const Icon = item.icon

          return (
            <a
              key={item.label}
              href={item.href}
              title={item.label}
              target={item.external ? "_blank" : undefined}
              rel={item.external ? "noreferrer" : undefined}
              className={styles.utilityButton}
            >
              <Icon size={20} strokeWidth={2.2} />
              <span className={styles.railLabel}>{item.label}</span>
            </a>
          )
        })}

        <div className={styles.statusCard}>
          <div className={styles.statusTitle}>Story x Shelby</div>
          <div className={styles.statusMeta}>AI rights rail</div>
        </div>
      </div>
    </aside>
  )
}

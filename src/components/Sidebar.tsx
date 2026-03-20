"use client"

import { useState, type ChangeEvent } from "react"
import Image from "next/image"

import styles from "./Sidebar.module.css"

const workspaceLinks = [
  {
    label: "Dashboard",
    description: "Overview and live insights",
    href: "/#overview"
  },
  {
    label: "Dataset Registry",
    description: "Browse uploaded assets",
    href: "/#dataset-registry"
  },
  {
    label: "Upload Dataset",
    description: "Send new blobs to Shelby",
    href: "/#upload-dataset"
  },
  {
    label: "Dataset Details",
    description: "Inspect hashes and metadata",
    href: "/#dataset-details"
  }
] as const

const resourceLinks = [
  {
    label: "Shelby Explorer",
    description: "Watch network activity live",
    href: "https://explorer.shelby.xyz",
    external: true,
    badge: "LIVE"
  },
  {
    label: "Documentation",
    description: "SDKs, uploads, and guides",
    href: "https://docs.shelby.xyz",
    external: true,
    badge: "DOCS"
  }
] as const

export default function Sidebar() {
  const [image, setImage] = useState<string | null>(null)
  const [bio, setBio] = useState("")
  const [twitter, setTwitter] = useState("")
  const [activeItem, setActiveItem] = useState("Dashboard")
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const handleImageUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]

    if (!file) return

    const reader = new FileReader()

    reader.onload = () => {
      setImage(reader.result as string)
    }

    reader.readAsDataURL(file)
  }

  const handleNavigation = (label: string) => {
    setActiveItem(label)
    setIsMenuOpen(false)
  }

  return (
    <>
      <div
        className={`${styles.backdrop} ${isMenuOpen ? styles.backdropVisible : ""}`}
        onClick={() => setIsMenuOpen(false)}
        aria-hidden={!isMenuOpen}
      />

      <aside className={styles.sidebar}>
        <div className={styles.mobileHeader}>
          <div className={styles.mobileBrand}>
            <div className={styles.mobileLogoShell}>
              <Image src="/shelby-logo.png" alt="Shelby Logo" width={26} height={26} />
            </div>
            <div className={styles.mobileBrandText}>
              <div className={styles.mobileBrandLabel}>VeriData</div>
              <div className={styles.mobileBrandTitle}>Shelby workspace</div>
            </div>
          </div>

          <button
            type="button"
            className={styles.mobileToggle}
            onClick={() => setIsMenuOpen((currentValue) => !currentValue)}
            aria-expanded={isMenuOpen}
            aria-controls="veridata-sidebar-content"
          >
            {isMenuOpen ? "Close" : "Menu"}
          </button>
        </div>

        <div
          id="veridata-sidebar-content"
          className={`${styles.sidebarContent} ${isMenuOpen ? styles.sidebarContentOpen : ""}`}
        >
          <div className={styles.brandCard}>
            <div className={styles.brandTop}>
              <div>
                <div className={styles.brandBadge}>Data Trust Layer</div>
                <h2 className={styles.brandTitle}>VeriData</h2>
              </div>

              <div className={styles.brandLogoShell}>
                <Image src="/shelby-logo.png" alt="Shelby Logo" width={28} height={28} />
              </div>
            </div>

            <p className={styles.brandSubtitle}>
              Secure dataset discovery, uploads, and provenance tracking on Shelby.
            </p>

            <div className={styles.statusRow}>
              <span className={styles.statusPill}>Powered by Shelby</span>
              <span className={styles.statusMeta}>Brand-aligned dashboard</span>
            </div>
          </div>

          <div className={styles.navSection}>
            <div className={styles.sectionLabel}>Workspace</div>
            <div className={styles.navList}>
              {workspaceLinks.map((item) => {
                const isActive = activeItem === item.label

                return (
                  <a
                    key={item.label}
                    href={item.href}
                    onClick={() => handleNavigation(item.label)}
                    className={`${styles.navItem} ${isActive ? styles.navItemActive : ""}`}
                  >
                    <span className={styles.navGlowDot} />
                    <span className={styles.navTextWrap}>
                      <span className={styles.navLabel}>{item.label}</span>
                      <span className={styles.navDescription}>{item.description}</span>
                    </span>
                    <span className={styles.navArrow}>Go</span>
                  </a>
                )
              })}
            </div>
          </div>

          <div className={styles.navSection}>
            <div className={styles.sectionLabel}>Resources</div>
            <div className={styles.navList}>
              {resourceLinks.map((item) => {
                const isActive = activeItem === item.label

                return (
                  <a
                    key={item.label}
                    href={item.href}
                    target={item.external ? "_blank" : undefined}
                    rel={item.external ? "noreferrer" : undefined}
                    onClick={() => handleNavigation(item.label)}
                    className={`${styles.navItem} ${isActive ? styles.navItemActive : ""}`}
                  >
                    <span className={styles.navGlowDot} />
                    <span className={styles.navTextWrap}>
                      <span className={styles.navLabel}>{item.label}</span>
                      <span className={styles.navDescription}>{item.description}</span>
                    </span>
                    <span className={styles.navBadge}>{item.badge}</span>
                  </a>
                )
              })}
            </div>
          </div>

          <div className={styles.profileCard}>
            <div className={styles.sectionLabel}>Creator Card</div>

            <div className={styles.profileHeader}>
              <label className={styles.avatarShell}>
                {image ? (
                  <Image
                    src={image}
                    alt="Profile"
                    fill
                    unoptimized
                    sizes="74px"
                    className={styles.avatarImage}
                  />
                ) : (
                  <span className={styles.avatarPlaceholder}>Upload</span>
                )}

                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className={styles.hiddenInput}
                />
              </label>

              <div className={styles.profileMeta}>
                <div className={styles.profileTitle}>Your Shelby Identity</div>
                <div className={styles.profileHint}>Add a photo, short bio, and your social link.</div>
              </div>
            </div>

            <textarea
              placeholder="Add your bio..."
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              className={styles.textarea}
            />

            <input
              placeholder="Twitter / social link"
              value={twitter}
              onChange={(event) => setTwitter(event.target.value)}
              className={styles.input}
            />
          </div>

          <div className={styles.footerCard}>
            <div className={styles.footerLogoShell}>
              <Image src="/shelby-logo.png" alt="Shelby Logo" width={34} height={34} />
            </div>

            <div className={styles.footerCopy}>
              <div className={styles.footerEyebrow}>Powered by Shelby</div>
              <div className={styles.footerTitle}>Decentralized data storage</div>
              <div className={styles.footerSubtitle}>Purpose-built for trusted uploads.</div>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}

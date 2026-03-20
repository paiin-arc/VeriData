import type { CSSProperties, ReactNode } from "react"

import styles from "./StatsCard.module.css"

type StatsCardProps = {
  title: string
  value: string | number
  description: string
  accent?: string
  icon?: ReactNode
}

export default function StatsCard({
  title,
  value,
  description,
  accent = "rgba(244, 114, 182, 0.55)",
  icon
}: StatsCardProps) {
  return (
    <article
      className={styles.card}
      style={
        {
          "--stat-accent": accent
        } as CSSProperties
      }
    >
      <div className={styles.header}>
        <p className={styles.title}>{title}</p>
        {icon ? <span className={styles.icon}>{icon}</span> : null}
      </div>

      <div className={styles.value}>{value}</div>
      <p className={styles.description}>{description}</p>
    </article>
  )
}

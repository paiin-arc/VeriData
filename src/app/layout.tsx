import "./globals.css"
import Sidebar from "@/components/Sidebar"
import WalletProvider from "@/components/WalletProvider"
import styles from "./layout.module.css"

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <WalletProvider>
          <div className={styles.appShell}>
            <Sidebar />
            <main className={styles.main}>
              <div className={styles.mainInner}>{children}</div>
            </main>
          </div>
        </WalletProvider>
      </body>
    </html>
  )
}

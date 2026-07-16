import type { Metadata } from "next"
import { DM_Sans } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/context/ThemeContext"
import Nav from "@/components/Nav"

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal"],
})

export const metadata: Metadata = {
  title: "Ledger",
  description: "Personal investment tracker",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={dmSans.variable} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('ledger-theme')||'light';document.documentElement.classList.add(t);}catch(e){document.documentElement.classList.add('light');}})();`,
          }}
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&family=Instrument+Serif:ital@1&display=swap"
        />
      </head>
      <body style={{ fontFamily: "var(--font-dm-sans)" }}>
        <ThemeProvider>
          <Nav />
          <div
            style={{
              background: "var(--color-bg)",
              minHeight: "calc(100vh - 52px)",
            }}
          >
            <div
              className="main-content-wrapper"
              style={{
                maxWidth: "1280px",
                margin: "0 auto",
                padding: "36px 40px",
              }}
            >
              {children}
            </div>
          </div>
        </ThemeProvider>
      </body>
    </html>
  )
}

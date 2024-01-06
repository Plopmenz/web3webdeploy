import "@/styles/globals.css"
import "@rainbow-me/rainbowkit/styles.css"

import { Metadata, Viewport } from "next"
import { config as dotEnvConfig } from "dotenv"
import { WagmiConfig } from "wagmi"

import { siteConfig } from "@/config/site"
import { config } from "@/config/wagmi-config"
import { fontSans } from "@/lib/fonts"
import { cn } from "@/lib/utils"
import { ThemedRaindbowProvider } from "@/components/custom/themed-rainbow-provider"
import { SiteHeader } from "@/components/site-header"
import { TailwindIndicator } from "@/components/tailwind-indicator"
import { ThemeProvider } from "@/components/theme-provider"

// Make configurable path
dotEnvConfig({ path: "../.env" })

export const metadata: Metadata = {
  title: {
    default: siteConfig.name,
    template: `%s - ${siteConfig.name}`,
  },
  description: siteConfig.description,
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon-16x16.png",
    apple: "/apple-touch-icon.png",
  },
}
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "white" },
    { media: "(prefers-color-scheme: dark)", color: "black" },
  ],
}

interface RootLayoutProps {
  children: React.ReactNode
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <>
      <html lang="en" suppressHydrationWarning>
        <head />
        <body
          className={cn(
            "min-h-screen bg-background font-sans antialiased",
            fontSans.variable
          )}
        >
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <WagmiConfig config={config}>
              <ThemedRaindbowProvider>
                <div className="relative flex min-h-screen flex-col">
                  <SiteHeader />
                  <div className="flex-1">{children}</div>
                </div>
                <TailwindIndicator />{" "}
              </ThemedRaindbowProvider>
            </WagmiConfig>
          </ThemeProvider>
        </body>
      </html>
    </>
  )
}

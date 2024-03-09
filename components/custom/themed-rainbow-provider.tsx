"use client"

import {
  darkTheme,
  lightTheme,
  RainbowKitProvider,
} from "@rainbow-me/rainbowkit"
import { useTheme } from "next-themes"

import { appName, appUrl, defaultChain } from "@/config/wagmi-config"

export function ThemedRaindbowProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const { resolvedTheme } = useTheme()

  return (
    <RainbowKitProvider
      initialChain={defaultChain}
      theme={resolvedTheme == "light" ? lightTheme() : darkTheme()}
      appInfo={{
        appName: appName,
        learnMoreUrl: appUrl,
      }}
    >
      {children}
    </RainbowKitProvider>
  )
}

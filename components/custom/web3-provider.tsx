"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { WagmiProvider } from "wagmi"

import { config } from "@/config/wagmi-config"
import { ThemedRaindbowProvider } from "@/components/custom/themed-rainbow-provider"

export function Web3Provider({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient()

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <ThemedRaindbowProvider>{children}</ThemedRaindbowProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}

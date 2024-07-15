"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createWeb3Modal } from "@web3modal/wagmi"
import { WagmiProvider } from "wagmi"

import { config, projectId } from "@/config/wagmi-config"

const queryClient = new QueryClient()

createWeb3Modal({
  wagmiConfig: config,
  projectId: projectId,
})

export function Web3Provider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  )
}

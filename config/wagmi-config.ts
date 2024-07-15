"use client"

import { defaultWagmiConfig } from "@web3modal/wagmi"
import { http, Transport } from "viem"
import * as allChains from "viem/chains"

import { getChainProvider } from "./chain-provider"
import { siteConfig } from "./site"

export const chains = Object.values(allChains)
export const defaultChain = allChains.sepolia
export const projectId = "fdec1b7bedfc107d40d256a8461e7dee" as const // WalletConnect

export const appName = siteConfig.name
export const appDescription = siteConfig.description
export const appIcon = "http://localhost:8078/icon.png" as const
export const appUrl = "http://localhost:8078" as const
export const metadata = {
  name: appName,
  description: appDescription,
  url: appUrl,
  icons: [appIcon],
}

export const config = defaultWagmiConfig({
  projectId: projectId,
  metadata: metadata,
  chains: chains as any, // typescript cannot verify if every chain has an entry in transports
  transports: chains.reduce(
    (acc, chain) => {
      acc[chain.id] = http(getChainProvider(chain.id))
      return acc
    },
    {} as { [chainId: number]: Transport }
  ),
  auth: {
    email: false,
  },
})

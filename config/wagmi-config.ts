"use client"

import { getDefaultConfig } from "@rainbow-me/rainbowkit"
import { http, Transport } from "viem"
import * as allChains from "viem/chains"

import { siteConfig } from "./site"

export const chains = Object.values(allChains)
export const defaultChain = allChains.sepolia

export const appName = siteConfig.name
export const appDescription = siteConfig.description
export const appIcon = "http://localhost:8078/icon.png" as const
export const appUrl = "http://localhost:8078" as const
const projectId = "fdec1b7bedfc107d40d256a8461e7dee" as const // WalletConnect

export const config = getDefaultConfig({
  appName: appName,
  projectId: projectId,
  appDescription: appDescription,
  appIcon: appIcon,
  appUrl: appUrl,
  chains: chains as any, // typescript cannot verify if every chain has an entry in transports
  transports: chains.reduce(
    (acc, chain) => {
      let customProvider: string | undefined = undefined
      if (chain.id === 11155111) {
        customProvider = "https://rpc.ankr.com/eth_sepolia"
      }
      acc[chain.id] = http(customProvider)
      return acc
    },
    {} as { [chainId: number]: Transport }
  ),
})

"use client"

import { connectorsForWallets, getDefaultWallets } from "@rainbow-me/rainbowkit"
import {
  arbitrum,
  aurora,
  avalanche,
  base,
  bsc,
  celo,
  fantom,
  gnosis,
  harmonyOne,
  linea,
  mainnet,
  polygon,
  sepolia,
} from "viem/chains"
import { configureChains, createConfig } from "wagmi"
import { infuraProvider } from "wagmi/providers/infura"
import { publicProvider } from "wagmi/providers/public"

const { chains, publicClient } = configureChains(
  [
    mainnet,
    sepolia,
    arbitrum,
    aurora,
    avalanche,
    base,
    bsc,
    celo,
    fantom,
    gnosis,
    harmonyOne,
    linea,
    polygon,
  ],
  [publicProvider()]
)

export const appName = "web3webdeploy" as const
const projectId = "fdec1b7bedfc107d40d256a8461e7dee" as const // WalletConnect
const { wallets } = getDefaultWallets({
  appName: appName,
  projectId: projectId,
  chains,
})

export const config = createConfig({
  autoConnect: true,
  connectors: connectorsForWallets(wallets),
  publicClient: publicClient,
})

export { chains }
export const defaultChain = sepolia

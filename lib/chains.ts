import * as allChains from "viem/chains"

const chains = Object.values(allChains)

/**
 * Gets the chain object for the given chain id.
 * @param chainId - Chain id of the target EVM chain.
 * @returns Viem's chain object.
 */
export function getChain(chainId: bigint) {
  const chainIdNumber = Number(chainId)
  for (const chain of chains) {
    if (chain.id === chainIdNumber) {
      if (chain.id === 11155111) {
        return {
          ...chain,
          rpcUrls: {
            default: {
              // Default sepolia rpc is very restrictive
              http: ["https://rpc.ankr.com/eth_sepolia"],
            },
            public: {
              http: ["https://rpc.ankr.com/eth_sepolia"],
            },
          },
        } as const
      }

      return chain
    }
  }

  throw new Error(`Chain with id ${chainId} not found`)
}

export interface Explorer {
  name: string
  url: string
}
export function getExplorer(chainId: bigint): Explorer | undefined {
  const chain = getChain(chainId)
  if (!Object.hasOwn(chain, "blockExplorers")) {
    return undefined
  }

  return (chain as any).blockExplorers.default
}

export function getVerificationExplorer(chainId: bigint): Explorer | undefined {
  const chain = getChain(chainId)
  if (!Object.hasOwn(chain, "blockExplorers")) {
    return undefined
  }

  const verificationExplorer = (chain as any).blockExplorers.default as
    | Explorer
    | undefined

  if (verificationExplorer) {
    return {
      name: verificationExplorer.name,
      url: getVerificationUrl(verificationExplorer),
    }
  }

  return undefined
}

function getVerificationUrl(explorer: Explorer): string {
  // Ideally there would be some package to get these (by chainid works)
  // Can steal some from this: https://github.com/wighawag/hardhat-deploy/blob/master/src/etherscan.ts
  if (explorer.url === "https://sepolia.etherscan.io") {
    return "https://api-sepolia.etherscan.io/api"
  }
  if (explorer.url === "https://mumbai.polygonscan.com") {
    return "https://api-testnet.polygonscan.com/api"
  }
  if (explorer.url === "https://goerli.basescan.org") {
    return "https://api-goerli.basescan.org/api"
  }

  return `https://api.${explorer.url.replace("https://", "")}/api`
}

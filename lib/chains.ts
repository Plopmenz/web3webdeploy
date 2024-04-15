import * as allChains from "viem/chains"

const chains = Object.values(allChains)

/**
 * Gets the chain object for the given chain id.
 * @param chainId - Chain id of the target EVM chain.
 * @returns Viem's chain object.
 */
export function getChain(chainId: number) {
  for (const chain of chains) {
    if (chain.id === chainId) {
      return chain
    }
  }

  throw new Error(`Chain with id ${chainId} not found`)
}

export interface Explorer {
  name: string
  url: string
}
export function getExplorer(chainId: number): Explorer | undefined {
  const chain = getChain(chainId)
  if (!Object.hasOwn(chain, "blockExplorers")) {
    return undefined
  }

  return (chain as any).blockExplorers.default
}

export function getVerificationExplorer(chainId: number): Explorer | undefined {
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
      url: getVerificationUrl(verificationExplorer, chainId),
    }
  }

  return undefined
}

function getVerificationUrl(explorer: Explorer, chainId: number): string {
  // Ideally there would be some package to get these
  // This list comes from: https://github.com/wighawag/hardhat-deploy/blob/master/src/etherscan.ts
  switch (chainId) {
    case 1:
      return "https://api.etherscan.io/api"
    case 3:
      return "https://api-ropsten.etherscan.io/api"
    case 4:
      return "https://api-rinkeby.etherscan.io/api"
    case 5:
      return "https://api-goerli.etherscan.io/api"
    case 10:
      return "https://api-optimistic.etherscan.io/api"
    case 42:
      return "https://api-kovan.etherscan.io/api"
    case 97:
      return "https://api-testnet.bscscan.com/api"
    case 56:
      return "https://api.bscscan.com/api"
    case 69:
      return "https://api-kovan-optimistic.etherscan.io/api"
    case 70:
      return "https://api.hooscan.com/api"
    case 77:
      return "https://blockscout.com/poa/sokol"
    case 128:
      return "https://api.hecoinfo.com/api"
    case 137:
      return "https://api.polygonscan.com/api"
    case 250:
      return "https://api.ftmscan.com/api"
    case 256:
      return "https://api-testnet.hecoinfo.com/api"
    case 420:
      return "https://api-goerli-optimism.etherscan.io/api"
    case 588:
      return "https://stardust-explorer.metis.io/api"
    case 1088:
      return "https://andromeda-explorer.metis.io/api"
    case 1284:
      return "https://api-moonbeam.moonscan.io/api"
    case 1285:
      return "https://api-moonriver.moonscan.io/api"
    case 80001:
      return "https://api-testnet.polygonscan.com/api"
    case 4002:
      return "https://api-testnet.ftmscan.com/api"
    case 42161:
      return "https://api.arbiscan.io/api"
    case 421611:
      return "https://api-testnet.arbiscan.io/api"
    case 421613:
      return "https://api-goerli.arbiscan.io/api"
    case 421614:
      return "https://api-sepolia.arbiscan.io/api"
    case 43113:
      return "https://api-testnet.snowtrace.io/api"
    case 43114:
      return "https://api.snowtrace.io/api"
    case 338:
      return "https://api-testnet.cronoscan.com/api"
    case 25:
      return "https://api.cronoscan.com/api"
    case 11155111:
      return "https://api-sepolia.etherscan.io/api"
    case 8453:
      return "https://api.basescan.org/api"
    case 84532:
      return "https://api-sepolia.basescan.org/api"
    default:
      return `https://api.${explorer.url.replace("https://", "")}/api`
  }
}

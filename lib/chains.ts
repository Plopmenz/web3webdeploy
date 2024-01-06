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

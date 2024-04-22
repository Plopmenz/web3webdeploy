export function getChainProvider(chainId: number): string | undefined {
  let customProvider: string | undefined = undefined
  if (chainId === 11155111) {
    customProvider = "https://rpc.ankr.com/eth_sepolia"
  }
  return customProvider
}

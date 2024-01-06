import { UnsignedDeploymentTransaction } from "@/types"
import axios from "axios"

export async function verifySourcify({
  deploymentTransaction,
}: {
  deploymentTransaction: UnsignedDeploymentTransaction
}): Promise<string> {
  const response = await axios.post(
    // TODO: Actually using their verification might be better, but most users will want to verify on each platform anyway
    "https://sourcify.dev/server/verify/etherscan",
    {
      // https://sourcify.dev/server/api-docs/
      address: deploymentTransaction.deploymentAddress,
      chainId: deploymentTransaction.transactionSettings.chainId.toString(),
    }
  )
  if (response.data.status !== "perfect") {
    console.warn(
      `Sourcify version wasn't perfect: ${JSON.stringify(response.data)}`
    )
  }
  return JSON.stringify({
    addresses: deploymentTransaction.deploymentAddress,
    chainIds: deploymentTransaction.transactionSettings.chainId,
  })
}

export async function checkPendingSourcify({
  guid,
}: {
  guid: string
}): Promise<{ verified: boolean; message: string }> {
  const response = await axios.get(
    "https://sourcify.dev/server/check-by-addresses",
    {
      params: {
        ...JSON.parse(guid),
      },
    }
  )
  return {
    verified: response.data[0].status === "perfect",
    message: JSON.stringify(response.data),
  }
}

export async function checkVerifiedSourcify({
  deploymentTransaction,
}: {
  deploymentTransaction: UnsignedDeploymentTransaction
}): Promise<boolean> {
  // TODO: batch check
  const response = await axios.get(
    "https://sourcify.dev/server/check-by-addresses",
    {
      params: {
        addresses: deploymentTransaction.deploymentAddress,
        chainIds: deploymentTransaction.transactionSettings.chainId,
      },
    }
  )
  return response.data[0].status === "perfect"
}

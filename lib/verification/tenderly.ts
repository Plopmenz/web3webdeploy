import { Address, UnsignedDeploymentTransaction } from "@/types"
import { Tenderly } from "@tenderly/sdk"

function getSdk(chainId: bigint) {
  const tenderly = new Tenderly({
    accessKey: process.env.TENDERLY_ACCESS_KEY || ``,
    accountName: process.env.TENDERLY_ACCOUNT_NAME || ``,
    projectName: process.env.TENDERLY_PROJECT_NAME || ``,
    network: Number(chainId),
  })
  return tenderly
}

export async function verifyTenderly({
  deploymentTransaction,
}: {
  deploymentTransaction: UnsignedDeploymentTransaction
}): Promise<string> {
  const tenderly = getSdk(deploymentTransaction.transactionSettings.chainId)
  await tenderly.contracts.add(deploymentTransaction.deploymentAddress, {
    displayName: deploymentTransaction.id,
  })
  await tenderly.contracts.verify(deploymentTransaction.deploymentAddress, {
    config: {
      mode: `public`,
    },
    contractToVerify: deploymentTransaction.artifact.contractName,
    solc: {
      version: deploymentTransaction.artifact.compiler.version.split(
        "+"
      )[0] as any,
      sources: deploymentTransaction.artifact.jsonDescription.sources,
      settings: {
        remappings:
          deploymentTransaction.artifact.jsonDescription.settings?.remappings,
        optimizer: {
          enabled:
            deploymentTransaction.artifact.jsonDescription.settings?.optimizer
              ?.enabled,
          runs: deploymentTransaction.artifact.jsonDescription.settings
            ?.optimizer?.runs,
        },
        evmVersion: deploymentTransaction.artifact.jsonDescription.evmVersion,
      },
    },
  })
  return JSON.stringify({
    address: deploymentTransaction.deploymentAddress,
    chainId: deploymentTransaction.transactionSettings.chainId,
  })
}

export async function checkPendingTenderly({
  guid,
}: {
  guid: string
}): Promise<{ verified: boolean; message: string }> {
  try {
    const contractInfo = JSON.parse(guid) as {
      address: Address
      chainId: bigint
    }
    await getSdk(contractInfo.chainId).contracts.get(contractInfo.address)
    return { verified: true, message: "Verified" }
  } catch (error) {
    return { verified: false, message: JSON.stringify(error) }
  }
}

export async function checkVerifiedTenderly({
  deploymentTransaction,
}: {
  deploymentTransaction: UnsignedDeploymentTransaction
}): Promise<boolean> {
  try {
    await getSdk(
      deploymentTransaction.transactionSettings.chainId
    ).contracts.get(deploymentTransaction.deploymentAddress.toLowerCase())
    return true
  } catch (error) {
    // Should throw a warning or something if not the "NotFoundError"
    return false
  }
}

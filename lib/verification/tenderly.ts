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
  await tenderly.contracts.add(
    deploymentTransaction.deploymentAddress.toLowerCase(),
    {
      // Displayname is not set currently for some reason
      displayName: deploymentTransaction.id,
    }
  )
  await tenderly.contracts.verify(
    deploymentTransaction.deploymentAddress.toLowerCase(),
    {
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
          optimizer: {
            enabled:
              deploymentTransaction.artifact.jsonDescription.settings?.optimizer
                ?.enabled,
            runs: deploymentTransaction.artifact.jsonDescription.settings
              ?.optimizer?.runs,
          },
          remappings:
            deploymentTransaction.artifact.jsonDescription.settings?.remappings,
          evmVersion: deploymentTransaction.artifact.jsonDescription.evmVersion,
          viaIR: deploymentTransaction.artifact.jsonDescription.settings?.viaIR,
        },
      },
    }
  )
  return ""
}

export async function checkPendingTenderly({
  deploymentTransaction,
  additionalInfo,
}: {
  deploymentTransaction: UnsignedDeploymentTransaction
  additionalInfo: string
}): Promise<{ verified: boolean; busy?: boolean; message: string }> {
  // Could also call checkVerifiedSourcify here instead (but we lose the message)
  try {
    await getSdk(
      deploymentTransaction.transactionSettings.chainId
    ).contracts.get(deploymentTransaction.deploymentAddress.toLowerCase())
    return { verified: true, message: "Verified" }
  } catch (error: any) {
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

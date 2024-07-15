import { VerifySettings } from "@/types"
import { Tenderly } from "@tenderly/sdk"

import { VerificationService } from "./verificationService"

export class TenderlyVerificationService implements VerificationService {
  private sdkCache: { [chainId: number]: Tenderly } = {}

  private getSdk(chainId: number) {
    if (!Object.hasOwn(this.sdkCache, chainId)) {
      this.sdkCache[chainId] = new Tenderly({
        accessKey: process.env.TENDERLY_ACCESS_KEY || ``,
        accountName: process.env.TENDERLY_ACCOUNT_NAME || ``,
        projectName: process.env.TENDERLY_PROJECT_NAME || ``,
        network: chainId,
      })
    }

    return this.sdkCache[chainId]
  }

  public async verify(verifySettings: VerifySettings): Promise<string> {
    const tenderly = this.getSdk(verifySettings.chainId)
    await tenderly.contracts.add(
      verifySettings.deploymentAddress.toLowerCase()
      // {
      //   // Displayname is not set currently for some reason
      //   displayName: verifySettings.id,
      // }
    )
    await tenderly.contracts.verify(
      verifySettings.deploymentAddress.toLowerCase(),
      {
        config: {
          mode: `public`,
        },
        contractToVerify: verifySettings.artifact.contractName,
        solc: {
          version: verifySettings.artifact.compiler.version.split(
            "+"
          )[0] as any,
          sources: verifySettings.artifact.jsonDescription.sources,
          settings: {
            remappings:
              verifySettings.artifact.jsonDescription.settings?.remappings,
            optimizer: {
              enabled:
                verifySettings.artifact.jsonDescription.settings?.optimizer
                  ?.enabled,
              runs: verifySettings.artifact.jsonDescription.settings?.optimizer
                ?.runs,
            },
            evmVersion:
              verifySettings.artifact.jsonDescription.settings?.evmVersion,
            viaIR: verifySettings.artifact.jsonDescription.settings?.viaIR,
          },
        },
      }
    )
    return ""
  }
  public async checkPending(
    verifySettings: VerifySettings,
    additionalInfo: string
  ): Promise<{ verified: boolean; busy?: boolean; message: string }> {
    // Could also call checkVerified here instead (but we lose the message)
    try {
      await this.getSdk(verifySettings.chainId).contracts.get(
        verifySettings.deploymentAddress.toLowerCase()
      )
      return { verified: true, message: "Verified" }
    } catch (error: any) {
      return { verified: false, message: JSON.stringify(error) }
    }
  }
  public async checkVerified(verifySettings: VerifySettings): Promise<boolean> {
    try {
      await this.getSdk(verifySettings.chainId).contracts.get(
        verifySettings.deploymentAddress.toLowerCase()
      )
      return true
    } catch (error) {
      // Should throw a warning or something if not the "NotFoundError"
      return false
    }
  }
}

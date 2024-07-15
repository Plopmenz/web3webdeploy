import { VerifySettings } from "@/types"
import axios from "axios"

import { VerificationService } from "./verificationService"

export class SourcifyVerificationService implements VerificationService {
  public async verify(verifySettings: VerifySettings): Promise<string> {
    const response = await axios.post(
      // TODO: Actually using their verification might be better, but most users will want to verify on each platform anyway
      "https://sourcify.dev/server/verify/etherscan",
      {
        // https://sourcify.dev/server/api-docs/
        address: verifySettings.deploymentAddress,
        chainId: verifySettings.chainId.toString(),
      }
    )
    if (response.data.result[0].status !== "perfect") {
      console.warn(
        `Sourcify version wasn't perfect: ${JSON.stringify(response.data)}`
      )
    }
    return ""
  }
  public async checkPending(
    verifySettings: VerifySettings,
    additionalInfo: string
  ): Promise<{ verified: boolean; busy?: boolean; message: string }> {
    // Could also call checkVerified here instead (but we lose the message)
    const response = await axios.get(
      "https://sourcify.dev/server/check-by-addresses",
      {
        params: {
          addresses: verifySettings.deploymentAddress,
          chainIds: verifySettings.chainId.toString(),
        },
      }
    )
    return {
      verified: response.data[0].status === "perfect",
      message: JSON.stringify(response.data),
    }
  }
  public async checkVerified(verifySettings: VerifySettings): Promise<boolean> {
    // TODO: batch check
    const response = await axios.get(
      "https://sourcify.dev/server/check-by-addresses",
      {
        params: {
          addresses: verifySettings.deploymentAddress,
          chainIds: verifySettings.chainId.toString(),
        },
      }
    )
    return response.data[0].status === "perfect"
  }
}

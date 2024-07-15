import { VerifySettings } from "@/types"

export abstract class VerificationService {
  public abstract verify(verifySettings: VerifySettings): Promise<string>
  public abstract checkPending(
    verifySettings: VerifySettings,
    additionalInfo: string
  ): Promise<{
    verified: boolean
    busy?: boolean
    message: string
  }>
  public abstract checkVerified(
    verifySettings: VerifySettings
  ): Promise<boolean>
}

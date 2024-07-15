import { VerificationServices, VerifySettings } from "../types"
import { EtherscanVerificationService } from "./verification/etherscan"
import { SourcifyVerificationService } from "./verification/sourcify"
import { TenderlyVerificationService } from "./verification/tenderly"
import { VerificationService } from "./verification/verificationService"

const verificationServices = {
  [VerificationServices.Etherscan]: new EtherscanVerificationService(),
  [VerificationServices.Sourcify]: new SourcifyVerificationService(),
  [VerificationServices.Tenderly]: new TenderlyVerificationService(),
}
function getVerificationService(
  service: VerificationServices
): VerificationService {
  if (!Object.hasOwn(verificationServices, service)) {
    throw new Error(`Verification service not implemented (${service})`)
  }

  return verificationServices[service]
}

export async function verify({
  verifySettings,
  service,
}: {
  verifySettings: VerifySettings
  service: VerificationServices
}): Promise<string> {
  const verificationService = getVerificationService(service)
  return verificationService.verify(verifySettings)
}

export async function checkPending({
  verifySettings,
  additionalInfo,
  service,
}: {
  verifySettings: VerifySettings
  additionalInfo: string
  service: VerificationServices
}): Promise<{ verified: boolean; busy?: boolean; message: string }> {
  const verificationService = getVerificationService(service)
  return verificationService.checkPending(verifySettings, additionalInfo)
}

export async function checkVerified({
  verifySettings,
  service,
}: {
  verifySettings: VerifySettings
  service: VerificationServices
}): Promise<boolean> {
  const verificationService = getVerificationService(service)
  return verificationService.checkVerified(verifySettings)
}

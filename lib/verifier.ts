import { UnsignedDeploymentTransaction, VerificationServices } from "../types"
import {
  checkPendingEtherscan,
  checkVerifiedEtherscan,
  verifyEtherscan,
} from "./verification/etherscan"
import {
  checkPendingSourcify,
  checkVerifiedSourcify,
  verifySourcify,
} from "./verification/sourcify"
import {
  checkPendingTenderly,
  checkVerifiedTenderly,
  verifyTenderly,
} from "./verification/tenderly"

export async function verify({
  deploymentTransaction,
  service,
}: {
  deploymentTransaction: UnsignedDeploymentTransaction
  service: VerificationServices
}): Promise<string> {
  switch (service) {
    case VerificationServices.Etherscan:
      return verifyEtherscan({ deploymentTransaction })
    case VerificationServices.Sourcify:
      return verifySourcify({ deploymentTransaction })
    case VerificationServices.Tenderly:
      return verifyTenderly({ deploymentTransaction })
    default:
      console.warn(`Verify not implemented for ${service}`)
      return "NOTIMPLEMENTED"
  }
}

export async function checkPending({
  guid,
  service,
}: {
  guid: string
  service: VerificationServices
}): Promise<{ verified: boolean; message: string }> {
  switch (service) {
    case VerificationServices.Etherscan:
      return checkPendingEtherscan({ guid })
    case VerificationServices.Sourcify:
      return checkPendingSourcify({ guid })
    case VerificationServices.Tenderly:
      return checkPendingTenderly({ guid })
    default:
      console.warn(`Check pending not implemented for ${service}`)
      return { verified: false, message: "NOTIMPLEMENTED" }
  }
}

export async function checkVerified({
  deploymentTransaction,
  service,
}: {
  deploymentTransaction: UnsignedDeploymentTransaction
  service: VerificationServices
}): Promise<boolean> {
  switch (service) {
    case VerificationServices.Etherscan:
      return checkVerifiedEtherscan({ deploymentTransaction })
    case VerificationServices.Sourcify:
      return checkVerifiedSourcify({ deploymentTransaction })
    case VerificationServices.Tenderly:
      return checkVerifiedTenderly({ deploymentTransaction })
    default:
      console.warn(`Check verified not implemented for ${service}`)
      return false
  }
}

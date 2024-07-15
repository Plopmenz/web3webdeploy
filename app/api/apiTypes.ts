import {
  Bytes,
  GenerateSettings,
  UnsignedDeploymentTransaction,
  VerificationServices,
  VerifySettings,
} from "@/types"

export type GenerateRequest = GenerateSettings

export interface UnsignedToSubmittedRequest {
  batchId: string
  transactionId: string
  transactionHash: Bytes
}

export interface VerifyRequest {
  verifySettings: VerifySettings
  service: VerificationServices
}

export interface VerifyPendingRequest {
  verifySettings: VerifySettings
  additionalInfo: string
  service: VerificationServices
}

export interface VerifyStatusRequest {
  verifySettings: VerifySettings
  service: VerificationServices
}

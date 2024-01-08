import {
  Bytes,
  GenerateSettings,
  UnsignedDeploymentTransaction,
  VerificationServices,
} from "@/types.ts"

export type GenerateRequest = GenerateSettings

export interface UnsignedToSubmittedRequest {
  transactionId: string
  transactionHash: Bytes
}

export interface VerifyRequest {
  deploymentTransaction: UnsignedDeploymentTransaction
  service: VerificationServices
}

export interface VerifyPendingRequest {
  deploymentTransaction: UnsignedDeploymentTransaction
  additionalInfo: string
  service: VerificationServices
}

export interface VerifyStatusRequest {
  deploymentTransaction: UnsignedDeploymentTransaction
  service: VerificationServices
}

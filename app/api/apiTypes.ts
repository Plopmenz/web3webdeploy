import {
  Address,
  Bytes,
  TransactionSettings,
  UnsignedDeploymentTransaction,
  VerificationServices,
} from "@/types.ts"

export interface GenerateRequest {
  transactionSettings: TransactionSettings
  from: Address
}

export interface UnsignedToSubmittedRequest {
  transactionId: string
  transactionHash: Bytes
}

export interface VerifyRequest {
  deploymentTransaction: UnsignedDeploymentTransaction
  service: VerificationServices
}

export interface VerifyPendingRequest {
  verificationGuid: string
  service: VerificationServices
}

export interface VerifyStatusRequest {
  deploymentTransaction: UnsignedDeploymentTransaction
  service: VerificationServices
}

import {
  AbiItem,
  Address,
  DecodeEventLogReturnType,
  Hex,
  Log,
  TransactionReceipt,
} from "viem"

export type { Address }
export type Bytes = Hex
export type { AbiItem }

export interface ForgeArtifact {
  abi: AbiItem[]
  bytecode: {
    object: Bytes
  }
  rawMetadata: string // contains evmVersion
  metadata: {
    language: string
    compiler: {
      version: string
    }
    settings: {
      remappings: string[]
      optimizer: {
        enabled: boolean
        runs: number
      }
      compilationTarget: {
        [contractPath: string]: string // Contract name
      }
      viaIR?: boolean
    }
    sources: {
      [file: string]: {
        keccak256: Bytes
        urls: string[]
        ast: {}
      }
    }
  }
  ast: {
    license: string
  }
}

export interface JsonDescription {
  language: string
  sources: {
    [filePath: string]: { content: string }
  }
  settings?: {
    remappings?: string[]
    optimizer?: { enabled?: boolean; runs?: number }
    viaIR?: boolean
  }
  evmVersion?: string
  metadata: {
    useLiteralContent: true
  }
}

export interface Artifact {
  abi: AbiItem[]
  bytecode: Bytes
  compiler: {
    version: `v${string}`
  }
  contractName: string
  jsonDescription: JsonDescription
  license: string
}

export interface TransactionSettings {
  chainId: number
  nonce: bigint
  baseFee: bigint
  priorityFee: bigint
}

export interface UnsignedTransactionBase {
  type: "function" | "deployment"
  id: string
  batch: string
  to?: Address // undefined for create deployments
  value: bigint
  data: Bytes
  gas: bigint
  from: Address
  transactionSettings: TransactionSettings
  source: string
}

export type UnsignedFunctionTransaction = UnsignedTransactionBase & {
  type: "function"
  functionName: string
  functionArgs: any[]
}

export type UnsignedDeploymentTransaction = UnsignedTransactionBase & {
  type: "deployment"
  deploymentAddress: Address
  constructorArgs: any[]
  salt?: string
  artifact: Artifact
}

export type QueuedTransaction = UnsignedTransactionBase & {
  signedTransactionRaw: Bytes
}

export type SubmittedTransaction = UnsignedTransactionBase & {
  submitted: {
    transactionHash: Bytes
    date: Date
  }
}

export interface DeployInfo {
  contract: string
  args?: any[]
  id?: string
  create2?: boolean
  salt?: string | Uint8Array
  from?: Address
  chainId?: number
  nonce?: bigint
  baseFee?: bigint
  priorityFee?: bigint
  value?: bigint

  export?: boolean
}

export interface ExecuteInfo {
  abi: AbiItem[] | string // Can also use contract name
  to: Address
  function: string
  args?: any[]
  id?: string
  from?: Address
  chainId?: number
  nonce?: bigint
  baseFee?: bigint
  priorityFee?: bigint
  value?: bigint
}

export interface EventInfo {
  abi: AbiItem[] | string
  logs: Log[]
  address?: Address
  eventName?: string
}

export interface SaveDeploymentInfo {
  deploymentName: string
  deployment: any
}

export interface LoadDeploymentInfo {
  deploymentName: string
}

export interface Deployer {
  settings: GenerateSettings
  deploy: (
    deployInfo: DeployInfo
  ) => Promise<{ address: Address; receipt: TransactionReceipt }>
  execute: (
    executeInfo: ExecuteInfo
  ) => Promise<{ receipt: TransactionReceipt }>
  startContext: (context: string) => void
  finishContext: () => void

  saveDeployment: (deploymentInfo: SaveDeploymentInfo) => Promise<void>
  loadDeployment: (deploymentInfo: LoadDeploymentInfo) => Promise<any>
  getEvents: (eventInfo: EventInfo) => Promise<DecodeEventLogReturnType[]>
}

export interface DeployScript {
  deploy?: (deployer: Deployer) => Promise<void>
}

export interface GenerateSettings {
  defaultFrom: Address
  defaultChainId: number
  defaultBaseFee: bigint
  defaultPriorityFee: bigint

  batchId: string
}

export enum VerificationServices {
  Etherscan = "Etherscan",
  Sourcify = "Sourcify",
  Tenderly = "Tenderly",
}

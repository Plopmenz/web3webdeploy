import viem, {
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
      evmVersion: string
      viaIR?: boolean
    }
    sources: {
      [file: string]: {
        keccak256: Bytes
        urls: string[]
        license: string
      }
    }
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
    evmVersion?: string
    viaIR?: boolean
  }
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

export interface AdditionalDeployment {
  id: string
  deploymentAddress: Address
  constructorArgs: any[]
  artifact: Artifact
}

export interface UnsignedTransactionBase {
  type: "function" | "deployment"
  id: string
  batch: string
  batchIndex: number
  to?: Address // undefined for create deployments
  value: bigint
  data: Bytes
  gas: bigint
  from: Address
  transactionSettings: TransactionSettings
  source: string

  deployments?: AdditionalDeployment[] // Deployments triggered by this transaction
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
  gas?: bigint
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
  gas?: bigint
  baseFee?: bigint
  priorityFee?: bigint
  value?: bigint
}

export interface AddDeployInfo {
  addTo: string
  contract: string
  deploymentAddress: Address
  args?: any[]
  id?: string
  chainId?: number

  export?: boolean
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
  viem: typeof viem
  settings: GenerateSettings
  deploy: (
    deployInfo: DeployInfo
  ) => Promise<{ address: Address; receipt: TransactionReceipt }>
  execute: (
    executeInfo: ExecuteInfo
  ) => Promise<{ receipt: TransactionReceipt }>
  addDeploy: (addDeployInfo: AddDeployInfo) => Promise<void>
  startContext: (context: string) => void
  finishContext: () => void

  saveDeployment: (deploymentInfo: SaveDeploymentInfo) => Promise<void>
  loadDeployment: (
    deploymentInfo: LoadDeploymentInfo
  ) => Promise<any | undefined>
  getAbi: (contractName: string) => Promise<AbiItem[]>
  getEvents: (
    eventInfo: EventInfo
  ) => Promise<{ eventName: string; args: any }[]>
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
  deploymentFile: string
}

export interface VerifySettings {
  chainId: number
  deploymentAddress: Address
  artifact: Artifact
  args: any[]
}

export enum VerificationServices {
  Etherscan = "Etherscan",
  Sourcify = "Sourcify",
  Tenderly = "Tenderly",
}

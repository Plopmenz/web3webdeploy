export type Address = `0x${string}`
export type Bytes = `0x${string}`

export interface AbiParameter {
  name: string
  type: string
  internalType: string
}

export interface AbiItem {
  type: string
  name: string
  inputs: AbiParameter[]
  outputs: AbiParameter[]
  stateMutability: string
}

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
  contractName: string // "erc20.sol:ERC20"
  jsonDescription: JsonDescription
  license: string // "MIT"
}

export interface TransactionSettings {
  chainId: bigint
  nonce: bigint
  baseFee: bigint
  priorityFee: bigint
}

export interface UnsignedTransactionBase {
  type: "transaction" | "deployment"
  id: string // nonce_contractName
  to?: Address // undefined for create deployments
  value: bigint
  data: Bytes
  gas: bigint
  from: Address
  transactionSettings: TransactionSettings
}

export type UnsignedRawTransaction = UnsignedTransactionBase & {
  type: "transaction"
  functionName: string
  functionArgs: any[]
}

export type UnsignedDeploymentTransaction = UnsignedTransactionBase & {
  type: "deployment"
  deploymentAddress: Address
  constructorArgs: any[]
  artifact: Artifact
}

export type QueuedTransaction = UnsignedTransactionBase & {
  // Is this allowed with wallet connect? Or would it submit right away?
  signature: {
    v: 0 | 1
    r: Bytes
    s: Bytes
  }
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
}

export interface Deployer {
  deploy: (deployInfo: DeployInfo) => Promise<Address>
}

export interface DeployScript {
  deploy?: (deployer: Deployer) => Promise<void>
}

export interface GenerateSettings {
  transactionSettings: TransactionSettings
  from: Address
}

export enum VerificationServices {
  Etherscan = "Etherscan",
  Sourcify = "Sourcify",
  Tenderly = "Tenderly",
}

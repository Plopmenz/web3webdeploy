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

export interface Artifact {
  abi: AbiItem[]
  bytecode: {
    object: Bytes
  }
  metadata: {
    compiler: {
      version: string
    }
    settings: {
      remappings: string[]
      optimizer: {
        enabled: boolean
        runs: number
      }
    }
    sources: {
      [file: string]: {}
    }
  }
}

export interface TransactionSettings {
  chainId: bigint
  nonce: bigint
  baseFee: bigint
  priorityFee: bigint
}

export interface UnsignedTransactionBase {
  type: string
  to: Address
  value: bigint
  data: Bytes
  transactionSettings: TransactionSettings
}

export type UnsignedRawTransaction = UnsignedTransactionBase & {
  type: "transaction"
}

export type UnsignedDeploymentTransaction = UnsignedTransactionBase & {
  type: "deployment"
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

export type SubmittedTransaction = QueuedTransaction & {
  transcation: {
    hash: Bytes
  }
}

export type ConfirmedTransaction = SubmittedTransaction & {
  block: {
    hash: Bytes
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
}

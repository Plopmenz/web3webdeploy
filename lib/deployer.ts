import { ChildProcess, exec, spawn } from "child_process"
import { mkdir, readdir, readFile, rm, rmdir, writeFile } from "fs/promises"
import { Module } from "module"
import path from "path"
import { promisify } from "util"
import esbuild from "esbuild"
import * as viem from "viem"
import {
  createPublicClient,
  createTestClient,
  decodeEventLog,
  DecodeEventLogReturnType,
  encodeDeployData,
  encodeFunctionData,
  fromBytes,
  getCreate2Address,
  getCreateAddress,
  http,
  padBytes,
  PublicClient,
  TestClient,
  toBytes,
} from "viem"

import { getChainProvider } from "@/config/wagmi-config"

import {
  Address,
  Artifact,
  Bytes,
  DeployInfo,
  DeployScript,
  EventInfo,
  ExecuteInfo,
  ForgeArtifact,
  GenerateSettings,
  JsonDescription,
  LoadDeploymentInfo,
  SaveDeploymentInfo,
  SubmittedTransaction,
  UnsignedDeploymentTransaction,
  UnsignedFunctionTransaction,
  UnsignedTransactionBase,
} from "../types"
import { getChain } from "./chains"
import { Config, getConfig } from "./config"
import { PromiseObject } from "./promiseHelper"
import { stringToTransaction, transactionToString } from "./transactionString"

export async function generate(settings: GenerateSettings) {
  const config = await getConfig()
  const compiledProjects: string[] = []
  const executionContext: string[] = []
  const getCurrentContext = () =>
    executionContext.at(-1) ?? path.resolve(config.projectRoot)

  let localForkPort = 18078
  const chainVariables: {
    [chainId: number]: {
      localFork: ChildProcess
      publicClient: PublicClient
      testClient: TestClient
      nonce: { [address: Address]: bigint }
    }
  } = {}

  const getNonce = async (address: Address, chainId: number) => {
    const variables = chainVariables[chainId]

    if (!Object.hasOwn(variables.nonce, address)) {
      await variables.testClient.impersonateAccount({ address: address })
      variables.nonce[address] = BigInt(
        await variables.publicClient.getTransactionCount({ address: address })
      )
    }

    return variables.nonce[address]
  }

  const batchId = settings.batchId
  const getTransactionVariables = async (info: DeployInfo | ExecuteInfo) => {
    const chainId = info.chainId ?? settings.defaultChainId
    if (!Object.hasOwn(chainVariables, chainId)) {
      const chain = getChain(chainId)
      const port = localForkPort++
      const forkRPC =
        getChainProvider(chain.id) ?? chain.rpcUrls.default.http[0]
      const anvilInstance = spawn("anvil", [
        "--port",
        port.toString(),
        "--fork-url",
        forkRPC,
      ])

      let anvilProcessClosed: number | null = 0
      await new Promise((resolve) => {
        // Wait for anvil to be ready (output anything in the console)
        anvilInstance.stdout.on("data", resolve)

        // In case anvil for whatever reason does not manage to start
        anvilInstance.on("close", (code, signal) => {
          if (code !== 0) {
            console.error(`Anvil instance killed with code ${code} (${signal})`)
          }
          anvilProcessClosed = code
          resolve({})
        })
      })
      if (anvilProcessClosed !== 0) {
        throw new Error(
          `Local fork of ${forkRPC} (chain ${chainId}) failed to initialize.`
        )
      }

      chainVariables[chainId] = {
        localFork: anvilInstance,
        publicClient: createPublicClient({
          chain: chain,
          transport: http(`http://127.0.0.1:${port}`),
        }) as PublicClient,
        testClient: createTestClient({
          mode: "anvil",
          chain: chain,
          transport: http(`http://127.0.0.1:${port}`),
        }),
        nonce: {},
      }
    }
    const from = info.from ?? settings.defaultFrom
    const baseFee = info.baseFee ?? settings.defaultBaseFee
    const priorityFee = info.priorityFee ?? settings.defaultPriorityFee
    const nonce = await getNonce(from, chainId)
    return { chainId, from, baseFee, priorityFee, nonce }
  }

  const saveTransaction = async (
    transaction: UnsignedDeploymentTransaction | UnsignedFunctionTransaction,
    batchId: string
  ) => {
    const batchDir = path.join(config.unsignedTransactionsDir, batchId)
    await mkdir(batchDir, {
      recursive: true,
    })
    await writeFile(
      path.join(batchDir, `${transaction.id}.json`),
      transactionToString(transaction)
    )
  }

  const getAbi = async (contractName: string) => {
    return await getArtifactAndCompile(
      contractName,
      getCurrentContext(),
      compiledProjects
    ).then((artifact) => artifact.abi)
  }

  const exportContract = async (
    transaction: UnsignedDeploymentTransaction,
    batchId: string
  ) => {
    if (config.exportToOriginalProject) {
      const localConfig = await getConfig(getCurrentContext())
      const batchDir = path.join(localConfig.exportDir, batchId)
      await mkdir(batchDir, {
        recursive: true,
      })
      await writeFile(
        path.join(batchDir, `${transaction.id}.ts`),
        `export const ${transaction.id}Contract = ${JSON.stringify({ address: transaction.deploymentAddress, abi: transaction.artifact.abi })} as const;`
      )
    }
    if (config.exportToRootProject) {
      const batchDir = path.join(config.exportDir, batchId)
      await mkdir(batchDir, {
        recursive: true,
      })
      await writeFile(
        path.join(batchDir, `${transaction.id}.ts`),
        `export const ${transaction.id}Contract = ${JSON.stringify({ address: transaction.deploymentAddress, abi: transaction.artifact.abi })} as const;`
      )
    }
  }

  const estimateGas = async (
    from: Address,
    baseTransaction: { to?: Address; value: bigint; data: Bytes },
    chainId: number,
    transactionId: string
  ) => {
    return await chainVariables[chainId].publicClient
      .estimateGas({
        account: from,
        ...baseTransaction,
      })
      .catch((error) => {
        throw new Error(
          `Error in test deploy for transaction ${transactionId}: ${JSON.stringify(
            error
          )}`
        )
      })
  }

  const locallyExecuteTransaction = async (
    transaction: UnsignedDeploymentTransaction | UnsignedFunctionTransaction
  ) => {
    const clients = chainVariables[transaction.transactionSettings.chainId]
    const transactionHash = await clients.testClient.sendUnsignedTransaction({
      from: transaction.from,
      to: transaction.to,
      value: transaction.value,
      data: transaction.data,
      gas: transaction.gas,
      nonce: Number(transaction.transactionSettings.nonce),
    })
    return clients.publicClient.waitForTransactionReceipt({
      hash: transactionHash,
    })
  }

  let batchIndex = 0
  const deployer = {
    viem: viem,
    settings: settings,
    deploy: async (deployInfo: DeployInfo) => {
      const localConfig = await getConfig(getCurrentContext())
      const { chainId, from, baseFee, priorityFee, nonce } =
        await getTransactionVariables(deployInfo)
      const transactionId =
        deployInfo.id ?? `${chainId}_${nonce}_${deployInfo.contract}`

      const create2 = deployInfo.create2 ?? localConfig.defaultCreate2
      const salt = deployInfo.salt
        ? typeof deployInfo.salt === "string"
          ? padBytes(toBytes(deployInfo.salt), { size: 32 })
          : deployInfo.salt
        : localConfig.defaultSalt

      const artifact = await getArtifactAndCompile(
        deployInfo.contract,
        getCurrentContext(),
        compiledProjects
      )
      const bytecode = encodeDeployData({
        abi: artifact.abi,
        bytecode: artifact.bytecode,
        args: deployInfo.args,
      })
      const predictedAddress = create2
        ? getCreate2Address({
            from: localConfig.create2Deployer,
            salt: salt,
            bytecode: bytecode,
          })
        : getCreateAddress({
            from: from,
            nonce: nonce,
          })

      const baseTransaction = {
        to: create2 ? localConfig.create2Deployer : undefined,
        value: deployInfo.value ?? BigInt(0),
        data: create2
          ? ((fromBytes<"hex">(salt, { to: "hex" }) +
              bytecode.replace("0x", "")) as Bytes)
          : bytecode,
      } as const
      const deployTransaction: UnsignedDeploymentTransaction = {
        type: "deployment",
        id: transactionId,
        batch: batchId,
        batchIndex: batchIndex++,
        deploymentAddress: predictedAddress,
        constructorArgs: deployInfo.args ?? [],
        ...baseTransaction,
        gas: await estimateGas(from, baseTransaction, chainId, transactionId),
        from: from,
        transactionSettings: {
          chainId: chainId,
          nonce: nonce,
          baseFee: baseFee,
          priorityFee: priorityFee,
        },
        salt: create2
          ? deployInfo.salt && typeof deployInfo.salt !== "string"
            ? `0x${Buffer.from(salt).toString("hex")}`
            : Buffer.from(salt).toString()
          : undefined,
        artifact: artifact,
        source: getCurrentContext(),
      }

      const receipt = await locallyExecuteTransaction(deployTransaction)
      await saveTransaction(deployTransaction, batchId)
      if (deployInfo.export ?? config.defaultExport) {
        await exportContract(deployTransaction, batchId)
      }

      chainVariables[chainId].nonce[from]++
      return { address: predictedAddress, receipt: receipt }
    },
    execute: async (executeInfo: ExecuteInfo) => {
      const { chainId, from, baseFee, priorityFee, nonce } =
        await getTransactionVariables(executeInfo)
      const transactionId =
        executeInfo.id ?? `${chainId}_${nonce}_${executeInfo.function}`

      const abi =
        typeof executeInfo.abi === "string"
          ? await getAbi(executeInfo.abi)
          : executeInfo.abi
      const baseTransaction = {
        to: executeInfo.to,
        value: executeInfo.value ?? BigInt(0),
        data: encodeFunctionData({
          abi: abi,
          functionName: executeInfo.function,
          args: executeInfo.args ?? [],
        }),
      } as const
      const functionTransaction: UnsignedFunctionTransaction = {
        type: "function",
        id: transactionId,
        batch: batchId,
        batchIndex: batchIndex++,
        functionName: executeInfo.function,
        functionArgs: executeInfo.args ?? [],
        ...baseTransaction,
        gas: await estimateGas(from, baseTransaction, chainId, transactionId),
        from: from,
        transactionSettings: {
          chainId: chainId,
          nonce: nonce,
          baseFee: baseFee,
          priorityFee: priorityFee,
        },
        source: getCurrentContext(),
      }

      await saveTransaction(functionTransaction, batchId)
      const receipt = await locallyExecuteTransaction(functionTransaction)

      chainVariables[chainId].nonce[from]++
      return { receipt: receipt }
    },
    startContext: (context: string) => {
      executionContext.push(path.join(getCurrentContext(), context))
    },
    finishContext: () => {
      executionContext.pop()
    },

    saveDeployment: async (deploymentInfo: SaveDeploymentInfo) => {
      const localConfig = await getConfig(getCurrentContext())
      await mkdir(localConfig.savedDeploymentsDir, {
        recursive: true,
      })
      await writeFile(
        path.join(
          localConfig.savedDeploymentsDir,
          deploymentInfo.deploymentName
        ),
        JSON.stringify(deploymentInfo.deployment)
      )
    },
    loadDeployment: async (deploymentInfo: LoadDeploymentInfo) => {
      try {
        const localConfig = await getConfig(getCurrentContext())
        const deployment = await readFile(
          path.join(
            localConfig.savedDeploymentsDir,
            deploymentInfo.deploymentName
          ),
          { encoding: "utf-8" }
        )
        return JSON.parse(deployment)
      } catch (error) {
        console.warn(
          `Deployment ${deploymentInfo.deploymentName} not found: ${error}`
        )
        return undefined
      }
    },
    getAbi: getAbi,
    getEvents: async (eventInfo: EventInfo) => {
      const abi =
        typeof eventInfo.abi === "string"
          ? await getAbi(eventInfo.abi)
          : eventInfo.abi

      const events = eventInfo.logs
        .map((log) => {
          if (
            eventInfo.address &&
            log.address.toLowerCase() !== eventInfo.address.toLowerCase()
          ) {
            return undefined
          }

          try {
            return decodeEventLog({
              abi: abi,
              topics: log.topics,
              data: log.data,
              strict: true,
              eventName: eventInfo.eventName,
            })
          } catch {}
        })
        .filter((event) => event !== undefined) as DecodeEventLogReturnType[]
      return events
    },
  }

  if (config.deleteUnfinishedDeploymentOnGenerate) {
    // Check if all directories are empty (or non-existent)
    const subDirectories = ["unsigned", "queued"] // Except submitted
    const allDirsEmpty = !(
      await Promise.all(
        subDirectories.map(
          (d) =>
            readdir(path.join(config.deploymentDir, d))
              .then((files) => files.length == 0)
              .catch((error) => true) // Assume expection means non-existent
        )
      )
    ).includes(false)

    if (!allDirsEmpty) {
      console.warn("Unfinished deployment found, deleting...")
      // Clear all leftover transactions
      await Promise.all(
        subDirectories.map((d) =>
          rm(path.join(config.deploymentDir, d), {
            force: true,
            recursive: true,
          }).catch((error: any) => {
            throw new Error(
              `Could not clean up directory ${path.join(
                config.deploymentDir,
                d
              )}: ${error?.message ?? JSON.stringify(error)}`
            )
          })
        )
      )
    }
  }

  // execute deploy script
  const fileContent = await readFile(config.deployFile, {
    encoding: "utf-8",
  })

  // Transform ts file to a single js file (without imports)
  const bundle = await esbuild.build({
    bundle: true,
    write: false,
    platform: "node",
    stdin: {
      contents: fileContent,
      loader: "ts",
      resolveDir: path.resolve(config.deployDir),
      sourcefile: path.resolve(config.deployFile),
    },
    tsconfig: path.join(config.projectRoot, "tsconfig.json"),
  })
  const jsContent = bundle.outputFiles[0].text

  var m = new Module(config.deployFile) as any // Type signatures do not expose _compile
  m._compile(jsContent, "")
  const deployScript: DeployScript = m.exports

  if (!deployScript?.deploy) {
    console.warn(
      `Script ${path.resolve(
        config.deployFile
      )} does not export a correct deploy function. Deployment skipped.`
    )
  } else {
    try {
      await deployScript.deploy(deployer)
    } finally {
      // Stop local chain processes
      Object.values(chainVariables).forEach((chainInfo) =>
        chainInfo.localFork.kill()
      )
    }
  }
}

async function getTransactions<T extends UnsignedTransactionBase>(
  transactionsDir: string
): Promise<{ [batchId: string]: T[] }> {
  const transactionBatches = await readdir(transactionsDir)
  const transactions: {
    [batchId: string]: Promise<T[]>
  } = {}
  for (let i = 0; i < transactionBatches.length; i++) {
    transactions[transactionBatches[i]] = readdir(
      path.join(transactionsDir, transactionBatches[i])
    )
      .then((transactionFiles) =>
        Promise.all(
          transactionFiles.map(async (transactionFile) => {
            const transactionContent = await readFile(
              path.join(
                transactionsDir,
                transactionBatches[i],
                transactionFile
              ),
              { encoding: "utf-8" }
            )

            const transaction = stringToTransaction(transactionContent) as T
            if (transactionFile !== `${transaction.id}.json`) {
              // Will be an issue when trying to move the transaction file (such as unsigned -> submitted)
              console.warn(
                `Transaction file ${transactionFile} does not match it's id ${transaction.id}`
              )
            }
            return transaction
          })
        )
      )
      .then((unsortedTransactions) =>
        unsortedTransactions.sort((t1, t2) =>
          Number(t1.transactionSettings.nonce - t2.transactionSettings.nonce)
        )
      )
  }
  return PromiseObject(transactions)
}

export async function getUnsignedTransactions(): Promise<{
  [batchId: string]: UnsignedTransactionBase[]
}> {
  const config = await getConfig()
  try {
    return await getTransactions<UnsignedTransactionBase>(
      config.unsignedTransactionsDir
    )
  } catch (error: any) {
    console.warn(
      `Could not load unsigned transactions: ${
        error?.message ?? JSON.stringify(error)
      }`
    )
    return {}
  }
}

export async function getSubmittedTransactions(): Promise<{
  [batchId: string]: SubmittedTransaction[]
}> {
  const config = await getConfig()
  try {
    return await getTransactions<SubmittedTransaction>(
      config.submittedTransactionsDir
    )
  } catch (error: any) {
    console.warn(
      `Could not load submitted transactions: ${
        error?.message ?? JSON.stringify(error)
      }`
    )
    return {}
  }
}

async function getArtifactAndCompile(
  contractName: string,
  fromPath: string,
  compiledProjects: string[]
): Promise<Artifact> {
  const config = await getConfig(fromPath)
  if (!compiledProjects.includes(config.projectRoot)) {
    await promisify(exec)("forge compile", { cwd: config.projectRoot })
    compiledProjects.push(config.projectRoot)
  }
  return getArtifact(contractName, config)
}

async function getArtifact(
  contractName: string,
  withConfig?: Config
): Promise<Artifact> {
  const config = withConfig ?? (await getConfig())
  const filePath = path.join(
    config.artifactsDir,
    `${contractName}.sol`,
    `${contractName}.json`
  )
  try {
    const forgeOutput = await readFile(filePath, { encoding: "utf-8" })
    const forgeArtifact = JSON.parse(forgeOutput) as ForgeArtifact
    return forgeToArtifact(forgeArtifact, config)
  } catch (error: any) {
    throw new Error(
      `Could not get artifact for ${contractName} at ${filePath}: ${
        error?.message ?? JSON.stringify(error)
      }`
    )
  }
}

async function forgeToArtifact(
  forgeArtifact: ForgeArtifact,
  withConfig?: Config
): Promise<Artifact> {
  const config = withConfig ?? (await getConfig())
  const abi = forgeArtifact.abi
  const bytecode = forgeArtifact.bytecode.object
  const compiler = {
    version: `v${forgeArtifact.metadata.compiler.version}`,
  } as const
  const compilationTarget = Object.keys(
    forgeArtifact.metadata.settings.compilationTarget
  )[0]
  const contractName = `${compilationTarget}:${forgeArtifact.metadata.settings.compilationTarget[compilationTarget]}`
  const license = forgeArtifact.metadata.sources[compilationTarget].license
  const jsonDescription: JsonDescription = {
    language: forgeArtifact.metadata.language,
    sources: forgeArtifact.metadata.sources as any, // Will be transformed into the right format in the next step
    settings: {
      remappings: forgeArtifact.metadata.settings.remappings,
      optimizer: forgeArtifact.metadata.settings.optimizer,
      evmVersion: forgeArtifact.metadata.settings.evmVersion,
      viaIR: forgeArtifact.metadata.settings.viaIR,
    },
    metadata: { useLiteralContent: true },
  }
  await Promise.all(
    Object.keys(jsonDescription.sources).map(async (file) => {
      const sourceCode = await readFile(
        path.join(config.projectRoot, file),
        "utf-8"
      )
      jsonDescription.sources[file] = {
        content: sourceCode,
      }
    })
  )

  return {
    abi: abi,
    bytecode: bytecode,
    compiler: compiler,
    contractName: contractName,
    jsonDescription: jsonDescription,
    license: license,
  }
}

export async function unsignedToSubmitted(
  batchId: string,
  transactionId: string,
  transactionHash: Bytes
) {
  const config = await getConfig()
  const oldBatchDir = path.join(config.unsignedTransactionsDir, batchId)
  const oldPath = path.join(oldBatchDir, `${transactionId}.json`)
  try {
    const oldData = await readFile(oldPath, { encoding: "utf-8" })
    const newData: SubmittedTransaction = {
      ...(stringToTransaction(oldData) as UnsignedTransactionBase),
      submitted: {
        transactionHash: transactionHash,
        date: new Date(),
      },
    }
    const newBatchDir = path.join(config.submittedTransactionsDir, batchId)
    await mkdir(newBatchDir, {
      recursive: true,
    })
    await writeFile(
      path.join(newBatchDir, `${transactionId}.json`),
      transactionToString(newData)
    )
    await rm(oldPath)
  } catch (error: any) {
    throw new Error(
      `Could not move unsigned transaction at ${oldPath} to submitted: ${
        error?.message ?? JSON.stringify(error)
      }`
    )
  }

  try {
    const files = await readdir(oldBatchDir)
    if (files.length === 0) {
      await rmdir(oldBatchDir)
    }
  } catch (error: any) {
    throw new Error(
      `Could not remove empty batch directory at ${oldBatchDir}: ${
        error?.message ?? JSON.stringify(error)
      }`
    )
  }
}

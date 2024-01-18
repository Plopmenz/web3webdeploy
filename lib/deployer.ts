import { exec } from "child_process"
import { mkdir, readdir, readFile, rm, rmdir, writeFile } from "fs/promises"
import { Module } from "module"
import path from "path"
import { promisify } from "util"
import esbuild from "esbuild"
import {
  createPublicClient,
  encodeDeployData,
  fromBytes,
  getCreate2Address,
  getCreateAddress,
  http,
  padBytes,
  PublicClient,
  toBytes,
} from "viem"

import {
  Address,
  Artifact,
  Bytes,
  DeployInfo,
  DeployScript,
  ForgeArtifact,
  GenerateSettings,
  JsonDescription,
  SubmittedTransaction,
  UnsignedDeploymentTransaction,
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

  const chainVariables: {
    [chainId: string]: {
      publicClient: PublicClient
      nonce: { [address: Address]: bigint }
    }
  } = {}

  const getNonce = async (address: Address, chainId: bigint) => {
    const variables = chainVariables[chainId.toString()]

    if (!Object.hasOwn(variables.nonce, address)) {
      variables.nonce[address] = BigInt(
        await variables.publicClient.getTransactionCount({ address: address })
      )
    }

    return variables.nonce[address]
  }

  const generationStart = new Date()
  const generationYYYY = generationStart.getFullYear().toString()
  const generationMM = (generationStart.getMonth() + 1)
    .toString()
    .padStart(2, "0")
  const generationDD = generationStart.getDate().toString().padStart(2, "0")
  const generationHH = generationStart.getHours().toString().padStart(2, "0")
  const generationmm = generationStart.getMinutes().toString().padStart(2, "0")
  const generationSS = generationStart.getSeconds().toString().padStart(2, "0")
  const batchId = `${generationYYYY}${generationMM}${generationDD}_${generationHH}${generationmm}${generationSS}`

  const deployer = {
    deploy: async (deployInfo: DeployInfo) => {
      const chainId = deployInfo.chainId ?? settings.defaultChainId
      if (!Object.hasOwn(chainVariables, chainId.toString())) {
        chainVariables[chainId.toString()] = {
          publicClient: createPublicClient({
            chain: getChain(chainId),
            transport: http(),
          }) as PublicClient,
          nonce: {},
        }
      }
      const from = deployInfo.from ?? settings.defaultFrom
      const baseFee = deployInfo.baseFee ?? settings.defaultBaseFee
      const priorityFee = deployInfo.priorityFee ?? settings.defaultPriorityFee
      const nonce = await getNonce(from, chainId)

      const create2 = deployInfo.create2 ?? config.defaultCreate2
      const salt = deployInfo.salt
        ? typeof deployInfo.salt === "string"
          ? padBytes(toBytes(deployInfo.salt), { size: 32 })
          : deployInfo.salt
        : config.defaultSalt

      const artifact = await getArtifactAndCompile(
        deployInfo.contract,
        getCurrentContext(),
        compiledProjects
      )
      const predictedAddress = create2
        ? getCreate2Address({
            from: config.create2Deployer,
            salt: salt,
            bytecode: artifact.bytecode,
          })
        : getCreateAddress({
            from: from,
            nonce: nonce,
          })

      const baseTransaction = {
        to: create2 ? config.create2Deployer : undefined,
        value: BigInt(0),
        data: create2
          ? ((fromBytes<"hex">(salt, { to: "hex" }) +
              encodeDeployData({
                abi: artifact.abi,
                bytecode: artifact.bytecode,
                args: deployInfo.args,
              }).replace("0x", "")) as Bytes)
          : encodeDeployData({
              abi: artifact.abi,
              bytecode: artifact.bytecode,
              args: deployInfo.args,
            }),
      } as const
      const deployTransaction: UnsignedDeploymentTransaction = {
        type: "deployment",
        id: `${chainId}_${nonce}_${deployInfo.contract}`,
        batch: batchId,
        deploymentAddress: predictedAddress,
        constructorArgs: deployInfo.args ?? [],
        ...baseTransaction,
        gas: await chainVariables[chainId.toString()].publicClient
          .estimateGas({
            account: from,
            ...baseTransaction,
          })
          .catch(() => BigInt(0)),
        from: from,
        transactionSettings: {
          chainId: chainId,
          nonce: nonce,
          baseFee: baseFee,
          priorityFee: priorityFee,
        },
        salt: create2 ? Buffer.from(salt).toString() : undefined,
        artifact: artifact,
      }
      if (deployTransaction.gas === BigInt(0)) {
        console.warn(`Could not estimate gas for ${deployTransaction.id}`)
      }

      const batchDir = path.join(config.unsignedTransactionsDir, batchId)
      await mkdir(batchDir, {
        recursive: true,
      })
      await writeFile(
        path.join(batchDir, `${deployTransaction.id}.json`),
        transactionToString(deployTransaction)
      )

      chainVariables[chainId.toString()].nonce[from]++
      return predictedAddress
    },
    startContext: (context: string) => {
      executionContext.push(path.join(getCurrentContext(), context))
    },
    finishContext: () => {
      executionContext.pop()
    },
  }

  if (config.deleteUnfishedDeploymentOnGenerate) {
    // Check if all directories are empty (or non-existent)
    const subDirectories = ["unsigned", "queued"] // Except submitted
    const allDirsEmpty = !(
      await Promise.all(
        subDirectories.map(
          (d) =>
            readdir(path.join(config.deploymentsDir, d))
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
          rm(path.join(config.deploymentsDir, d), {
            force: true,
            recursive: true,
          }).catch((error: any) => {
            throw new Error(
              `Could not clean up directory ${path.join(
                config.deploymentsDir,
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
    await deployScript.deploy(deployer)
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
    ).then((transactionFiles) =>
      Promise.all(
        transactionFiles.map(async (transactionFile) => {
          const transactionContent = await readFile(
            path.join(transactionsDir, transactionBatches[i], transactionFile),
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
  const license = forgeArtifact.ast.license
  const jsonDescription: JsonDescription = {
    language: forgeArtifact.metadata.language,
    sources: forgeArtifact.metadata.sources as any, // Will be transformed into the right format in the next step
    settings: {
      optimizer: forgeArtifact.metadata.settings.optimizer,
      remappings: forgeArtifact.metadata.settings.remappings,
    },
    evmVersion: JSON.parse(forgeArtifact.rawMetadata).settings.evmVersion,
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
    license: license,
    jsonDescription: jsonDescription,
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

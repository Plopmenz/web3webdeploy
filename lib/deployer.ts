import { exec } from "child_process"
import { mkdir, readdir, readFile, rm, writeFile } from "fs/promises"
import { promisify } from "util"
import {
  createPublicClient,
  encodeDeployData,
  fromBytes,
  getCreate2Address,
  getCreateAddress,
  http,
  padBytes,
  toBytes,
} from "viem"

import {
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
import { stringToTransaction, transactionToString } from "./transactionString"

const useCreate2 = true
const salt = padBytes(toBytes("web3webdeploy"), { size: 32 })
// From https://book.getfoundry.sh/tutorials/create2-tutorial (using https://github.com/Arachnid/deterministic-deployment-proxy)
const deterministicDeployer = "0x4e59b44847b379578588920ca78fbf26c0b4956c"

const baseDir = ".." as const
const deployDir = `${baseDir}/deploy` as const
const deploymentsDir = `${baseDir}/deployed` as const
const unsignedTransactionsDir = `${deploymentsDir}/unsigned` as const
const submittedTransactionsDir = `${deploymentsDir}/submitted` as const
const artifactsDir = `${baseDir}/out` as const

export async function generate(settings: GenerateSettings) {
  await promisify(exec)("forge compile", { cwd: baseDir })

  const publicClient = createPublicClient({
    transport: http(),
    chain: getChain(Number(settings.transactionSettings.chainId)),
  })
  let nonce = settings.transactionSettings.nonce
  const deployer = {
    deploy: async (deployInfo: DeployInfo) => {
      const artifact = await getArtifact(deployInfo.contract)
      const predictedAddress = useCreate2
        ? getCreate2Address({
            from: deterministicDeployer,
            salt: salt,
            bytecode: artifact.bytecode,
          })
        : getCreateAddress({
            from: settings.from,
            nonce: nonce,
          })

      const baseTransaction = {
        to: useCreate2 ? deterministicDeployer : undefined,
        value: BigInt(0),
        data: useCreate2
          ? ((fromBytes<"hex">(salt, { to: "hex" }) +
              encodeDeployData({
                abi: artifact.abi,
                bytecode: artifact.bytecode,
                args: deployInfo.args,
              }).replace("0x", "")) as Bytes)
          : artifact.bytecode,
      } as const
      const deployTransaction: UnsignedDeploymentTransaction = {
        type: "deployment",
        id: `${nonce}_${deployInfo.contract}`,
        deploymentAddress: predictedAddress,
        constructorArgs: deployInfo.args ?? [],
        ...baseTransaction,
        gas: await publicClient
          .estimateGas({
            account: settings.from,
            ...baseTransaction,
          })
          .catch(() => BigInt(0)),
        from: settings.from,
        transactionSettings: {
          ...settings.transactionSettings,
          nonce: nonce,
        },
        artifact: artifact,
      }
      if (deployTransaction.gas === BigInt(0)) {
        console.warn(`Could not estimate gas for ${deployTransaction.id}`)
      }

      await mkdir(unsignedTransactionsDir, { recursive: true })
      await writeFile(
        `${unsignedTransactionsDir}/${deployTransaction.id}.json`,
        transactionToString(deployTransaction)
      )

      nonce++
      return predictedAddress
    },
  }

  // Check if all directories are empty (or non-existent)
  const subDirectories = ["unsigned", "queued"] // Except submitted
  const allDirsEmpty = !(
    await Promise.all(
      subDirectories.map(
        (d) =>
          readdir(`${deploymentsDir}/${d}`)
            .then((files) => files.length == 0)
            .catch((error) => true) // Assume expection means non-existent
      )
    )
  ).includes(false)

  if (!allDirsEmpty) {
    console.warn("Unfinished deployment found, want to resume instead?")
    // Clear all leftover transactions
    await Promise.all(
      subDirectories.map((d) =>
        rm(`${deploymentsDir}/${d}`, { force: true, recursive: true }).catch(
          (error: any) => {
            throw new Error(
              `Could not clean up directory ${deploymentsDir}/${d}: ${
                error?.message ?? JSON.stringify(error)
              }`
            )
          }
        )
      )
    )
  }

  // redeploy
  const deployScripts = await readdir(deployDir)
  for (let i = 0; i < deployScripts.length; i++) {
    const deployScript: DeployScript = await eval(
      // To bypass the webpack overrides on importing files (so the frontend does not need to be rebuilt in case the deployment scripts change)
      `async function importDeployScript() { const tsImport = await import("ts-import"); return await tsImport.load("${deployDir}/${deployScripts[i]}"); } importDeployScript().catch(console.error);`
    )
    if (!deployScript.deploy) {
      console.warn(
        `Script ${deployScript} in ${deployDir} does not export a correct deploy function.`
      )
      continue
    }

    await deployScript.deploy(deployer)
  }
}

export async function getUnsignedTransactions(): Promise<
  UnsignedTransactionBase[]
> {
  try {
    const unsignedTransactionFiles = await readdir(unsignedTransactionsDir)
    return Promise.all(
      unsignedTransactionFiles.map(async (transactionFile) => {
        const transactionContent = await readFile(
          `${unsignedTransactionsDir}/${transactionFile}`,
          { encoding: "utf-8" }
        )
        // Could check if fileName === transactionId(.json)
        return stringToTransaction(
          transactionContent
        ) as UnsignedTransactionBase
      })
    )
  } catch (error: any) {
    console.warn(
      `Could not load unsigned transactions: ${
        error?.message ?? JSON.stringify(error)
      }`
    )
    return []
  }
}

export async function getSubmittedTransactions(): Promise<
  SubmittedTransaction[]
> {
  try {
    const submittedTransactionFiles = await readdir(submittedTransactionsDir)
    return Promise.all(
      submittedTransactionFiles.map(async (transactionFile) => {
        const transactionContent = await readFile(
          `${submittedTransactionsDir}/${transactionFile}`,
          { encoding: "utf-8" }
        )
        // Could check if fileName === transactionId(.json)
        return stringToTransaction(transactionContent) as SubmittedTransaction
      })
    )
  } catch (error: any) {
    console.warn(
      `Could not load submitted transactions: ${
        error?.message ?? JSON.stringify(error)
      }`
    )
    return []
  }
}

async function getArtifact(contractName: string): Promise<Artifact> {
  const path = `${artifactsDir}/${contractName}.sol/${contractName}.json`
  try {
    const forgeOutput = await readFile(path, { encoding: "utf-8" })
    const forgeArtifact = JSON.parse(forgeOutput) as ForgeArtifact
    return forgeToArtifact(forgeArtifact)
  } catch (error: any) {
    throw new Error(
      `Could not get artifact for ${contractName} at ${path}: ${
        error?.message ?? JSON.stringify(error)
      }`
    )
  }
}

async function forgeToArtifact(
  forgeArtifact: ForgeArtifact
): Promise<Artifact> {
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
      const sourceCode = await readFile(`../${file}`, "utf-8")
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
  transactionId: string,
  transactionHash: Bytes
) {
  const oldPath = `${unsignedTransactionsDir}/${transactionId}.json`
  try {
    const oldData = await readFile(oldPath, { encoding: "utf-8" })
    const newData: SubmittedTransaction = {
      ...(stringToTransaction(oldData) as UnsignedTransactionBase),
      submitted: {
        transactionHash: transactionHash,
        date: new Date(),
      },
    }
    await mkdir(submittedTransactionsDir, { recursive: true })
    await writeFile(
      `${submittedTransactionsDir}/${transactionId}.json`,
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
}

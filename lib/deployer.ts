import { mkdir, readdir, readFile, writeFile } from "fs/promises"
import { promisify } from "util"
import { encodeDeployData, fromBytes, getCreate2Address, toBytes } from "viem"

import {
  Artifact,
  Bytes,
  DeployInfo,
  DeployScript,
  GenerateSettings,
  UnsignedDeploymentTransaction,
  UnsignedTransactionBase,
} from "../types"

import "./bigintJson"

import { exec } from "child_process"

const salt = toBytes("Web3WebDeploy")
// From https://book.getfoundry.sh/tutorials/create2-tutorial (using https://github.com/Arachnid/deterministic-deployment-proxy)
const deterministicDeployer = "0x4e59b44847b379578588920ca78fbf26c0b4956c"

// Presigned (gas fee greedy) or live signing mode
// Show QR code in console / open web page to connect + wc:// for copy pasta (deploy as gnosis safe / dao :eyes:)

const deployDir = "../deploy" as const
const deploymentsDir = "../deployed" as const
const unsignedTransactionsDir = `${deploymentsDir}/unsigned` as const
const artifactsDir = "../out" as const

export async function generate(settings: GenerateSettings) {
  await promisify(exec)("forge compile")

  let nonce = settings.transactionSettings.nonce
  const deployer = {
    deploy: async (deployInfo: DeployInfo) => {
      const artifact = await getArtifact(deployInfo.contract)
      const deployTransaction: UnsignedDeploymentTransaction = {
        type: "deployment",
        to: deterministicDeployer,
        value: BigInt(0),
        data: (fromBytes<"hex">(salt, { to: "hex", size: 32 }) +
          encodeDeployData({
            abi: artifact.abi,
            bytecode: artifact.bytecode.object,
            args: deployInfo.args,
          }).replace("0x", "")) as Bytes,
        transactionSettings: {
          ...settings.transactionSettings,
          nonce: nonce,
        },
        artifact: artifact,
      }
      await mkdir(unsignedTransactionsDir, { recursive: true })
      await writeFile(
        `${unsignedTransactionsDir}/${nonce}_${deployInfo.contract}.json`,
        JSON.stringify(deployTransaction)
      )
      nonce++

      const predictedAddress = getCreate2Address({
        bytecode: artifact.bytecode.object,
        salt: salt,
        from: deterministicDeployer,
      })
      return predictedAddress
    },
  }

  // Check if all directories are empty (or non-existent)
  // Error accessing is assumed error
  const subDirectories = ["unsigned", "queued", "submitted"] // Except confirmed
  const allDirsEmpty = !(
    await Promise.all(
      subDirectories.map((d) =>
        readdir(`${deploymentsDir}/${d}`)
          .then((files) => files.length == 0)
          .catch((error) => true)
      )
    )
  ).includes(false)

  if (!allDirsEmpty) {
    console.warn("Unfinished deployment found, want to resume instead?")
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
  const unsignedTransactionFiles = await readdir(unsignedTransactionsDir)
  return await Promise.all(
    unsignedTransactionFiles.map(async (transactionFile) => {
      const transactionContent = await readFile(
        `${unsignedTransactionsDir}/${transactionFile}`,
        { encoding: "utf-8" }
      )
      return JSON.parse(transactionContent) as UnsignedTransactionBase
    })
  )
}

async function getArtifact(contractName: string): Promise<Artifact> {
  const path = `${artifactsDir}/${contractName}.sol/${contractName}.json`
  try {
    const foundryOutput = await readFile(path, { encoding: "utf-8" })
    return JSON.parse(foundryOutput) as Artifact
  } catch (error: any) {
    throw new Error(
      `Could not get artifact for ${contractName} at ${path}: ${
        error?.message ?? JSON.stringify(error)
      }`
    )
  }
}

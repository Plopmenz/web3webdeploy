import { readFile } from "fs/promises"
import path from "path"
import { Address } from "@/types"
import { padBytes, toBytes } from "viem"

export interface Config {
  deleteUnfishedDeploymentOnGenerate: boolean
  defaultCreate2: boolean
  defaultSalt: Uint8Array
  create2Deployer: Address

  projectRoot: string
  deployDir: string
  deployFile: string
  deploymentsDir: string
  unsignedTransactionsDir: string
  submittedTransactionsDir: string
  artifactsDir: string
}
type ConfigFile = Omit<Config, "defaultSalt"> & {
  defaultSalt: string
}

// Restart to update any changes made
let configCache: Config | undefined

export async function getConfig(): Promise<Config> {
  if (!configCache) {
    const configFile = JSON.parse(
      await readFile(
        path.resolve(path.join("..", "web3webdeploy.config.json")),
        "utf-8"
      ).catch((error) => {
        console.log(error)
        return "{}"
      })
    ) as ConfigFile

    configFile.deleteUnfishedDeploymentOnGenerate ??= false
    configFile.defaultCreate2 ??= false
    configFile.defaultSalt ??= "web3webdeploy"
    configFile.create2Deployer ??= "0x4e59b44847b379578588920ca78fbf26c0b4956c" // From https://book.getfoundry.sh/tutorials/create2-tutorial (using https://github.com/Arachnid/deterministic-deployment-proxy)

    configFile.projectRoot ??= path.resolve("..")
    configFile.deployDir ??= path.join(configFile.projectRoot, "deploy")
    configFile.deployFile ??= path.join(configFile.deployDir, "deploy.ts")
    configFile.deploymentsDir ??= path.join(configFile.projectRoot, "deployed")
    configFile.unsignedTransactionsDir ??= path.join(
      configFile.deploymentsDir,
      "unsigned"
    )
    configFile.submittedTransactionsDir ??= path.join(
      configFile.deploymentsDir,
      "submitted"
    )
    configFile.artifactsDir ??= path.join(configFile.projectRoot, "out")

    configCache = {
      ...configFile,
      defaultSalt: padBytes(toBytes(configFile.defaultSalt), { size: 32 }),
    }
  }

  return configCache
}

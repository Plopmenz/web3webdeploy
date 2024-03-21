import { readdir, readFile } from "fs/promises"
import path from "path"
import { Address } from "@/types"
import { padBytes, toBytes } from "viem"

export interface Config {
  deleteUnfinishedDeploymentOnGenerate: boolean
  defaultCreate2: boolean
  defaultSalt: Uint8Array
  create2Deployer: Address
  defaultExport: boolean
  exportToOriginalProject: boolean
  exportToRootProject: boolean

  projectRoot: string
  deployDir: string
  deployFile: string
  deploymentDir: string
  unsignedTransactionsDir: string
  submittedTransactionsDir: string
  savedDeploymentsDir: string
  exportDir: string
  artifactsDir: string
}
type ConfigFile = Omit<Config, "defaultSalt"> & {
  defaultSalt: string
}

// Restart to update any changes made
const configCache: { [startingPath: string]: Config } = {}
const configFileName = "web3webdeploy.config.json"

export async function getConfig(startingPath?: string): Promise<Config> {
  let configPath = startingPath ?? path.resolve("..")
  if (!Object.hasOwn(configCache, configPath)) {
    try {
      while (
        !(await readdir(configPath).then((files) =>
          files
            .map((file) => path.basename(file) === configFileName)
            .includes(true)
        ))
      ) {
        // Keep going up in directories until one is found that contains a config file
        configPath = path.dirname(configPath)
      }
    } catch (error) {
      console.log(
        `Error finding config file from ${startingPath ?? path.resolve(".")}`,
        error
      )
    }

    const configFile = JSON.parse(
      await readFile(
        path.join(configPath, "web3webdeploy.config.json"),
        "utf-8"
      ).catch((error) => {
        console.log(
          `Error reading config file at ${path.join(
            configPath,
            "web3webdeploy.config.json"
          )}`,
          error
        )
        return JSON.stringify({ projectRoot: path.resolve("..") })
      })
    ) as ConfigFile

    configFile.deleteUnfinishedDeploymentOnGenerate ??= false
    configFile.defaultCreate2 ??= false
    configFile.defaultSalt ??= "web3webdeploy"
    configFile.create2Deployer ??= "0x4e59b44847b379578588920ca78fbf26c0b4956c" // From https://book.getfoundry.sh/tutorials/create2-tutorial (using https://github.com/Arachnid/deterministic-deployment-proxy)
    configFile.defaultExport ??= true
    configFile.exportToOriginalProject ??= false
    configFile.exportToRootProject ??= true

    configFile.projectRoot ??= configPath
    configFile.deployDir ??= path.join(configFile.projectRoot, "deploy")
    configFile.deployFile ??= path.join(configFile.deployDir, "deploy.ts")
    configFile.deploymentDir ??= path.join(configFile.projectRoot, "deployed")
    configFile.unsignedTransactionsDir ??= path.join(
      configFile.deploymentDir,
      "unsigned"
    )
    configFile.submittedTransactionsDir ??= path.join(
      configFile.deploymentDir,
      "submitted"
    )
    configFile.savedDeploymentsDir ??= path.join(
      configFile.deploymentDir,
      "deployments"
    )
    configFile.exportDir ??= path.join(configFile.projectRoot, "export")
    configFile.artifactsDir ??= path.join(configFile.projectRoot, "out")

    configCache[configPath] = {
      ...configFile,
      defaultSalt: padBytes(toBytes(configFile.defaultSalt), { size: 32 }),
    }
  }

  return configCache[configPath]
}

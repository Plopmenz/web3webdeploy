import { UnsignedDeploymentTransaction } from "@/types"
import axios from "axios"
import { encodeDeployData } from "viem"

import { getVerificationExplorer } from "../chains"

// https://etherscan.io/contract-license-types
const licenses = [
  "None",
  "UNLICENSED",
  "MIT",
  "GPL-2.0",
  "GPL-3.0",
  "LGPL-2.1",
  "LGPL-3.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "MPL-2.0",
  "OSL-3.0",
  "Apache-2.0",
  "AGPL-3.0",
  "BUSL-1.1",
]
export async function verifyEtherscan({
  deploymentTransaction,
}: {
  deploymentTransaction: UnsignedDeploymentTransaction
}): Promise<string> {
  const { url, apiKey } = getUrlAndApiKey(deploymentTransaction)
  const response = await axios.post(
    url,
    {
      // https://docs.etherscan.io/api-endpoints/contracts
      apikey: apiKey,
      module: "contract",
      action: "verifysourcecode",
      contractaddress: deploymentTransaction.deploymentAddress,
      sourceCode: JSON.stringify({
        language: deploymentTransaction.artifact.jsonDescription.language,
        sources: deploymentTransaction.artifact.jsonDescription.sources,
        settings: {
          remappings:
            deploymentTransaction.artifact.jsonDescription.settings?.remappings,
          optimizer: {
            enabled:
              deploymentTransaction.artifact.jsonDescription.settings?.optimizer
                ?.enabled,
            runs: deploymentTransaction.artifact.jsonDescription.settings
              ?.optimizer?.runs,
          },
          evmVersion:
            deploymentTransaction.artifact.jsonDescription.settings?.evmVersion,
          viaIR: deploymentTransaction.artifact.jsonDescription.settings?.viaIR,
        },
      }),
      codeformat: "solidity-standard-json-input",
      contractname: deploymentTransaction.artifact.contractName,
      compilerversion: deploymentTransaction.artifact.compiler.version,
      constructorArguements:
        // Viem does not expose the constructor encoding function, so encode deploydata and remove bytecode to get it
        deploymentTransaction.constructorArgs.length > 0
          ? encodeDeployData({
              abi: deploymentTransaction.artifact.abi,
              bytecode: deploymentTransaction.artifact.bytecode,
              args: deploymentTransaction.constructorArgs,
            }).replace(deploymentTransaction.artifact.bytecode, "")
          : undefined,
      licenseType: licenses.indexOf(deploymentTransaction.artifact.license) + 1,
    },
    { headers: { "content-type": "application/x-www-form-urlencoded" } }
  )

  return response.data.result
}

export async function checkPendingEtherscan({
  deploymentTransaction,
  additionalInfo,
}: {
  deploymentTransaction: UnsignedDeploymentTransaction
  additionalInfo: string
}): Promise<{ verified: boolean; busy?: boolean; message: string }> {
  const { url, apiKey } = getUrlAndApiKey(deploymentTransaction)
  const response = await axios.get(url, {
    data: {
      apikey: apiKey,
      guid: additionalInfo,
      module: "contract",
      action: "checkverifystatus",
    },
    headers: { "content-type": "application/x-www-form-urlencoded" },
  })

  return {
    verified:
      response.data.status === "1" ||
      response.data.result === "Already Verified",
    busy: response.data.result === "Pending in queue",
    message: response.data.result,
  }
}

export async function checkVerifiedEtherscan({
  deploymentTransaction,
}: {
  deploymentTransaction: UnsignedDeploymentTransaction
}): Promise<boolean> {
  const { url, apiKey } = getUrlAndApiKey(deploymentTransaction)
  const response = await axios.get(url, {
    data: {
      apikey: apiKey,
      module: "contract",
      action: "getsourcecode", // Is there a better action? getabi is an alternative
      address: deploymentTransaction.deploymentAddress,
    },
    headers: { "content-type": "application/x-www-form-urlencoded" },
  })

  if (response.data.result === "Max rate limit reached") {
    return checkVerifiedEtherscan({ deploymentTransaction })
  }
  return response.data.result?.at(0)?.SourceCode !== ""
}

function getUrlAndApiKey(
  deploymentTransaction: UnsignedDeploymentTransaction
): { url: string; apiKey: string } {
  const explorer = getVerificationExplorer(
    deploymentTransaction.transactionSettings.chainId
  )
  if (!explorer) {
    throw new Error(`No verification explorer for ${deploymentTransaction.id}`)
  }
  const apiKeyEnvVar = `${explorer?.name.toUpperCase()}_API_KEY`
  if (!process.env[apiKeyEnvVar]) {
    console.warn(`${apiKeyEnvVar} env variable not set`)
  }
  return {
    url: explorer.url,
    apiKey: process.env[apiKeyEnvVar] ?? "",
  }
}

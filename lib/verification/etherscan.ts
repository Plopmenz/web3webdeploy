import { Address, UnsignedDeploymentTransaction } from "@/types"
import axios from "axios"

export async function verifyEtherscan({
  deploymentTransaction,
}: {
  deploymentTransaction: UnsignedDeploymentTransaction
}): Promise<string> {
  const response = await axios.post(
    "https://api-sepolia.etherscan.io/api",
    {
      // https://docs.etherscan.io/v/sepolia-etherscan/api-endpoints/contracts
      apikey:
        process.env.ETHERSCAN_API_KEY ?? "ETHERSCAN_API_KEY ENV VAR NOT SET",
      module: "contract",
      action: "verifysourcecode",
      contractaddress: deploymentTransaction.deploymentAddress,
      sourceCode: JSON.stringify({
        language: deploymentTransaction.artifact.jsonDescription.language,
        sources: deploymentTransaction.artifact.jsonDescription.sources,
        settings: {
          optimizer: {
            enabled:
              deploymentTransaction.artifact.jsonDescription.settings?.optimizer
                ?.enabled,
            runs: deploymentTransaction.artifact.jsonDescription.settings
              ?.optimizer?.runs,
          },
          remappings:
            deploymentTransaction.artifact.jsonDescription.settings?.remappings,
          evmVersion: deploymentTransaction.artifact.jsonDescription.evmVersion,
        },
      }),
      codeformat: "solidity-standard-json-input",
      contractname: deploymentTransaction.artifact.contractName,
      compilerversion: deploymentTransaction.artifact.compiler.version,
      constructorArguements: deploymentTransaction.constructorArgs,
      licenseType: deploymentTransaction.artifact.license == "MIT" ? 3 : 0, // https://sepolia.etherscan.io/contract-license-types
    },
    { headers: { "content-type": "application/x-www-form-urlencoded" } }
  )
  return response.data.result
}

export async function checkPendingEtherscan({
  guid,
}: {
  guid: string
}): Promise<{ verified: boolean; message: string }> {
  const response = await axios.get("https://api-sepolia.etherscan.io/api", {
    data: {
      apikey:
        process.env.ETHERSCAN_API_KEY ?? "ETHERSCAN_API_KEY ENV VAR NOT SET",
      guid: guid,
      module: "contract",
      action: "checkverifystatus",
    },
    headers: { "content-type": "application/x-www-form-urlencoded" },
  })
  return {
    verified: response.data.status === "1",
    message: response.data.result,
  }
}

export async function checkVerifiedEtherscan({
  deploymentTransaction,
}: {
  deploymentTransaction: UnsignedDeploymentTransaction
}): Promise<boolean> {
  const response = await axios.get("https://api-sepolia.etherscan.io/api", {
    data: {
      apikey:
        process.env.ETHERSCAN_API_KEY ?? "ETHERSCAN_API_KEY ENV VAR NOT SET",
      module: "contract",
      action: "getsourcecode", // Is there a better action? getabi is an alternative
      address: deploymentTransaction.deploymentAddress,
    },
    headers: { "content-type": "application/x-www-form-urlencoded" },
  })
  if (response.data.result === "Max rate limit reached") {
    return checkVerifiedEtherscan({ deploymentTransaction })
  }
  return response.data.status === "1"
}

import { VerifySettings } from "@/types"
import axios from "axios"
import { encodeDeployData } from "viem"

import { getVerificationExplorer } from "../chains"
import { VerificationService } from "./verificationService"

export class EtherscanVerificationService implements VerificationService {
  // https://etherscan.io/contract-license-types
  private licenses = [
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

  public async verify(verifySettings: VerifySettings): Promise<string> {
    const { url, apiKey } = getUrlAndApiKey(verifySettings.chainId)
    const response = await axios.post(
      url,
      {
        // https://docs.etherscan.io/api-endpoints/contracts
        apikey: apiKey,
        module: "contract",
        action: "verifysourcecode",
        contractaddress: verifySettings.deploymentAddress,
        sourceCode: JSON.stringify({
          language: verifySettings.artifact.jsonDescription.language,
          sources: verifySettings.artifact.jsonDescription.sources,
          settings: {
            remappings:
              verifySettings.artifact.jsonDescription.settings?.remappings,
            optimizer: {
              enabled:
                verifySettings.artifact.jsonDescription.settings?.optimizer
                  ?.enabled,
              runs: verifySettings.artifact.jsonDescription.settings?.optimizer
                ?.runs,
            },
            evmVersion:
              verifySettings.artifact.jsonDescription.settings?.evmVersion,
            viaIR: verifySettings.artifact.jsonDescription.settings?.viaIR,
          },
        }),
        codeformat: "solidity-standard-json-input",
        contractname: verifySettings.artifact.contractName,
        compilerversion: verifySettings.artifact.compiler.version,
        constructorArguements:
          // Viem does not expose the constructor encoding function, so encode deploydata and remove bytecode to get it
          verifySettings.args.length > 0
            ? encodeDeployData({
                abi: verifySettings.artifact.abi,
                bytecode: verifySettings.artifact.bytecode,
                args: verifySettings.args,
              }).replace(verifySettings.artifact.bytecode, "")
            : undefined,
        licenseType: this.licenses.indexOf(verifySettings.artifact.license) + 1,
      },
      { headers: { "content-type": "application/x-www-form-urlencoded" } }
    )

    return response.data.result
  }

  public async checkPending(
    verifySettings: VerifySettings,
    additionalInfo: string
  ): Promise<{ verified: boolean; busy?: boolean; message: string }> {
    const { url, apiKey } = getUrlAndApiKey(verifySettings.chainId)
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

  public async checkVerified(verifySettings: VerifySettings): Promise<boolean> {
    const { url, apiKey } = getUrlAndApiKey(verifySettings.chainId)
    const response = await axios.get(url, {
      data: {
        apikey: apiKey,
        module: "contract",
        action: "getsourcecode", // Is there a better action? getabi is an alternative
        address: verifySettings.deploymentAddress,
      },
      headers: { "content-type": "application/x-www-form-urlencoded" },
    })

    if (response.data.result === "Max rate limit reached") {
      await new Promise((resolve) => setTimeout(resolve, 1000)) // wait 1 second
      return this.checkVerified(verifySettings)
    }
    return response.data.result?.at(0)?.SourceCode !== ""
  }
}

function getUrlAndApiKey(chainId: number): { url: string; apiKey: string } {
  const explorer = getVerificationExplorer(chainId)
  if (!explorer) {
    throw new Error(`No verification explorer for ${chainId}`)
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

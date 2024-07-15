"use client"

import { Dispatch, SetStateAction, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  SubmittedTransaction,
  UnsignedDeploymentTransaction,
  UnsignedTransactionBase,
  VerificationServices,
  VerifySettings,
} from "@/types"
import axios from "axios"
import { useWaitForTransactionReceipt } from "wagmi"

import { getExplorer, getVerificationExplorer } from "@/lib/chains"
import { Button } from "@/components/ui/button"
import {
  VerifyPendingRequest,
  VerifyRequest,
  VerifyStatusRequest,
} from "@/app/api/apiTypes"

function getVerifySettings(
  transaction: UnsignedTransactionBase,
  additionalDeploymentIndex?: number
): VerifySettings | undefined {
  if (additionalDeploymentIndex !== undefined) {
    const additionalDeployment = transaction?.deployments?.at(
      additionalDeploymentIndex
    )
    if (additionalDeployment === undefined) {
      throw new Error(
        `Invalid additional deployment index ${additionalDeploymentIndex} for transaction ${transaction.id}`
      )
    }

    return {
      chainId: transaction.transactionSettings.chainId,
      deploymentAddress: additionalDeployment.deploymentAddress,
      artifact: additionalDeployment.artifact,
      args: additionalDeployment.constructorArgs,
    }
  }

  if (transaction.type === "deployment") {
    const tx = transaction as any as UnsignedDeploymentTransaction
    return {
      chainId: tx.transactionSettings.chainId,
      deploymentAddress: tx.deploymentAddress,
      artifact: tx.artifact,
      args: tx.constructorArgs,
    }
  }

  return undefined
}

enum VerifyState {
  NotVerified = "Not verified.",
  Verifying = "Verifying...",
  Verified = "Verified!",
}
async function getVerified(
  verifySettings: VerifySettings,
  service: VerificationServices
): Promise<VerifyState> {
  const request: VerifyStatusRequest = {
    verifySettings: verifySettings,
    service: service,
  }
  const response = await axios.post(
    "/api/verify/status",
    JSON.stringify(request)
  )

  return response.data.verified ? VerifyState.Verified : VerifyState.NotVerified
}

async function pendingVerification(
  verifySettings: VerifySettings,
  additionalInfo: string,
  service: VerificationServices
): Promise<VerifyState> {
  const request: VerifyPendingRequest = {
    verifySettings: verifySettings,
    additionalInfo: additionalInfo,
    service: service,
  }
  const response = await axios.post(
    "/api/verify/pending",
    JSON.stringify(request)
  )

  if (!response.data.verified) {
    console.warn(
      `Verification of ${verifySettings.chainId}:${verifySettings.deploymentAddress} with ${additionalInfo} returned with status ${response.data.message}`
    )
  }

  if (response.data.busy) {
    console.log(response.data.busy)
    await new Promise((resolve) => setTimeout(resolve, 2000))
    return pendingVerification(verifySettings, additionalInfo, service)
  }
  return response.data.verified ? VerifyState.Verified : VerifyState.NotVerified
}

async function startVerify(
  verifySettings: VerifySettings,
  service: VerificationServices
): Promise<VerifyState> {
  const request: VerifyRequest = {
    verifySettings: verifySettings,
    service: service,
  }
  const response = await axios.post("/api/verify", JSON.stringify(request))
  return pendingVerification(verifySettings, response.data.verifyInfo, service)
}

export function SubmittedTransactionComponent({
  transaction,
  additionalDeploymentIndex,
}: {
  transaction: SubmittedTransaction
  additionalDeploymentIndex?: number
}) {
  const verifySettings = useMemo(
    () => getVerifySettings(transaction, additionalDeploymentIndex),
    [transaction, additionalDeploymentIndex]
  )
  const { isLoading, isError, error } = useWaitForTransactionReceipt({
    hash: transaction.submitted.transactionHash,
    chainId: transaction.transactionSettings.chainId,
  })

  const verified = useMemo<{
    [service: string]: {
      value: VerifyState
      set: Dispatch<SetStateAction<VerifyState>>
    }
  }>(() => {
    return {}
  }, [])
  for (let i = 0; i < Object.values(VerificationServices).length; i++) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [value, set] = useState<VerifyState>(VerifyState.NotVerified)
    verified[Object.values(VerificationServices)[i]] = {
      value: value,
      set: set,
    }
  }

  useEffect(() => {
    if (!verifySettings) {
      return
    }

    for (let i = 0; i < Object.values(VerificationServices).length; i++) {
      const service = Object.values(VerificationServices)[i]
      getVerified(verifySettings, service)
        .then((status) => verified[service].set(status))
        .catch(console.error)
    }
  }, [verifySettings, verified])

  const explorer = getExplorer(transaction.transactionSettings.chainId)
  const verificationExplorer = getVerificationExplorer(
    transaction.transactionSettings.chainId
  )
  const address =
    additionalDeploymentIndex !== undefined
      ? transaction.deployments?.at(additionalDeploymentIndex)
          ?.deploymentAddress
      : transaction.type === "deployment"
        ? (transaction as any as UnsignedDeploymentTransaction)
            .deploymentAddress
        : undefined

  return (
    <div className="grid grid-cols-1 items-center gap-2">
      <h2 className="text-l">
        {transaction.type.toUpperCase()} {transaction.id}
        {additionalDeploymentIndex !== undefined
          ? ` (deployment #${additionalDeploymentIndex + 1})`
          : ""}
        :
      </h2>
      {additionalDeploymentIndex === undefined && (
        <>
          {" "}
          <li>
            Submitted: {transaction.submitted.date.toLocaleDateString()} at{" "}
            {transaction.submitted.date.toLocaleTimeString()}
          </li>
          <div className="grid grid-cols-2 items-center">
            <li>
              Status: {isLoading ? "Waiting for confirmation..." : "Confirmed!"}
            </li>
            {explorer && (
              <Link
                href={`${explorer.url}/tx/${transaction.submitted.transactionHash}`}
                target="_blank"
                passHref
              >
                <Button className="w-full">View on {explorer.name}</Button>
              </Link>
            )}
            {isError && <h2>Error!! {error?.message}</h2>}
          </div>
        </>
      )}
      {address && (
        <li>
          <Link href={`${explorer?.url}/address/${address}`} target="_blank">
            Address: {address}
          </Link>
        </li>
      )}
      {verifySettings && !isLoading && !isError && (
        <div className="grid grid-cols-1 items-center gap-2">
          <VerifyButton
            serviceName={verificationExplorer?.name}
            service={VerificationServices.Etherscan}
            verificationState={verified[VerificationServices.Etherscan].value}
            onClick={() => {
              verified[VerificationServices.Etherscan].set(
                VerifyState.Verifying
              )
              startVerify(verifySettings, VerificationServices.Etherscan)
                .then((status) =>
                  verified[VerificationServices.Etherscan].set(status)
                )
                .catch(console.error)
            }}
          />
          <VerifyButton
            service={VerificationServices.Sourcify}
            verificationState={verified[VerificationServices.Sourcify].value}
            onClick={() => {
              verified[VerificationServices.Sourcify].set(VerifyState.Verifying)
              startVerify(verifySettings, VerificationServices.Sourcify)
                .then((status) =>
                  verified[VerificationServices.Sourcify].set(status)
                )
                .catch(console.error)
            }}
          />
          <VerifyButton
            service={VerificationServices.Tenderly}
            verificationState={verified[VerificationServices.Tenderly].value}
            onClick={() => {
              verified[VerificationServices.Tenderly].set(VerifyState.Verifying)
              startVerify(verifySettings, VerificationServices.Tenderly)
                .then((status) =>
                  verified[VerificationServices.Tenderly].set(status)
                )
                .catch(console.error)
            }}
          />
        </div>
      )}
    </div>
  )
}

function VerifyButton({
  serviceName,
  service,
  verificationState,
  onClick,
}: {
  serviceName?: string
  service: VerificationServices
  verificationState: VerifyState
  onClick: () => void
}) {
  return (
    <div className="grid grid-cols-2 items-center">
      <li>
        Verification on {serviceName ?? service}: {verificationState}
      </li>
      <Button
        onClick={onClick}
        disabled={verificationState !== VerifyState.NotVerified}
      >
        Verify
      </Button>
    </div>
  )
}

"use client"

import { Dispatch, SetStateAction, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  Address,
  SubmittedTransaction,
  UnsignedDeploymentTransaction,
  UnsignedTransactionBase,
  VerificationServices,
} from "@/types"
import axios from "axios"
import { useWaitForTransactionReceipt } from "wagmi"

import { getExplorer, getVerificationExplorer } from "@/lib/chains"
import {
  VerifyPendingRequest,
  VerifyRequest,
  VerifyStatusRequest,
} from "@/app/api/apiTypes"

import { Button } from "../ui/button"

enum VerifyState {
  NotVerified = "Not verified.",
  Verifying = "Verifying...",
  Verified = "Verified!",
}
async function getVerified(
  transaction: UnsignedTransactionBase,
  service: VerificationServices
): Promise<VerifyState> {
  const request: VerifyStatusRequest = {
    // Might cause issues JSON.stringify with bigints? Can use the custom transactionToString, but will put whole transactionjson in string then (instead of actual sub-json)
    deploymentTransaction: transaction as UnsignedDeploymentTransaction,
    service: service,
  }
  const response = await axios.post(
    "/api/verify/status",
    JSON.stringify(request)
  )

  return response.data.verified ? VerifyState.Verified : VerifyState.NotVerified
}

async function pendingVerification(
  transaction: UnsignedTransactionBase,
  additionalInfo: string,
  service: VerificationServices
): Promise<VerifyState> {
  const request: VerifyPendingRequest = {
    // Might cause issues JSON.stringify with bigints? Can use the custom transactionToString, but will put whole transactionjson in string then (instead of actual sub-json)
    deploymentTransaction: transaction as UnsignedDeploymentTransaction,
    additionalInfo: additionalInfo,
    service: service,
  }
  const response = await axios.post(
    "/api/verify/pending",
    JSON.stringify(request)
  )

  if (!response.data.verified) {
    console.warn(
      `Verification of ${transaction.id} with ${additionalInfo} returned with status ${response.data.message}`
    )
  }

  if (response.data.busy) {
    console.log(response.data.busy)
    await new Promise((resolve) => setTimeout(resolve, 2000))
    return pendingVerification(transaction, additionalInfo, service)
  }
  return response.data.verified ? VerifyState.Verified : VerifyState.NotVerified
}

async function startVerify(
  transaction: UnsignedTransactionBase,
  service: VerificationServices
): Promise<VerifyState> {
  const request: VerifyRequest = {
    // Might cause issues JSON.stringify with bigints? Can use the custom transactionToString, but will put whole transactionjson in string then (instead of actual sub-json)
    deploymentTransaction: transaction as UnsignedDeploymentTransaction,
    service: service,
  }
  const response = await axios.post("/api/verify", JSON.stringify(request))
  return pendingVerification(transaction, response.data.verifyInfo, service)
}

export function SubmittedTransactionComponent({
  transaction,
}: {
  transaction: SubmittedTransaction
}) {
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
    if (transaction.type !== "deployment") {
      return
    }

    for (let i = 0; i < Object.values(VerificationServices).length; i++) {
      const service = Object.values(VerificationServices)[i]
      getVerified(transaction, service)
        .then((status) => verified[service].set(status))
        .catch(console.error)
    }
  }, [transaction, verified])

  const explorer = getExplorer(transaction.transactionSettings.chainId)
  const verificationExplorer = getVerificationExplorer(
    transaction.transactionSettings.chainId
  )

  return (
    <div className="grid grid-cols-1 gap-2 items-center">
      <h2 className="text-l">
        {transaction.type.toUpperCase()} {transaction.id}:
      </h2>
      <li>
        Submitted: {transaction.submitted.date.toLocaleDateString()} at{" "}
        {transaction.submitted.date.toLocaleTimeString()}
      </li>
      {transaction.type === "deployment" && (
        <li>
          Address:{" "}
          {
            (transaction as any as UnsignedDeploymentTransaction)
              .deploymentAddress
          }
        </li>
      )}
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
      {transaction.type === "deployment" && !isLoading && !isError && (
        <div className="grid grid-cols-1 gap-2 items-center">
          <VerifyButton
            serviceName={verificationExplorer?.name}
            service={VerificationServices.Etherscan}
            verificationState={verified[VerificationServices.Etherscan].value}
            onClick={() => {
              verified[VerificationServices.Etherscan].set(
                VerifyState.Verifying
              )
              startVerify(transaction, VerificationServices.Etherscan)
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
              startVerify(transaction, VerificationServices.Sourcify)
                .then((status) =>
                  verified[VerificationServices.Sourcify].set(status)
                )
                .catch(console.error)
            }}
          />{" "}
          <VerifyButton
            service={VerificationServices.Tenderly}
            verificationState={verified[VerificationServices.Tenderly].value}
            onClick={() => {
              verified[VerificationServices.Tenderly].set(VerifyState.Verifying)
              startVerify(transaction, VerificationServices.Tenderly)
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

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
import { useWaitForTransaction } from "wagmi"

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
  requestGuid: string,
  service: VerificationServices
): Promise<VerifyState> {
  const request: VerifyPendingRequest = {
    verificationGuid: requestGuid,
    service: service,
  }
  const response = await axios.post(
    "/api/verify/pending",
    JSON.stringify(request)
  )

  if (!response.data.verified) {
    console.warn(
      `Verification ${requestGuid} returned with status ${response.data.message}`
    )
  }
  return response.data.verified
    ? VerifyState.Verified
    : response.data.message === "BUSY"
      ? VerifyState.Verifying
      : VerifyState.NotVerified
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
  return pendingVerification(response.data.verifyInfo, service)
}

export function SubmittedTransactionComponent({
  transaction,
}: {
  transaction: SubmittedTransaction
}) {
  const { isLoading, isError, error } = useWaitForTransaction({
    hash: transaction.submitted.transactionHash,
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

  return (
    <div className="grid grid-cols-1 gap-2 items-center">
      <h2 className="text-l">
        {transaction.type.toUpperCase()} {transaction.id}:
      </h2>
      <li>
        Submitted: {transaction.submitted.date.toLocaleDateString()} at{" "}
        {transaction.submitted.date.toLocaleTimeString()}
      </li>
      <div className="grid grid-cols-2 items-center">
        <li>
          Status: {isLoading ? "Waiting for confirmation..." : "Confirmed!"}
        </li>
        <Link
          href={`https://sepolia.etherscan.io/tx/${transaction.submitted.transactionHash}`}
          target="_blank"
          passHref
        >
          <Button className="w-full">View on Etherscan</Button>
        </Link>
        <div>{isError && <h2>Error!! {error?.message}</h2>}</div>
      </div>
      {transaction.type === "deployment" && (
        <div className="grid grid-cols-1 gap-2 items-center">
          <VerifyButton
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
  service,
  verificationState,
  onClick,
}: {
  service: VerificationServices
  verificationState: VerifyState
  onClick: () => void
}) {
  return (
    <div className="grid grid-cols-2 items-center">
      <li>
        Verification on {service}: {verificationState}
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

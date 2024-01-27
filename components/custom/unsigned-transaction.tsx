"use client"

import {
  Bytes,
  UnsignedDeploymentTransaction,
  UnsignedFunctionTransaction,
  UnsignedTransactionBase,
} from "@/types"
import axios from "axios"
import { useWalletClient } from "wagmi"

import { getChain } from "@/lib/chains"
import { UnsignedToSubmittedRequest } from "@/app/api/apiTypes"

import { Button } from "../ui/button"

export function UnsignedTransactionComponent({
  transaction,
  onSubmit,
}: {
  transaction: UnsignedTransactionBase
  onSubmit: (transactionHash: string) => void
}) {
  const { data: signer } = useWalletClient()

  const execute = async () => {
    if (!signer) {
      throw new Error("No signer")
    }

    const transactionSettings = {
      chain: getChain(transaction.transactionSettings.chainId),
      nonce: Number(transaction.transactionSettings.nonce),
      maxFeePerGas: transaction.transactionSettings.baseFee,
      maxPriorityFeePerGas: transaction.transactionSettings.priorityFee,
      gas: transaction.gas,
      account: transaction.from,
    }
    let transactionHash: Bytes
    if (!transaction.to) {
      const deployTransaction = transaction as UnsignedDeploymentTransaction
      transactionHash = await signer.deployContract({
        abi: deployTransaction.artifact.abi,
        bytecode: deployTransaction.artifact.bytecode,
        args: deployTransaction.constructorArgs,
        ...transactionSettings,
      })
    } else {
      transactionHash = await signer.sendTransaction({
        to: transaction.to,
        value: transaction.value,
        data: transaction.data,
        ...transactionSettings,
      })
    }
    const request: UnsignedToSubmittedRequest = {
      batchId: transaction.batch,
      transactionId: transaction.id,
      transactionHash: transactionHash,
    }
    await axios.post("/api/unsignedToSubmitted", JSON.stringify(request))
    onSubmit(transactionHash)

    // TODO: Allow for signing now and submitting automatically on certain condition
    // const blockchainTransation = {
    //   to: transaction.to ?? zeroAddress,
    //   value: BigInt(transaction.value),
    //   data: transaction.data,
    //   chainId: Number(transaction.transactionSettings.chainId),
    //   nonce: Number(transaction.transactionSettings.nonce),
    //   maxFeePerGas: BigInt(transaction.transactionSettings.baseFee),
    //   maxPriorityFeePerGas: BigInt(transaction.transactionSettings.priorityFee),
    //   gas: BigInt(26144),
    //   accessList: [],
    // }
    // await signer.prepareTransactionRequest(blockchainTransation)
    // const signedTransaction = await signer.signTransaction(blockchainTransation)
    // const signedComponents = fromRlp(signedTransaction)
    // console.log({
    //   type: "eip1559",
    //   ...blockchainTransation,
    //   v: BigInt(signedComponents[9].toString().replace("0x", "")),
    //   r: signedComponents[10] as Bytes,
    //   s: signedComponents[11] as Bytes,
    // })
    // const rawTransaction = serializeTransaction({
    //   type: "eip1559",
    //   ...blockchainTransation,
    //   v: BigInt(signedComponents[9].toString().replace("0x", "")),
    //   r: signedComponents[10] as Bytes,
    //   s: signedComponents[11] as Bytes,
    // })
    // console.log(parseTransaction(rawTransaction))
    // await signer.sendRawTransaction({
    //   serializedTransaction: rawTransaction,
    // })
  }

  return (
    <div className="grid grid-cols-1 gap-2 items-center">
      <h2 className="text-l">
        {transaction.type.toUpperCase()} {transaction.id}:
      </h2>
      {transaction.type === "deployment" &&
        DeploymentTransaction(transaction as UnsignedDeploymentTransaction)}
      {transaction.type === "function" &&
        FunctionTransaction(transaction as UnsignedFunctionTransaction)}
      <div>
        <Button
          onClick={() => {
            execute().catch(console.error)
          }}
          disabled={transaction.gas == BigInt(0)}
        >
          Send transaction
        </Button>
      </div>
    </div>
  )
}

function DeploymentTransaction(transaction: UnsignedDeploymentTransaction) {
  return (
    <div>
      <li>Contract: {transaction.artifact.contractName}</li>
      {transaction.constructorArgs.length > 0 && (
        <li>
          Constructor arguments:{" "}
          {transaction.constructorArgs
            .map((x) => x.toString())
            .reduce((prev, curr) => (prev ? `${prev}, ${curr}` : curr), "")}
        </li>
      )}
      <li>Predicted deployment address: {transaction.deploymentAddress}</li>
      {transaction.salt && <li>CREATE2 salt: {transaction.salt}</li>}
      <li>Transaction signer: {transaction.from}</li>
      <li>Project: {transaction.source}</li>
    </div>
  )
}

function FunctionTransaction(transaction: UnsignedFunctionTransaction) {
  return (
    <div>
      <li>Function: {transaction.functionName}</li>
      {transaction.functionArgs.length > 0 && (
        <li>
          Constructor arguments:{" "}
          {transaction.functionArgs
            .map((x) => x.toString())
            .reduce((prev, curr) => (prev ? `${prev}, ${curr}` : curr), "")}
        </li>
      )}
      <li>To: {transaction.to}</li>
      {transaction.value > BigInt(0) && (
        <li>Value: {transaction.value.toString()}</li>
      )}
      <li>Transaction signer: {transaction.from}</li>
      <li>Project: {transaction.source}</li>
    </div>
  )
}

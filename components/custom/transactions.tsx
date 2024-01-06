"use client"

import "@/lib/bigintJson"

import { useEffect, useState } from "react"
import { SubmittedTransaction, UnsignedTransactionBase } from "@/types"
import axios from "axios"
import { useAccount, useChainId, usePublicClient } from "wagmi"

import { Gwei } from "@/lib/etherUnits"
import { sanitizeTransaction } from "@/lib/transactionString"
import { GenerateRequest } from "@/app/api/apiTypes"

import { Button } from "../ui/button"
import { SubmittedTransactionComponent } from "./submitted-transaction"
import { UnsignedTransactionComponent } from "./unsigned-transaction"

interface AllTransactions {
  unsigned: UnsignedTransactionBase[]
  submitted: SubmittedTransaction[]
}
export function Transactions() {
  const [generating, setGenerating] = useState<boolean>(false)
  const [transactions, setTransactions] = useState<AllTransactions>({
    unsigned: [],
    submitted: [],
  })
  const chainId = useChainId()
  const publicClient = usePublicClient({ chainId: chainId })
  const { address } = useAccount()

  useEffect(() => {
    if (!generating) {
      return
    }

    const generate = async () => {
      if (!publicClient || !address) {
        console.error("Tried to generate without publicClient / address")
        setGenerating(false)
        return
      }

      const nonce = await publicClient.getTransactionCount({
        address: address,
      })
      const request: GenerateRequest = {
        transactionSettings: {
          chainId: BigInt(chainId),
          nonce: BigInt(nonce),
          baseFee: Gwei(25),
          priorityFee: Gwei(1),
        },
        from: address,
      }
      await axios.post("/api/generate", JSON.stringify(request))
      setGenerating(false)
    }

    generate().catch(console.error)
  }, [generating, publicClient, address, chainId])

  const getTransactions = async () => {
    const { data } = await axios.post("/api/transactions")

    const allTransactions: AllTransactions = {
      unsigned: data.unsigned.map(sanitizeTransaction),
      submitted: data.submitted.map(sanitizeTransaction).reverse(), // Reverse to show most recent transactions first
    }
    setTransactions(allTransactions)
  }

  useEffect(() => {
    if (generating) {
      return
    }

    getTransactions().catch(console.error)
  }, [generating])

  return (
    <div>
      <div className="grid grid-cols-1 gap-3">
        <div>
          <Button onClick={() => setGenerating(true)} disabled={generating}>
            Generate New Deploy
          </Button>
        </div>
        <TransactionCategoryHeader header="Unsigned" />
        {transactions.unsigned.map((transaction, i) => (
          <UnsignedTransactionComponent
            transaction={transaction}
            onSubmit={(transactionHash) => getTransactions()}
            key={i.toString()}
          />
        ))}
        <TransactionCategoryHeader header="Submitted" />
        {transactions.submitted.map((transaction, i) => (
          <SubmittedTransactionComponent
            transaction={transaction}
            key={i.toString()}
          />
        ))}
      </div>
    </div>
  )
}

function TransactionCategoryHeader({ header }: { header: string }) {
  return <h1 className="font-bold text-2xl">{header}</h1>
}

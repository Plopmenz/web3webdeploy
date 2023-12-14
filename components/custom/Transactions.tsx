"use client"

import { useEffect, useState } from "react"
import { UnsignedTransactionBase } from "@/types"
import axios from "axios"

import { Button } from "../ui/button"

export default function Transactions() {
  const [generating, setGenerating] = useState<boolean>(false)
  const [transactions, setTransactions] = useState<UnsignedTransactionBase[]>(
    []
  )

  useEffect(() => {
    if (!generating) {
      return
    }

    const generate = async () => {
      await axios.post("/api/generate")
      setGenerating(false)
    }

    generate().catch(console.error)
  }, [generating])

  useEffect(() => {
    if (generating) {
      return
    }

    const generate = async () => {
      const transactions = await axios.post("/api/transactions")
      setTransactions(transactions.data.unsigned)
    }

    generate().catch(console.error)
  }, [generating])

  return (
    <div>
      <Button onClick={() => setGenerating(true)} disabled={generating}>
        Generate New Deploy
      </Button>
      {transactions.map((transaction, i) => (
        <div key={i.toString()}>
          <h2>{transaction.type}:</h2>
          <li>to: {transaction.to}</li>
          <li>value: {transaction.value.toString()}</li>
          <li>data: {transaction.data}</li>
          <li>chainId: {transaction.transactionSettings.chainId.toString()}</li>
          <li>nonce: {transaction.transactionSettings.nonce.toString()}</li>
          <li>baseFee: {transaction.transactionSettings.baseFee.toString()}</li>
          <li>
            priorityFee:{" "}
            {transaction.transactionSettings.priorityFee.toString()}
          </li>
        </div>
      ))}
    </div>
  )
}

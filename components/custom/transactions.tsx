"use client"

import "@/lib/bigintJson"

import { useEffect, useState } from "react"
import { SubmittedTransaction, UnsignedTransactionBase } from "@/types"
import { zodResolver } from "@hookform/resolvers/zod"
import axios from "axios"
import { useForm } from "react-hook-form"
import { useAccount, useChainId, usePublicClient } from "wagmi"
import * as z from "zod"

import { Gwei, gwei } from "@/lib/etherUnits"
import { sanitizeTransaction } from "@/lib/transactionString"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { GenerateRequest } from "@/app/api/apiTypes"

import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { SubmittedTransactionComponent } from "./submitted-transaction"
import { UnsignedTransactionComponent } from "./unsigned-transaction"

interface AllTransactions {
  unsigned: UnsignedTransactionBase[]
  submitted: SubmittedTransaction[]
}
export function Transactions() {
  const generateForm = z.object({
    baseFee: z.string().regex(new RegExp("[0-9]+.?[0-9]*")),
  })

  const [generating, setGenerating] = useState<boolean>(false)
  const [transactions, setTransactions] = useState<AllTransactions>({
    unsigned: [],
    submitted: [],
  })
  const [customGasFee, setCustomGasFee] = useState<boolean>(false)
  const [baseFee, setBaseFee] = useState<bigint>(BigInt(0))
  const form = useForm<z.infer<typeof generateForm>>({
    resolver: zodResolver(generateForm),
    defaultValues: {
      baseFee: "0.0",
    },
  })

  const chainId = useChainId()
  const { address } = useAccount()
  const publicClient = usePublicClient()

  useEffect(() => {
    if (customGasFee) {
      return
    }

    let stop = false
    const setGasPrice = async () => {
      const gasPrice = await publicClient.getGasPrice()
      setBaseFee(gasPrice)
      await new Promise((resolve) => setTimeout(resolve, 10_000))
      if (!stop) {
        await setGasPrice()
      }
    }

    setGasPrice().catch(console.error)

    return () => {
      stop = true
    }
  }, [customGasFee])

  useEffect(() => {
    if (!generating) {
      return
    }

    const generate = async () => {
      if (!address) {
        console.error("Tried to generate without publicClient / address")
        setGenerating(false)
        return
      }

      const request: GenerateRequest = {
        defaultChainId: BigInt(chainId),
        defaultBaseFee: baseFee,
        defaultPriorityFee: Gwei(1),
        defaultFrom: address,
      }
      await axios.post("/api/generate", JSON.stringify(request))
      setGenerating(false)
    }

    generate().catch(console.error)
  }, [generating, address, chainId])

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
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(
              (values: z.infer<typeof generateForm>) => {
                if (customGasFee) {
                  const baseFeeComponents = values.baseFee.split(".")
                  setBaseFee(
                    BigInt(baseFeeComponents[0]) * gwei +
                      BigInt(baseFeeComponents.at(1)?.padEnd(9, "0") ?? 0)
                  )
                }
                setGenerating(true)
              }
            )}
            className="space-y-8"
          >
            <FormField
              control={form.control}
              name="baseFee"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Max gas fee (gwei)</FormLabel>
                  <FormControl>
                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        {...field}
                        disabled={!customGasFee}
                        value={
                          customGasFee
                            ? field.value
                            : `${(baseFee / gwei).toString()}.${(baseFee % gwei)
                                .toString()
                                .padStart(9, "0")}`
                        }
                      />
                      <Button
                        type="button"
                        onClick={() => setCustomGasFee(!customGasFee)}
                      >
                        {customGasFee ? "Set auto" : "Set custom"}
                      </Button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={generating}>
              Generate New Deploy
            </Button>
          </form>
        </Form>
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

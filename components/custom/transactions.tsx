"use client"

import "@/lib/bigintJson"

import { useEffect, useState } from "react"
import { SubmittedTransaction, UnsignedTransactionBase } from "@/types"
import { zodResolver } from "@hookform/resolvers/zod"
import axios from "axios"
import { useForm } from "react-hook-form"
import { formatUnits, parseUnits } from "viem"
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

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../ui/accordion"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { SubmittedTransactionComponent } from "./submitted-transaction"
import { TransactionBatch } from "./transaction-batch"
import { UnsignedTransactionComponent } from "./unsigned-transaction"

interface AllTransactions {
  unsigned: { [batchId: string]: UnsignedTransactionBase[] }
  submitted: { [batchId: string]: SubmittedTransaction[] }
}
export function Transactions() {
  const generateForm = z.object({
    baseFee: z.string().regex(new RegExp("[0-9]+.?[0-9]*")),
    priorityFee: z.string().regex(new RegExp("[0-9]+.?[0-9]*")),
    batchId: z.string().min(1, "This cannot be empty"),
  })

  const [generating, setGenerating] = useState<boolean>(false)
  const [transactions, setTransactions] = useState<AllTransactions>({
    unsigned: {},
    submitted: {},
  })
  const [customGasFee, setCustomGasFee] = useState<boolean>(false)
  const [baseFee, setBaseFee] = useState<bigint>(BigInt(0))
  const form = useForm<z.infer<typeof generateForm>>({
    resolver: zodResolver(generateForm),
    defaultValues: {
      baseFee: "0.0",
      priorityFee: "0.01",
    },
  })

  const chainId = useChainId()
  const { address } = useAccount()
  const publicClient = usePublicClient({ chainId: chainId })

  useEffect(() => {
    if (customGasFee || !publicClient) {
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
  }, [publicClient, customGasFee])

  const onSubmit = (values: z.infer<typeof generateForm>) => {
    setGenerating(true)
    const generate = async () => {
      if (!address) {
        console.error("Tried to generate without address")
        setGenerating(false)
        return
      }

      const request: GenerateRequest = {
        defaultChainId: chainId,
        defaultBaseFee: customGasFee ? parseUnits(values.baseFee, 9) : baseFee,
        defaultPriorityFee: parseUnits(values.priorityFee, 9),
        defaultFrom: address,

        batchId: values.batchId,
      }
      await axios.post("/api/generate", JSON.stringify(request))
    }
    generate()
      .catch(console.error)
      .finally(() => setGenerating(false))
  }

  const getTransactions = async () => {
    const { data } = await axios.post("/api/transactions")

    const sanitize = <T extends UnsignedTransactionBase>(unsanitized: {
      [batchId: string]: T[]
    }) => {
      return Object.keys(unsanitized).reduce(
        (acc: typeof unsanitized, curr: string) => {
          acc[curr] = unsanitized[curr].map(sanitizeTransaction)
          return acc
        },
        {}
      )
    }

    const allTransactions: AllTransactions = {
      unsigned: sanitize(data.unsigned),
      submitted: sanitize(data.submitted),
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
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
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
                          customGasFee ? field.value : formatUnits(baseFee, 9)
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
            <FormField
              control={form.control}
              name="priorityFee"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Priority fee (gwei)</FormLabel>
                  <FormControl>
                    <div className="grid grid-cols-2 gap-3">
                      <Input {...field} />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="batchId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Deployment name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormDescription>
                    This name should make clear to others what deployment this
                    refers to. Its recommended to include values such as chain
                    and smart contracts version.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={generating}>
              Generate New Deploy
            </Button>
          </form>
        </Form>
        <Accordion type="multiple">
          <AccordionItem value="unsigned" className="pt-5">
            <AccordionTrigger>
              <TransactionCategoryHeader header="Unsigned" />
            </AccordionTrigger>
            <AccordionContent>
              <div>
                {Object.keys(transactions.unsigned)
                  // Reverse for most recent ones first
                  .reverse()
                  .map((batchId, i) => (
                    <TransactionBatch
                      batchId={batchId}
                      transactionBatch={transactions.unsigned[batchId]}
                      transactionComponent={(transaction, i) => (
                        <UnsignedTransactionComponent
                          transaction={transaction}
                          onSubmit={(transactionHash) => getTransactions()}
                          key={i.toString()}
                        />
                      )}
                      key={i.toString()}
                    />
                  ))}
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="submitted" className="pt-5">
            <AccordionTrigger>
              <TransactionCategoryHeader header="Submitted" />
            </AccordionTrigger>
            <AccordionContent>
              <div>
                {Object.keys(transactions.submitted)
                  // Reverse for most recent ones first
                  .reverse()
                  .map((batchId, i) => (
                    <TransactionBatch
                      batchId={batchId}
                      transactionBatch={transactions.submitted[batchId]}
                      transactionComponent={(transaction, i) => (
                        <SubmittedTransactionComponent
                          transaction={transaction}
                          key={i.toString()}
                        />
                      )}
                      key={i.toString()}
                    />
                  ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  )
}

function TransactionCategoryHeader({ header }: { header: string }) {
  return <h1 className="font-bold text-2xl">{header}</h1>
}

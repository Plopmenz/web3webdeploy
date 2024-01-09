"use client"

import "@/lib/bigintJson"

import { UnsignedTransactionBase } from "@/types"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../ui/accordion"

export function TransactionBatch<T extends UnsignedTransactionBase>({
  batchId,
  transactionBatch,
  transactionComponent,
}: {
  batchId: string
  transactionBatch: T[]
  transactionComponent: (transaction: T, i: number) => JSX.Element
}) {
  return (
    <Accordion type="single" collapsible>
      <AccordionItem value="item-1">
        <AccordionTrigger>
          <h1 className="font-bold text-xl">{batchId}</h1>
        </AccordionTrigger>
        <AccordionContent>
          <div className="grid grid-cols-1 gap-3">
            {transactionBatch.map(transactionComponent)}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}

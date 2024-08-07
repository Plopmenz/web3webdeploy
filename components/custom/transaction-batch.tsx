"use client"

import "@/lib/bigintJson"

import { UnsignedTransactionBase } from "@/types"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

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
          <h1 className="text-xl font-bold">{batchId}</h1>
        </AccordionTrigger>
        <AccordionContent>
          <div className="grid grid-cols-1 gap-3">
            {transactionBatch
              .sort((t1, t2) => t1.batchIndex - t2.batchIndex)
              .map(transactionComponent)}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}

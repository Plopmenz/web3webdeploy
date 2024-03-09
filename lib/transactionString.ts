import { SubmittedTransaction, UnsignedTransactionBase } from "@/types"

import "./bigintJson"

export function sanitizeTransaction<T extends UnsignedTransactionBase>(
  transaction: T
): T {
  const submittedTranscation = transaction as any as SubmittedTransaction
  return {
    ...transaction,
    value: BigInt(transaction.value),
    transactionSettings: {
      ...transaction.transactionSettings,
      nonce: BigInt(transaction.transactionSettings.nonce),
      baseFee: BigInt(transaction.transactionSettings.baseFee),
      priorityFee: BigInt(transaction.transactionSettings.priorityFee),
    },
    submitted: submittedTranscation.submitted
      ? {
          ...submittedTranscation.submitted,
          date: new Date(submittedTranscation.submitted.date),
        }
      : undefined,
  }
}

export function transactionToString(
  transaction: UnsignedTransactionBase
): string {
  return JSON.stringify(transaction)
}

export function stringToTransaction(
  transaction: string
): UnsignedTransactionBase {
  return sanitizeTransaction(JSON.parse(transaction))
}

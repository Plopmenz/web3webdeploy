import {
  getSubmittedTransactions,
  getUnsignedTransactions,
} from "@/lib/deployer"
import { PromiseObject } from "@/lib/promiseHelper"

// GET gets cached
export async function POST() {
  try {
    const transactions = await PromiseObject({
      unsigned: getUnsignedTransactions(),
      submitted: getSubmittedTransactions(),
    })
    return Response.json(transactions, { status: 200 })
  } catch (error: any) {
    return Response.json(
      { error: error?.message ?? JSON.stringify(error) },
      { status: 500 }
    )
  }
}

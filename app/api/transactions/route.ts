import { getUnsignedTransactions } from "@/lib/deployer"

// GET gets cached
export async function POST() {
  try {
    const transactions = await getUnsignedTransactions()
    return Response.json({ unsigned: transactions }, { status: 200 })
  } catch (error: any) {
    return Response.json(
      { error: error?.message ?? JSON.stringify(error) },
      { status: 500 }
    )
  }
}

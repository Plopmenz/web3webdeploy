import { generate } from "@/lib/deployer"

export async function POST() {
  try {
    await generate({
      transactionSettings: {
        chainId: BigInt(1),
        nonce: BigInt(0),
        baseFee: BigInt(25),
        priorityFee: BigInt(3),
      },
    })
    return Response.json({ message: "OK" }, { status: 200 })
  } catch (error: any) {
    return Response.json(
      { error: error?.message ?? JSON.stringify(error) },
      { status: 500 }
    )
  }
}

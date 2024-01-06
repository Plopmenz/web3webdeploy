import { generate } from "@/lib/deployer.ts"

import { GenerateRequest } from "../apiTypes.ts"

export async function POST(req: Request) {
  try {
    const settings = JSON.parse(await req.text()) as GenerateRequest
    await generate({
      ...settings,
      transactionSettings: {
        chainId: BigInt(settings.transactionSettings.chainId),
        nonce: BigInt(settings.transactionSettings.nonce),
        baseFee: BigInt(settings.transactionSettings.baseFee),
        priorityFee: BigInt(settings.transactionSettings.priorityFee),
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

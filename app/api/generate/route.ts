import { generate } from "@/lib/deployer"

import { GenerateRequest } from "../apiTypes"

export async function POST(req: Request) {
  try {
    const settings = JSON.parse(await req.text()) as GenerateRequest
    await generate({
      ...settings,
      defaultChainId: BigInt(settings.defaultChainId),
      defaultBaseFee: BigInt(settings.defaultBaseFee),
      defaultPriorityFee: BigInt(settings.defaultPriorityFee),
    })
    return Response.json({ message: "OK" }, { status: 200 })
  } catch (error: any) {
    return Response.json(
      { error: error?.message ?? JSON.stringify(error) },
      { status: 500 }
    )
  }
}

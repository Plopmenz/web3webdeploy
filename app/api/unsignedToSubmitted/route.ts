import { unsignedToSubmitted } from "@/lib/deployer"

import { UnsignedToSubmittedRequest } from "../apiTypes"

export async function POST(req: Request) {
  try {
    const settings = JSON.parse(await req.text()) as UnsignedToSubmittedRequest
    await unsignedToSubmitted(
      settings.batchId,
      settings.transactionId,
      settings.transactionHash
    )
    return Response.json({ message: "OK" }, { status: 200 })
  } catch (error: any) {
    return Response.json(
      { error: error?.message ?? JSON.stringify(error) },
      { status: 500 }
    )
  }
}

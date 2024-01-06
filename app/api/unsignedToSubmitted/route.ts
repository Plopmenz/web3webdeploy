import { unsignedToSubmitted } from "@/lib/deployer.ts"

import { UnsignedToSubmittedRequest } from "../apiTypes.ts"

export async function POST(req: Request) {
  try {
    const settings = JSON.parse(await req.text()) as UnsignedToSubmittedRequest
    await unsignedToSubmitted(settings.transactionId, settings.transactionHash)
    return Response.json({ message: "OK" }, { status: 200 })
  } catch (error: any) {
    return Response.json(
      { error: error?.message ?? JSON.stringify(error) },
      { status: 500 }
    )
  }
}

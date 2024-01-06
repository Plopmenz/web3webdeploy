import { checkPending } from "@/lib/verifier.ts"

import { VerifyPendingRequest } from "../../apiTypes.ts"

export async function POST(req: Request) {
  try {
    const settings = JSON.parse(await req.text()) as VerifyPendingRequest
    const status = await checkPending({
      guid: settings.verificationGuid,
      service: settings.service,
    })
    return Response.json(status, { status: 200 })
  } catch (error: any) {
    return Response.json(
      { error: error?.message ?? JSON.stringify(error) },
      { status: 500 }
    )
  }
}

import { checkPending } from "@/lib/verifier"

import { VerifyPendingRequest } from "../../apiTypes"

export async function POST(req: Request) {
  try {
    const settings = JSON.parse(await req.text()) as VerifyPendingRequest
    const status = await checkPending({
      deploymentTransaction: settings.deploymentTransaction,
      additionalInfo: settings.additionalInfo,
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

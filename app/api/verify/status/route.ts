import { checkVerified } from "@/lib/verifier.ts"

import { VerifyStatusRequest } from "../../apiTypes.ts"

export async function POST(req: Request) {
  try {
    const settings = JSON.parse(await req.text()) as VerifyStatusRequest
    const verified = await checkVerified({
      deploymentTransaction: settings.deploymentTransaction,
      service: settings.service,
    })
    return Response.json({ verified: verified }, { status: 200 })
  } catch (error: any) {
    return Response.json({ error: JSON.stringify(error) }, { status: 500 })
  }
}

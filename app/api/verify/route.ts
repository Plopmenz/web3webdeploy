import { verify } from "@/lib/verifier.ts"

import { VerifyRequest } from "../apiTypes.ts"

export async function POST(req: Request) {
  try {
    const settings = JSON.parse(await req.text()) as VerifyRequest
    const info = await verify({
      deploymentTransaction: settings.deploymentTransaction,
      service: settings.service,
    })
    return Response.json({ verifyInfo: info }, { status: 200 })
  } catch (error: any) {
    return Response.json(
      { error: error?.message ?? JSON.stringify(error) },
      { status: 500 }
    )
  }
}

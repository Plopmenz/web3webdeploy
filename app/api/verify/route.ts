import { verify } from "@/lib/verifier"

import { VerifyRequest } from "../apiTypes"

export async function POST(req: Request) {
  try {
    const settings = JSON.parse(await req.text()) as VerifyRequest
    const info = await verify({
      verifySettings: settings.verifySettings,
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

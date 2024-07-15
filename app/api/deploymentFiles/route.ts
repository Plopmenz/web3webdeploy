import { getDeploymentFiles } from "@/lib/deployer"

// GET gets cached
export async function POST() {
  try {
    const deploymentFiles = await getDeploymentFiles()
    return Response.json(deploymentFiles, { status: 200 })
  } catch (error: any) {
    return Response.json(
      { error: error?.message ?? JSON.stringify(error) },
      { status: 500 }
    )
  }
}

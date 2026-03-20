import { getBackendSigner, getShelbyClient } from "@/lib/client"

export const runtime = "nodejs"

export async function POST(req: Request) {

  try {
    const shelby = getShelbyClient()
    const signer = getBackendSigner()

    const formData = await req.formData()
    const file = formData.get("file")

    if (!(file instanceof File)) {
      return Response.json({ error: "No file uploaded" }, { status: 400 })
    }

    const blobData = new Uint8Array(await file.arrayBuffer())
    const expirationMicros = Date.now() * 1000 + 86400_000_000

    await shelby.upload({
      blobData,
      blobName: file.name,
      signer,
      expirationMicros
    })

    return Response.json({
      success: true,
      blobName: file.name,
      owner: signer.accountAddress.toString(),
      sizeBytes: blobData.byteLength
    })

  } catch (error) {

    console.error("UPLOAD ERROR:", error)

    const message = error instanceof Error ? error.message : String(error)

    return Response.json(
      {
        success: false,
        error: message
      },
      { status: 500 }
    )
  }
}

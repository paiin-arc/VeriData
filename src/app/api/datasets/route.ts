export async function GET(req: Request) {

  const { searchParams } = new URL(req.url)
  const owner = searchParams.get("owner")

  if (!owner) {
    return Response.json([])
  }

  try {

    const res = await fetch(
      `https://indexer.testnet.shelby.xyz/blobs?owner=${owner}`
    )

    const data = await res.json()

    const datasets = data.map((blob: any) => ({
      id: blob.blob_id,
      name: blob.blob_name,
      size: (blob.blob_size / 1024 / 1024).toFixed(2) + " MB",
      owner: blob.owner,
      merkle: blob.merkle_root
    }))

    return Response.json(datasets)

  } catch (error) {

    console.error("Dataset fetch error:", error)

    return Response.json([])

  }

}
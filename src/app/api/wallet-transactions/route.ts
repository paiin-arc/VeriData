import { getAptosClient } from "@/lib/aptosClient"

const MAX_TRANSACTION_LIMIT = 25

function parseLimit(limitParam: string | null): number {
  const limit = Number(limitParam)

  if (!Number.isFinite(limit) || limit <= 0) {
    return 10
  }

  return Math.min(Math.trunc(limit), MAX_TRANSACTION_LIMIT)
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const address = searchParams.get("address")
  const limit = parseLimit(searchParams.get("limit"))

  if (!address) {
    return Response.json(
      {
        error: "Missing wallet address"
      },
      { status: 400 }
    )
  }

  try {
    const aptos = getAptosClient()
    const transactions = await aptos.getAccountTransactions({
      accountAddress: address,
      options: {
        limit
      }
    })

    const data = transactions.map((transaction) => {
      const payload =
        "payload" in transaction &&
        transaction.payload &&
        typeof transaction.payload === "object" &&
        "function" in transaction.payload
          ? transaction.payload.function
          : null

      return {
        version: "version" in transaction ? transaction.version : null,
        hash: transaction.hash,
        type: transaction.type,
        sender: "sender" in transaction ? transaction.sender : null,
        success: "success" in transaction ? transaction.success : null,
        vmStatus: "vm_status" in transaction ? transaction.vm_status : null,
        timestamp: "timestamp" in transaction ? transaction.timestamp : null,
        sequenceNumber:
          "sequence_number" in transaction ? transaction.sequence_number : null,
        gasUsed: "gas_used" in transaction ? transaction.gas_used : null,
        function: payload
      }
    })

    return Response.json({
      address,
      count: data.length,
      transactions: data
    })

  } catch (error) {
    console.error("Wallet transactions fetch error:", error)

    const rawMessage =
      error instanceof Error ? error.message : "Failed to fetch wallet transactions"
    const message =
      rawMessage.includes("Per applic") || rawMessage.includes("Unexpected token 'P'")
        ? "Aptos API returned a plain-text rate limit response. Add a valid APTOS_API_KEY in .env.local or wait and retry."
        : rawMessage

    return Response.json(
      {
        error: message
      },
      { status: 500 }
    )
  }
}

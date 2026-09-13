import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function receiptUrl() {
  return (
    process.env.NEXT_PUBLIC_SUBGRAPH_QUERY_URL?.trim() ||
    process.env.SUBGRAPH_QUERY_URL?.trim() ||
    "https://gateway.thegraph.com/api/subgraphs/id/GfvNLa3ym7X6bNDNm6oyqvHGgW2anbzTKhEo7cFPjhvz"
  );
}

function apiKey() {
  return (
    process.env.GRAPH_API_KEY?.trim() ||
    process.env.NEXT_PUBLIC_GRAPH_API_KEY?.trim() ||
    ""
  );
}

/** Server-side Receipt Graph proxy — keeps Gateway auth off the browser. */
export async function POST(req: Request) {
  try {
    const url = receiptUrl();
    if (url.includes("studio.thegraph.com")) {
      return NextResponse.json(
        {
          errors: [
            {
              message:
                "Receipt Graph still points at Studio (429 daily). Set NEXT_PUBLIC_SUBGRAPH_QUERY_URL to gateway.thegraph.com/…/GfvNLa3…",
            },
          ],
        },
        { status: 503 },
      );
    }
    const key = apiKey();
    if (!key) {
      return NextResponse.json(
        { errors: [{ message: "GRAPH_API_KEY missing in packages/web/.env" }] },
        { status: 500 },
      );
    }
    const body = await req.text();
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body,
      cache: "no-store",
    });
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ errors: [{ message }] }, { status: 500 });
  }
}

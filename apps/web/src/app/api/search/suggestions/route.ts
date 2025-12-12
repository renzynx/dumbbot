import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("q");

  if (!query) {
    return NextResponse.json({ suggestions: [] });
  }

  try {
    // Use YouTube's suggestion API
    const response = await fetch(
      `https://suggestqueries-clients6.youtube.com/complete/search?client=youtube&hl=en&gl=us&gs_rn=64&gs_ri=youtube&ds=yt&cp=3&gs_id=h&q=${encodeURIComponent(query)}&xhr=t&xssi=t`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      },
    );

    if (!response.ok) {
      return NextResponse.json({ suggestions: [] });
    }

    const text = await response.text();
    // Remove XSSI protection prefix
    const jsonText = text.replace(/^\)\]\}'\n/, "");
    const data = JSON.parse(jsonText);

    // Extract suggestions from the response
    // YouTube returns: [query, [[suggestion1, ...], [suggestion2, ...], ...], ...]
    const suggestions: string[] = [];
    if (Array.isArray(data) && Array.isArray(data[1])) {
      for (const item of data[1]) {
        if (Array.isArray(item) && typeof item[0] === "string") {
          suggestions.push(item[0]);
        }
      }
    }

    return NextResponse.json({ suggestions: suggestions.slice(0, 10) });
  } catch (error) {
    console.error("Failed to fetch suggestions:", error);
    return NextResponse.json({ suggestions: [] });
  }
}

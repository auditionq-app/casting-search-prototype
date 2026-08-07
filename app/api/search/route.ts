// app/api/search/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getQueryUnderstandingProvider } from "../../../lib/query-understanding";
import { rankCandidates } from "../../../lib/search/rank";
import { prisma } from "../../../lib/prisma";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const query: string | undefined = body?.query;
  const page: number = body?.page ?? 1;
  const pageSize: number = body?.pageSize ?? 20;

  if (!query || typeof query !== "string" || query.trim().length === 0) {
    return NextResponse.json({ error: "query is required" }, { status: 400 });
  }

  const provider = getQueryUnderstandingProvider();
  const parsed = await provider.parse(query);

  const { results, totalCandidates } = await rankCandidates(
    parsed.hard_filters,
    parsed.semantic_query,
    parsed.soft_preferences,
    { page, pageSize }
  );

  // rankCandidates returns ids + scores only — fetch display fields here.
  // findMany with `in` doesn't preserve array order, so re-sort to match
  // the ranking after fetching.
  const profiles = await prisma.artist_profiles.findMany({
    where: { id: { in: results.map((r) => r.id) } },
    select: {
      id: true,
      full_name: true,
      bio: true,
      primary_category: true,
      experience_level: true,
      current_location: true,
      state: true,
      country: true,
    },
  });
  const profileMap = new Map(profiles.map((p) => [p.id, p]));

  const enrichedResults = results.map((r) => {
    const profile = profileMap.get(r.id);
    return {
      id: r.id,
      full_name: profile?.full_name ?? "Unknown",
      bio: profile?.bio ?? null,
      primary_category: profile?.primary_category ?? null,
      experience_level: profile?.experience_level ?? null,
      location: [profile?.current_location, profile?.state, profile?.country]
        .filter(Boolean)
        .join(", "),
      finalScore: r.finalScore,
      vectorScore: r.vectorScore,
      lexicalScore: r.lexicalScore,
      softMatchScore: r.softMatchScore,
    };
  });

  return NextResponse.json({
    query,
    parsed,
    totalCandidates,
    page,
    pageSize,
    results: enrichedResults,
  });
}
// app/api/artist-profiles/[id]/reindex/route.ts
//
// Manual trigger for Phase 4 testing — since this prototype has no real
// profile create/update flow yet, this route lets you enqueue a single
// existing seed row by id and confirm the worker processes it correctly.
//
// Later (Phase 5 backfill, or once merged into the real app's profile save
// route), the same enqueueArtistIngestion() call is all that's needed —
// nothing about the worker changes.

import { NextRequest, NextResponse } from "next/server";
import { enqueueArtistIngestion } from "../../../../../lib/queues/ingestion-queue";
import { prisma } from "../../../../../lib/prisma";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const profile = await prisma.artist_profiles.findUnique({
    where: { id },
    select: { id: true, full_name: true },
  });

  if (!profile) {
    return NextResponse.json(
      { error: `No artist_profiles row found for id ${id}` },
      { status: 404 }
    );
  }

  const job = await enqueueArtistIngestion(id);

  return NextResponse.json({
    message: `Enqueued reindex job for ${profile.full_name}`,
    jobId: job.id,
  });
}
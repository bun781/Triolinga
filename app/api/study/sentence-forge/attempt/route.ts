import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { drills, reviewStates, sentenceReviewAttempts } from "@/db/schema";
import { scheduleSentenceReview } from "@/lib/language/srs";
import type { SentenceGrade } from "@/lib/language/types";
import { getDb, db } from "@/lib/server/db";

const grades = new Set<SentenceGrade>(["easy", "correct", "hard", "failed"]);

export async function POST(request: Request) {
  try {
    await getDb();
    const body = await request.json() as { reviewStateId?: string; drillId?: string; grade?: string; response?: string };

    if (!body.reviewStateId || !body.drillId || !grades.has(body.grade as SentenceGrade)) {
      return NextResponse.json({ error: "Missing reviewStateId, drillId, or valid grade." }, { status: 400 });
    }

    const [state] = await db
      .select({
        reviewStateId: reviewStates.id,
        drillId: drills.id,
        drillType: drills.type
      })
      .from(reviewStates)
      .innerJoin(drills, eq(reviewStates.drillId, drills.id))
      .where(and(
        eq(reviewStates.id, body.reviewStateId),
        eq(drills.id, body.drillId)
      ))
      .limit(1);

    if (!state) {
      return NextResponse.json({ error: "Review state not found." }, { status: 404 });
    }

    const reviewedAt = new Date();
    const schedule = scheduleSentenceReview(body.grade as SentenceGrade, reviewedAt);

    await db.transaction(async (tx) => {
      await tx.insert(sentenceReviewAttempts).values({
        reviewStateId: state.reviewStateId,
        drillId: state.drillId,
        drillType: state.drillType,
        response: body.response,
        grade: body.grade as SentenceGrade,
        attemptedAt: reviewedAt
      });

      await tx.update(reviewStates)
        .set({
          reviewState: schedule.reviewState,
          nextReviewAt: schedule.nextReviewAt,
          intervalDays: schedule.intervalDays,
          lastGrade: body.grade as SentenceGrade,
          lastReviewedAt: reviewedAt,
          updatedAt: reviewedAt
        })
        .where(eq(reviewStates.id, state.reviewStateId));
    });

    return NextResponse.json({ schedule });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to save review attempt." },
      { status: 400 }
    );
  }
}

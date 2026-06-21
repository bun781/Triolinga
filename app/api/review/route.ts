import { NextResponse } from "next/server";
import { updateReviewSentenceState, getReviewSentences } from "@/lib/review/reviewData";
import type { ReviewDecision } from "@/lib/review/types";

const decisions = new Set<ReviewDecision>(["remembered", "forgotten"]);

export async function GET() {
  try {
    return NextResponse.json({ sentences: await getReviewSentences() });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load review sentences." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json() as { sentenceId?: string; decision?: string };
    if (!body.sentenceId || !body.decision || !decisions.has(body.decision as ReviewDecision)) {
      return NextResponse.json({ error: "Missing sentenceId or valid review decision." }, { status: 400 });
    }

    const sentence = await updateReviewSentenceState(body.sentenceId, body.decision as ReviewDecision);
    if (!sentence) {
      return NextResponse.json({ error: "Sentence not found." }, { status: 404 });
    }

    return NextResponse.json({ sentence });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update review sentence." },
      { status: 400 }
    );
  }
}

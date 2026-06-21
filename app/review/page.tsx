import { AppShell } from "@/components/AppShell";
import { ReviewDeck } from "@/components/review/ReviewDeck";
import { getReviewSentences } from "@/lib/review/reviewData";

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const sentences = await getReviewSentences();

  return (
    <AppShell>
      <ReviewDeck sentences={sentences} />
    </AppShell>
  );
}

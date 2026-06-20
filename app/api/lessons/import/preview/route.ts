import { NextResponse } from "next/server";
import { parseLessonJson } from "@/lib/language/importSchema";
import { buildImportPreview } from "@/lib/language/importLesson";
import { getDb } from "@/lib/server/db";

export async function POST(request: Request) {
  try {
    await getDb();
    const { source } = await request.json() as { source?: string };
    const parsed = parseLessonJson(source ?? "");

    if (!parsed.lesson) {
      return NextResponse.json({ errors: parsed.errors }, { status: 400 });
    }

    const preview = await buildImportPreview(parsed.lesson);

    if (preview.validationErrors.length) {
      return NextResponse.json({ errors: preview.validationErrors, preview }, { status: 400 });
    }

    return NextResponse.json({ preview });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to preview lesson." },
      { status: 400 }
    );
  }
}

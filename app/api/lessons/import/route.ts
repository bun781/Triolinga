import { NextResponse } from "next/server";
import { parseLessonJson } from "@/lib/language/importSchema";
import { importApprovedLesson } from "@/lib/language/importLesson";

export async function POST(request: Request) {
  try {
    const { source } = await request.json() as { source?: string };
    const parsed = parseLessonJson(source ?? "");

    if (!parsed.lesson) {
      return NextResponse.json({ errors: parsed.errors }, { status: 400 });
    }

    const result = await importApprovedLesson(parsed.lesson);

    if (result.errors.length) {
      return NextResponse.json({ result }, { status: 400 });
    }

    return NextResponse.json({ result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to import lesson." },
      { status: 400 }
    );
  }
}

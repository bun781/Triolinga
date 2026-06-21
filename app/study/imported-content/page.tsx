import { AppShell } from "@/components/AppShell";
import { ImportedContentStudy } from "@/components/imported-content/ImportedContentStudy";
import { formatLanguageLabel } from "@/lib/language/importResources";
import { getAllLessonsMeta, getLessonContentById } from "@/lib/language/importedContent";

export const dynamic = "force-dynamic";

export default async function ImportedContentPage() {
  const allLessons = await getAllLessonsMeta();
  const latestLesson = allLessons[0] ? await getLessonContentById(allLessons[0].id) : null;

  return (
    <AppShell>
      <div className="topbar">
        <div>
          <h1>Lesson Library</h1>
          <p className="muted">Study saved lessons one sentence at a time, grouped by language.</p>
        </div>
        {latestLesson ? (
          <span className="pill">{formatLanguageLabel(latestLesson.language)} → {formatLanguageLabel(latestLesson.baseLanguage)}</span>
        ) : null}
      </div>

      <ImportedContentStudy lesson={latestLesson} allLessons={allLessons} />
    </AppShell>
  );
}

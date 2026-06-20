import Link from "next/link";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <strong>Habitz</strong>
        <nav aria-label="Primary navigation">
          <Link href="/admin/imports">Import</Link>
          <Link href="/study/sentence-forge">Sentence Forge</Link>
          <Link href="/study/imported-content">Imported Content</Link>
          <Link href="/review">Review</Link>
        </nav>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}

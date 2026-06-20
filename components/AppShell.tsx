"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navLinks = [
  { href: "/admin/imports", label: "Import" },
  { href: "/study/sentence-forge", label: "Sentence Forge" },
  { href: "/study/imported-content", label: "Imported Content" },
  { href: "/review", label: "Review" }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">Habitz</div>
        <nav aria-label="Primary navigation">
          {navLinks.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={pathname === href || pathname.startsWith(href + "/") ? "nav-active" : ""}
            >
              {label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Habitz",
  description: "Lesson import, study, and Sentence Forge review."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}

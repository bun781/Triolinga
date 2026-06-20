import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Habitz",
  description: "Language study — lesson builder, sentence forge, vocabulary review."
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

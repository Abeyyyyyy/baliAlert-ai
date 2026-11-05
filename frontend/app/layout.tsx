import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BaliAlert AI",
  description:
    "Penjelas peringatan resmi BMKG/BPBD untuk wisatawan di Bali. Bukan sumber peringatan resmi.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}

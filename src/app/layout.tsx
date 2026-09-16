import type { Metadata } from "next";
import type { ReactNode } from "react";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";

const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Radar GRU → LON · Varredura de Tarifas 2027",
  description:
    "Sistema de varredura e histórico de preços de passagens São Paulo (GRU) ⇄ Londres — abril a agosto de 2027, viagens de 15–20 dias, com e sem bagagem.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className={`${display.variable} ${plexMono.variable}`}>
      <body className="bg-ink text-snow font-display antialiased">{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import { DM_Sans, Lora } from "next/font/google";
import { Nav } from "@/components/Nav";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  display: "swap",
});

const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Global Pulse — News Intelligence",
  description: "See the world through every lens. Multi-perspective news clustering with bias transparency.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${dmSans.variable} ${lora.variable} font-sans antialiased bg-background text-foreground`}>
        <Nav />
        <main className="min-h-screen pt-16">
          {children}
        </main>
      </body>
    </html>
  );
}

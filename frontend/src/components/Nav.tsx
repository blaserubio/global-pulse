"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Globe, Newspaper, BookOpen, Radio, Search, Eye, Brain } from "lucide-react";

const links = [
  { href: "/", label: "Stories", icon: Newspaper },
  { href: "/psychology", label: "Psychology", icon: Brain },
  { href: "/gaps", label: "Coverage Gaps", icon: Eye },
  { href: "/sources", label: "Sources", icon: Radio },
  { href: "/search", label: "Search", icon: Search },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-surface/80 backdrop-blur-md border-b border-border">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group">
          <Globe className="w-6 h-6 text-blue-400 group-hover:text-blue-300 transition-colors" />
          <span className="font-serif text-xl font-bold tracking-tight">
            Global Pulse
          </span>
        </Link>

        <div className="flex items-center gap-1">
          {links.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-white/10 text-foreground"
                    : "text-muted hover:text-foreground hover:bg-white/5"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/sign", label: "Tanda Tangani" },
  { href: "/verify", label: "Verifikasi" },
];

export default function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="hidden md:flex items-center space-x-1 text-sm">
      {navItems.map(({ href, label }) => {
        const isActive = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            className={`px-3 py-1.5 rounded-md transition-all duration-150 ${
              isActive
                ? "bg-seal/10 text-seal font-medium"
                : "text-ink-muted hover:text-ink hover:bg-black/[0.04]"
            }`}
          >
            {label}
            {isActive && (
              <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-seal align-middle" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}

"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { RainbowKitCustomConnectButton } from "~~/components/helper";
import { CopsLogo } from "~~/components/ui/CopsLogo";
import { ThemeToggle } from "~~/components/ui/ThemeToggle";

export const Header = () => {
  const pathname = usePathname();

  const roles = [
    { href: "/employer", label: "Employer" },
    { href: "/employee", label: "Employee" },
  ];

  return (
    <nav className="sticky top-0 z-20 w-full border-b border-base-300/50 bg-base-200/60 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <Link href="/" className="transition-opacity hover:opacity-80">
          <CopsLogo className="h-7" />
        </Link>

        <div className="flex items-center rounded-lg bg-base-300/60 p-1">
          {roles.map(role => {
            const isActive = pathname === role.href;
            return (
              <Link
                key={role.href}
                href={role.href}
                className={`rounded-md px-4 py-1.5 text-sm font-medium transition-all
                  ${
                    isActive
                      ? "bg-primary text-primary-content shadow-sm"
                      : "text-base-content/60 hover:text-base-content"
                  }`}
              >
                {role.label}
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <RainbowKitCustomConnectButton />
        </div>
      </div>
    </nav>
  );
};

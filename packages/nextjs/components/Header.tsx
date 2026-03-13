"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { RainbowKitCustomConnectButton } from "~~/components/helper";

export const Header = () => {
  const pathname = usePathname();

  const navLinks = [
    { href: "/employer", label: "Employer" },
    { href: "/employee", label: "Employee" },
  ];

  return (
    <div className="sticky lg:static top-0 navbar min-h-0 shrink-0 justify-between z-20 px-0 sm:px-2">
      <div className="navbar-start">
        <Link href="/" className="btn btn-ghost text-lg font-bold">
          COPS
        </Link>
        <ul className="menu menu-horizontal px-1 gap-1">
          {navLinks.map(link => (
            <li key={link.href}>
              <Link href={link.href} className={pathname === link.href ? "active" : ""}>
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <div className="navbar-end grow mr-4">
        <RainbowKitCustomConnectButton />
      </div>
    </div>
  );
};

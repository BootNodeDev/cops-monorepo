"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useTheme } from "next-themes";

type CopsLogoProps = {
  className?: string;
};

export function CopsLogo({ className = "h-8" }: CopsLogoProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = !mounted || resolvedTheme === "dark";

  return (
    <>
      <Image
        src="/logo-dark.svg"
        alt="COPS"
        width={820}
        height={280}
        priority
        className={`${className} w-auto ${isDark ? "block" : "hidden"}`}
      />
      <Image
        src="/logo-light.svg"
        alt="COPS"
        width={820}
        height={280}
        priority
        className={`${className} w-auto ${isDark ? "hidden" : "block"}`}
      />
    </>
  );
}

export function CopsIconMark({ className = "w-8 h-8" }: { className?: string }) {
  return <Image src="/favicon.svg" alt="COPS" width={64} height={64} className={className} />;
}

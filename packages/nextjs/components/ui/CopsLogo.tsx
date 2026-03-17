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

  const src = mounted && resolvedTheme === "light" ? "/logo-light.svg" : "/logo-dark.svg";

  return <Image src={src} alt="COPS" width={820} height={280} priority className={`${className} w-auto`} />;
}

export function CopsIconMark({ className = "w-8 h-8" }: { className?: string }) {
  return <Image src="/favicon.svg" alt="COPS" width={64} height={64} className={className} />;
}

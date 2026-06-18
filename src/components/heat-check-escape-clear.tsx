"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function HeatCheckEscapeClear({ href }: { href: string }) {
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        router.push(href);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [href, router]);

  return null;
}

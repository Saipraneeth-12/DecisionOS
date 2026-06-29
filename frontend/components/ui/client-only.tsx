"use client";
/**
 * ClientOnly — defers rendering children until after hydration.
 * Use to wrap components that read browser-only state (Zustand, localStorage, etc.)
 * and would cause SSR/client HTML mismatches.
 */
import { useEffect, useState, type ReactNode } from "react";

interface ClientOnlyProps {
  children: ReactNode;
  /** Rendered on the server and during the first client paint */
  fallback?: ReactNode;
}

export function ClientOnly({ children, fallback = null }: ClientOnlyProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  return mounted ? <>{children}</> : <>{fallback}</>;
}

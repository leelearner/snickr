import type { ReactNode } from "react";

export function MainContent({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-5xl p-6 ${className}`}>{children}</div>;
}

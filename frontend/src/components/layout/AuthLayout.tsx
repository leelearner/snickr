import type { ReactNode } from "react";

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="grid min-h-screen place-items-center bg-gradient-to-b from-slate-100 to-slate-200 px-4 py-6">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-950 text-xl font-bold text-white shadow-md">
            S
          </div>
          <span className="text-2xl font-bold tracking-tight text-slate-950">Snickr</span>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-7 shadow-sm">
          <div className="mb-6">
            <h1 className="text-xl font-semibold text-slate-950">{title}</h1>
            <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

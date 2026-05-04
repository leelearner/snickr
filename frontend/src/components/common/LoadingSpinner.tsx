import { Loader2 } from "lucide-react";

export function LoadingSpinner({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex min-h-32 items-center justify-center gap-2 text-sm text-slate-500">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span>{label}</span>
    </div>
  );
}

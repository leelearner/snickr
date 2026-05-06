import { initials } from "../../utils/format";

const PALETTE = [
  "bg-rose-500",
  "bg-orange-500",
  "bg-amber-600",
  "bg-emerald-600",
  "bg-teal-600",
  "bg-sky-600",
  "bg-blue-600",
  "bg-indigo-600",
  "bg-violet-600",
  "bg-fuchsia-600",
  "bg-pink-600",
];

function colorFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
}

interface AvatarProps {
  name?: string | null;
  className?: string;
}

export function Avatar({ name, className = "" }: AvatarProps) {
  const seed = (name ?? "").trim() || "?";
  const bg = seed === "?" ? "bg-slate-300" : colorFor(seed);
  return (
    <div
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-sm font-semibold text-white ${bg} ${className}`}
      aria-hidden="true"
    >
      {initials(name)}
    </div>
  );
}

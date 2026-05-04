import { initials } from "../../utils/format";

interface AvatarProps {
  name?: string | null;
  className?: string;
}

export function Avatar({ name, className = "" }: AvatarProps) {
  return (
    <div
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-200 text-sm font-semibold text-slate-700 ${className}`}
      aria-hidden="true"
    >
      {initials(name)}
    </div>
  );
}

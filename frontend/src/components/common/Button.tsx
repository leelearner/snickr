import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Loader2 } from "lucide-react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  isLoading?: boolean;
  leftIcon?: ReactNode;
}

const variants: Record<Variant, string> = {
  primary: "bg-slate-900 text-white hover:bg-slate-800 focus-visible:ring-slate-400",
  secondary:
    "border border-slate-300 bg-white text-slate-900 hover:bg-slate-50 focus-visible:ring-slate-300",
  ghost: "text-slate-700 hover:bg-slate-100 focus-visible:ring-slate-300",
  danger: "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-300",
};

export function Button({
  children,
  className = "",
  disabled,
  isLoading,
  leftIcon,
  variant = "primary",
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : leftIcon}
      {children}
    </button>
  );
}

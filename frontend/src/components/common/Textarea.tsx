import type { TextareaHTMLAttributes } from "react";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function Textarea({ label, error, className = "", id, ...props }: TextareaProps) {
  const inputId = id ?? props.name;
  return (
    <label className="block">
      {label ? (
        <span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>
      ) : null}
      <textarea
        id={inputId}
        className={`min-h-24 w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-100 ${className}`}
        {...props}
      />
      {error ? <p className="mt-1 text-sm text-red-600">{error}</p> : null}
    </label>
  );
}

import { AlertCircle } from "lucide-react";
import { errorMessage } from "../../utils/format";

export function ErrorState({ error, title = "Unable to load" }: { error: unknown; title?: string }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
      <div className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="font-medium">{title}</p>
          <p className="mt-1">{errorMessage(error)}</p>
        </div>
      </div>
    </div>
  );
}

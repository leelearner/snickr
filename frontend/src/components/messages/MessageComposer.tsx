import { KeyboardEvent, useState } from "react";
import { Send } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { messageApi } from "../../api/messages";
import { errorMessage } from "../../utils/format";
import { queryKeys } from "../../utils/queryKeys";

const MAX_LENGTH = 500;
const COUNTER_THRESHOLD = 400;

export function MessageComposer({ channelId, disabled = false }: { channelId: number; disabled?: boolean }) {
  const [content, setContent] = useState("");
  const [validation, setValidation] = useState("");
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (trimmed: string) => messageApi.create(channelId, { content: trimmed }),
    onSuccess: async () => {
      setContent("");
      await queryClient.invalidateQueries({ queryKey: queryKeys.messages(channelId) });
    },
  });

  const length = content.trim().length;
  const canSend = length > 0 && length <= MAX_LENGTH && !disabled && !mutation.isPending;
  const showCounter = length >= COUNTER_THRESHOLD;

  function send() {
    if (!canSend) {
      if (length === 0) return;
      setValidation(`Message must be 1-${MAX_LENGTH} characters.`);
      return;
    }
    setValidation("");
    mutation.mutate(content.trim());
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  }

  return (
    <div className="border-t border-slate-200 bg-white p-3">
      <div className="flex items-end gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 focus-within:border-slate-500 focus-within:ring-2 focus-within:ring-slate-200">
        <textarea
          className="max-h-40 min-h-9 flex-1 resize-none border-0 bg-transparent text-sm leading-6 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed"
          placeholder={disabled ? "Join the channel before posting." : "Message"}
          value={content}
          maxLength={MAX_LENGTH}
          disabled={disabled || mutation.isPending}
          onChange={(event) => setContent(event.target.value)}
          onKeyDown={handleKeyDown}
        />
        {showCounter ? (
          <span className={`shrink-0 self-center text-xs ${length > MAX_LENGTH ? "text-red-600" : "text-slate-400"}`}>
            {length}/{MAX_LENGTH}
          </span>
        ) : null}
        <button
          type="button"
          onClick={send}
          disabled={!canSend}
          className="flex h-8 w-8 shrink-0 items-center justify-center self-end rounded-md bg-blue-600 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
          title="Send"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
      {validation ? <p className="mt-2 text-sm text-red-600">{validation}</p> : null}
      {mutation.error ? <p className="mt-2 text-sm text-red-600">{errorMessage(mutation.error)}</p> : null}
    </div>
  );
}

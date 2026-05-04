import { KeyboardEvent, useState } from "react";
import { Send } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { messageApi } from "../../api/messages";
import { errorMessage } from "../../utils/format";
import { queryKeys } from "../../utils/queryKeys";
import { Button } from "../common/Button";

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

  function send() {
    const trimmed = content.trim();
    if (!trimmed || trimmed.length > 500) {
      setValidation("Message must be 1-500 characters.");
      return;
    }
    setValidation("");
    mutation.mutate(trimmed);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  }

  return (
    <div className="border-t border-slate-200 bg-white p-4">
      <div className="rounded-lg border border-slate-300 bg-white focus-within:border-slate-500 focus-within:ring-2 focus-within:ring-slate-200">
        <textarea
          className="max-h-40 min-h-20 w-full resize-y rounded-lg border-0 px-3 py-2 text-sm outline-none disabled:bg-slate-100"
          placeholder={disabled ? "Join the channel before posting." : "Write a message"}
          value={content}
          maxLength={500}
          disabled={disabled || mutation.isPending}
          onChange={(event) => setContent(event.target.value)}
          onKeyDown={handleKeyDown}
        />
        <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2">
          <span className={`text-xs ${content.trim().length > 500 ? "text-red-600" : "text-slate-400"}`}>
            {content.trim().length}/500
          </span>
          <Button
            className="h-8 px-3"
            leftIcon={<Send className="h-4 w-4" />}
            isLoading={mutation.isPending}
            disabled={disabled}
            onClick={send}
          >
            Send
          </Button>
        </div>
      </div>
      {validation ? <p className="mt-2 text-sm text-red-600">{validation}</p> : null}
      {mutation.error ? <p className="mt-2 text-sm text-red-600">{errorMessage(mutation.error)}</p> : null}
    </div>
  );
}

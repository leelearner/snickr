import { KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { messageApi } from '../../api/messages';
import { errorMessage } from '../../utils/format';
import { displayName as safeDisplayName } from '../../utils/displayName';
import { queryKeys } from '../../utils/queryKeys';
import type { ChannelMember } from '../../types/api';
import { Avatar } from '../common/Avatar';

const MAX_LENGTH = 500;
const COUNTER_THRESHOLD = 400;
const TRIGGER_PATTERN = /@([A-Za-z0-9_.]*)$/;

export function MessageComposer({
  channelId,
  disabled = false,
  members = [],
}: {
  channelId: number;
  disabled?: boolean;
  members?: ChannelMember[];
}) {
  const [content, setContent] = useState('');
  const [validation, setValidation] = useState('');
  const [cursor, setCursor] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (trimmed: string) => messageApi.create(channelId, { content: trimmed }),
    onSuccess: async () => {
      setContent('');
      setCursor(0);
      await queryClient.invalidateQueries({ queryKey: queryKeys.messages(channelId) });
    },
  });

  const triggerMatch = useMemo(() => {
    const before = content.slice(0, cursor);
    return before.match(TRIGGER_PATTERN);
  }, [content, cursor]);

  const suggestions = useMemo(() => {
    if (!triggerMatch) return [] as ChannelMember[];
    const query = triggerMatch[1].toLowerCase();
    return members
      .filter((member) => {
        const name = (member.nickname ?? '').toLowerCase();
        return member.username.toLowerCase().startsWith(query) || name.startsWith(query);
      })
      .slice(0, 6);
  }, [triggerMatch, members]);

  const showSuggestions = suggestions.length > 0;
  const triggerQuery = triggerMatch?.[1];

  useEffect(() => {
    setActiveIndex(0);
  }, [triggerQuery]);

  const length = content.trim().length;
  const canSend = length > 0 && length <= MAX_LENGTH && !disabled && !mutation.isPending;
  const showCounter = length >= COUNTER_THRESHOLD;

  function send() {
    if (!canSend) {
      if (length === 0) return;
      setValidation(`Message must be 1-${MAX_LENGTH} characters.`);
      return;
    }
    setValidation('');
    mutation.mutate(content.trim());
  }

  function applySuggestion(member: ChannelMember) {
    if (!triggerMatch) return;
    const matchStart = cursor - triggerMatch[0].length;
    const before = content.slice(0, matchStart);
    const after = content.slice(cursor);
    const insertion = `@${member.username} `;
    const newValue = before + insertion + after;
    const newCursor = before.length + insertion.length;
    setContent(newValue);
    requestAnimationFrame(() => {
      const ta = textareaRef.current;
      if (ta) {
        ta.focus();
        ta.setSelectionRange(newCursor, newCursor);
      }
      setCursor(newCursor);
    });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (showSuggestions) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveIndex((i) => (i + 1) % suggestions.length);
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        applySuggestion(suggestions[activeIndex]);
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        setCursor(-1);
        return;
      }
      if (event.key === 'Tab') {
        event.preventDefault();
        applySuggestion(suggestions[activeIndex]);
        return;
      }
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  }

  function syncCursor() {
    setCursor(textareaRef.current?.selectionStart ?? content.length);
  }

  return (
    <div className="relative border-t border-slate-200 bg-white p-3">
      {showSuggestions ? (
        <div className="absolute bottom-[calc(100%-0.5rem)] left-3 z-10 w-72 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
          <div className="border-b border-slate-100 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
            People
          </div>
          <ul>
            {suggestions.map((member, index) => (
              <li key={member.userId}>
                <button
                  type="button"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    applySuggestion(member);
                  }}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${
                    index === activeIndex ? 'bg-slate-100' : 'bg-white hover:bg-slate-50'
                  }`}
                >
                  <Avatar
                    name={safeDisplayName(member.nickname, member.username)}
                    className="h-6 w-6 text-xs"
                  />
                  <span className="font-medium text-slate-800">
                    {safeDisplayName(member.nickname, member.username)}
                  </span>
                  <span className="text-xs text-slate-500">@{member.username}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="flex items-end gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 focus-within:border-slate-500 focus-within:ring-2 focus-within:ring-slate-200">
        <textarea
          ref={textareaRef}
          className="max-h-40 min-h-9 flex-1 resize-none border-0 bg-transparent text-sm leading-6 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed"
          placeholder={disabled ? 'Join the channel before posting.' : 'Message'}
          value={content}
          maxLength={MAX_LENGTH}
          disabled={disabled || mutation.isPending}
          onChange={(event) => {
            setContent(event.target.value);
            setCursor(event.target.selectionStart);
          }}
          onKeyDown={handleKeyDown}
          onSelect={syncCursor}
          onClick={syncCursor}
        />
        {showCounter ? (
          <span
            className={`shrink-0 self-center text-xs ${length > MAX_LENGTH ? 'text-red-600' : 'text-slate-400'}`}
          >
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
      {mutation.error ? (
        <p className="mt-2 text-sm text-red-600">{errorMessage(mutation.error)}</p>
      ) : null}
    </div>
  );
}

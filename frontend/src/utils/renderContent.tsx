import { Fragment, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

const MENTION_PATTERN = /@([A-Za-z0-9_.]+)/g;
const INLINE_TOKEN = /\*\*([^*\n]+?)\*\*|\*([^*\n]+?)\*|`([^`\n]+?)`/g;

interface MemberLike {
  userId: number;
  username: string;
}

interface RenderOptions {
  members?: MemberLike[];
  fromWorkspaceId?: number;
}

interface InlineResult {
  nodes: ReactNode[];
  nextKey: number;
}

function renderInline(text: string, baseKey: number): InlineResult {
  const nodes: ReactNode[] = [];
  let key = baseKey;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  INLINE_TOKEN.lastIndex = 0;
  while ((match = INLINE_TOKEN.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(<Fragment key={key++}>{text.slice(lastIndex, match.index)}</Fragment>);
    }
    if (match[1] !== undefined) {
      nodes.push(<strong key={key++}>{match[1]}</strong>);
    } else if (match[2] !== undefined) {
      nodes.push(<em key={key++}>{match[2]}</em>);
    } else if (match[3] !== undefined) {
      nodes.push(
        <code
          key={key++}
          className="rounded bg-slate-100 px-1 font-mono text-[0.9em] text-slate-800"
        >
          {match[3]}
        </code>,
      );
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    nodes.push(<Fragment key={key++}>{text.slice(lastIndex)}</Fragment>);
  }
  return { nodes, nextKey: key };
}

export function renderMessageContent(content: string, options?: RenderOptions): ReactNode {
  const members = options?.members;
  const fromWorkspaceId = options?.fromWorkspaceId;
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  MENTION_PATTERN.lastIndex = 0;
  while ((match = MENTION_PATTERN.exec(content)) !== null) {
    if (match.index > lastIndex) {
      const inline = renderInline(content.slice(lastIndex, match.index), key);
      parts.push(...inline.nodes);
      key = inline.nextKey;
    }
    const username = match[1];
    const member = members?.find((m) => m.username === username);
    if (member) {
      const href = fromWorkspaceId
        ? `/app/users/${member.userId}/messages?from=${fromWorkspaceId}`
        : `/app/users/${member.userId}/messages`;
      parts.push(
        <Link
          key={key++}
          to={href}
          className="rounded bg-blue-50 px-0.5 font-medium text-blue-700 hover:bg-blue-100 hover:underline"
        >
          @{username}
        </Link>,
      );
    } else {
      parts.push(
        <span key={key++} className="rounded bg-blue-50 px-0.5 font-medium text-blue-700">
          @{username}
        </span>,
      );
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < content.length) {
    const inline = renderInline(content.slice(lastIndex), key);
    parts.push(...inline.nodes);
    key = inline.nextKey;
  }
  return parts.length > 0 ? parts : content;
}

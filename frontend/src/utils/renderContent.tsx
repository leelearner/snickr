import { Fragment, type ReactNode } from "react";
import { Link } from "react-router-dom";

const MENTION_PATTERN = /@([A-Za-z0-9_.]+)/g;

interface MemberLike {
  userId: number;
  username: string;
}

interface RenderOptions {
  members?: MemberLike[];
  fromWorkspaceId?: number;
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
      parts.push(<Fragment key={key++}>{content.slice(lastIndex, match.index)}</Fragment>);
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
        <span
          key={key++}
          className="rounded bg-blue-50 px-0.5 font-medium text-blue-700"
        >
          @{username}
        </span>,
      );
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < content.length) {
    parts.push(<Fragment key={key++}>{content.slice(lastIndex)}</Fragment>);
  }
  return parts.length > 0 ? parts : content;
}

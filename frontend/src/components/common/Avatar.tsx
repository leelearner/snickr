import { Link } from 'react-router-dom';
import { initials } from '../../utils/format';

const PALETTE = [
  'bg-rose-500',
  'bg-orange-500',
  'bg-amber-600',
  'bg-emerald-600',
  'bg-teal-600',
  'bg-sky-600',
  'bg-blue-600',
  'bg-indigo-600',
  'bg-violet-600',
  'bg-fuchsia-600',
  'bg-pink-600',
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
  userId?: number;
  fromWorkspaceId?: number;
  className?: string;
}

export function Avatar({ name, userId, fromWorkspaceId, className = '' }: AvatarProps) {
  const seed = (name ?? '').trim() || '?';
  const bg = seed === '?' ? 'bg-slate-300' : colorFor(seed);
  const baseClass = `flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-sm font-semibold text-white ${bg} ${className}`;

  if (userId) {
    const href = fromWorkspaceId
      ? `/app/users/${userId}/messages?from=${fromWorkspaceId}`
      : `/app/users/${userId}/messages`;
    return (
      <Link
        to={href}
        className={`${baseClass} transition hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-1`}
        title={name ? `View ${name}` : 'View user'}
      >
        {initials(name)}
      </Link>
    );
  }

  return (
    <div className={baseClass} aria-hidden="true">
      {initials(name)}
    </div>
  );
}

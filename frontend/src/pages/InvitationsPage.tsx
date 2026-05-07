import { ReactNode, useMemo, useState } from 'react';
import {
  AtSign,
  Check,
  Hash,
  Inbox,
  LayoutGrid,
  LogIn,
  MessageSquare,
  type LucideIcon,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { channelApi } from '../api/channels';
import { mentionsApi } from '../api/mentions';
import { workspaceApi } from '../api/workspaces';
import { EmptyState } from '../components/common/EmptyState';
import { ErrorState } from '../components/common/ErrorState';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { MainContent } from '../components/layout/MainContent';
import { ChannelInvitationCard } from '../components/invitations/ChannelInvitationCard';
import { MentionCard } from '../components/invitations/MentionCard';
import { WorkspaceInvitationCard } from '../components/invitations/WorkspaceInvitationCard';
import { queryKeys } from '../utils/queryKeys';
import { markInboxSeen, readInboxLastSeen } from '../utils/inboxSeen';

function SectionHeader({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
      <Icon className="h-3.5 w-3.5" />
      {children}
    </h2>
  );
}

export function InvitationsPage() {
  const workspaceInvites = useQuery({
    queryKey: queryKeys.workspaceInvitations,
    queryFn: workspaceApi.listMyInvitations,
  });
  const channelInvites = useQuery({
    queryKey: queryKeys.channelInvitations,
    queryFn: channelApi.listMyInvitations,
  });
  const mentions = useQuery({
    queryKey: queryKeys.mentions,
    queryFn: mentionsApi.list,
  });

  // Snapshot lastSeen at first render so unread highlights do not flicker to
  // read just because the user happened to open the Inbox; bump the snapshot
  // only when the user explicitly hits "Mark all as read".
  const [seenAtOpen, setSeenAtOpen] = useState(() => readInboxLastSeen());
  const isUnread = (postedTime: string) => {
    const t = new Date(postedTime).getTime();
    return Number.isFinite(t) && t > seenAtOpen;
  };
  function handleMarkAllRead() {
    markInboxSeen();
    setSeenAtOpen(Date.now());
  }

  const grouped = useMemo(() => {
    const data = mentions.data ?? [];
    return {
      mentions: data.filter((m) => m.kind === 'mention'),
      dms: data.filter((m) => m.kind === 'dm'),
      joins: data.filter((m) => m.kind === 'join'),
    };
  }, [mentions.data]);

  const loading = workspaceInvites.isLoading || channelInvites.isLoading || mentions.isLoading;
  const invitationCount = (workspaceInvites.data?.length ?? 0) + (channelInvites.data?.length ?? 0);
  const notificationCount = grouped.mentions.length + grouped.dms.length + grouped.joins.length;
  const empty = invitationCount === 0 && notificationCount === 0;

  return (
    <MainContent>
      <div className="flex items-start gap-3">
        <Inbox className="mt-1 h-6 w-6 text-slate-700" />
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-slate-950">Inbox</h1>
          <p className="text-sm text-slate-500">
            {invitationCount > 0 || notificationCount > 0
              ? [
                  invitationCount > 0
                    ? `${invitationCount} invitation${invitationCount === 1 ? '' : 's'}`
                    : null,
                  notificationCount > 0
                    ? `${notificationCount} notification${notificationCount === 1 ? '' : 's'}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ')
              : 'Invitations, mentions, direct messages, and join activity show up here.'}
          </p>
        </div>
        {notificationCount > 0 ? (
          <button
            type="button"
            onClick={handleMarkAllRead}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <Check className="h-3.5 w-3.5" />
            Mark all as read
          </button>
        ) : null}
      </div>
      <div className="mt-6 space-y-6">
        {loading ? <LoadingSpinner /> : null}
        {workspaceInvites.error ? <ErrorState error={workspaceInvites.error} /> : null}
        {channelInvites.error ? <ErrorState error={channelInvites.error} /> : null}
        {mentions.error ? <ErrorState error={mentions.error} /> : null}
        {!loading && empty ? (
          <EmptyState
            title="Nothing here yet"
            description="Pending invitations and recent activity show up here."
          />
        ) : null}
        {(workspaceInvites.data?.length ?? 0) > 0 ? (
          <section>
            <SectionHeader icon={LayoutGrid}>Workspace invitations</SectionHeader>
            <div className="space-y-2">
              {workspaceInvites.data?.map((invitation) => (
                <WorkspaceInvitationCard key={invitation.invitationId} invitation={invitation} />
              ))}
            </div>
          </section>
        ) : null}
        {(channelInvites.data?.length ?? 0) > 0 ? (
          <section>
            <SectionHeader icon={Hash}>Channel invitations</SectionHeader>
            <div className="space-y-2">
              {channelInvites.data?.map((invitation) => (
                <ChannelInvitationCard key={invitation.invitationId} invitation={invitation} />
              ))}
            </div>
          </section>
        ) : null}
        {grouped.mentions.length > 0 ? (
          <section>
            <SectionHeader icon={AtSign}>Mentions</SectionHeader>
            <div className="space-y-2">
              {grouped.mentions.map((mention) => (
                <MentionCard
                  key={mention.mentionId}
                  mention={mention}
                  unread={isUnread(mention.postedTime)}
                />
              ))}
            </div>
          </section>
        ) : null}
        {grouped.dms.length > 0 ? (
          <section>
            <SectionHeader icon={MessageSquare}>Direct messages</SectionHeader>
            <div className="space-y-2">
              {grouped.dms.map((mention) => (
                <MentionCard
                  key={mention.mentionId}
                  mention={mention}
                  unread={isUnread(mention.postedTime)}
                />
              ))}
            </div>
          </section>
        ) : null}
        {grouped.joins.length > 0 ? (
          <section>
            <SectionHeader icon={LogIn}>Channel joins</SectionHeader>
            <div className="space-y-2">
              {grouped.joins.map((mention) => (
                <MentionCard
                  key={mention.mentionId}
                  mention={mention}
                  unread={isUnread(mention.postedTime)}
                />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </MainContent>
  );
}

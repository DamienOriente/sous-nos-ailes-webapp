import { ChannelSidebar } from "@/components/collaboration/channel-sidebar";
import { MessageThread } from "@/components/collaboration/message-thread";
import { requireActor } from "@/lib/session";
import { getChannel, listChannels } from "@/modules/collaboration/application/channel-service";
import { listMessages } from "@/modules/collaboration/application/message-service";
import { activeMembersWithChannels } from "@/modules/events/application/member-service";
import { guardPage } from "../../_guards";
import { archiveChannelAction, createChannelAction, deleteMessageAction, editMessageAction, loadOlderMessagesAction, markReadAction, postMessageAction, reportMessageAction, searchMessagesAction, updateChannelMembersAction } from "../actions";

export default async function ChannelPage({ params }: { params: Promise<{ id: string; channelId: string }> }) {
  const { id, channelId } = await params;
  const actor = await requireActor(`/app/evenements/${id}/messages/${channelId}`);
  const { channels, channel, members, thread, access } = await guardPage(async () => {
    const { channels: all, access } = await listChannels(actor, id, { includeArchived: true });
    // Archived channels stay visible to channel managers only.
    const channels = access.permissions.has("event.channels.manage") ? all : all.filter((c) => !c.archivedAt);
    const { channel, members } = await getChannel(actor, id, channelId);
    const thread = await listMessages(actor, id, channelId);
    return { channels, channel, members, thread, access };
  });
  const canManage = access.permissions.has("event.channels.manage");
  const canPost = access.permissions.has("event.channels.post") && !channel.archivedAt;
  const { members: allMembers } = canManage ? await activeMembersWithChannels(id) : { members: [] };
  const serialize = (m: (typeof thread.messages)[number]) => ({ ...m, createdAt: m.createdAt.toISOString(), editedAt: m.editedAt?.toISOString() ?? null, deletedAt: m.deletedAt?.toISOString() ?? null, reportedAt: m.reportedAt?.toISOString() ?? null });
  return (
    <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
      <ChannelSidebar
        eventId={id}
        activeChannelId={channelId}
        channels={channels.map((c) => ({ id: c.id, name: c.name, kind: c.kind, unread: c.unread, archived: Boolean(c.archivedAt), isMember: c.isMember, memberCount: c.memberCount }))}
        canManage={canManage}
        members={allMembers.map((m) => ({ id: m.id, name: m.name, role: m.role }))}
        actions={{ createChannel: createChannelAction, search: searchMessagesAction }}
      />
      <MessageThread
        eventId={id}
        channel={{ id: channel.id, name: channel.name, description: channel.description, kind: channel.kind, archived: Boolean(channel.archivedAt), isOpen: channel.isOpenToAllMembers }}
        members={members.map((m) => ({ memberId: m.memberId, userId: m.userId, name: m.name, role: m.role }))}
        allMembers={allMembers.map((m) => ({ id: m.id, name: m.name, role: m.role }))}
        initialMessages={thread.messages.map(serialize)}
        initialHasMore={thread.hasMore}
        currentUserId={actor.userId}
        canPost={canPost}
        canManage={canManage}
        actions={{ post: postMessageAction, loadOlder: loadOlderMessagesAction, edit: editMessageAction, remove: deleteMessageAction, report: reportMessageAction, markRead: markReadAction, archive: archiveChannelAction, updateMembers: updateChannelMembersAction }}
      />
    </div>
  );
}

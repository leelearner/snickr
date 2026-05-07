from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, StringConstraints


ChannelType = Literal["public", "private", "direct"]
ChannelName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=50)]
Username = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=30)]


class ChannelCreate(BaseModel):
    channelName: ChannelName
    type: ChannelType = "public"


class ChannelSummary(BaseModel):
    channelId: int
    channelName: str
    type: ChannelType
    isMember: bool
    directUserId: int | None = None
    directUsername: str | None = None
    directNickname: str | None = None


class DirectMessageCreate(BaseModel):
    targetUserId: int


class ChannelMember(BaseModel):
    userId: int
    username: str
    nickname: str | None = None
    joinedTime: datetime


class ChannelDetail(BaseModel):
    channelId: int
    workspaceId: int
    channelName: str
    type: ChannelType
    createdBy: int
    createdTime: datetime
    isMember: bool
    members: list[ChannelMember]


class ChannelInviteCreate(BaseModel):
    username: Username


class ChannelInvitation(BaseModel):
    invitationId: int
    channelId: int
    channelName: str
    workspaceId: int
    workspaceName: str
    inviterUsername: str
    invitedTime: datetime


class InviteResponse(BaseModel):
    accept: bool

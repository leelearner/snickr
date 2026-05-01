from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


ChannelType = Literal["public", "private", "direct"]


class ChannelCreate(BaseModel):
    channelName: str = Field(min_length=1, max_length=50)
    type: ChannelType = "public"


class ChannelSummary(BaseModel):
    channelId: int
    channelName: str
    type: ChannelType
    isMember: bool


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
    username: str = Field(min_length=1, max_length=30)


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

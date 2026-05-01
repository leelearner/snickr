from datetime import datetime

from pydantic import BaseModel, Field


class WorkspaceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=30)
    description: str | None = Field(default=None, max_length=200)


class WorkspaceSummary(BaseModel):
    workspaceId: int
    name: str
    description: str | None = None
    myRole: str


class WorkspaceMember(BaseModel):
    userId: int
    username: str
    nickname: str | None = None
    role: str
    joinedTime: datetime


class WorkspaceDetail(BaseModel):
    workspaceId: int
    name: str
    description: str | None = None
    createdTime: datetime
    createdBy: int | None = None
    myRole: str
    members: list[WorkspaceMember]


class InviteCreate(BaseModel):
    username: str = Field(min_length=1, max_length=30)


class WorkspaceInvitation(BaseModel):
    invitationId: int
    workspaceId: int
    workspaceName: str
    inviterUsername: str
    invitedTime: datetime


class InviteResponse(BaseModel):
    accept: bool


class StaleChannelInvite(BaseModel):
    channelId: int
    channelName: str
    pendingInvitesOver5Days: int


class AdminEntry(BaseModel):
    workspaceId: int
    workspaceName: str
    userId: int
    username: str
    nickname: str | None = None

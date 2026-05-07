from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, StringConstraints


WorkspaceName = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=30)
]
WorkspaceDescription = Annotated[str, StringConstraints(strip_whitespace=True, max_length=200)]
Username = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=30)]


class WorkspaceCreate(BaseModel):
    name: WorkspaceName
    description: WorkspaceDescription | None = None


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
    username: Username


class WorkspaceInvitation(BaseModel):
    invitationId: int
    workspaceId: int
    workspaceName: str
    inviterUsername: str
    invitedTime: datetime


class InviteResponse(BaseModel):
    accept: bool


class RoleChange(BaseModel):
    role: Literal["admin", "member"]


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

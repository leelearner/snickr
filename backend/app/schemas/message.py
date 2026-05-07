from datetime import datetime

from pydantic import BaseModel, Field


class MessageCreate(BaseModel):
    content: str = Field(min_length=1, max_length=500)


class MessageUpdate(BaseModel):
    content: str = Field(min_length=1, max_length=500)


class MessageOut(BaseModel):
    messageId: int
    content: str
    postedTime: datetime
    editedTime: datetime | None = None
    systemKind: str | None = None
    postedBy: int
    postedByUsername: str
    postedByNickname: str | None = None


class MessageWithLocation(BaseModel):
    messageId: int
    content: str
    postedTime: datetime
    editedTime: datetime | None = None
    systemKind: str | None = None
    workspaceId: int
    workspaceName: str
    channelId: int
    channelName: str
    postedBy: int
    postedByUsername: str
    postedByNickname: str | None = None

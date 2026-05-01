from datetime import datetime

from pydantic import BaseModel, Field


class MessageCreate(BaseModel):
    content: str = Field(min_length=1, max_length=500)


class MessageOut(BaseModel):
    messageId: int
    content: str
    postedTime: datetime
    postedBy: int
    postedByUsername: str
    postedByNickname: str | None = None


class MessageWithLocation(BaseModel):
    messageId: int
    content: str
    postedTime: datetime
    workspaceId: int
    workspaceName: str
    channelId: int
    channelName: str
    postedBy: int
    postedByUsername: str
    postedByNickname: str | None = None

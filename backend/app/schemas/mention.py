from datetime import datetime
from typing import Literal

from pydantic import BaseModel


MentionKind = Literal["mention", "dm", "join"]


class MentionOut(BaseModel):
    mentionId: int
    messageId: int
    content: str
    postedTime: datetime
    workspaceId: int
    workspaceName: str
    channelId: int
    channelName: str
    channelType: Literal["public", "private", "direct"]
    kind: MentionKind
    postedBy: int
    postedByUsername: str
    postedByNickname: str | None = None

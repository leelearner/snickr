from datetime import datetime
from typing import Annotated

from pydantic import AfterValidator, BaseModel, StringConstraints


# Trim leading/trailing whitespace before validating length, so a body of "   "
# fails min_length=1 instead of slipping through and being persisted as blank.
def reject_nul_byte(value: str) -> str:
    if "\x00" in value:
        raise ValueError("content must not contain NUL bytes")
    return value


MessageContent = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=500),
    AfterValidator(reject_nul_byte),
]


class MessageCreate(BaseModel):
    content: MessageContent


class MessageUpdate(BaseModel):
    content: MessageContent


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

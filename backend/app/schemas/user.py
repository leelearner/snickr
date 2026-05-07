from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, EmailStr, Field, StringConstraints


Username = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=30)]
Nickname = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=30)]


class UserRegister(BaseModel):
    email: EmailStr
    username: Username
    password: str = Field(min_length=8, max_length=128)
    nickname: Nickname | None = None


class UserLogin(BaseModel):
    username: str
    password: str


class UserOut(BaseModel):
    userId: int
    email: EmailStr
    username: str
    nickname: str | None = None
    createdTime: datetime | None = None


class ProfileUpdate(BaseModel):
    # Reject unknown fields so a stray "password" key cannot be silently dropped.
    model_config = ConfigDict(extra="forbid")

    email: EmailStr | None = None
    nickname: Nickname | None = None
    currentPassword: str | None = None
    newPassword: str | None = Field(default=None, min_length=8, max_length=128)

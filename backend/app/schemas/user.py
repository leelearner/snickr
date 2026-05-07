from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, EmailStr, Field, StringConstraints, field_validator


# Usernames are restricted to letters, digits, underscore, and period. This
# keeps them URL-safe, blocks angle brackets and other HTML-looking junk, and
# matches what the @-mention parser is willing to address.
Username = Annotated[
    str,
    StringConstraints(
        strip_whitespace=True, min_length=1, max_length=30, pattern=r"^[A-Za-z0-9_.]+$"
    ),
]
# Nicknames are free-form display names but cannot contain angle brackets, so
# users can't register with HTML-looking values like <img onerror=...>.
Nickname = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=30, pattern=r"^[^<>]+$"),
]


class UserRegister(BaseModel):
    email: EmailStr
    username: Username
    password: str = Field(min_length=8, max_length=128)
    nickname: Nickname | None = None

    @field_validator("email", "username")
    @classmethod
    def normalize_identity_fields(cls, value: str) -> str:
        return value.lower()


class UserLogin(BaseModel):
    username: str
    password: str

    @field_validator("username")
    @classmethod
    def normalize_username(cls, value: str) -> str:
        return value.strip().lower()


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

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.lower()

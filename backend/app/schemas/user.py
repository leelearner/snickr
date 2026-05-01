from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class UserRegister(BaseModel):
    email: EmailStr
    username: str = Field(min_length=1, max_length=30)
    password: str = Field(min_length=1, max_length=128)
    nickname: str | None = Field(default=None, max_length=30)


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
    email: EmailStr | None = None
    nickname: str | None = Field(default=None, max_length=30)
    currentPassword: str | None = None
    newPassword: str | None = Field(default=None, min_length=1, max_length=128)

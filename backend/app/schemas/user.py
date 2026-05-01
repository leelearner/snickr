"""Pydantic models for user-facing payloads.

Field names match the JSON contract (camelCase). The schema column names
in Postgres are lowercase (see SQL aliases in the route handlers).
"""

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
    """User shape returned to the frontend. Never includes the password hash."""

    userId: int
    email: EmailStr
    username: str
    nickname: str | None = None
    createdTime: datetime | None = None

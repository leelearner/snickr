"""Reusable FastAPI dependencies for the v1 API."""

from fastapi import HTTPException, Request, status


def current_user_id(request: Request) -> int:
    """Return the logged-in user's id, or 401 if no session."""
    user_id = request.session.get("user_id")
    if not user_id:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="not authenticated")
    return user_id

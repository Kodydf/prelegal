"""Sign up / sign in / sign out, with a server-side session in an HttpOnly cookie."""

import re
import sqlite3

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import field_validator

from app import store
from app.db import get_db
from app.schemas import CamelModel
from app.security import DUMMY_HASH, hash_password, new_session_token, verify_password

SESSION_COOKIE = "prelegal_session"
MIN_PASSWORD_LENGTH = 8
MAX_PASSWORD_LENGTH = 128  # bounds the work scrypt does per request

_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

router = APIRouter(prefix="/api/auth", tags=["auth"])


class Credentials(CamelModel):
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def _normalize_email(cls, value: str) -> str:
        value = value.strip().lower()
        if len(value) > 254 or not _EMAIL.match(value):
            raise ValueError("Enter a valid email address.")
        return value

    @field_validator("password")
    @classmethod
    def _check_password_length(cls, value: str) -> str:
        if len(value) > MAX_PASSWORD_LENGTH:
            raise ValueError(f"Password must be at most {MAX_PASSWORD_LENGTH} characters.")
        return value


class UserResponse(CamelModel):
    email: str


def _start_session(db: sqlite3.Connection, response: Response, user: store.User) -> None:
    token = new_session_token()
    store.create_session(db, user.id, token)
    response.set_cookie(
        SESSION_COOKIE,
        token,
        max_age=int(store.SESSION_LIFETIME.total_seconds()),
        httponly=True,
        samesite="lax",
        path="/",
    )


def current_user(request: Request, db: sqlite3.Connection = Depends(get_db)) -> store.User:
    """Dependency: the signed-in user, or 401."""
    token = request.cookies.get(SESSION_COOKIE)
    user = store.user_for_session(db, token) if token else None
    if user is None:
        raise HTTPException(status_code=401, detail="Please sign in.")
    return user


@router.post("/signup", response_model=UserResponse, status_code=201)
def sign_up(credentials: Credentials, response: Response, db: sqlite3.Connection = Depends(get_db)):
    if len(credentials.password) < MIN_PASSWORD_LENGTH:
        raise HTTPException(status_code=422, detail=f"Password must be at least {MIN_PASSWORD_LENGTH} characters.")
    try:
        user = store.create_user(db, credentials.email, hash_password(credentials.password))
    except store.EmailTaken as exc:
        raise HTTPException(status_code=409, detail="An account with that email already exists.") from exc
    _start_session(db, response, user)
    return UserResponse(email=user.email)


@router.post("/signin", response_model=UserResponse)
def sign_in(credentials: Credentials, response: Response, db: sqlite3.Connection = Depends(get_db)):
    found = store.find_user_with_hash(db, credentials.email)
    # Always verify against some hash, so timing doesn't reveal whether the email is registered.
    password_ok = verify_password(credentials.password, found[1] if found else DUMMY_HASH)
    if found is None or not password_ok:
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    _start_session(db, response, found[0])
    return UserResponse(email=found[0].email)


@router.post("/signout", status_code=204)
def sign_out(request: Request, response: Response, db: sqlite3.Connection = Depends(get_db)):
    token = request.cookies.get(SESSION_COOKIE)
    if token:
        store.delete_session(db, token)
    response.delete_cookie(SESSION_COOKIE, path="/")


@router.get("/me", response_model=UserResponse)
def me(user: store.User = Depends(current_user)):
    return UserResponse(email=user.email)

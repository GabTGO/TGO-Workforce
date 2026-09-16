import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_effective_role, require_account, require_super_admin
from app.core.db import get_db
from app.models.account import Account, AccountRole
from app.models.feedback import Feedback, FeedbackComment
from app.schemas.feedback import (
    FeedbackAdminUpdate,
    FeedbackCommentCreate,
    FeedbackCommentRead,
    FeedbackCreate,
    FeedbackReactionToggle,
    FeedbackRead,
)

# Open to every signed-in account — this isn't a module in the permission
# matrix sense (see app/services/permissions.py's module comment); it's a
# shared feedback inbox anyone can read and post to. The reply-thread routes
# below are further restricted per-card (see _can_access_thread) rather than
# at the router level, since "can you read this card" already varies by
# whether it's yours; the PATCH/DELETE routes are Super-Admin-only.
router = APIRouter(prefix="/feedback", tags=["feedback"], dependencies=[Depends(require_account)])

DbSession = Annotated[AsyncSession, Depends(get_db)]
CurrentAccount = Annotated[Account, Depends(require_account)]
SuperAdminAccount = Annotated[Account, Depends(require_super_admin)]

# A pasted screenshot easily runs a few MB before base64 inflates it further
# (~33%) — this caps the *encoded* string length at roughly what a 4MB image
# becomes, generous for a "proof of a bug" screenshot without letting the
# feedback table balloon. The frontend also downsizes large images before
# sending (see feedback-thread-dialog.tsx), so this should rarely actually
# trigger — it's the backstop, not the primary control.
MAX_IMAGE_DATA_URL_LENGTH = 6_000_000

# How many screenshots a single report can carry — generous for "here's proof
# of the bug from a few angles" without letting one report's row balloon.
MAX_SCREENSHOTS = 6


def _actor_label(account: Account) -> str:
    return account.display_name or account.email


def _to_read(feedback: Feedback, *, reveal_reporter: bool, is_own: bool, comment_count: int) -> FeedbackRead:
    """The one place that decides whether a card's reporter identity is
    visible — reveal_reporter is true only for a Super Admin (see the call
    sites below), everyone else always gets reported_by_label=None regardless
    of what's actually stored. is_own is safe to reveal to anyone regardless
    — see FeedbackRead.is_own's own comment."""
    data = FeedbackRead.model_validate(feedback)
    if not reveal_reporter:
        data.reported_by_label = None
    data.is_own = is_own
    data.comment_count = comment_count
    return data


def _can_access_thread(feedback: Feedback, account: Account, request: Request) -> bool:
    """Only the card's own reporter or a Super Admin may read or post to its
    reply thread — everyone else doesn't even know it exists. Unlike the
    reported_by_label field (hidden from view but the card itself is still
    visible to everyone), a thread you can't access 404s outright rather than
    returning an empty list, so its existence isn't distinguishable from a
    card that has no thread at all."""
    if get_effective_role(account, request) == AccountRole.SUPER_ADMIN:
        return True
    return feedback.reported_by_id is not None and feedback.reported_by_id == account.id


async def _comment_counts(db: AsyncSession, feedback_ids: list[uuid.UUID]) -> dict[uuid.UUID, int]:
    if not feedback_ids:
        return {}
    result = await db.execute(
        select(FeedbackComment.feedback_id, func.count())
        .where(FeedbackComment.feedback_id.in_(feedback_ids))
        .group_by(FeedbackComment.feedback_id)
    )
    return dict(result.all())


@router.get("", response_model=list[FeedbackRead])
async def list_feedback(
    db: DbSession,
    account: CurrentAccount,
    request: Request,
) -> list[FeedbackRead]:
    is_super_admin = get_effective_role(account, request) == AccountRole.SUPER_ADMIN
    result = await db.execute(select(Feedback).order_by(Feedback.created_at.desc()))
    rows = list(result.scalars().all())
    counts = await _comment_counts(db, [f.id for f in rows])
    return [
        _to_read(
            f,
            reveal_reporter=is_super_admin,
            is_own=f.reported_by_id == account.id,
            comment_count=counts.get(f.id, 0),
        )
        for f in rows
    ]


@router.post("", response_model=FeedbackRead, status_code=status.HTTP_201_CREATED)
async def create_feedback(
    payload: FeedbackCreate,
    db: DbSession,
    account: CurrentAccount,
    request: Request,
) -> FeedbackRead:
    """Anyone signed in can report a bug or suggest an improvement — the
    reporting account is captured automatically (never client-supplied), and
    every new card starts at the default Pending status regardless of what
    the submitter might try to send."""
    title = payload.title.strip()
    reason = payload.reason.strip()
    if not title:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Title is required")
    if not reason:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Reason is required")
    if len(payload.screenshot_urls) > MAX_SCREENSHOTS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"You can attach up to {MAX_SCREENSHOTS} screenshots.",
        )
    for image in payload.screenshot_urls:
        if len(image) > MAX_IMAGE_DATA_URL_LENGTH:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="One of those screenshots is too large — try a smaller one or crop it first.",
            )

    feedback = Feedback(
        type=payload.type,
        title=title,
        reason=reason,
        priority=payload.priority,
        screenshot_urls=payload.screenshot_urls,
        reported_by_id=account.id,
        reported_by_label=_actor_label(account),
    )
    db.add(feedback)
    await db.commit()
    await db.refresh(feedback)

    is_super_admin = get_effective_role(account, request) == AccountRole.SUPER_ADMIN
    return _to_read(feedback, reveal_reporter=is_super_admin, is_own=True, comment_count=0)


@router.patch("/{feedback_id}", response_model=FeedbackRead)
async def update_feedback(
    feedback_id: uuid.UUID,
    payload: FeedbackAdminUpdate,
    db: DbSession,
    account: SuperAdminAccount,
) -> FeedbackRead:
    """Move a card between Kanban columns and/or re-triage its priority —
    Super Admin only (see the module docstring in app/models/feedback.py for
    why this isn't matrix-configurable like a normal module permission)."""
    feedback = await db.get(Feedback, feedback_id)
    if feedback is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Feedback not found")

    changes = payload.model_dump(exclude_unset=True)
    for field, value in changes.items():
        setattr(feedback, field, value)
    await db.commit()
    await db.refresh(feedback)

    counts = await _comment_counts(db, [feedback.id])
    # The requester here is already confirmed Super Admin (SuperAdminAccount
    # dependency), so the reporter identity is always revealed in the
    # response to this route.
    return _to_read(
        feedback,
        reveal_reporter=True,
        is_own=feedback.reported_by_id == account.id,
        comment_count=counts.get(feedback.id, 0),
    )


@router.delete("/{feedback_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_feedback(feedback_id: uuid.UUID, db: DbSession, account: SuperAdminAccount) -> None:
    feedback = await db.get(Feedback, feedback_id)
    if feedback is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Feedback not found")
    await db.delete(feedback)
    await db.commit()


# --- Reply thread ------------------------------------------------------------
# Only the card's own reporter or a Super Admin may reach any of these three
# routes for a given feedback_id — see _can_access_thread. Anyone else gets a
# 404 (not 403 — see that helper's own comment on why the thread's existence
# itself isn't revealed).


def _comment_to_read(comment: FeedbackComment, *, requester_id: uuid.UUID) -> FeedbackCommentRead:
    data = FeedbackCommentRead.model_validate(comment)
    data.reaction_counts = {emoji: len(ids) for emoji, ids in comment.reactions.items()}
    data.my_reactions = [
        emoji for emoji, ids in comment.reactions.items() if str(requester_id) in ids
    ]
    return data


async def _get_feedback_or_404(db: AsyncSession, feedback_id: uuid.UUID) -> Feedback:
    feedback = await db.get(Feedback, feedback_id)
    if feedback is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Feedback not found")
    return feedback


@router.get("/{feedback_id}/comments", response_model=list[FeedbackCommentRead])
async def list_feedback_comments(
    feedback_id: uuid.UUID,
    db: DbSession,
    account: CurrentAccount,
    request: Request,
) -> list[FeedbackCommentRead]:
    feedback = await _get_feedback_or_404(db, feedback_id)
    if not _can_access_thread(feedback, account, request):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Feedback not found")

    result = await db.execute(
        select(FeedbackComment)
        .where(FeedbackComment.feedback_id == feedback_id)
        .order_by(FeedbackComment.created_at)
    )
    return [_comment_to_read(c, requester_id=account.id) for c in result.scalars().all()]


@router.post(
    "/{feedback_id}/comments", response_model=FeedbackCommentRead, status_code=status.HTTP_201_CREATED
)
async def create_feedback_comment(
    feedback_id: uuid.UUID,
    payload: FeedbackCommentCreate,
    db: DbSession,
    account: CurrentAccount,
    request: Request,
) -> FeedbackCommentRead:
    feedback = await _get_feedback_or_404(db, feedback_id)
    if not _can_access_thread(feedback, account, request):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Feedback not found")

    if payload.image_data and len(payload.image_data) > MAX_IMAGE_DATA_URL_LENGTH:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="That image is too large — try a smaller screenshot or crop it first.",
        )

    message = (payload.message or "").strip() or None
    comment = FeedbackComment(
        feedback_id=feedback_id,
        author_id=account.id,
        author_label=_actor_label(account),
        author_role=get_effective_role(account, request),
        message=message,
        image_data=payload.image_data,
        reactions={},
    )
    db.add(comment)
    await db.commit()
    await db.refresh(comment)
    return _comment_to_read(comment, requester_id=account.id)


@router.post("/{feedback_id}/comments/{comment_id}/reactions", response_model=FeedbackCommentRead)
async def toggle_feedback_comment_reaction(
    feedback_id: uuid.UUID,
    comment_id: uuid.UUID,
    payload: FeedbackReactionToggle,
    db: DbSession,
    account: CurrentAccount,
    request: Request,
) -> FeedbackCommentRead:
    """Adds the requester's reaction if they haven't reacted with this emoji
    yet, removes it if they have — a plain toggle, same as clicking your own
    reaction again on any chat app."""
    feedback = await _get_feedback_or_404(db, feedback_id)
    if not _can_access_thread(feedback, account, request):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Feedback not found")

    comment = await db.get(FeedbackComment, comment_id)
    if comment is None or comment.feedback_id != feedback_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")

    emoji = payload.emoji
    reactions = {k: list(v) for k, v in comment.reactions.items()}
    account_id_str = str(account.id)
    current = reactions.get(emoji, [])
    if account_id_str in current:
        current = [a for a in current if a != account_id_str]
    else:
        current = [*current, account_id_str]
    if current:
        reactions[emoji] = current
    else:
        reactions.pop(emoji, None)
    comment.reactions = reactions

    await db.commit()
    await db.refresh(comment)
    return _comment_to_read(comment, requester_id=account.id)

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_effective_role, require_account, require_super_admin
from app.core.db import get_db
from app.models.account import Account, AccountRole
from app.models.feedback import Feedback
from app.schemas.feedback import FeedbackAdminUpdate, FeedbackCreate, FeedbackRead

# Open to every signed-in account — this isn't a module in the permission
# matrix sense (see app/services/permissions.py's module comment); it's a
# shared feedback inbox anyone can read and post to. Only the two Super-
# Admin-only routes below (PATCH, DELETE) are further restricted.
router = APIRouter(prefix="/feedback", tags=["feedback"], dependencies=[Depends(require_account)])

DbSession = Annotated[AsyncSession, Depends(get_db)]
CurrentAccount = Annotated[Account, Depends(require_account)]
SuperAdminAccount = Annotated[Account, Depends(require_super_admin)]


def _actor_label(account: Account) -> str:
    return account.display_name or account.email


def _to_read(feedback: Feedback, *, reveal_reporter: bool) -> FeedbackRead:
    """The one place that decides whether a card's reporter identity is
    visible — reveal_reporter is true only for a Super Admin (see the two
    call sites below), everyone else always gets reported_by_label=None
    regardless of what's actually stored."""
    data = FeedbackRead.model_validate(feedback)
    if not reveal_reporter:
        data.reported_by_label = None
    return data


@router.get("", response_model=list[FeedbackRead])
async def list_feedback(
    db: DbSession,
    account: CurrentAccount,
    request: Request,
) -> list[FeedbackRead]:
    is_super_admin = get_effective_role(account, request) == AccountRole.SUPER_ADMIN
    result = await db.execute(select(Feedback).order_by(Feedback.created_at.desc()))
    return [_to_read(f, reveal_reporter=is_super_admin) for f in result.scalars().all()]


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

    feedback = Feedback(
        type=payload.type,
        title=title,
        reason=reason,
        priority=payload.priority,
        reported_by_id=account.id,
        reported_by_label=_actor_label(account),
    )
    db.add(feedback)
    await db.commit()
    await db.refresh(feedback)

    is_super_admin = get_effective_role(account, request) == AccountRole.SUPER_ADMIN
    return _to_read(feedback, reveal_reporter=is_super_admin)


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

    # The requester here is already confirmed Super Admin (SuperAdminAccount
    # dependency), so the reporter identity is always revealed in the
    # response to this route.
    return _to_read(feedback, reveal_reporter=True)


@router.delete("/{feedback_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_feedback(feedback_id: uuid.UUID, db: DbSession, account: SuperAdminAccount) -> None:
    feedback = await db.get(Feedback, feedback_id)
    if feedback is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Feedback not found")
    await db.delete(feedback)
    await db.commit()

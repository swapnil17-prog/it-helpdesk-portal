import csv
import io
import os
import re
import shutil
import uuid
from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import FileResponse, Response
from sqlalchemy import func, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app import schemas
from app.auth import get_current_user, require_roles
from app.database import get_db
from app.models import (
    Attachment,
    Category,
    Priority,
    Ticket,
    TicketComment,
    TicketHistory,
    TicketStatus,
    User,
)

router = APIRouter(prefix="/tickets", tags=["tickets"])

AGENT_ROLES = ("agent", "admin")
UPLOAD_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "..", "uploads"
)
UPLOAD_DIR = os.path.abspath(UPLOAD_DIR)
os.makedirs(UPLOAD_DIR, exist_ok=True)


def _sanitize_filename(filename: str) -> str:
    """Strip any path components and unsafe characters from a client-supplied filename.

    file.filename comes straight from the multipart request, so a name like
    "../../../whatever" must never be trusted for building a filesystem path.
    """
    base = os.path.basename(filename or "upload")
    base = re.sub(r"[^A-Za-z0-9._-]", "_", base).strip("._") or "upload"
    return base[:150]

TICKET_LOAD_OPTIONS = (
    joinedload(Ticket.requester),
    joinedload(Ticket.assignee),
    joinedload(Ticket.category),
    joinedload(Ticket.priority),
)


def _log(db: Session, ticket: Ticket, user: User, field: str, old, new):
    db.add(
        TicketHistory(
            ticket_id=ticket.id,
            changed_by_id=user.id,
            field_changed=field,
            old_value=str(old) if old is not None else None,
            new_value=str(new) if new is not None else None,
        )
    )


def _ensure_can_view(ticket: Ticket, user: User):
    if user.role in AGENT_ROLES or user.role == "management":
        return
    if ticket.requester_id != user.id:
        raise HTTPException(status_code=403, detail="You cannot view this ticket")


def _ensure_not_locked(ticket: Ticket):
    if ticket.status in (TicketStatus.RESOLVED.value, TicketStatus.CLOSED.value):
        raise HTTPException(status_code=400, detail="Reopen the ticket before making further changes")


MAX_TICKET_NUMBER_RETRIES = 5


def _next_ticket_number(db: Session) -> str:
    max_id = db.query(func.max(Ticket.id)).scalar() or 0
    return f"TCK-{max_id + 1:06d}"


@router.post("", response_model=schemas.TicketDetail)
def create_ticket(
    payload: schemas.TicketCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    priority = db.query(Priority).filter(Priority.id == payload.priority_id).first()
    if not priority:
        raise HTTPException(status_code=400, detail="Invalid priority")

    # Employees can only ever raise a ticket as themselves. Agents/admins may log one on
    # behalf of an employee (something reported verbally) or leave requester blank to log
    # a self-initiated task — and since they're the one logging it, they're assumed to
    # already be handling it, so it's auto-assigned to them (or whoever they name) instead
    # of landing unassigned in the queue.
    requester = current_user
    assignee = None
    if current_user.role in AGENT_ROLES:
        if payload.requester_id is not None:
            requester = db.query(User).filter(User.id == payload.requester_id).first()
            if not requester:
                raise HTTPException(status_code=400, detail="Invalid requester")
        if payload.assigned_to_id is not None:
            assignee = db.query(User).filter(User.id == payload.assigned_to_id).first()
            if not assignee or assignee.role not in AGENT_ROLES:
                raise HTTPException(status_code=400, detail="Assignee must be an IT agent or admin")
        else:
            assignee = current_user

    now = datetime.utcnow()

    # ticket_number is derived from MAX(id), which two concurrent requests could read
    # identically before either commits — the unique constraint then rejects the loser,
    # who retries with a freshly-read (now-advanced) number instead of failing outright.
    for attempt in range(MAX_TICKET_NUMBER_RETRIES):
        ticket = Ticket(
            ticket_number=_next_ticket_number(db),
            requester_id=requester.id,
            department=requester.department,
            issue=payload.issue.strip(),
            description=payload.description.strip(),
            contact_info=payload.contact_info,
            category_id=payload.category_id,
            priority_id=payload.priority_id,
            status=TicketStatus.ASSIGNED.value if assignee else TicketStatus.NEW.value,
            assigned_to_id=assignee.id if assignee else None,
            allocated_at=now if assignee else None,
        )
        db.add(ticket)
        try:
            db.commit()
            break
        except IntegrityError:
            db.rollback()
            if attempt == MAX_TICKET_NUMBER_RETRIES - 1:
                raise

    if assignee:
        _log(db, ticket, current_user, "Assignee", "Unassigned", assignee.name)
        db.commit()

    db.refresh(ticket)
    ticket = (
        db.query(Ticket).options(*TICKET_LOAD_OPTIONS).filter(Ticket.id == ticket.id).first()
    )
    return ticket


@router.get("", response_model=list[schemas.TicketListItem])
def list_tickets(
    status_filter: Optional[str] = Query(None, alias="status"),
    priority_id: Optional[int] = None,
    category_id: Optional[int] = None,
    assigned_to_id: Optional[int] = None,
    unassigned: Optional[bool] = None,
    department: Optional[str] = None,
    search: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    open_only: Optional[bool] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Ticket).options(*TICKET_LOAD_OPTIONS)

    if current_user.role == "employee":
        query = query.filter(Ticket.requester_id == current_user.id)

    if status_filter:
        query = query.filter(Ticket.status == status_filter)
    if priority_id:
        query = query.filter(Ticket.priority_id == priority_id)
    if category_id:
        query = query.filter(Ticket.category_id == category_id)
    if assigned_to_id:
        query = query.filter(Ticket.assigned_to_id == assigned_to_id)
    if unassigned:
        query = query.filter(Ticket.assigned_to_id.is_(None))
    if department:
        query = query.filter(Ticket.department == department)
    if open_only:
        query = query.filter(
            Ticket.status.notin_([TicketStatus.RESOLVED.value, TicketStatus.CLOSED.value])
        )
    if search:
        like = f"%{search}%"
        query = query.filter(
            or_(
                Ticket.ticket_number.ilike(like),
                Ticket.issue.ilike(like),
                Ticket.description.ilike(like),
            )
        )
    if date_from:
        query = query.filter(Ticket.reported_at >= datetime.combine(date_from, datetime.min.time()))
    if date_to:
        query = query.filter(Ticket.reported_at <= datetime.combine(date_to, datetime.max.time()))

    return query.order_by(Ticket.reported_at.desc()).all()


def _aging_hours(ticket: Ticket) -> Optional[float]:
    end = ticket.closed_at or ticket.resolved_at
    if end is None:
        return None
    return round((end - ticket.reported_at).total_seconds() / 3600.0, 1)


@router.get("/export", dependencies=[Depends(require_roles("agent", "admin", "management"))])
def export_tickets(
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    assigned_to_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    # Defaults to "today" so an IT user can grab a quick day-wise report with no params;
    # widen date_from/date_to for a month-wise one. Pass assigned_to_id to scope it to a
    # single IT user's own tickets instead of the whole team's.
    today = datetime.utcnow().date()
    date_from = date_from or today
    date_to = date_to or today

    query = (
        db.query(Ticket)
        .options(*TICKET_LOAD_OPTIONS)
        .filter(Ticket.reported_at >= datetime.combine(date_from, datetime.min.time()))
        .filter(Ticket.reported_at <= datetime.combine(date_to, datetime.max.time()))
    )
    if assigned_to_id:
        query = query.filter(Ticket.assigned_to_id == assigned_to_id)
    tickets = query.order_by(Ticket.reported_at.asc()).all()

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(
        [
            "Ticket ID", "Issue", "Requester", "Department", "Category", "Priority", "Status",
            "Assigned To", "Reported At", "Allocated At", "Resolved At", "Closed At",
            "Resolution / Action Taken", "Aging (hours)",
        ]
    )
    for t in tickets:
        writer.writerow(
            [
                t.ticket_number,
                t.issue,
                t.requester.name,
                t.department,
                t.category.name if t.category else "",
                t.priority.name,
                t.status,
                t.assignee.name if t.assignee else "",
                t.reported_at.strftime("%Y-%m-%d %H:%M") if t.reported_at else "",
                t.allocated_at.strftime("%Y-%m-%d %H:%M") if t.allocated_at else "",
                t.resolved_at.strftime("%Y-%m-%d %H:%M") if t.resolved_at else "",
                t.closed_at.strftime("%Y-%m-%d %H:%M") if t.closed_at else "",
                t.resolution_summary or "",
                _aging_hours(t) if _aging_hours(t) is not None else "",
            ]
        )

    filename = f"tickets_{date_from.isoformat()}_to_{date_to.isoformat()}.csv"
    return Response(
        content=buffer.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{ticket_id}", response_model=schemas.TicketDetail)
def get_ticket(
    ticket_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ticket = (
        db.query(Ticket).options(*TICKET_LOAD_OPTIONS).filter(Ticket.id == ticket_id).first()
    )
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    _ensure_can_view(ticket, current_user)

    # Requesters never see internal-only notes.
    if current_user.role not in AGENT_ROLES:
        ticket.comments = [c for c in ticket.comments if not c.is_internal]
    return ticket


@router.patch("/{ticket_id}/assign", response_model=schemas.TicketDetail)
def assign_ticket(
    ticket_id: int,
    payload: schemas.TicketAssign,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role not in AGENT_ROLES:
        raise HTTPException(status_code=403, detail="Only IT agents can assign tickets")

    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    _ensure_not_locked(ticket)

    assignee = db.query(User).filter(User.id == payload.assigned_to_id).first()
    if not assignee or assignee.role not in AGENT_ROLES:
        raise HTTPException(status_code=400, detail="Assignee must be an IT agent or admin")

    old_assignee = ticket.assignee.name if ticket.assignee else "Unassigned"
    ticket.assigned_to_id = assignee.id
    if ticket.allocated_at is None:
        ticket.allocated_at = datetime.utcnow()
    if ticket.status == TicketStatus.NEW.value:
        ticket.status = TicketStatus.ASSIGNED.value

    _log(db, ticket, current_user, "Assignee", old_assignee, assignee.name)
    db.commit()
    return get_ticket(ticket_id, current_user, db)


@router.patch("/{ticket_id}/priority", response_model=schemas.TicketDetail)
def update_priority(
    ticket_id: int,
    payload: schemas.TicketPriorityUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role not in AGENT_ROLES:
        raise HTTPException(status_code=403, detail="Only IT agents can change priority")

    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    _ensure_not_locked(ticket)
    priority = db.query(Priority).filter(Priority.id == payload.priority_id).first()
    if not priority:
        raise HTTPException(status_code=400, detail="Invalid priority")

    old_priority = ticket.priority.name if ticket.priority else None
    ticket.priority_id = priority.id
    _log(db, ticket, current_user, "Priority", old_priority, priority.name)
    db.commit()
    return get_ticket(ticket_id, current_user, db)


@router.patch("/{ticket_id}/category", response_model=schemas.TicketDetail)
def update_category(
    ticket_id: int,
    payload: schemas.TicketCategoryUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role not in AGENT_ROLES:
        raise HTTPException(status_code=403, detail="Only IT agents can change category")

    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    _ensure_not_locked(ticket)

    new_category = None
    if payload.category_id is not None:
        new_category = db.query(Category).filter(Category.id == payload.category_id).first()
        if not new_category:
            raise HTTPException(status_code=400, detail="Invalid category")

    old_category = ticket.category.name if ticket.category else "None"
    ticket.category_id = payload.category_id
    _log(db, ticket, current_user, "Category", old_category, new_category.name if new_category else "None")
    db.commit()
    return get_ticket(ticket_id, current_user, db)


VALID_MANUAL_STATUSES = {
    TicketStatus.ASSIGNED.value,
    TicketStatus.IN_PROGRESS.value,
    TicketStatus.WAITING_USER.value,
    TicketStatus.WAITING_VENDOR.value,
}


@router.patch("/{ticket_id}/status", response_model=schemas.TicketDetail)
def update_status(
    ticket_id: int,
    payload: schemas.TicketStatusUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role not in AGENT_ROLES:
        raise HTTPException(status_code=403, detail="Only IT agents can update status")
    if payload.status not in VALID_MANUAL_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid status for this action")

    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if ticket.status in (TicketStatus.RESOLVED.value, TicketStatus.CLOSED.value):
        raise HTTPException(status_code=400, detail="Reopen the ticket before changing its status")

    old_status = ticket.status
    ticket.status = payload.status
    ticket.waiting_reason = payload.waiting_reason if "Waiting" in payload.status else None
    _log(db, ticket, current_user, "Status", old_status, payload.status)
    db.commit()
    return get_ticket(ticket_id, current_user, db)


@router.post("/{ticket_id}/resolve", response_model=schemas.TicketDetail)
def resolve_ticket(
    ticket_id: int,
    payload: schemas.TicketResolve,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role not in AGENT_ROLES:
        raise HTTPException(status_code=403, detail="Only IT agents can resolve tickets")

    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if ticket.status in (TicketStatus.RESOLVED.value, TicketStatus.CLOSED.value):
        raise HTTPException(status_code=400, detail="Ticket is already resolved or closed")
    if not payload.resolution_summary.strip():
        raise HTTPException(status_code=400, detail="Resolution summary is required")

    old_status = ticket.status
    ticket.status = TicketStatus.RESOLVED.value
    ticket.resolution_summary = payload.resolution_summary.strip()
    ticket.resolved_at = datetime.utcnow()
    _log(db, ticket, current_user, "Status", old_status, TicketStatus.RESOLVED.value)
    db.commit()
    return get_ticket(ticket_id, current_user, db)


@router.post("/{ticket_id}/close", response_model=schemas.TicketDetail)
def close_ticket(
    ticket_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role not in AGENT_ROLES:
        raise HTTPException(status_code=403, detail="Only IT agents can close tickets")

    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if ticket.status != TicketStatus.RESOLVED.value:
        raise HTTPException(status_code=400, detail="Only resolved tickets can be closed")

    ticket.status = TicketStatus.CLOSED.value
    ticket.closed_at = datetime.utcnow()
    _log(db, ticket, current_user, "Status", TicketStatus.RESOLVED.value, TicketStatus.CLOSED.value)
    db.commit()
    return get_ticket(ticket_id, current_user, db)


@router.post("/{ticket_id}/reopen", response_model=schemas.TicketDetail)
def reopen_ticket(
    ticket_id: int,
    payload: schemas.TicketReopen,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if current_user.role not in AGENT_ROLES and ticket.requester_id != current_user.id:
        raise HTTPException(status_code=403, detail="You cannot reopen this ticket")
    if ticket.status not in (TicketStatus.RESOLVED.value, TicketStatus.CLOSED.value):
        raise HTTPException(status_code=400, detail="Only resolved or closed tickets can be reopened")

    old_status = ticket.status
    ticket.status = TicketStatus.REOPENED.value
    ticket.reopened_at = datetime.utcnow()
    ticket.resolved_at = None
    ticket.closed_at = None
    db.add(
        TicketComment(
            ticket_id=ticket.id,
            author_id=current_user.id,
            comment_text=f"Ticket reopened: {payload.reason.strip()}",
            is_internal=False,
        )
    )
    _log(db, ticket, current_user, "Status", old_status, TicketStatus.REOPENED.value)
    db.commit()
    return get_ticket(ticket_id, current_user, db)


@router.post("/{ticket_id}/comments", response_model=schemas.TicketDetail)
def add_comment(
    ticket_id: int,
    payload: schemas.CommentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    _ensure_can_view(ticket, current_user)
    if payload.is_internal and current_user.role not in AGENT_ROLES:
        raise HTTPException(status_code=403, detail="Only IT agents can add internal notes")
    if not payload.comment_text.strip():
        raise HTTPException(status_code=400, detail="Comment cannot be empty")

    db.add(
        TicketComment(
            ticket_id=ticket.id,
            author_id=current_user.id,
            comment_text=payload.comment_text.strip(),
            is_internal=payload.is_internal,
        )
    )
    db.commit()
    return get_ticket(ticket_id, current_user, db)


@router.post("/{ticket_id}/attachments", response_model=schemas.TicketDetail)
def upload_attachment(
    ticket_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    _ensure_can_view(ticket, current_user)

    safe_name = f"{ticket.ticket_number}_{uuid.uuid4().hex[:8]}_{_sanitize_filename(file.filename)}"
    dest_path = os.path.join(UPLOAD_DIR, safe_name)
    if os.path.dirname(dest_path) != UPLOAD_DIR:
        raise HTTPException(status_code=400, detail="Invalid filename")
    with open(dest_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    db.add(
        Attachment(
            ticket_id=ticket.id,
            filename=file.filename,
            filepath=safe_name,
            uploaded_by_id=current_user.id,
        )
    )
    db.commit()
    return get_ticket(ticket_id, current_user, db)


@router.get("/{ticket_id}/attachments/{attachment_id}/download")
def download_attachment(
    ticket_id: int,
    attachment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    _ensure_can_view(ticket, current_user)

    attachment = (
        db.query(Attachment)
        .filter(Attachment.id == attachment_id, Attachment.ticket_id == ticket_id)
        .first()
    )
    if not attachment:
        raise HTTPException(status_code=404, detail="Attachment not found")

    file_path = os.path.join(UPLOAD_DIR, attachment.filepath)
    if not os.path.isfile(file_path):
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(file_path, filename=attachment.filename)

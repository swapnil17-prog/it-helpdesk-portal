from collections import defaultdict
from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload

from app import schemas
from app.auth import get_current_user, require_roles
from app.database import get_db
from app.models import Ticket, TicketHistory, TicketStatus, User

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

CLOSED_LIKE = (TicketStatus.RESOLVED.value, TicketStatus.CLOSED.value)


@router.get(
    "/summary",
    response_model=schemas.DashboardSummary,
    dependencies=[Depends(require_roles("agent", "admin", "management"))],
)
def dashboard_summary(
    for_date: Optional[date] = None,
    db: Session = Depends(get_db),
):
    target_date = for_date or datetime.utcnow().date()

    tickets = (
        db.query(Ticket)
        .options(
            joinedload(Ticket.priority),
            joinedload(Ticket.category),
            joinedload(Ticket.assignee),
        )
        .all()
    )

    def on_date(dt, d):
        return dt is not None and dt.date() == d

    logged_today = sum(1 for t in tickets if on_date(t.reported_at, target_date))
    allocated_today = sum(1 for t in tickets if on_date(t.allocated_at, target_date))
    closed_today = sum(1 for t in tickets if on_date(t.closed_at, target_date))

    open_tickets_list = [t for t in tickets if t.status not in CLOSED_LIKE]
    open_tickets = len(open_tickets_list)
    unallocated_tickets = sum(1 for t in open_tickets_list if t.assigned_to_id is None)
    in_progress = sum(1 for t in tickets if t.status == TicketStatus.IN_PROGRESS.value)
    resolved_awaiting_closure = sum(1 for t in tickets if t.status == TicketStatus.RESOLVED.value)

    reopened_ticket_ids = {
        h.ticket_id
        for h in db.query(TicketHistory).filter(TicketHistory.new_value == TicketStatus.REOPENED.value)
    }
    reopened_count = len(reopened_ticket_ids)
    reopened_pct = (reopened_count / len(tickets) * 100) if tickets else 0.0

    resolved_durations = [
        (t.resolved_at - t.reported_at).total_seconds() / 3600.0
        for t in tickets
        if t.resolved_at is not None
    ]
    avg_resolution_hours = (
        round(sum(resolved_durations) / len(resolved_durations), 1) if resolved_durations else None
    )

    priority_counts = defaultdict(int)
    priority_colors = {}
    for t in open_tickets_list:
        priority_counts[t.priority.name] += 1
        priority_colors[t.priority.name] = t.priority.color
    priority_split = [
        {"name": name, "count": count, "color": priority_colors[name]}
        for name, count in sorted(priority_counts.items())
    ]

    department_counts = defaultdict(int)
    for t in open_tickets_list:
        department_counts[t.department] += 1
    department_split = [
        {"name": name, "count": count} for name, count in sorted(department_counts.items())
    ]

    category_counts = defaultdict(int)
    for t in open_tickets_list:
        category_counts[t.category.name if t.category else "Uncategorized"] += 1
    category_split = [
        {"name": name, "count": count} for name, count in sorted(category_counts.items())
    ]

    workload_counts = defaultdict(int)
    for t in open_tickets_list:
        workload_counts[t.assignee.name if t.assignee else "Unassigned"] += 1
    agent_workload = [
        {"name": name, "count": count}
        for name, count in sorted(workload_counts.items(), key=lambda x: -x[1])
    ]

    now = datetime.utcnow()
    buckets = {"<1 day": 0, "1-2 days": 0, "3-5 days": 0, ">5 days": 0}
    for t in open_tickets_list:
        age_days = (now - t.reported_at).total_seconds() / 86400.0
        if age_days < 1:
            buckets["<1 day"] += 1
        elif age_days < 3:
            buckets["1-2 days"] += 1
        elif age_days <= 5:
            buckets["3-5 days"] += 1
        else:
            buckets[">5 days"] += 1
    aging_buckets = [{"name": k, "count": v} for k, v in buckets.items()]

    return schemas.DashboardSummary(
        date=target_date.isoformat(),
        logged_today=logged_today,
        allocated_today=allocated_today,
        closed_today=closed_today,
        open_tickets=open_tickets,
        unallocated_tickets=unallocated_tickets,
        in_progress=in_progress,
        resolved_awaiting_closure=resolved_awaiting_closure,
        reopened_count=reopened_count,
        reopened_pct=round(reopened_pct, 1),
        avg_resolution_hours=avg_resolution_hours,
        priority_split=priority_split,
        department_split=department_split,
        category_split=category_split,
        agent_workload=agent_workload,
        aging_buckets=aging_buckets,
    )

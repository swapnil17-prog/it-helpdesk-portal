from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


# ---------- Auth ----------

class LoginRequest(BaseModel):
    employee_id: str
    password: str
    role: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserOut"


# ---------- User ----------

class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    employee_id: str
    name: str
    email: str
    department: str
    role: str
    is_active: bool


class UserCreate(BaseModel):
    employee_id: str
    name: str
    email: str
    department: str
    role: str
    password: str


class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    department: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None


# ---------- Category / Priority ----------

class CategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    is_active: bool
    sort_order: int


class CategoryCreate(BaseModel):
    name: str
    sort_order: int = 0


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None


class PriorityOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    level: int
    color: str
    description: str
    is_active: bool


class PriorityCreate(BaseModel):
    name: str
    level: int
    color: str = "#6b7280"
    description: str = ""


class PriorityUpdate(BaseModel):
    name: Optional[str] = None
    level: Optional[int] = None
    color: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


# ---------- Comments / History / Attachments ----------

class CommentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    comment_text: str
    is_internal: bool
    created_at: datetime
    author: UserOut


class CommentCreate(BaseModel):
    comment_text: str
    is_internal: bool = False


class HistoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    field_changed: str
    old_value: Optional[str]
    new_value: Optional[str]
    changed_at: datetime
    changed_by: UserOut


class AttachmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    filename: str
    uploaded_at: datetime
    uploaded_by: UserOut


# ---------- Ticket ----------

class TicketCreate(BaseModel):
    issue: str
    description: str
    priority_id: int
    category_id: Optional[int] = None
    contact_info: Optional[str] = None


class TicketAssign(BaseModel):
    assigned_to_id: int


class TicketStatusUpdate(BaseModel):
    status: str
    waiting_reason: Optional[str] = None


class TicketResolve(BaseModel):
    resolution_summary: str


class TicketReopen(BaseModel):
    reason: str


class TicketPriorityUpdate(BaseModel):
    priority_id: int


class TicketCategoryUpdate(BaseModel):
    category_id: Optional[int] = None


class TicketListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    ticket_number: str
    issue: str
    department: str
    status: str
    reported_at: datetime
    allocated_at: Optional[datetime]
    resolved_at: Optional[datetime]
    closed_at: Optional[datetime]
    requester: UserOut
    assignee: Optional[UserOut]
    category: Optional[CategoryOut]
    priority: PriorityOut


class TicketDetail(TicketListItem):
    description: str
    contact_info: Optional[str]
    resolution_summary: Optional[str]
    waiting_reason: Optional[str]
    comments: list[CommentOut] = []
    history: list[HistoryOut] = []
    attachments: list[AttachmentOut] = []


# ---------- Dashboard ----------

class DashboardSummary(BaseModel):
    date: str
    logged_today: int
    allocated_today: int
    closed_today: int
    open_tickets: int
    unallocated_tickets: int
    in_progress: int
    resolved_awaiting_closure: int
    reopened_count: int
    reopened_pct: float
    avg_resolution_hours: Optional[float]
    priority_split: list[dict]
    department_split: list[dict]
    category_split: list[dict]
    agent_workload: list[dict]
    aging_buckets: list[dict]

import enum
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from app.database import Base


def utcnow():
    # Naive UTC on purpose: SQLite drops tzinfo on round-trip, so every other
    # datetime read from the DB is naive too — mixing aware/naive breaks comparisons.
    return datetime.utcnow()


class Role(str, enum.Enum):
    EMPLOYEE = "employee"
    AGENT = "agent"
    ADMIN = "admin"
    MANAGEMENT = "management"


class TicketStatus(str, enum.Enum):
    NEW = "New"
    ASSIGNED = "Assigned"
    IN_PROGRESS = "In Progress"
    WAITING_USER = "Waiting for User"
    WAITING_VENDOR = "Waiting for Vendor"
    RESOLVED = "Resolved"
    CLOSED = "Closed"
    REOPENED = "Reopened"


OPEN_STATUSES = [
    TicketStatus.NEW,
    TicketStatus.ASSIGNED,
    TicketStatus.IN_PROGRESS,
    TicketStatus.WAITING_USER,
    TicketStatus.WAITING_VENDOR,
    TicketStatus.REOPENED,
]


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False)
    department = Column(String, nullable=False)
    role = Column(String, nullable=False, default=Role.EMPLOYEE.value)
    password_hash = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utcnow)

    tickets_raised = relationship(
        "Ticket", back_populates="requester", foreign_keys="Ticket.requester_id"
    )
    tickets_assigned = relationship(
        "Ticket", back_populates="assignee", foreign_keys="Ticket.assigned_to_id"
    )


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    is_active = Column(Boolean, default=True)
    sort_order = Column(Integer, default=0)


class Priority(Base):
    __tablename__ = "priorities"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    level = Column(Integer, nullable=False)  # 1=Low .. 4=Critical, drives sort/urgency
    color = Column(String, default="#6b7280")
    description = Column(String, default="")
    is_active = Column(Boolean, default=True)


class Ticket(Base):
    __tablename__ = "tickets"

    id = Column(Integer, primary_key=True, index=True)
    ticket_number = Column(String, unique=True, index=True, nullable=False)

    requester_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    department = Column(String, nullable=False)

    issue = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    contact_info = Column(String, nullable=True)

    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    priority_id = Column(Integer, ForeignKey("priorities.id"), nullable=False)

    status = Column(String, nullable=False, default=TicketStatus.NEW.value)
    assigned_to_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    resolution_summary = Column(Text, nullable=True)
    waiting_reason = Column(String, nullable=True)

    reported_at = Column(DateTime, default=utcnow)
    allocated_at = Column(DateTime, nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    closed_at = Column(DateTime, nullable=True)
    reopened_at = Column(DateTime, nullable=True)

    requester = relationship(
        "User", back_populates="tickets_raised", foreign_keys=[requester_id]
    )
    assignee = relationship(
        "User", back_populates="tickets_assigned", foreign_keys=[assigned_to_id]
    )
    category = relationship("Category")
    priority = relationship("Priority")
    comments = relationship(
        "TicketComment", back_populates="ticket", cascade="all, delete-orphan",
        order_by="TicketComment.created_at",
    )
    history = relationship(
        "TicketHistory", back_populates="ticket", cascade="all, delete-orphan",
        order_by="TicketHistory.changed_at",
    )
    attachments = relationship(
        "Attachment", back_populates="ticket", cascade="all, delete-orphan"
    )


class TicketComment(Base):
    __tablename__ = "ticket_comments"

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id"), nullable=False)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    comment_text = Column(Text, nullable=False)
    is_internal = Column(Boolean, default=False)
    created_at = Column(DateTime, default=utcnow)

    ticket = relationship("Ticket", back_populates="comments")
    author = relationship("User")


class TicketHistory(Base):
    __tablename__ = "ticket_history"

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id"), nullable=False)
    changed_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    field_changed = Column(String, nullable=False)
    old_value = Column(String, nullable=True)
    new_value = Column(String, nullable=True)
    changed_at = Column(DateTime, default=utcnow)

    ticket = relationship("Ticket", back_populates="history")
    changed_by = relationship("User")


class Attachment(Base):
    __tablename__ = "attachments"

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id"), nullable=False)
    filename = Column(String, nullable=False)
    filepath = Column(String, nullable=False)
    uploaded_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    uploaded_at = Column(DateTime, default=utcnow)

    ticket = relationship("Ticket", back_populates="attachments")
    uploaded_by = relationship("User")

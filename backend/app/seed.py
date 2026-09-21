import os
from datetime import datetime, timedelta

from app.auth import hash_password
from app.database import Base, SessionLocal, engine
from app.models import Category, Priority, Ticket, TicketComment, TicketHistory, User

DEMO_PASSWORD = os.environ.get("DEMO_PASSWORD", "password123")


def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if db.query(User).count() > 0:
            print("Database already seeded, skipping.")
            return

        password_hash = hash_password(DEMO_PASSWORD)

        categories = [
            "Hardware",
            "Software",
            "Network/Wi-Fi",
            "Printer",
            "Email/Outlook",
            "Access",
            "Server/Drive",
            "Security",
            "Other",
        ]
        for i, name in enumerate(categories):
            db.add(Category(name=name, sort_order=i))

        priorities = [
            ("Low", 1, "#9ca3af", "Minor issue or a request"),
            ("Medium", 2, "#eab308", "Slower, workaround exists"),
            ("High", 3, "#f97316", "Blocked, no workaround"),
            ("Critical", 4, "#dc2626", "Major outage or security issue"),
        ]
        for name, level, color, desc in priorities:
            db.add(Priority(name=name, level=level, color=color, description=desc))

        users = [
            ("E1001", "Asha Rao", "asha.rao@example.com", "Sales", "employee"),
            ("E1002", "Vikram Singh", "vikram.singh@example.com", "Finance", "employee"),
            ("E1003", "Meera Nair", "meera.nair@example.com", "Operations", "employee"),
            ("A2001", "Rahul Verma", "rahul.verma@example.com", "IT", "agent"),
            ("A2002", "Sara Khan", "sara.khan@example.com", "IT", "agent"),
            ("ADM01", "Priya Sharma", "priya.sharma@example.com", "IT", "admin"),
            ("MGT01", "Karan Mehta", "karan.mehta@example.com", "Management", "management"),
        ]
        for employee_id, name, email, department, role in users:
            db.add(
                User(
                    employee_id=employee_id,
                    name=name,
                    email=email,
                    department=department,
                    role=role,
                    password_hash=password_hash,
                )
            )

        db.flush()

        _seed_sample_tickets(db)

        db.commit()
        print("Seed complete.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def _seed_sample_tickets(db):
    employees = {u.employee_id: u for u in db.query(User).filter(User.role == "employee").all()}
    agents = {u.employee_id: u for u in db.query(User).filter(User.role == "agent").all()}
    categories = {c.name: c for c in db.query(Category).all()}
    priorities = {p.name: p for p in db.query(Priority).all()}

    now = datetime.utcnow()

    def make(
        number,
        requester,
        issue,
        description,
        category,
        priority,
        status,
        age_hours,
        assignee=None,
        resolution=None,
        resolved_hours_ago=None,
        closed_hours_ago=None,
    ):
        reported_at = now - timedelta(hours=age_hours)
        ticket = Ticket(
            ticket_number=number,
            requester_id=requester.id,
            department=requester.department,
            issue=issue,
            description=description,
            category_id=categories[category].id,
            priority_id=priorities[priority].id,
            status=status,
            reported_at=reported_at,
        )
        if assignee:
            ticket.assigned_to_id = assignee.id
            ticket.allocated_at = reported_at + timedelta(minutes=20)
        if resolution:
            ticket.resolution_summary = resolution
        if resolved_hours_ago is not None:
            ticket.resolved_at = now - timedelta(hours=resolved_hours_ago)
        if closed_hours_ago is not None:
            ticket.closed_at = now - timedelta(hours=closed_hours_ago)
        db.add(ticket)
        db.flush()
        if assignee:
            db.add(
                TicketHistory(
                    ticket_id=ticket.id,
                    changed_by_id=assignee.id,
                    field_changed="Assignee",
                    old_value="Unassigned",
                    new_value=assignee.name,
                    changed_at=ticket.allocated_at,
                )
            )
        return ticket

    t1 = make(
        "TCK-000001",
        employees["E1001"],
        "MS Teams not opening",
        "Teams crashes immediately on launch since this morning. Reinstalled once, same issue.",
        "Software",
        "High",
        "In Progress",
        age_hours=26,
        assignee=agents["A2001"],
    )
    db.add(
        TicketComment(
            ticket_id=t1.id,
            author_id=agents["A2001"].id,
            comment_text="Clearing Teams cache and reinstalling the client.",
            is_internal=True,
        )
    )

    make(
        "TCK-000002",
        employees["E1002"],
        "Laptop battery draining fast",
        "Battery drops from 100% to 20% within an hour even when idle.",
        "Hardware",
        "Medium",
        "New",
        age_hours=4,
    )

    make(
        "TCK-000003",
        employees["E1003"],
        "Cannot connect to office Wi-Fi",
        "Laptop keeps disconnecting from the 5th floor Wi-Fi every few minutes.",
        "Network/Wi-Fi",
        "High",
        "New",
        age_hours=1,
    )

    t4 = make(
        "TCK-000004",
        employees["E1001"],
        "Need access to shared Finance drive",
        "Requesting read access to the Finance shared drive for the month-end report.",
        "Access",
        "Low",
        "Waiting for User",
        age_hours=50,
        assignee=agents["A2002"],
    )
    t4.waiting_reason = "Waiting for manager approval email"

    make(
        "TCK-000005",
        employees["E1002"],
        "Printer on 3rd floor jamming repeatedly",
        "The HP printer near the finance bay jams after every 2-3 pages.",
        "Printer",
        "Medium",
        "Resolved",
        age_hours=30,
        assignee=agents["A2001"],
        resolution="Cleared paper jam and replaced worn feed roller.",
        resolved_hours_ago=4,
    )

    make(
        "TCK-000006",
        employees["E1003"],
        "Outlook not syncing new emails",
        "Outlook stopped receiving new emails since yesterday evening; webmail works fine.",
        "Email/Outlook",
        "Critical",
        "Closed",
        age_hours=72,
        assignee=agents["A2002"],
        resolution="Recreated Outlook profile; sync restored and verified with user.",
        resolved_hours_ago=48,
        closed_hours_ago=47,
    )


if __name__ == "__main__":
    seed()

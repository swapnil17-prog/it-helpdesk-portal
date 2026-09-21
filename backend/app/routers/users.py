from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import schemas
from app.auth import get_current_user, hash_password, require_roles
from app.database import get_db
from app.models import User

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[schemas.UserOut])
def list_users(
    role: str | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Any authenticated user can see the active IT team roster (needed for assignment
    # dropdowns); only admins get the unfiltered list including inactive accounts.
    query = db.query(User)
    if role:
        query = query.filter(User.role == role)
    if current_user.role != "admin":
        query = query.filter(User.is_active.is_(True))
    return query.order_by(User.name).all()


@router.post("", response_model=schemas.UserOut, dependencies=[Depends(require_roles("admin"))])
def create_user(payload: schemas.UserCreate, db: Session = Depends(get_db)):
    if db.query(User).filter(User.employee_id == payload.employee_id).first():
        raise HTTPException(status_code=400, detail="Employee ID already exists")
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Email already exists")
    user = User(
        employee_id=payload.employee_id,
        name=payload.name,
        email=payload.email,
        department=payload.department,
        role=payload.role,
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.patch(
    "/{user_id}", response_model=schemas.UserOut, dependencies=[Depends(require_roles("admin"))]
)
def update_user(user_id: int, payload: schemas.UserUpdate, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    data = payload.model_dump(exclude_unset=True)
    if "password" in data:
        password = data.pop("password")
        if password:
            user.password_hash = hash_password(password)
    if "email" in data and data["email"] != user.email:
        if db.query(User).filter(User.email == data["email"], User.id != user_id).first():
            raise HTTPException(status_code=400, detail="Email already exists")
    for field, value in data.items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return user

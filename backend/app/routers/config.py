from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import schemas
from app.auth import require_roles
from app.database import get_db
from app.models import Category, Priority

router = APIRouter(tags=["config"])


# ---------- Categories ----------

@router.get("/categories", response_model=list[schemas.CategoryOut])
def list_categories(include_inactive: bool = False, db: Session = Depends(get_db)):
    query = db.query(Category)
    if not include_inactive:
        query = query.filter(Category.is_active.is_(True))
    return query.order_by(Category.sort_order, Category.name).all()


@router.post(
    "/categories",
    response_model=schemas.CategoryOut,
    dependencies=[Depends(require_roles("admin"))],
)
def create_category(payload: schemas.CategoryCreate, db: Session = Depends(get_db)):
    if db.query(Category).filter(Category.name == payload.name).first():
        raise HTTPException(status_code=400, detail="Category already exists")
    category = Category(**payload.model_dump())
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


@router.patch(
    "/categories/{category_id}",
    response_model=schemas.CategoryOut,
    dependencies=[Depends(require_roles("admin"))],
)
def update_category(category_id: int, payload: schemas.CategoryUpdate, db: Session = Depends(get_db)):
    category = db.query(Category).filter(Category.id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(category, field, value)
    db.commit()
    db.refresh(category)
    return category


# ---------- Priorities ----------

@router.get("/priorities", response_model=list[schemas.PriorityOut])
def list_priorities(include_inactive: bool = False, db: Session = Depends(get_db)):
    query = db.query(Priority)
    if not include_inactive:
        query = query.filter(Priority.is_active.is_(True))
    return query.order_by(Priority.level).all()


@router.post(
    "/priorities",
    response_model=schemas.PriorityOut,
    dependencies=[Depends(require_roles("admin"))],
)
def create_priority(payload: schemas.PriorityCreate, db: Session = Depends(get_db)):
    if db.query(Priority).filter(Priority.name == payload.name).first():
        raise HTTPException(status_code=400, detail="Priority already exists")
    priority = Priority(**payload.model_dump())
    db.add(priority)
    db.commit()
    db.refresh(priority)
    return priority


@router.patch(
    "/priorities/{priority_id}",
    response_model=schemas.PriorityOut,
    dependencies=[Depends(require_roles("admin"))],
)
def update_priority(priority_id: int, payload: schemas.PriorityUpdate, db: Session = Depends(get_db)):
    priority = db.query(Priority).filter(Priority.id == priority_id).first()
    if not priority:
        raise HTTPException(status_code=404, detail="Priority not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(priority, field, value)
    db.commit()
    db.refresh(priority)
    return priority

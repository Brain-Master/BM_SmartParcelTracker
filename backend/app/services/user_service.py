"""User service layer."""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate
from app.core.security import get_password_hash
from app.core.exceptions import NotFoundException, AlreadyExistsException


async def get_user_by_id(db: AsyncSession, user_id: str) -> User:
    """Get user by ID."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise NotFoundException("User", user_id)
    return user


async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    """Get user by email."""
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


async def create_user(db: AsyncSession, user_data: UserCreate) -> User:
    """Create a new user."""
    # Check if user exists
    existing = await get_user_by_email(db, user_data.email)
    if existing:
        raise AlreadyExistsException("User", "email", user_data.email)
    
    # Create user
    user = User(
        email=user_data.email,
        hashed_password=get_password_hash(user_data.password),
        main_currency=user_data.main_currency
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def update_user(db: AsyncSession, user_id: str, user_data: UserUpdate) -> User:
    """Update user."""
    user = await get_user_by_id(db, user_id)
    
    if user_data.email is not None:
        # Check if new email is available
        existing = await get_user_by_email(db, user_data.email)
        if existing and existing.id != user_id:
            raise AlreadyExistsException("User", "email", user_data.email)
        user.email = user_data.email
    
    if user_data.main_currency is not None:
        user.main_currency = user_data.main_currency
    
    if user_data.password is not None:
        user.hashed_password = get_password_hash(user_data.password)
    
    await db.commit()
    await db.refresh(user)
    return user


async def delete_user(db: AsyncSession, user_id: str) -> None:
    """Delete user."""
    user = await get_user_by_id(db, user_id)
    await db.delete(user)
    await db.commit()

"""Custom exceptions for the application."""
from fastapi import HTTPException, status


class NotFoundException(HTTPException):
    """Raised when a resource is not found."""
    def __init__(self, resource: str, identifier: str):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{resource} with id '{identifier}' not found"
        )


class AlreadyExistsException(HTTPException):
    """Raised when trying to create/update a resource that would duplicate a unique field (409 Conflict)."""
    def __init__(self, resource: str, field: str, value: str):
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"{resource} with {field} '{value}' already exists"
        )


class UnauthorizedException(HTTPException):
    """Raised when user is not authorized to perform an action."""
    def __init__(self, detail: str = "Not authorized to perform this action"):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail
        )


class ValidationException(HTTPException):
    """Raised when validation fails."""
    def __init__(self, detail: str):
        super().__init__(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=detail
        )


class ConflictException(HTTPException):
    """Raised when operation conflicts with existing data (e.g. delete forbidden)."""
    def __init__(self, detail: str):
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            detail=detail
        )

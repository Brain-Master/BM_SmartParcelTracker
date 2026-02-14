"""Logging configuration for the application."""
import logging
import sys

from app.core.config import settings


def setup_logging() -> None:
    """Configure application logging."""
    
    # Log format
    log_format = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    date_format = "%Y-%m-%d %H:%M:%S"
    
    # Root logger level
    log_level = logging.DEBUG if settings.DEBUG else logging.INFO
    
    # Configure root logger
    logging.basicConfig(
        level=log_level,
        format=log_format,
        datefmt=date_format,
        handlers=[
            logging.StreamHandler(sys.stdout)
        ]
    )
    
    # Configure specific loggers
    loggers_config = {
        "app": log_level,
        "sqlalchemy.engine": logging.WARNING,  # Reduce SQL query logging
        "sqlalchemy.pool": logging.WARNING,
        "uvicorn": logging.INFO,
        "uvicorn.access": logging.INFO if settings.DEBUG else logging.WARNING,
    }
    
    for logger_name, level in loggers_config.items():
        logger = logging.getLogger(logger_name)
        logger.setLevel(level)


def get_logger(name: str) -> logging.Logger:
    """Get a logger instance."""
    return logging.getLogger(name)


# For structured logging in production, consider:
# - structlog (https://www.structlog.org/)
# - python-json-logger
# - Integration with ELK stack, CloudWatch, or similar

class RequestLogger:
    """Middleware-style request logger."""
    
    def __init__(self, logger: logging.Logger):
        self.logger = logger
    
    def log_request(self, method: str, url: str, status_code: int, duration_ms: float) -> None:
        """Log an HTTP request."""
        self.logger.info(
            f"{method} {url} - {status_code} - {duration_ms:.2f}ms"
        )
    
    def log_error(self, method: str, url: str, error: Exception) -> None:
        """Log an error during request processing."""
        self.logger.error(
            f"{method} {url} - Error: {str(error)}",
            exc_info=True
        )

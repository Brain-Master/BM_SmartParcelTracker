from typing import Protocol

from app.models import Parcel


class TrackingService(Protocol):
    def fetch_status(self, tracking_number: str) -> str:
        ...


def refresh_parcel_status(parcel: Parcel, tracking_service: TrackingService) -> str:
    parcel.status = tracking_service.fetch_status(parcel.tracking_number)
    return parcel.status

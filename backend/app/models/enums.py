"""Enums matching System Design Document §2.1."""
import enum


class MainCurrency(str, enum.Enum):
    RUB = "RUB"
    USD = "USD"
    EUR = "EUR"


class ParcelStatus(str, enum.Enum):
    Created = "Created"
    In_Transit = "In_Transit"
    PickUp_Ready = "PickUp_Ready"
    Delivered = "Delivered"
    Lost = "Lost"
    Archived = "Archived"


class OrderItemStatus(str, enum.Enum):
    Waiting_Shipment = "Waiting_Shipment"
    Shipped = "Shipped"
    Received = "Received"
    Dispute_Open = "Dispute_Open"
    Refunded = "Refunded"

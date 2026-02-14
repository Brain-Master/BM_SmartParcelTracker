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
    Waiting_Payment = "Waiting_Payment"
    Payment_Verification = "Payment_Verification"
    Seller_Packing = "Seller_Packing"
    Partially_Shipped = "Partially_Shipped"
    Shipped = "Shipped"
    Partially_Received = "Partially_Received"
    Received = "Received"
    Cancelled = "Cancelled"
    Dispute_Open = "Dispute_Open"
    Refunded = "Refunded"
    # Deprecated: map to Seller_Packing in UI
    Waiting_Shipment = "Waiting_Shipment"

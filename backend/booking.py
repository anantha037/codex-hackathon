"""In-memory mock ticket booking helpers."""

from urllib.parse import quote
from uuid import uuid4


BOOKINGS: dict[str, dict] = {}


def create_booking(start_station: str, end_station: str, date: str) -> dict:
    """Create and store a mock confirmed ticket."""
    ticket_id = uuid4().hex[:8]
    record = {
        "start_station": start_station,
        "end_station": end_station,
        "date": str(date),
        "ticket_id": ticket_id,
        "status": "confirmed",
        "qr_payload": (
            f"KMRL|{ticket_id}|{start_station}|{end_station}|{date}"
        ),
    }
    BOOKINGS[ticket_id] = record
    return record


def build_whatsapp_link(start_station: str, end_station: str, date: str) -> str:
    """Build a prefilled WhatsApp booking message link."""
    message = f"BOOK {start_station} to {end_station} {date}"
    return f"https://wa.me/919048690486?text={quote(message)}"

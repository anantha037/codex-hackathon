"""Pydantic models for the Kochi Metro API."""

from datetime import date

from pydantic import BaseModel, Field


class PlanRouteRequest(BaseModel):
    start_station: str
    end_station: str
    profile: str


class SimulateOutageRequest(BaseModel):
    station_name: str


class ReplanRequest(BaseModel):
    start_station: str
    end_station: str
    profile: str


class BookTicketRequest(BaseModel):
    start_station: str
    end_station: str
    date: date


class WhatsAppBookingLinkRequest(BaseModel):
    start_station: str
    end_station: str
    date: date


class NotImplementedResponse(BaseModel):
    message: str = "not implemented"
    speech_text: str = "not implemented"
    visual_alert: str = "not implemented"
    accessible_route: list[str] = Field(default_factory=list)
    elevator_details: list[dict[str, str | bool]] = Field(default_factory=list)


class PlanRouteResponse(NotImplementedResponse):
    pass


class SimulateOutageResponse(NotImplementedResponse):
    pass


class ReplanResponse(NotImplementedResponse):
    pass


class BookTicketResponse(NotImplementedResponse):
    pass


class WhatsAppBookingLinkResponse(NotImplementedResponse):
    pass

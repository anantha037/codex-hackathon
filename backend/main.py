"""FastAPI application skeleton for the Kochi Metro demo."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from routing import get_accessible_route, get_direct_route
from stations import STATIONS

from models import (
    BookTicketRequest,
    BookTicketResponse,
    PlanRouteRequest,
    PlanRouteResponse,
    ReplanRequest,
    ReplanResponse,
    SimulateOutageRequest,
    SimulateOutageResponse,
    WhatsAppBookingLinkResponse,
)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def not_implemented_response() -> JSONResponse:
    return JSONResponse(status_code=501, content=PlanRouteResponse().model_dump())


def elevator_details_for(station_names: tuple[str, str]) -> list[dict]:
    requested_names = set(station_names)
    return [
        {
            "station": station["name"],
            "has_elevator": station["has_elevator"],
            "elevator_status": station["elevator_status"],
        }
        for station in STATIONS
        if station["name"] in requested_names
    ]


@app.post("/plan-route", response_model=None)
def plan_route(request: PlanRouteRequest):
    if request.profile == "wheelchair":
        route_details = get_accessible_route(
            request.start_station, request.end_station
        )
        route_details["accessible_route"] = route_details["route"]
        route_details["elevator_details"] = elevator_details_for(
            (request.start_station, request.end_station)
        )
    else:
        route_details = get_direct_route(request.start_station, request.end_station)
        route_details["accessible_route"] = []
        route_details["elevator_details"] = []

    route_details["speech_text"] = "Route has been planned."
    route_details["visual_alert"] = ""
    return route_details


@app.post("/simulate-outage", response_model=SimulateOutageResponse)
def simulate_outage(_: SimulateOutageRequest):
    return not_implemented_response()


@app.post("/replan", response_model=ReplanResponse)
def replan(_: ReplanRequest):
    return not_implemented_response()


@app.post("/book-ticket", response_model=BookTicketResponse)
def book_ticket(_: BookTicketRequest):
    return not_implemented_response()


@app.get("/whatsapp-booking-link", response_model=WhatsAppBookingLinkResponse)
def whatsapp_booking_link(start_station: str, end_station: str, date: str):
    del start_station, end_station, date
    return not_implemented_response()

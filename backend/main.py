"""FastAPI application skeleton for the Kochi Metro demo."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from assistant import handle_request
from booking import build_whatsapp_link, create_booking
from llm import generate_explanation
from routing import get_accessible_route, get_direct_route, set_elevator_status
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


class AssistantRequest(BaseModel):
    user_text: str
    profile: str


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


def route_for_profile(start_station: str, end_station: str, profile: str) -> dict:
    if profile == "wheelchair":
        route_details = get_accessible_route(start_station, end_station)
        route_details["accessible_route"] = route_details["route"]
        route_details["elevator_details"] = elevator_details_for(
            (start_station, end_station)
        )
    else:
        route_details = get_direct_route(start_station, end_station)
        route_details["accessible_route"] = []
        route_details["elevator_details"] = []

    explanation_input = {**route_details, "platform": route_details["platform"]}
    explanation = generate_explanation(explanation_input, profile)
    route_details["speech_text"] = ""
    route_details["visual_alert"] = ""
    if profile == "visually_impaired":
        route_details["speech_text"] = explanation
    elif profile == "deaf_hoh_mute":
        route_details["visual_alert"] = explanation
    else:
        route_details["explanation"] = explanation
    return route_details


@app.post("/plan-route", response_model=None)
def plan_route(request: PlanRouteRequest):
    return route_for_profile(
        request.start_station, request.end_station, request.profile
    )


@app.post("/simulate-outage", response_model=None)
def simulate_outage(request: SimulateOutageRequest):
    station = set_elevator_status(request.station_name, "Under Maintenance")
    return {
        **station,
        "speech_text": "Elevator outage has been recorded.",
        "visual_alert": "Elevator under maintenance.",
        "accessible_route": [],
        "elevator_details": [station],
    }


@app.post("/replan", response_model=None)
def replan(request: ReplanRequest):
    return route_for_profile(
        request.start_station, request.end_station, request.profile
    )


@app.post("/assistant", response_model=None)
def assistant(request: AssistantRequest):
    return handle_request(request.user_text, request.profile)


@app.post("/book-ticket", response_model=None)
def book_ticket(request: BookTicketRequest):
    return {
        **create_booking(request.start_station, request.end_station, request.date),
        "speech_text": "",
        "visual_alert": "",
        "accessible_route": [],
        "elevator_details": [],
    }


@app.get("/whatsapp-booking-link", response_model=None)
def whatsapp_booking_link(start_station: str, end_station: str, date: str):
    return {
        "whatsapp_link": build_whatsapp_link(start_station, end_station, date),
        "speech_text": "",
        "visual_alert": "",
        "accessible_route": [],
        "elevator_details": [],
    }

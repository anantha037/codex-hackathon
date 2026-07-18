"""FastAPI application skeleton for the Kochi Metro demo."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

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


@app.post("/plan-route", response_model=PlanRouteResponse)
def plan_route(_: PlanRouteRequest):
    return not_implemented_response()


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

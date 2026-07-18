"""Function-calling assistant for deterministic metro actions."""

from datetime import date
import json
import os

from booking import build_whatsapp_link, create_booking
from dotenv import load_dotenv
from llm import generate_explanation
from routing import get_accessible_route, get_direct_route
from stations import STATIONS


TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "plan_route",
            "description": "Plan a route between two Kochi Metro stations.",
            "parameters": {
                "type": "object",
                "properties": {
                    "start_station": {"type": "string"},
                    "end_station": {"type": "string"},
                },
                "required": ["start_station", "end_station"],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "book_ticket",
            "description": "Create a mock confirmed ticket for a route.",
            "parameters": {
                "type": "object",
                "properties": {
                    "start_station": {"type": "string"},
                    "end_station": {"type": "string"},
                    "date": {"type": "string", "description": "YYYY-MM-DD"},
                },
                "required": ["start_station", "end_station", "date"],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_whatsapp_link",
            "description": "Get a WhatsApp payment link for a route.",
            "parameters": {
                "type": "object",
                "properties": {
                    "start_station": {"type": "string"},
                    "end_station": {"type": "string"},
                    "date": {"type": "string", "description": "YYYY-MM-DD"},
                },
                "required": ["start_station", "end_station", "date"],
                "additionalProperties": False,
            },
        },
    },
]


def _stations_in_text(user_text: str) -> list[str]:
    normalized = user_text.lower()
    return [
        station["name"]
        for station in sorted(
            (
                {"name": station["name"], "index": normalized.find(station["name"].lower())}
                for station in STATIONS
            ),
            key=lambda match: match["index"],
        )
        if station["index"] >= 0
    ]


def _plan_route(start_station: str, end_station: str, profile: str) -> dict:
    if profile == "wheelchair":
        return get_accessible_route(start_station, end_station)
    return get_direct_route(start_station, end_station)


def _run_tool(name: str, arguments: dict, profile: str) -> dict:
    if name == "plan_route":
        return _plan_route(arguments["start_station"], arguments["end_station"], profile)
    if name == "book_ticket":
        return create_booking(
            arguments["start_station"],
            arguments["end_station"],
            arguments.get("date") or date.today().isoformat(),
        )
    if name == "get_whatsapp_link":
        return {
            "whatsapp_link": build_whatsapp_link(
                arguments["start_station"],
                arguments["end_station"],
                arguments.get("date") or date.today().isoformat(),
            )
        }
    raise ValueError(f"Unknown tool: {name}")


def _elevator_details(route: dict | None) -> list[dict]:
    if not route:
        return []
    endpoints = {route["route"][0], route["route"][-1]}
    return [
        {
            "station": station["name"],
            "has_elevator": station["has_elevator"],
            "elevator_status": station["elevator_status"],
            "boarding_assistance": station["boarding_assistance"],
        }
        for station in STATIONS
        if station["name"] in endpoints
    ]


def _response(profile: str, tool_results: list[dict]) -> dict:
    route = next(
        (result["result"] for result in tool_results if result["tool"] == "plan_route"),
        None,
    )
    elevator_details = _elevator_details(route)
    explanation_input = {
        **(route or {"route": []}),
        "elevator_details": elevator_details,
        "boarding_assistance": elevator_details,
    }
    summary = generate_explanation(explanation_input, profile)
    response = {
        "profile": profile,
        "message": summary,
        "tool_results": tool_results,
        "speech_text": "",
        "visual_alert": "",
        "accessible_route": route["route"] if profile == "wheelchair" and route else [],
        "elevator_details": elevator_details if profile == "wheelchair" else [],
    }
    if profile == "visually_impaired":
        response["speech_text"] = response["message"]
    elif profile == "deaf_hoh_mute":
        response["visual_alert"] = response["message"]
    else:
        response["explanation"] = response["message"]
    return response


def _fallback(user_text: str, profile: str) -> dict:
    stations = _stations_in_text(user_text)
    if len(stations) < 2:
        return _response(profile, [])

    route = _plan_route(stations[0], stations[1], profile)
    return _response(profile, [{"tool": "plan_route", "result": route}])


def handle_request(user_text: str, profile: str) -> dict:
    """Use model function calls to orchestrate existing route and booking helpers."""
    try:
        from openai import OpenAI

        load_dotenv()
        client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        today = date.today().isoformat()
        messages = [
            {
                "role": "system",
                "content": (
                    f"You are an assistant for the {profile} profile. Extract station names only from "
                    f"this list: {[station['name'] for station in STATIONS]}. Today is {today}. "
                    "Use tools for all actions. If booking or WhatsApp is requested, call plan_route "
                    "first and wait for its result before calling the related action. When no further tool "
                    "calls are needed, return a brief completion message."
                ),
            },
            {"role": "user", "content": user_text},
        ]
        tool_results = []

        for _ in range(4):
            completion = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages,
                tools=TOOLS,
                tool_choice="auto",
            )
            message = completion.choices[0].message
            if not message.tool_calls:
                if not tool_results:
                    raise ValueError("Assistant did not select a tool")
                return _response(profile, tool_results)

            messages.append(message.model_dump(exclude_none=True))
            for tool_call in message.tool_calls:
                arguments = json.loads(tool_call.function.arguments)
                result = _run_tool(tool_call.function.name, arguments, profile)
                tool_results.append({"tool": tool_call.function.name, "result": result})
                messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": tool_call.id,
                        "content": json.dumps(result),
                    }
                )

        raise ValueError("Assistant exceeded tool-call limit")
    except Exception:
        return _fallback(user_text, profile)

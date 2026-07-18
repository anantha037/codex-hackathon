"""Optional natural-language explanations for already-computed routes."""

import json
import os
import re

from dotenv import load_dotenv


def _route_data(route_result: dict) -> dict:
    return {
        "stations": route_result.get("route", route_result.get("stations", [])),
        "station_count": route_result.get("station_count"),
        "suggested_alternate": route_result.get("suggested_alternate"),
        "elevator_details": route_result.get("elevator_details", []),
    }


def _plain_text(text: str) -> str:
    text = re.sub(r"(?m)^\s*(?:[-+•]|\d+[.)])\s*", "", text)
    text = re.sub(r"[*_`#]", "", text)
    return " ".join(text.split())


def _alternate_text(alternate: dict | None) -> str:
    replacements = alternate.get("replacements", []) if alternate else []
    names = ", ".join(item["alternate_station"] for item in replacements)
    return f" Use alternate station: {names}." if names else ""


def _fallback_explanation(route_result: dict, profile: str) -> str:
    data = _route_data(route_result)
    stations = data["stations"]
    route_text = " to ".join(stations) if stations else "the selected route"
    count = data["station_count"] or len(stations)
    elevator_text = ", ".join(
        f"{item['station']}: {item['elevator_status']}"
        for item in data["elevator_details"]
        if "station" in item and "elevator_status" in item
    )
    alternate_text = _alternate_text(data["suggested_alternate"])

    if profile == "deaf_hoh_mute":
        return _plain_text(f"{route_text}. {count} stations.{alternate_text}")
    if profile == "wheelchair":
        return _plain_text(
            f"Wheelchair route: {route_text}. Elevator status: "
            f"{elevator_text or 'not provided'}.{alternate_text}"
        )
    return _plain_text(f"Route: {route_text}. {count} stations.{alternate_text}")


def _profile_instruction(profile: str) -> str:
    if profile == "visually_impaired":
        return "Write one or two short, clear sentences suitable for text to speech."
    if profile == "deaf_hoh_mute":
        return "Write one or two short, high-clarity sentences suitable for a visual alert."
    if profile == "wheelchair":
        return "Write one or two short descriptive sentences and include any provided elevator status."
    return "Write one or two short plain-language sentences."


def _build_prompt(route_result: dict, profile: str) -> str:
    return (
        f"Write route guidance only for the {profile} profile. "
        "Use only the station names, station count, suggested alternate, and elevator data "
        "in the route data below. Do not add facts or mention any other profile. "
        "Respond in plain text only: no Markdown, no headings, no asterisks, and no bullet lists. "
        f"{_profile_instruction(profile)} "
        f"Route data: {json.dumps(_route_data(route_result))}"
    )


def generate_explanation(route_result: dict, profile: str) -> str:
    """Generate a profile-aware explanation, with a deterministic fallback."""
    fallback = _fallback_explanation(route_result, profile)

    try:
        from openai import OpenAI

        load_dotenv()
        client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        response = client.responses.create(
            model="gpt-4o-mini",
            input=_build_prompt(route_result, profile),
        )
        return _plain_text(response.output_text) or fallback
    except Exception:
        return fallback

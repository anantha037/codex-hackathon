"""Optional natural-language explanations for already-computed routes."""

import os

from dotenv import load_dotenv


def _fallback_explanation(route_result: dict, profile: str) -> str:
    stations = route_result.get("route", route_result.get("stations", []))
    route_text = " to ".join(stations) if stations else "the selected route"
    station_count = route_result.get("station_count", len(stations))
    alternate = route_result.get("suggested_alternate")
    elevators = route_result.get("elevator_details", [])
    elevator_text = ", ".join(
        f"{item['station']}: {item['elevator_status']}"
        for item in elevators
        if "station" in item and "elevator_status" in item
    )

    alternate_text = ""
    if alternate:
        replacements = alternate.get("replacements", [])
        names = ", ".join(item["alternate_station"] for item in replacements)
        alternate_text = f" Use alternate station: {names}."

    if profile == "visually_impaired":
        return f"Route: {route_text}. {station_count} stations.{alternate_text}"
    if profile == "deaf_hoh_mute":
        return f"{route_text} - {station_count} stations{alternate_text}"
    if profile == "wheelchair":
        return (
            f"Wheelchair route: {route_text}. Elevator status: "
            f"{elevator_text or 'check station elevators'}.{alternate_text}"
        )
    return f"Route: {route_text}. {station_count} stations.{alternate_text}"


def _build_prompt(route_result: dict, profile: str) -> str:
    stations = route_result.get("route", route_result.get("stations", []))
    return (
        "Explain this already-computed Kochi Metro route without changing it. "
        f"Profile: {profile}. Stations: {stations}. "
        f"Suggested alternate: {route_result.get('suggested_alternate')}. "
        f"Elevator details: {route_result.get('elevator_details', [])}. "
        "For visually_impaired, use clean short text-to-speech sentences. "
        "For deaf_hoh_mute, use one very short banner-length line. "
        "For wheelchair, use one normal descriptive sentence including elevator status."
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
        return response.output_text.strip() or fallback
    except Exception:
        return fallback

"""Deterministic route planning helpers for the Kochi Metro line."""

from stations import STATIONS


def _station_index(station_name: str) -> int:
    for index, station in enumerate(STATIONS):
        if station["name"] == station_name:
            return index
    raise ValueError(f"Unknown station: {station_name}")


def _nearest_working_elevator(station_index: int) -> tuple[int, dict]:
    for distance in range(1, len(STATIONS)):
        for candidate_index in (station_index - distance, station_index + distance):
            if 0 <= candidate_index < len(STATIONS):
                candidate = STATIONS[candidate_index]
                if candidate["elevator_status"] == "Working":
                    return candidate_index, candidate
    raise ValueError("No station with a working elevator is available")


def _extra_stations(from_index: int, to_index: int) -> list[str]:
    step = 1 if to_index > from_index else -1
    return [STATIONS[index]["name"] for index in range(from_index + step, to_index + step, step)]


def get_direct_route(start_station: str, end_station: str) -> dict:
    """Return the inclusive linear route between two stations."""
    start_index = _station_index(start_station)
    end_index = _station_index(end_station)
    step = 1 if end_index >= start_index else -1
    route = [
        STATIONS[index]["name"]
        for index in range(start_index, end_index + step, step)
    ]

    if start_index < end_index:
        direction = "down"
    elif start_index > end_index:
        direction = "up"
    else:
        direction = "same station"

    return {"route": route, "direction": direction, "station_count": len(route)}


def get_accessible_route(start_station: str, end_station: str) -> dict:
    """Return a direct route and alternatives for unavailable endpoint elevators."""
    route_details = get_direct_route(start_station, end_station)
    endpoint_indexes = {
        "start_station": _station_index(start_station),
        "end_station": _station_index(end_station),
    }
    replacements = []

    for endpoint, station_index in endpoint_indexes.items():
        station = STATIONS[station_index]
        if station["elevator_status"] == "Working":
            continue

        alternate_index, alternate = _nearest_working_elevator(station_index)
        replacements.append(
            {
                "endpoint": endpoint,
                "original_station": station["name"],
                "alternate_station": alternate["name"],
                "extra_stations": _extra_stations(station_index, alternate_index),
            }
        )

    route_details["suggested_alternate"] = (
        {"replacements": replacements} if replacements else None
    )
    return route_details

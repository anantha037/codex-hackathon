"""Deterministic route planning helpers for the Kochi Metro line."""

from stations import STATIONS


def _station_index(station_name: str) -> int:
    for index, station in enumerate(STATIONS):
        if station["name"] == station_name:
            return index
    raise ValueError(f"Unknown station: {station_name}")


def set_elevator_status(station_name: str, status: str) -> dict:
    """Update and return a station's in-memory elevator data."""
    station = STATIONS[_station_index(station_name)]
    station["elevator_status"] = status
    return station


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
        platform = "Platform 1 — towards Thripunithura"
    elif start_index > end_index:
        direction = "up"
        platform = "Platform 2 — towards Aluva"
    else:
        direction = "same station"
        platform = "No platform required"

    return {
        "route": route,
        "direction": direction,
        "platform": platform,
        "station_count": len(route),
    }


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


def get_journey_status(
    start_station: str, end_station: str, current_station: str
) -> dict:
    """Return deterministic progress details from the current station to the destination."""
    start_index = _station_index(start_station)
    end_index = _station_index(end_station)
    current_index = _station_index(current_station)
    journey_start = min(start_index, end_index)
    journey_end = max(start_index, end_index)
    if not journey_start <= current_index <= journey_end:
        raise ValueError("Current station is outside the selected journey")

    remaining_route = get_direct_route(current_station, end_station)
    stations_remaining = max(remaining_route["station_count"] - 1, 0)
    next_station = (
        remaining_route["route"][1] if stations_remaining else None
    )
    return {
        **remaining_route,
        "start_station": start_station,
        "end_station": end_station,
        "current_station": current_station,
        "next_station": next_station,
        "stations_remaining": stations_remaining,
    }

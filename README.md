# Kochi Metro Accessible Commute Assistant

An accessibility-first commute assistant for the Kochi Metro (Aluva–Thripunithura line),
built for a hackathon under the Urban Mobility track.

## The problem

Kochi Metro is a single line, but the accessibility needs of its riders aren't uniform.
A blind rider needs the app usable without ever looking at a screen. A Deaf or Hard of
Hearing rider needs every alert to be visual. A wheelchair user needs to know, before they
arrive, whether the elevator at their station is actually working — and what to do if it
isn't. Most transit apps treat "accessible" as one checkbox. This one adapts its entire
interaction model per profile, from one shared, deterministic backend.

## How it works

Three profiles, one backend:

- **Visually Impaired** — voice is the primary interface, not a bonus. The app speaks
  instructions and listens for spoken commands throughout: selecting a profile, planning a
  journey ("Aluva to Thripunithura"), booking a ticket ("book it"), and getting live
  in-journey updates ("I'm at Kalamassery"). Station matching from speech is done with
  deterministic string matching against known station names — not the LLM — to keep it fast
  and reliable. Falls back cleanly to a tap-based UI if speech recognition isn't supported.
- **Deaf / Hard of Hearing / Mute** — every alert (route status, outages, journey updates)
  is delivered as a persistent, high-contrast visual banner, with a vibration pulse on
  supported devices (Android Chrome) for journey alerts. Nothing in this profile's flow
  depends on audio in either direction.
- **Wheelchair / Mobility-Limited** — routing checks elevator status at the start and end
  stations specifically (not stations passed through, since a single line has no alternate
  path) and, if either endpoint's elevator is down, suggests the nearest station with a
  working elevator instead. This updates live if an outage is reported mid-journey.

**Design principle:** routing, outage handling, and booking decisions are all deterministic
Python — reliable by construction, not by luck. An LLM (OpenAI, gpt-4o-mini) is used only to
turn an already-computed result into short, profile-appropriate natural language, and every
call has a hardcoded fallback so a network or API failure never breaks the core experience.

## Features

- Deterministic route planning with wheelchair-aware elevator handling
- Live outage simulation and re-planning
- Voice-driven journey planning, booking, and status updates for Visually Impaired users
- Persistent visual alerts and vibration for Deaf/Hard of Hearing/Mute users
- Platform and direction guidance for every route
- Mock ticket booking with a rendered QR code
- One-click handoff to Kochi Metro's real WhatsApp booking number, with the correct
  pre-filled message
- A function-calling assistant that can plan and book a journey from a single natural-language
  request (e.g. "book me a ticket from Aluva to Vyttila")

## Architecture

```
backend/            FastAPI application
  stations.py        Hardcoded station data (order, elevator status, boarding assistance)
  routing.py          Deterministic route planning, outage, and journey-status logic
  llm.py              OpenAI-backed natural-language explanation, with fallback
  assistant.py         OpenAI function-calling orchestration over the above
  booking.py           Mock ticket booking and WhatsApp link generation
  main.py              API endpoints, CORS, request/response wiring

frontend/            Vite + React application
  src/App.jsx           Profile selection, route planning, voice interaction, journey UI
```

## Setup

**Backend**
```
cd backend
pip install -r requirements.txt
cp .env.example .env   # add your OPENAI_API_KEY
uvicorn main:app --reload
```
Runs on `http://localhost:8000`. API docs at `http://localhost:8000/docs`.

**Frontend**
```
cd frontend
npm install
npm run dev
```
Runs on `http://localhost:5173`.

## API

| Endpoint | Method | Purpose |
|---|---|---|
| `/plan-route` | POST | Compute a route between two stations for a given profile |
| `/simulate-outage` | POST | Mark a station's elevator as under maintenance (demo/admin) |
| `/replan` | POST | Re-plan a route against current station state |
| `/journey-status` | GET | Get next-stop and remaining-stations info mid-journey |
| `/book-ticket` | POST | Create a mock booking with a ticket ID and QR payload |
| `/whatsapp-booking-link` | GET | Generate a real wa.me link to Kochi Metro's WhatsApp booking number |
| `/assistant` | POST | Natural-language request → planned/booked outcome, via OpenAI function-calling |

## Known limitations

Stated honestly, not hidden:

- **Booking is mocked.** Kochi Metro has no public payment/booking API to integrate against;
  a real ticket is issued only via KMRL's own app, website, or WhatsApp bot. This app
  simulates the booking experience and hands off to the real WhatsApp number for actual
  payment.
- **Journey tracking is manual, not GPS-based.** There's no public real-time train-position
  feed to build against; "I'm at..." is a self-reported check-in, voice or dropdown.
- **Vibration alerts only work on Android Chrome** — the Vibration API isn't implemented on
  iOS Safari and does nothing on desktop browsers.
- **Per-station boarding-assistance and elevator-location notes are illustrative placeholder
  data**, not sourced from verified KMRL facilities information.
- **Speech recognition requires network connectivity** — most browsers' implementations
  stream audio to a cloud transcription service rather than running fully offline, so
  performance depends on connection quality. Text-to-speech output has no such dependency.

## Roadmap

With a real transit data partnership: live train position for automatic arrival alerts,
verified station accessibility data, and a real payment integration.

# AGENTS.md — backend

- Routing/pathfinding logic must be plain deterministic Python. Never call the LLM for pathfinding.
- OpenAI (gpt-4o-mini, or whichever model I confirm) is only used in llm.py, only to generate
  natural-language explanations of an already-computed route. Always wrapped in try/except with a
  hardcoded fallback string — a Groq/OpenAI outage must never break the demo.
- Every endpoint response includes profile-specific fields: speech_text (Visually Impaired),
  visual_alert (Deaf/HoH/Mute), accessible_route + elevator details (Wheelchair).
- Station data lives only in stations.py, in memory, mutated in place by /simulate-outage.
- No real payment/booking API calls — booking is simulated (mock payment + generated ticket ID/QR),
  with a real wa.me link offered as a secondary "pay via WhatsApp" action.
- CORS must allow http://localhost:5173.
- Keep functions small and single-file-scoped so changes stay easy to review and revert.

import { useState } from 'react'
import './App.css'

const STATIONS = [
  'Aluva',
  'Pulinchodu',
  'Companypady',
  'Ambattukavu',
  'Muttom',
  'Kalamassery',
  'Cochin University',
  'Pathadipalam',
  'Edappally',
  'Changampuzha Park',
  'Palarivattom',
  'JLN Stadium',
  'Kaloor',
  'Lissie',
  'MG Road',
  "Maharaja's College",
  'Ernakulam South',
  'Kadavanthra',
  'Elamkulam',
  'Vyttila',
  'Thaikoodam',
  'Petta',
  'Vadakkekotta',
  'SN Junction',
  'Thripunithura',
]

const PROFILES = [
  {
    id: 'visually_impaired',
    title: 'Visually Impaired',
    description: 'Clear spoken route guidance',
  },
  {
    id: 'deaf_hoh_mute',
    title: 'Deaf / Hard of Hearing / Mute',
    description: 'Concise visual travel alerts',
  },
  {
    id: 'wheelchair',
    title: 'Wheelchair / Mobility-Limited',
    description: 'Elevator-aware route planning',
  },
]

function App() {
  const [profile, setProfile] = useState(null)
  const [startStation, setStartStation] = useState(STATIONS[0])
  const [endStation, setEndStation] = useState(STATIONS.at(-1))

  function handlePlanRoute(event) {
    event.preventDefault()
    console.log('Route plan selected:', {
      profile,
      start_station: startStation,
      end_station: endStation,
    })
  }

  if (!profile) {
    return (
      <main className="app-shell">
        <section className="panel profile-panel" aria-labelledby="profile-heading">
          <p className="eyebrow">Kochi Metro</p>
          <h1 id="profile-heading">How can we support your journey?</h1>
          <p className="intro">Choose an accessibility profile to start planning.</p>
          <div className="profile-list">
            {PROFILES.map((option) => (
              <button
                className="profile-button"
                key={option.id}
                type="button"
                onClick={() => setProfile(option.id)}
              >
                <span>{option.title}</span>
                <small>{option.description}</small>
              </button>
            ))}
          </div>
        </section>
      </main>
    )
  }

  const selectedProfile = PROFILES.find((option) => option.id === profile)

  return (
    <main className="app-shell">
      <section className="panel route-panel" aria-labelledby="route-heading">
        <button className="back-button" type="button" onClick={() => setProfile(null)}>
          Change profile
        </button>
        <p className="eyebrow">{selectedProfile.title}</p>
        <h1 id="route-heading">Plan your route</h1>
        <p className="intro">Select your boarding and destination stations.</p>
        <form onSubmit={handlePlanRoute}>
          <label htmlFor="start-station">From</label>
          <select
            id="start-station"
            value={startStation}
            onChange={(event) => setStartStation(event.target.value)}
          >
            {STATIONS.map((station) => <option key={station}>{station}</option>)}
          </select>

          <label htmlFor="end-station">To</label>
          <select
            id="end-station"
            value={endStation}
            onChange={(event) => setEndStation(event.target.value)}
          >
            {STATIONS.map((station) => <option key={station}>{station}</option>)}
          </select>

          <button className="primary-button" type="submit">Plan Route</button>
        </form>
      </section>
    </main>
  )
}

export default App

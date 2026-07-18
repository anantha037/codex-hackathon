import { useState } from 'react'
import './App.css'

const STATIONS = [
  'Aluva', 'Pulinchodu', 'Companypady', 'Ambattukavu', 'Muttom',
  'Kalamassery', 'Cochin University', 'Pathadipalam', 'Edappally',
  'Changampuzha Park', 'Palarivattom', 'JLN Stadium', 'Kaloor', 'Lissie',
  'MG Road', "Maharaja's College", 'Ernakulam South', 'Kadavanthra',
  'Elamkulam', 'Vyttila', 'Thaikoodam', 'Petta', 'Vadakkekotta',
  'SN Junction', 'Thripunithura',
]

const PROFILES = [
  { id: 'visually_impaired', title: 'Visually Impaired', description: 'Large, clear route guidance with speech support' },
  { id: 'deaf_hoh_mute', title: 'Deaf / Hard of Hearing / Mute', description: 'Persistent visual alerts and concise updates' },
  { id: 'wheelchair', title: 'Wheelchair / Mobility-Limited', description: 'Elevator-aware route planning' },
]

function MetroLineDiagram({ startStation, endStation, showElevators = false, outageStation }) {
  const startIndex = STATIONS.indexOf(startStation)
  const endIndex = STATIONS.indexOf(endStation)
  const routeStart = Math.min(startIndex, endIndex)
  const routeEnd = Math.max(startIndex, endIndex)

  return (
    <section className="line-diagram" aria-label="Kochi Metro Aluva to Thripunithura line">
      <div className="line-diagram-scroll">
        <ol className="station-list">
          {STATIONS.map((station, index) => {
            const isEndpoint = station === startStation || station === endStation
            const isInRoute = index >= routeStart && index <= routeEnd
            const isOutage = station === outageStation
            const classes = [
              'diagram-station',
              isInRoute && 'in-route',
              isEndpoint && 'route-endpoint',
              isOutage && 'outage',
            ].filter(Boolean).join(' ')

            return (
              <li className={classes} key={station}>
                <span className="station-dot" aria-hidden="true" />
                {showElevators && <span className="elevator-icon" aria-label={`${station} elevator available`}>↕</span>}
                <span className="station-name">{station}</span>
                <span className="station-code">KM{String(index + 1).padStart(2, '0')}</span>
                {isOutage && <span className="outage-label">Elevator outage</span>}
              </li>
            )
          })}
        </ol>
      </div>
    </section>
  )
}

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
      <main className="metro-app profile-start">
        <header className="app-header">
          <p className="wordmark">Kochi Metro</p>
          <p className="header-note">Accessible route companion</p>
        </header>
        <section className="profile-choice" aria-labelledby="profile-heading">
          <p className="eyebrow">Start here</p>
          <h1 id="profile-heading">Choose the support that helps you travel with confidence.</h1>
          <div className="profile-list">
            {PROFILES.map((option) => (
              <button className="profile-button" key={option.id} type="button" onClick={() => setProfile(option.id)}>
                <span className="profile-button-title">{option.title}</span>
                <span>{option.description}</span>
                <span className="button-arrow" aria-hidden="true">→</span>
              </button>
            ))}
          </div>
        </section>
        <MetroLineDiagram startStation={null} endStation={null} />
      </main>
    )
  }

  const selectedProfile = PROFILES.find((option) => option.id === profile)
  const isWheelchair = profile === 'wheelchair'
  const isDeaf = profile === 'deaf_hoh_mute'
  const isVisuallyImpaired = profile === 'visually_impaired'

  return (
    <main className={`metro-app route-screen ${profile}`}>
      <header className="app-header">
        <button className="text-button" type="button" onClick={() => setProfile(null)}>← Change profile</button>
        <p className="wordmark">Kochi Metro</p>
        <p className="header-note">{selectedProfile.title}</p>
      </header>

      {isDeaf && (
        <aside className="alert-banner" role="status">
          <strong>Service alerts</strong>
          <span>No active alerts. Live disruptions will appear here.</span>
        </aside>
      )}

      <section className="route-workspace" aria-labelledby="route-heading">
        <div className="route-intro">
          <p className="eyebrow">Plan a journey</p>
          <h1 id="route-heading">Where are you going?</h1>
          {isVisuallyImpaired && <p className="tts-indicator"><span aria-hidden="true">●</span> Speaking guidance is active</p>}
        </div>

        <form className="route-form" onSubmit={handlePlanRoute}>
          <div className="field-group">
            <label htmlFor="start-station">From station</label>
            <select id="start-station" value={startStation} onChange={(event) => setStartStation(event.target.value)}>
              {STATIONS.map((station) => <option key={station}>{station}</option>)}
            </select>
          </div>
          <div className="field-group">
            <label htmlFor="end-station">To station</label>
            <select id="end-station" value={endStation} onChange={(event) => setEndStation(event.target.value)}>
              {STATIONS.map((station) => <option key={station}>{station}</option>)}
            </select>
          </div>
          <button className="primary-button" type="submit">Plan Route <span aria-hidden="true">→</span></button>
        </form>
      </section>

      <section className="diagram-section" aria-labelledby="diagram-heading">
        <div className="diagram-heading">
          <div>
            <p className="eyebrow">Purple line</p>
            <h2 id="diagram-heading">Aluva — Thripunithura</h2>
          </div>
          <p className="diagram-key"><span aria-hidden="true" /> Selected journey</p>
        </div>
        <MetroLineDiagram startStation={startStation} endStation={endStation} showElevators={isWheelchair} />
      </section>
    </main>
  )
}

export default App

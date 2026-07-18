import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import './App.css'

const API_URL = 'http://localhost:8000'
const CONNECTION_ISSUE = 'Connection issue — tap to try again'
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

function alternateStation(routeResult) {
  return routeResult?.suggested_alternate?.replacements?.[0]?.alternate_station
}

function stationsInTranscript(transcript) {
  const normalized = transcript.toLowerCase()
  return STATIONS
    .map((station) => ({ station, index: normalized.indexOf(station.toLowerCase()) }))
    .filter((match) => match.index >= 0)
    .sort((first, second) => first.index - second.index)
    .map((match) => match.station)
}

function profileFromTranscript(transcript) {
  const text = transcript.toLowerCase()
  if (text.includes('visual') || text.includes('blind')) return 'visually_impaired'
  if (text.includes('deaf') || text.includes('mute') || text.includes('hearing')) return 'deaf_hoh_mute'
  if (text.includes('wheelchair') || text.includes('mobility')) return 'wheelchair'
  return null
}

function MetroLineDiagram({
  startStation,
  endStation,
  showElevators = false,
  alternate,
  outageStation,
  autoScroll = false,
  scrollKey,
}) {
  const startIndex = STATIONS.indexOf(startStation)
  const endIndex = STATIONS.indexOf(endStation)
  const routeStart = Math.min(startIndex, endIndex)
  const routeEnd = Math.max(startIndex, endIndex)
  const scrollRef = useRef(null)

  useEffect(() => {
    if (autoScroll && startIndex >= 0) {
      scrollRef.current?.scrollTo({ left: startIndex * 128, behavior: 'auto' })
    }
  }, [autoScroll, startIndex, scrollKey])

  return (
    <section className="line-diagram" aria-label="Kochi Metro Aluva to Thripunithura line">
      <div className="line-diagram-scroll" ref={scrollRef}>
        <ol className="station-list">
          {STATIONS.map((station, index) => {
            const isEndpoint = station === startStation || station === endStation
            const isInRoute = index >= routeStart && index <= routeEnd
            const isAlternate = station === alternate
            const isOutage = station === outageStation
            const classes = [
              'diagram-station',
              isInRoute && 'in-route',
              isEndpoint && 'route-endpoint',
              index % 2 === 0 ? 'label-above' : 'label-below',
              isAlternate && 'alternate-station',
              isOutage && 'outage-station',
            ].filter(Boolean).join(' ')

            return (
              <li className={classes} key={station}>
                <span className="station-dot" aria-hidden="true" />
                {showElevators && <span className="elevator-icon" aria-label={`${station} elevator available`}>↕</span>}
                <span className="station-label">
                  <span className="station-name">{station}</span>
                  <span className="station-code">KM{String(index + 1).padStart(2, '0')}</span>
                </span>
                {isAlternate && <span className="alternate-label">Accessible alternative</span>}
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
  const [routeResult, setRouteResult] = useState(null)
  const [isPlanning, setIsPlanning] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [lastPlan, setLastPlan] = useState(null)
  const [outageStation, setOutageStation] = useState(STATIONS[0])
  const [activeOutage, setActiveOutage] = useState(null)
  const [booking, setBooking] = useState(null)
  const [bookingStage, setBookingStage] = useState('')
  const [currentStation, setCurrentStation] = useState('')
  const [journeyStatus, setJourneyStatus] = useState(null)
  const [alertBannerPulse, setAlertBannerPulse] = useState(false)
  const [isActioning, setIsActioning] = useState(false)
  const [isProfileListening, setIsProfileListening] = useState(false)
  const [profileVoiceMessage, setProfileVoiceMessage] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [speechRecognitionSupported, setSpeechRecognitionSupported] = useState(true)
  const [voiceStatus, setVoiceStatus] = useState('')
  const [isConnecting, setIsConnecting] = useState(false)
  const [connectionIssue, setConnectionIssue] = useState(false)
  const [retryAction, setRetryAction] = useState(null)
  const recognitionRef = useRef(null)
  const restartTimerRef = useRef(null)
  const lastPlanRef = useRef(null)
  const lastExplanationRef = useRef('')
  const bookingTimerRef = useRef(null)
  const profileRecognitionRef = useRef(null)
  const alertPulseTimerRef = useRef(null)
  const qrCanvasRef = useRef(null)

  useEffect(() => () => {
    window.speechSynthesis?.cancel()
    recognitionRef.current?.abort()
    profileRecognitionRef.current?.abort()
    window.clearTimeout(restartTimerRef.current)
    window.clearTimeout(bookingTimerRef.current)
    window.clearTimeout(alertPulseTimerRef.current)
  }, [])

  useEffect(() => {
    lastPlanRef.current = lastPlan
  }, [lastPlan])

  useEffect(() => {
    if (bookingStage !== 'booked' || !booking?.qr_payload || !qrCanvasRef.current) return undefined

    let isCurrent = true
    QRCode.toCanvas(qrCanvasRef.current, booking.qr_payload, {
      width: 280,
      margin: 2,
      errorCorrectionLevel: 'M',
    }).catch(() => {
      if (isCurrent) setErrorMessage('Unable to render the ticket QR code.')
    })

    return () => {
      isCurrent = false
    }
  }, [booking, bookingStage])

  useEffect(() => {
    if (profile) return undefined

    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition
    speakRoute('Welcome to Kochi Metro Assistant. Say Visually Impaired, Deaf, or Wheelchair to continue. Or tap a button.')
    if (!Recognition) {
      setProfileVoiceMessage('Voice profile selection is unavailable. Choose an option below.')
      return undefined
    }

    const recognition = new Recognition()
    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = 'en-IN'
    profileRecognitionRef.current = recognition
    setIsProfileListening(true)
    setProfileVoiceMessage('Listening... Say a profile name to continue.')
    recognition.onresult = (event) => {
      const selectedProfile = profileFromTranscript(event.results[0][0].transcript)
      setIsProfileListening(false)
      if (selectedProfile) {
        setProfile(selectedProfile)
      } else {
        setProfileVoiceMessage('I did not recognise a profile. Choose a button below.')
      }
    }
    recognition.onerror = () => {
      setIsProfileListening(false)
      setProfileVoiceMessage('Voice profile selection is unavailable. Choose an option below.')
    }
    recognition.onend = () => setIsProfileListening(false)
    try {
      recognition.start()
    } catch {
      setIsProfileListening(false)
      setProfileVoiceMessage('Voice profile selection is unavailable. Choose an option below.')
    }

    return () => recognition.abort()
  }, [profile])

  useEffect(() => {
    if (profile !== 'visually_impaired') return undefined

    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition
    setSpeechRecognitionSupported(Boolean(Recognition))
    speakRoute('Visually Impaired mode. Say your journey. For example: Aluva to Thripunithura.')

    return () => {
      recognitionRef.current?.abort()
      window.clearTimeout(restartTimerRef.current)
      setIsListening(false)
    }
  }, [profile])

  function speakRoute(text, onComplete) {
    if (!text || !window.speechSynthesis) {
      onComplete?.()
      return
    }

    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.onend = () => {
      setIsSpeaking(false)
      onComplete?.()
    }
    utterance.onerror = () => {
      setIsSpeaking(false)
      onComplete?.()
    }
    setIsSpeaking(true)
    window.speechSynthesis.speak(utterance)
  }

  function retryListening(mode, message) {
    speakRoute(message, () => {
      restartTimerRef.current = window.setTimeout(() => startListening(mode), 700)
    })
  }

  async function fetchWithTimeout(url, options = {}) {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 8000)
    setIsConnecting(true)

    try {
      return await fetch(url, { ...options, signal: controller.signal })
    } catch (error) {
      if (error.name === 'AbortError' || error instanceof TypeError) {
        throw new Error(CONNECTION_ISSUE)
      }
      throw error
    } finally {
      window.clearTimeout(timeout)
      setIsConnecting(false)
    }
  }

  function showConnectionIssue(retry) {
    setConnectionIssue(true)
    setRetryAction(() => retry)
    setErrorMessage('')
    if (profile === 'visually_impaired') speakRoute(CONNECTION_ISSUE)
  }

  function clearConnectionIssue() {
    setConnectionIssue(false)
    setRetryAction(null)
  }

  function startBookingProcess() {
    window.clearTimeout(bookingTimerRef.current)
    setBooking(null)
    setBookingStage('checking')
    if (profile === 'visually_impaired') speakRoute('Booking your ticket now.')
  }

  function revealBooking(bookingResult) {
    bookingTimerRef.current = window.setTimeout(() => {
      setBookingStage('confirming')
      bookingTimerRef.current = window.setTimeout(() => {
        setBooking(bookingResult)
        setBookingStage('booked')
        const initialStation = lastPlanRef.current?.start_station
        const updateInitialJourneyStatus = () => {
          if (!initialStation) return
          setCurrentStation(initialStation)
          requestJourneyStatus(initialStation)
        }
        if (profile === 'visually_impaired') {
          speakRoute(`Booking confirmed, your ticket ID is ${bookingResult.ticket_id}.`, updateInitialJourneyStatus)
        } else {
          updateInitialJourneyStatus()
        }
      }, 400)
    }, 350)
  }

  async function requestJourneyStatus(station) {
    const plan = lastPlanRef.current
    if (!plan) return

    try {
      const parameters = new URLSearchParams({
        start_station: plan.start_station,
        end_station: plan.end_station,
        current_station: station,
        profile: plan.profile,
      })
      const response = await fetchWithTimeout(`${API_URL}/journey-status?${parameters}`)
      const result = await response.json()
      if (!response.ok) throw new Error(result.detail || 'Unable to update journey status.')
      setJourneyStatus(result)
      if (plan.profile === 'deaf_hoh_mute') {
        navigator.vibrate?.([200, 100, 200])
        setAlertBannerPulse(true)
        window.clearTimeout(alertPulseTimerRef.current)
        alertPulseTimerRef.current = window.setTimeout(() => setAlertBannerPulse(false), 600)
      }
      if (plan.profile === 'visually_impaired') {
        if (result.next_station) {
          const nextAfterThat = result.route?.[2] || 'your destination'
          speakRoute(
            `Approaching ${result.next_station}. Next stop after that: ${nextAfterThat}.`,
            () => startListening('command'),
          )
        } else {
          speakRoute('You have reached your destination.', () => startListening('command'))
        }
      }
    } catch (error) {
      if (error.message === CONNECTION_ISSUE) {
        showConnectionIssue(() => requestJourneyStatus(station))
        return
      }
      setErrorMessage(error.message || 'Unable to update journey status.')
    }
  }

  async function bookWithVoice() {
    const plan = lastPlanRef.current
    if (!plan) return

    try {
      const date = new Date().toISOString().slice(0, 10)
      startBookingProcess()
      const bookingResponse = await fetchWithTimeout(`${API_URL}/book-ticket`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...plan, date }),
      })
      const bookingResult = await bookingResponse.json()
      if (!bookingResponse.ok) throw new Error('Unable to create a ticket.')

      revealBooking(bookingResult)
      const parameters = new URLSearchParams({
        start_station: plan.start_station,
        end_station: plan.end_station,
        date,
      })
      const linkResponse = await fetchWithTimeout(`${API_URL}/whatsapp-booking-link?${parameters}`)
      const linkResult = await linkResponse.json()
      if (linkResponse.ok) window.open(linkResult.whatsapp_link, '_blank', 'noopener,noreferrer')
    } catch (error) {
      if (error.message === CONNECTION_ISSUE) {
        showConnectionIssue(bookWithVoice)
        setBookingStage('')
        return
      }
      setErrorMessage(error.message || 'Unable to create a ticket.')
      setBookingStage('')
      speakRoute('Sorry, I could not create your ticket.')
    }
  }

  function startListening(mode = 'journey') {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!Recognition) {
      setSpeechRecognitionSupported(false)
      return
    }

    recognitionRef.current?.abort()
    const recognition = new Recognition()
    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = 'en-IN'
    recognitionRef.current = recognition
    setIsListening(true)
    setVoiceStatus(mode === 'journey' ? 'Listening for your journey…' : 'Listening for “book it” or “repeat”…')

    recognition.onresult = async (event) => {
      const transcript = event.results[0][0].transcript
      setIsListening(false)
      setVoiceStatus(`Heard: ${transcript}`)

      if (mode === 'command') {
        const command = transcript.toLowerCase()
        if (command.includes('book it')) {
          await bookWithVoice()
          return
        }
        if (command.includes('repeat')) {
          speakRoute(lastExplanationRef.current, () => startListening('command'))
          return
        }
        const spokenStations = stationsInTranscript(transcript)
        const isCurrentStationUpdate = command.includes("i'm at") || command.includes('i am at') || spokenStations.length === 1
        if (bookingStage === 'booked' && journeyStatus && isCurrentStationUpdate && spokenStations.length) {
          const currentStationUpdate = spokenStations[0]
          setCurrentStation(currentStationUpdate)
          setVoiceStatus(`Updating location: ${currentStationUpdate}`)
          await requestJourneyStatus(currentStationUpdate)
          return
        }
        retryListening('command', 'Say book it, repeat, or tell me which station you are at.')
        return
      }

      const matches = stationsInTranscript(transcript)
      if (matches.length < 2) {
        retryListening('journey', "Sorry, I didn't catch both stations. Try again, like Aluva to Thripunithura.")
        return
      }

      const routeRequest = {
        profile: 'visually_impaired',
        start_station: matches[0],
        end_station: matches[1],
      }
      setStartStation(routeRequest.start_station)
      setEndStation(routeRequest.end_station)
      setIsPlanning(true)
      const result = await requestRoute('/plan-route', routeRequest, true)
      if (result) setLastPlan(routeRequest)
      setIsPlanning(false)
    }
    recognition.onerror = (event) => {
      setIsListening(false)
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setVoiceStatus('Microphone access is unavailable. Use the station dropdowns below.')
        return
      }
      retryListening(mode, "Sorry, I didn't catch that. Try again.")
    }
    recognition.onend = () => setIsListening(false)
    try {
      recognition.start()
    } catch {
      setIsListening(false)
      setVoiceStatus('Voice recognition is unavailable. Use the station dropdowns below.')
    }
  }

  async function requestRoute(endpoint, routeRequest, listenForCommands = false) {
    try {
      const response = await fetchWithTimeout(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(routeRequest),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.detail || 'Unable to plan this route.')

      setRouteResult(result)
      if (routeRequest.profile === 'visually_impaired') {
        lastExplanationRef.current = result.speech_text
        speakRoute(result.speech_text, listenForCommands ? () => startListening('command') : undefined)
      }
      return result
    } catch (error) {
      if (error.message === CONNECTION_ISSUE) {
        showConnectionIssue(() => requestRoute(endpoint, routeRequest, listenForCommands))
        return null
      }
      setErrorMessage(error.message || 'Unable to reach the route planning service.')
      return null
    }
  }

  async function handlePlanRoute(event) {
    event.preventDefault()
    const routeRequest = {
      profile,
      start_station: startStation,
      end_station: endStation,
    }
    console.log('Route plan selected:', routeRequest)
    setErrorMessage('')
    clearConnectionIssue()
    setIsPlanning(true)
    setBooking(null)
    setJourneyStatus(null)
    setActiveOutage(null)
    const result = await requestRoute('/plan-route', routeRequest, profile === 'visually_impaired')
    if (result) setLastPlan(routeRequest)
    setIsPlanning(false)
  }

  async function handleOutage() {
    if (!lastPlan) return
    setErrorMessage('')
    setIsActioning(true)
    try {
      const outageResponse = await fetchWithTimeout(`${API_URL}/simulate-outage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ station_name: outageStation }),
      })
      const outageResult = await outageResponse.json()
      if (!outageResponse.ok) throw new Error(outageResult.detail || 'Unable to simulate outage.')

      setActiveOutage(outageResult.name)
      await requestRoute('/replan', lastPlan)
    } catch (error) {
      if (error.message === CONNECTION_ISSUE) {
        showConnectionIssue(handleOutage)
        return
      }
      setErrorMessage(error.message || 'Unable to simulate outage.')
    } finally {
      setIsActioning(false)
    }
  }

  async function handleBooking() {
    if (!lastPlan) return
    setErrorMessage('')
    clearConnectionIssue()
    setIsActioning(true)
    startBookingProcess()
    try {
      const response = await fetchWithTimeout(`${API_URL}/book-ticket`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_station: lastPlan.start_station,
          end_station: lastPlan.end_station,
          date: new Date().toISOString().slice(0, 10),
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.detail || 'Unable to create a ticket.')
      revealBooking(result)
    } catch (error) {
      if (error.message === CONNECTION_ISSUE) {
        showConnectionIssue(handleBooking)
        setBookingStage('')
        return
      }
      setErrorMessage(error.message || 'Unable to create a ticket.')
      setBookingStage('')
    } finally {
      setIsActioning(false)
    }
  }

  async function handleWhatsApp() {
    if (!lastPlan) return
    setErrorMessage('')
    setIsActioning(true)
    try {
      const parameters = new URLSearchParams({
        start_station: lastPlan.start_station,
        end_station: lastPlan.end_station,
        date: new Date().toISOString().slice(0, 10),
      })
      const response = await fetchWithTimeout(`${API_URL}/whatsapp-booking-link?${parameters}`)
      const result = await response.json()
      if (!response.ok) throw new Error(result.detail || 'Unable to prepare the WhatsApp link.')
      window.open(result.whatsapp_link, '_blank', 'noopener,noreferrer')
    } catch (error) {
      if (error.message === CONNECTION_ISSUE) {
        showConnectionIssue(handleWhatsApp)
        return
      }
      setErrorMessage(error.message || 'Unable to prepare the WhatsApp link.')
    } finally {
      setIsActioning(false)
    }
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
          <p className={`profile-listening ${isProfileListening ? 'is-listening' : ''}`} aria-live="polite">
            <span aria-hidden="true">●</span> {profileVoiceMessage || 'Listening...'}
          </p>
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
  const selectedRoute = routeResult?.route || []
  const diagramStart = selectedRoute[0] || startStation
  const diagramEnd = selectedRoute.at(-1) || endStation

  return (
    <main className={`metro-app route-screen ${profile}`}>
      <header className="app-header">
        <button className="text-button" type="button" onClick={() => setProfile(null)}>← Change profile</button>
        <p className="wordmark">Kochi Metro</p>
        <p className="header-note">{selectedProfile.title}</p>
      </header>

      {isDeaf && (
        <aside className={`alert-banner ${alertBannerPulse ? 'is-pulsing' : ''}`} role="status">
          <strong>Service alerts</strong>
          <span>{connectionIssue ? CONNECTION_ISSUE : journeyStatus?.visual_alert || routeResult?.visual_alert || 'No active alerts. Live disruptions will appear here.'}</span>
        </aside>
      )}

      {isConnecting && <p className="connecting-status" aria-live="polite">Connecting...</p>}

      <section className="route-workspace" aria-labelledby="route-heading">
        <div className="route-intro">
          <p className="eyebrow">Plan a journey</p>
          <h1 id="route-heading">Where are you going?</h1>
          {isVisuallyImpaired && (
            <>
              <p className={`tts-indicator ${isSpeaking ? 'is-speaking' : ''}`}><span aria-hidden="true">●</span> {isSpeaking ? 'Speaking route guidance' : 'Speech guidance ready'}</p>
              {speechRecognitionSupported ? (
                <div className="voice-primary">
                  <button aria-label="Tap and speak your journey" className="voice-button" onClick={() => startListening('journey')} type="button">
                    {isListening ? 'Listening…' : 'Tap and speak your journey'}
                  </button>
                  <p aria-live="polite">{voiceStatus || 'Say your starting station, then your destination.'}</p>
                </div>
              ) : (
                <p className="voice-fallback" role="status">Voice recognition is not supported in this browser. Use the station dropdowns to plan your route.</p>
              )}
            </>
          )}
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
          <button className="primary-button" disabled={isPlanning || isConnecting} type="submit">
            {isPlanning || isConnecting ? 'Connecting...' : 'Plan Route'} <span aria-hidden="true">→</span>
          </button>
        </form>
      </section>

      {connectionIssue && (
        <div className="connection-issue" role="alert">
          <p>{CONNECTION_ISSUE}</p>
          <button
            className="outline-button"
            onClick={() => {
              const retry = retryAction
              clearConnectionIssue()
              retry?.()
            }}
            type="button"
          >
            Retry
          </button>
        </div>
      )}
      {errorMessage && !connectionIssue && <p className="error-message" role="alert">{errorMessage}</p>}

      {routeResult && (
        <>
          <section className="route-result" aria-live="polite" aria-labelledby="result-heading">
            <p className="eyebrow">Route ready</p>
            <h2 id="result-heading">{routeResult.station_count} stations · {routeResult.direction}</h2>
            {isVisuallyImpaired && <p>{routeResult.speech_text}</p>}
            {isDeaf && <p>{routeResult.visual_alert}</p>}
            {isWheelchair && (
              <>
                <p>{routeResult.explanation}</p>
                <ul className="elevator-details">
                  {routeResult.elevator_details?.map((station) => (
                    <li key={station.station}>{station.station}: <strong>{station.elevator_status}</strong></li>
                  ))}
                </ul>
              </>
            )}
          </section>

          <section className="secondary-actions" aria-label="Route actions">
            <div className="demo-area">
              <p className="eyebrow">Demo / admin controls</p>
              <h2>Simulate elevator outage</h2>
              <label htmlFor="outage-station">Station with outage</label>
              <div className="action-row">
                <select id="outage-station" value={outageStation} onChange={(event) => setOutageStation(event.target.value)}>
                  {STATIONS.map((station) => <option key={station}>{station}</option>)}
                </select>
                <button className="outline-button" disabled={isActioning} onClick={handleOutage} type="button">Simulate Outage</button>
              </div>
            </div>

            <div className="booking-area">
              <p className="eyebrow">Ticket options</p>
              <h2>Ready to travel?</h2>
              <div className="action-row">
                <button className="outline-button" disabled={isActioning} onClick={handleBooking} type="button">Book Ticket</button>
                <button className="text-action" disabled={isActioning} onClick={handleWhatsApp} type="button">Pay via WhatsApp ↗</button>
              </div>
              {bookingStage && (
                <div className={`booking-progress ${bookingStage}`} aria-live="polite">
                  <p>{bookingStage === 'checking' && 'Checking route...'}</p>
                  <p>{bookingStage === 'confirming' && 'Confirming booking...'}</p>
                  {bookingStage === 'booked' && booking && (
                    <>
                      <p><strong>Booked</strong></p>
                      <p className="ticket-confirmation"><strong>Ticket ID: {booking.ticket_id}</strong></p>
                      <figure className="ticket-qr">
                        <canvas ref={qrCanvasRef} aria-label={`QR code for ticket ${booking.ticket_id}`} role="img" />
                        <figcaption>Demo ticket — for hackathon presentation</figcaption>
                      </figure>
                      <div className="journey-tracker">
                        <label htmlFor="current-station">I&apos;m at...</label>
                        <select
                          id="current-station"
                          value={currentStation}
                          onChange={(event) => {
                            setCurrentStation(event.target.value)
                            requestJourneyStatus(event.target.value)
                          }}
                        >
                          {STATIONS.map((station) => <option key={station}>{station}</option>)}
                        </select>
                        {journeyStatus && (
                          <p className="journey-update">
                            {journeyStatus.next_station && <strong>Next stop: {journeyStatus.next_station}. </strong>}
                            {journeyStatus.message}
                          </p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </section>
        </>
      )}

      <section className="diagram-section" aria-labelledby="diagram-heading">
        <div className="diagram-heading">
          <div>
            <p className="eyebrow">Purple line</p>
            <h2 id="diagram-heading">Aluva — Thripunithura</h2>
          </div>
          <p className="diagram-key"><span aria-hidden="true" /> Selected journey</p>
        </div>
        <MetroLineDiagram
          autoScroll={Boolean(routeResult)}
          alternate={alternateStation(routeResult)}
          endStation={diagramEnd}
          outageStation={activeOutage}
          showElevators={isWheelchair}
          scrollKey={routeResult}
          startStation={diagramStart}
        />
      </section>
    </main>
  )
}

export default App

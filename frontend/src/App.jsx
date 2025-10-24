import React, { useEffect, useState, useRef } from 'react'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000'

function useSpeechRecognition(onResult) {
  const recogRef = useRef(null)
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) return
    const r = new SpeechRecognition()
    r.continuous = true
    r.interimResults = false
    r.lang = 'en-US'
    r.onresult = (e) => {
      const text = Array.from(e.results).map(r => r[0].transcript).join(' ')
      onResult(text)
    }
    recogRef.current = r
    return () => {
      try { r.stop() } catch {}
    }
  }, [onResult])

  const start = () => recogRef.current && recogRef.current.start()
  const stop = () => recogRef.current && recogRef.current.stop()
  return { start, stop }
}

export default function App() {
  const [transcript, setTranscript] = useState('')
  const [listening, setListening] = useState(false)
  const [reminders, setReminders] = useState([])
  const [news, setNews] = useState([])
  const [weather, setWeather] = useState(null)
  const recognition = useSpeechRecognition((text) => {
    setTranscript(prev => (prev ? prev + ' ' : '') + text)
  })

  useEffect(() => fetchReminders(), [])

  async function fetchReminders() {
    const r = await fetch(`${API_BASE}/api/reminders`)
    setReminders(await r.json())
  }

  async function addReminder(title) {
    const res = await fetch(`${API_BASE}/api/reminders`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title })
    })
    const created = await res.json()
    setReminders(prev => [...prev, created])
  }

  async function handleGetWeather() {
    const city = prompt('Enter city for weather (e.g., London)')
    if (!city) return
    const r = await fetch(`${API_BASE}/api/weather?city=${encodeURIComponent(city)}`)
    const data = await r.json()
    setWeather(data)
    speak(`Weather in ${data.city || city}: ${data.desc || data.temp}`)
  }

  async function handleGetNews() {
    const r = await fetch(`${API_BASE}/api/news`)
    const data = await r.json()
    setNews(data)
    if (data && data.length) speak(`Top news: ${data[0].title}`)
  }

  function speak(text) {
    if (!text) return
    // Prefer browser TTS
    const synth = window.speechSynthesis
    if (synth) {
      const ut = new SpeechSynthesisUtterance(text)
      ut.lang = 'en-US'
      synth.cancel()
      synth.speak(ut)
    } else {
      // fallback: ask backend to return mp3
      fetch(`${API_BASE}/api/tts`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ text }) })
        .then(r => r.blob())
        .then(b => {
          const url = URL.createObjectURL(b)
          const a = new Audio(url)
          a.play()
        })
    }
  }

  function handleStartListening() {
    setTranscript('')
    recognition.start()
    setListening(true)
  }

  function handleStopListening() {
    recognition.stop()
    setListening(false)
  }

  async function applyTranscriptCommand() {
    const t = transcript.toLowerCase()
    if (t.includes('set reminder') || t.includes('remind me')) {
      // naive extraction: text after "remind me to"
      const match = t.match(/remind me (to )?(.*)/) || t.match(/set reminder (for )?(.*)/)
      const title = (match && match[2]) ? match[2] : transcript
      await addReminder(title)
      speak('Reminder set')
      fetchReminders()
    } else if (t.includes('weather')) {
      const m = t.match(/weather in ([a-zA-Z ]+)/)
      if (m) {
        const city = m[1].trim()
        const r = await fetch(`${API_BASE}/api/weather?city=${encodeURIComponent(city)}`)
        const data = await r.json()
        setWeather(data)
        speak(`Weather in ${data.city || city}: ${data.desc || data.temp}`)
      } else {
        speak('Which city?')
      }
    } else if (t.includes('news')) {
      handleGetNews()
    } else {
      speak('I heard: ' + transcript)
    }
  }

  return (
    <div style={{ padding: 24, fontFamily: 'Arial, sans-serif' }}>
      <h1>Voice-Activated Personal Assistant</h1>
      <div style={{ marginBottom: 12 }}>
        <button onClick={handleStartListening} disabled={listening}>Start Listening</button>
        <button onClick={handleStopListening} disabled={!listening}>Stop</button>
        <button onClick={() => { setTranscript(''); setListening(false); }}>Clear</button>
        <button onClick={applyTranscriptCommand} disabled={!transcript}>Apply Command</button>
      </div>

      <div style={{ marginBottom: 12 }}>
        <strong>Transcript:</strong>
        <div style={{ minHeight: 40, padding: 8, border: '1px solid #ddd', background: '#fafafa' }}>{transcript}</div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <button onClick={() => { const text = prompt('Text to speak:'); if (text) speak(text) }}>Speak Text</button>
        <button onClick={handleGetWeather}>Get Weather</button>
        <button onClick={handleGetNews}>Get News</button>
        <button onClick={fetchReminders}>Refresh Reminders</button>
      </div>

      <section>
        <h3>Weather</h3>
        <pre>{weather ? JSON.stringify(weather, null, 2) : 'No data'}</pre>
      </section>

      <section>
        <h3>Top News</h3>
        <ul>
          {news && news.length ? news.map((n, i) => <li key={i}><a href={n.url} target="_blank" rel="noreferrer">{n.title}</a> — {n.source}</li>) : <li>No news</li>}
        </ul>
      </section>

      <section>
        <h3>Reminders</h3>
        <ul>
          {reminders.map(r => <li key={r.id}>{r.title} {r.time ? `@ ${r.time}` : ''}</li>)}
        </ul>
      </section>
    </div>
  )
}
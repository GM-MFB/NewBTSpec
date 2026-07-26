import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import './SettingsPage.css'
import { useAuth } from '../hooks/useAuth'
import { useUserSettings } from '../hooks/useUserSettings'

function KeyInput({ id, label, value, onChange }) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="key-input-wrap">
      <input id={id} type={visible ? 'text' : 'password'} value={value} onChange={onChange} />
      <button
        type="button"
        className="key-visibility-toggle"
        onClick={() => setVisible((v) => !v)}
        aria-label={`${visible ? 'Hide' : 'Show'} ${label}`}
      >
        {visible ? '🙈' : '👁'}
      </button>
    </div>
  )
}

export default function SettingsPage() {
  const { user } = useAuth()
  const { finnhubKey, avKey, displayName, loading, saveFinnhubKey, saveAvKey, saveDisplayName } = useUserSettings(user?.id)
  const [value, setValue] = useState('')
  const [status, setStatus] = useState(null)
  const [error, setError] = useState(null)
  const [avValue, setAvValue] = useState('')
  const [avStatus, setAvStatus] = useState(null)
  const [avError, setAvError] = useState(null)
  const [displayNameValue, setDisplayNameValue] = useState('')
  const [displayNameStatus, setDisplayNameStatus] = useState(null)
  const [displayNameError, setDisplayNameError] = useState(null)

  useEffect(() => {
    if (!loading) setValue(finnhubKey)
  }, [loading, finnhubKey])

  useEffect(() => {
    if (!loading) setAvValue(avKey)
  }, [loading, avKey])

  useEffect(() => {
    if (!loading) setDisplayNameValue(displayName)
  }, [loading, displayName])

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setStatus(null)
    try {
      await saveFinnhubKey(value)
      setStatus('Saved.')
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleAvSubmit(e) {
    e.preventDefault()
    setAvError(null)
    setAvStatus(null)
    try {
      await saveAvKey(avValue)
      setAvStatus('Saved.')
    } catch (err) {
      setAvError(err.message)
    }
  }

  async function handleDisplayNameSubmit(e) {
    e.preventDefault()
    setDisplayNameError(null)
    setDisplayNameStatus(null)
    try {
      await saveDisplayName(displayNameValue)
      setDisplayNameStatus('Saved.')
    } catch (err) {
      setDisplayNameError(err.message)
    }
  }

  return (
    <div data-testid="settings-page" className="settings-page">
      <Link to="/">← Home</Link>
      <h1>Settings</h1>

      <div className="settings-field">
        <span className="settings-label">User ID</span>
        <span className="mono settings-user-id">{user?.id}</span>
      </div>

      <form onSubmit={handleDisplayNameSubmit}>
        <label htmlFor="displayName">Display Name</label>
        <input id="displayName" type="text" value={displayNameValue} onChange={(e) => setDisplayNameValue(e.target.value)} />

        {displayNameError && <p role="alert">{displayNameError}</p>}
        {displayNameStatus && <p>{displayNameStatus}</p>}

        <button type="submit">Save Display Name</button>
      </form>

      <form onSubmit={handleSubmit}>
        <label htmlFor="finnhubKey">Finnhub API Key</label>
        <KeyInput id="finnhubKey" label="Finnhub API Key" value={value} onChange={(e) => setValue(e.target.value)} />

        {error && <p role="alert">{error}</p>}
        {status && <p>{status}</p>}

        <button type="submit">Save</button>
      </form>

      <form onSubmit={handleAvSubmit}>
        <label htmlFor="avKey">Alpha Vantage API Key</label>
        <KeyInput id="avKey" label="Alpha Vantage API Key" value={avValue} onChange={(e) => setAvValue(e.target.value)} />

        {avError && <p role="alert">{avError}</p>}
        {avStatus && <p>{avStatus}</p>}

        <button type="submit">Save Alpha Vantage Key</button>
      </form>
    </div>
  )
}

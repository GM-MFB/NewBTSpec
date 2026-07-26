import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import './SettingsPage.css'
import { useAuth } from '../hooks/useAuth'
import { useUserSettings } from '../hooks/useUserSettings'

export default function SettingsPage() {
  const { user } = useAuth()
  const { finnhubKey, displayName, loading, saveFinnhubKey, saveDisplayName } = useUserSettings(user?.id)
  const [value, setValue] = useState('')
  const [status, setStatus] = useState(null)
  const [error, setError] = useState(null)
  const [displayNameValue, setDisplayNameValue] = useState('')
  const [displayNameStatus, setDisplayNameStatus] = useState(null)
  const [displayNameError, setDisplayNameError] = useState(null)

  useEffect(() => {
    if (!loading) setValue(finnhubKey)
  }, [loading, finnhubKey])

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
        <input id="finnhubKey" type="password" value={value} onChange={(e) => setValue(e.target.value)} />

        {error && <p role="alert">{error}</p>}
        {status && <p>{status}</p>}

        <button type="submit">Save</button>
      </form>
    </div>
  )
}

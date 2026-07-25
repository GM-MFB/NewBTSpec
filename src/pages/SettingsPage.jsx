import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import './SettingsPage.css'
import { useAuth } from '../hooks/useAuth'
import { useUserSettings } from '../hooks/useUserSettings'

export default function SettingsPage() {
  const { user } = useAuth()
  const { finnhubKey, loading, saveFinnhubKey } = useUserSettings(user?.id)
  const [value, setValue] = useState('')
  const [status, setStatus] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!loading) setValue(finnhubKey)
  }, [loading, finnhubKey])

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

  return (
    <div data-testid="settings-page" className="settings-page">
      <Link to="/">← Home</Link>
      <h1>Settings</h1>
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

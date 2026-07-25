import { useState } from 'react'
import { supabase } from '../utils/supabase'
import './LoginPage.css'

const TICKER_ITEMS = [
  { symbol: 'AAPL', change: '+1.24%', up: true },
  { symbol: 'ES', change: '-0.42%', up: false },
  { symbol: 'NQ', change: '+0.87%', up: true },
  { symbol: 'TSLA', change: '-2.10%', up: false },
  { symbol: 'SPY', change: '+0.35%', up: true },
  { symbol: 'NVDA', change: '+3.02%', up: true },
  { symbol: 'CL', change: '-1.05%', up: false },
]

export default function LoginPage() {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    const { error: err } = mode === 'signin'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password })
    if (err) setError(err.message)
  }

  const tickerRow = [...TICKER_ITEMS, ...TICKER_ITEMS]

  return (
    <div data-testid="login-page" className="login-page">
      <div className="login-brand" aria-hidden="true">
        <div className="login-wordmark mono">
          BT<span>Speculation</span>
        </div>
        <p className="login-tagline">Every trade, logged.</p>
        <div className="ticker-tape">
          <div className="ticker-track mono">
            {tickerRow.map((item, i) => (
              <span key={i} className={`ticker-item ${item.up ? 'is-up' : 'is-down'}`}>
                {item.symbol} <span className="ticker-change">{item.change}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="login-panel">
        <div className="login-card">
          <h1 className="login-heading">{mode === 'signin' ? 'Sign in' : 'Create your account'}</h1>
          <p className="login-subheading">
            {mode === 'signin' ? 'Pick up where you left off.' : 'Start logging your trades.'}
          </p>

          <form onSubmit={handleSubmit} className="login-form">
            <div className="field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div className="field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              />
            </div>

            {error && <p role="alert" className="login-error">{error}</p>}

            <button type="submit" className="login-submit">
              {mode === 'signin' ? 'Sign In' : 'Sign Up'}
            </button>
          </form>

          <button
            type="button"
            className="login-toggle"
            onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
          >
            {mode === 'signin' ? 'Create an account' : 'Back to sign in'}
          </button>
        </div>
      </div>
    </div>
  )
}

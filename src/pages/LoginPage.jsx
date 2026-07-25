import { useState } from 'react'
import { supabase } from '../utils/supabase'

export default function LoginPage() {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    const action = mode === 'signin' ? supabase.auth.signInWithPassword : supabase.auth.signUp
    const { error: err } = await action({ email, password })
    if (err) setError(err.message)
  }

  return (
    <div data-testid="login-page" className="login-page">
      <h1>BT Speculation</h1>
      <form onSubmit={handleSubmit}>
        <label htmlFor="email">Email</label>
        <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />

        <label htmlFor="password">Password</label>
        <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />

        {error && <p role="alert">{error}</p>}

        <button type="submit">{mode === 'signin' ? 'Sign In' : 'Sign Up'}</button>
      </form>
      <button type="button" onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
        {mode === 'signin' ? 'Create an account' : 'Back to sign in'}
      </button>
    </div>
  )
}

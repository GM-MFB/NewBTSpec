import { useState } from 'react'
import { NavLink } from 'react-router-dom'

export default function Header({ accounts, activeAccount, switchAccount, createAccount, onAddTrade }) {
  const [open, setOpen] = useState(false)

  return (
    <header className="app-header">
      <div className="account-switcher">
        <button type="button" onClick={() => setOpen((o) => !o)} className="account-name">
          {activeAccount?.name ?? 'Account'}
        </button>
        {open && (
          <ul className="account-dropdown">
            {accounts.filter((a) => a.id !== activeAccount?.id).map((a) => (
              <li key={a.id}>
                <button type="button" onClick={() => { switchAccount(a.id); setOpen(false) }}>
                  {a.name}
                </button>
              </li>
            ))}
            <li>
              <button
                type="button"
                onClick={() => {
                  const name = window.prompt('New account name')
                  if (name) createAccount(name)
                  setOpen(false)
                }}
              >
                + New account
              </button>
            </li>
          </ul>
        )}
      </div>

      <nav className="app-nav">
        <NavLink to="/stats">Stats</NavLink>
        <NavLink to="/analyze">Analyze</NavLink>
        <NavLink to="/matt-cap">Matt Cap</NavLink>
      </nav>

      <button type="button" className="add-trade-btn" onClick={onAddTrade}>
        + Add Trade
      </button>
    </header>
  )
}

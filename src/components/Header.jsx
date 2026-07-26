import { useState } from "react";
import { NavLink, Link } from "react-router-dom";
import "./Header.css";

export default function Header({
    accounts,
    activeAccount,
    switchAccount,
    createAccount,
    onAddTrade,
    addLabel = "+ Add Trade",
    onRefresh,
    refreshing = false,
    showAddButton = true,
}) {
    const [open, setOpen] = useState(false);

    return (
        <header className="app-header">
            <div className="account-switcher">
                <button
                    type="button"
                    onClick={() => setOpen((o) => !o)}
                    className="account-name"
                >
                    {activeAccount?.name ?? "Account"}
                </button>
                {open && (
                    <ul className="account-dropdown">
                        {accounts
                            .filter((a) => a.id !== activeAccount?.id)
                            .map((a) => (
                                <li key={a.id}>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            switchAccount(a.id);
                                            setOpen(false);
                                        }}
                                    >
                                        {a.name}
                                    </button>
                                </li>
                            ))}
                        <li>
                            <button
                                type="button"
                                onClick={() => {
                                    const name =
                                        window.prompt("New account name");
                                    if (name) createAccount(name);
                                    setOpen(false);
                                }}
                            >
                                + New account
                            </button>
                        </li>
                    </ul>
                )}
            </div>

            <nav className="app-nav">
                <NavLink
                    to="/"
                    end
                    className={({ isActive }) =>
                        isActive ? "active" : undefined
                    }
                >
                    Home
                </NavLink>
                <NavLink
                    to="/stats"
                    className={({ isActive }) =>
                        isActive ? "active" : undefined
                    }
                >
                    Stats
                </NavLink>
                <NavLink
                    to="/daytrading"
                    className={({ isActive }) =>
                        isActive ? "active" : undefined
                    }
                >
                    Day Trading
                </NavLink>
                <NavLink
                    to="/analyze"
                    className={({ isActive }) =>
                        isActive ? "active" : undefined
                    }
                >
                    Analyze
                </NavLink>
                <NavLink
                    to="/matt-cap"
                    className={({ isActive }) =>
                        isActive ? "active" : undefined
                    }
                >
                    Matt Cap
                </NavLink>
            </nav>

            <div className="header-actions">
                {onRefresh && (
                    <button
                        type="button"
                        className="refresh-btn"
                        onClick={onRefresh}
                        disabled={refreshing}
                    >
                        {refreshing ? "Refreshing…" : "↻ Refresh"}
                    </button>
                )}
                {showAddButton && (
                    <button
                        type="button"
                        className="add-trade-btn"
                        onClick={onAddTrade}
                    >
                        {addLabel}
                    </button>
                )}
                <Link
                    to="/settings"
                    className="settings-link"
                    aria-label="Settings"
                >
                    ⚙
                </Link>
            </div>
        </header>
    );
}

import { useState } from "react";
import { NavLink, Link } from "react-router-dom";
import "./Header.css";

export default function Header({
    accounts,
    activeAccount,
    switchAccount,
    createAccount,
    deleteAccount,
    renameAccount,
    onSignOut,
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
                {renameAccount && activeAccount && activeAccount.name !== "Matt Cap" && (
                    <button
                        type="button"
                        className="rename-account-btn"
                        aria-label={`Rename ${activeAccount.name}`}
                        onClick={() => {
                            const name = window.prompt(
                                "Rename account",
                                activeAccount.name
                            );
                            if (name) renameAccount(activeAccount.id, name);
                        }}
                    >
                        ✎
                    </button>
                )}
                {open && (
                    <ul className="account-dropdown">
                        {accounts
                            .filter((a) => a.id !== activeAccount?.id)
                            .map((a) => (
                                <li key={a.id} className="account-row">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            switchAccount(a.id);
                                            setOpen(false);
                                        }}
                                    >
                                        {a.name}
                                    </button>
                                    {renameAccount && a.name !== 'Matt Cap' && (
                                        <button
                                            type="button"
                                            className="rename-account-btn"
                                            aria-label={`Rename ${a.name}`}
                                            onClick={() => {
                                                const name = window.prompt(
                                                    "Rename account",
                                                    a.name
                                                );
                                                if (name) renameAccount(a.id, name);
                                                setOpen(false);
                                            }}
                                        >
                                            ✎
                                        </button>
                                    )}
                                    {deleteAccount && a.name !== 'Matt Cap' && (
                                        <button
                                            type="button"
                                            className="delete-account-btn"
                                            aria-label={`Delete ${a.name}`}
                                            onClick={async () => {
                                                if (
                                                    window.confirm(
                                                        `Delete ${a.name}? This will also delete all of its trades and investments. This cannot be undone.`
                                                    )
                                                ) {
                                                    try {
                                                        await deleteAccount(a.id);
                                                    } catch (err) {
                                                        window.alert(
                                                            `Couldn't delete ${a.name}: ${err.message}`
                                                        );
                                                        return;
                                                    }
                                                }
                                                setOpen(false);
                                            }}
                                        >
                                            ×
                                        </button>
                                    )}
                                </li>
                            ))}
                        <li className="account-dropdown-divider" role="separator">
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
                        {onSignOut && (
                            <li>
                                <button
                                    type="button"
                                    className="sign-out-btn"
                                    onClick={() => {
                                        onSignOut();
                                        setOpen(false);
                                    }}
                                >
                                    Sign Out
                                </button>
                            </li>
                        )}
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
                    to="/watchlist"
                    className={({ isActive }) =>
                        isActive ? "active" : undefined
                    }
                >
                    Watchlist
                </NavLink>
                <NavLink
                    to="/charts"
                    className={({ isActive }) =>
                        isActive ? "active" : undefined
                    }
                >
                    Charts
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

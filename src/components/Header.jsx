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
    const [renamingId, setRenamingId] = useState(null);
    const [renameValue, setRenameValue] = useState("");
    const [addingAccount, setAddingAccount] = useState(false);
    const [newAccountName, setNewAccountName] = useState("");

    function startRename(account) {
        setRenamingId(account.id);
        setRenameValue(account.name);
    }

    function cancelRename() {
        setRenamingId(null);
        setRenameValue("");
    }

    function commitRename(id) {
        renameAccount(id, renameValue);
        setRenamingId(null);
        setRenameValue("");
    }

    function cancelAddAccount() {
        setAddingAccount(false);
        setNewAccountName("");
    }

    function commitAddAccount() {
        if (newAccountName.trim()) createAccount(newAccountName);
        setAddingAccount(false);
        setNewAccountName("");
        setOpen(false);
    }

    return (
        <header className="app-header">
            <div className="account-switcher">
                {renamingId === activeAccount?.id ? (
                    <form
                        className="rename-form"
                        onSubmit={(e) => {
                            e.preventDefault();
                            commitRename(activeAccount.id);
                        }}
                    >
                        <input
                            autoFocus
                            aria-label={`Rename ${activeAccount.name}`}
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                        />
                        <button type="submit">Save</button>
                        <button type="button" onClick={cancelRename}>
                            Cancel
                        </button>
                    </form>
                ) : (
                    <>
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
                                onClick={() => startRename(activeAccount)}
                            >
                                ✎
                            </button>
                        )}
                    </>
                )}
                {open && (
                    <ul className="account-dropdown">
                        {accounts
                            .filter((a) => a.id !== activeAccount?.id)
                            .map((a) =>
                                renamingId === a.id ? (
                                    <li key={a.id}>
                                        <form
                                            className="rename-form"
                                            onSubmit={(e) => {
                                                e.preventDefault();
                                                commitRename(a.id);
                                            }}
                                        >
                                            <input
                                                autoFocus
                                                aria-label={`Rename ${a.name}`}
                                                value={renameValue}
                                                onChange={(e) => setRenameValue(e.target.value)}
                                            />
                                            <button type="submit">Save</button>
                                            <button type="button" onClick={cancelRename}>
                                                Cancel
                                            </button>
                                        </form>
                                    </li>
                                ) : (
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
                                                onClick={() => startRename(a)}
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
                                )
                            )}
                        <li className="account-dropdown-divider">
                            {addingAccount ? (
                                <form
                                    className="rename-form"
                                    onSubmit={(e) => {
                                        e.preventDefault();
                                        commitAddAccount();
                                    }}
                                >
                                    <input
                                        autoFocus
                                        aria-label="New account name"
                                        value={newAccountName}
                                        onChange={(e) => setNewAccountName(e.target.value)}
                                    />
                                    <button type="submit">Create</button>
                                    <button type="button" onClick={cancelAddAccount}>
                                        Cancel
                                    </button>
                                </form>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => setAddingAccount(true)}
                                >
                                    + New account
                                </button>
                            )}
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

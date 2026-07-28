import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import LoginPage from "./pages/LoginPage";
import InvestmentsPage from "./pages/InvestmentsPage";
import TradesPage from "./pages/TradesPage";
import SettingsPage from "./pages/SettingsPage";
import StatsPage from "./pages/StatsPage";
import AnalyzePage from "./pages/AnalyzePage";

function RequireAuth({ user, children }) {
    if (!user) return <Navigate to="/login" replace />;
    return children;
}

export default function App() {
    const { user, loading } = useAuth();

    if (loading) return null;

    return (
        <Routes>
            <Route
                path="/login"
                element={user ? <Navigate to="/" replace /> : <LoginPage />}
            />
            <Route
                path="/"
                element={
                    <RequireAuth user={user}>
                        <InvestmentsPage />
                    </RequireAuth>
                }
            />
            <Route
                path="/daytrading"
                element={
                    <RequireAuth user={user}>
                        <TradesPage />
                    </RequireAuth>
                }
            />
            <Route
                path="/settings"
                element={
                    <RequireAuth user={user}>
                        <SettingsPage />
                    </RequireAuth>
                }
            />
            <Route
                path="/stats"
                element={
                    <RequireAuth user={user}>
                        <StatsPage />
                    </RequireAuth>
                }
            />
            <Route
                path="/analyze"
                element={
                    <RequireAuth user={user}>
                        <AnalyzePage />
                    </RequireAuth>
                }
            />
        </Routes>
    );
}

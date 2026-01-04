import { useEffect, useMemo, useState } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";

import AppLayout from "./components/AppLayout";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import UserManager from "./pages/UserManager";
import Employees from "./pages/Employees";
import Assets from "./pages/Assets";
import Assignments from "./pages/Assignments";
import Software from "./pages/Software";
import Internet from "./pages/Internet";
import Repairs from "./pages/Repairs";
import Maintenance from "./pages/Maintenance";
import BillingReminders from "./pages/BillingReminders";
import FingerprintAccess from "./pages/FingerprintAccess";

import {
  fetchMe,
  getStoredUser,
  getToken,
  logout as doLogout,
  logoutAsync,
} from "./auth/authStore";
import { PageLoader } from "./components/Loaders";
import { toast } from "react-toastify";

function ProtectedRoute({ allowRoles, user, booted, children }) {
  const token = getToken();
  const location = useLocation();

  if (!token)
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  // Token exists but boot not finished => show loader (prevents flicker)
  if (!booted) return <PageLoader label="Checking session..." />;

  // Booted but user missing => token invalid or user deleted => logout
  if (!user) return <Navigate to="/login" replace />;

  if (allowRoles && !allowRoles.includes(user.role))
    return <Navigate to="/dashboard" replace />;

  return children;
}

function AppInner() {
  const [user, setUser] = useState(() => getStoredUser());
  const [booted, setBooted] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (getToken()) {
          const me = await fetchMe();
          if (alive && me) setUser(me);
        }
      } catch {
        doLogout();
        if (alive) setUser(null);
      } finally {
        if (alive) setBooted(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function onLogout() {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await logoutAsync();
      setUser(null);
      toast.success("Logged out.");
    } catch (e) {
      toast.error(e.message || "Logout failed.");
    } finally {
      setIsLoggingOut(false);
    }
  }

  const navItems = useMemo(() => {
    if (!user) return [];

    const base = [{ to: "/dashboard", label: "Dashboard" }];

    if (user.role === "admin") {
      base.push({
        label: "Organization",
        children: [
          { to: "/users", label: "Users" },
          { to: "/employees", label: "Employees" },
        ],
      });

      base.push({
        label: "Assets & Resources",
        children: [
          { to: "/assets", label: "Hardware Assets" },
          { to: "/software", label: "Software Licenses" },
          { to: "/internet", label: "Internet / Network" },
          { to: "/assignments", label: "Asset Assignments" },
        ],
      });

      base.push({
        label: "Support & Maintenance",
        children: [
          { to: "/repairs", label: "Repairs & Tickets" },
          { to: "/maintenance", label: "Maintenance Jobs" },
          { to: "/billing-reminders", label: "Billing Reminders" },
          { to: "/fingerprint", label: "Fingerprint Access" },
        ],
      });
    }

    return base;
  }, [user]);

  return (
    <Routes>
      <Route path="/login" element={<Login onAuthed={setUser} />} />
      <Route path="/register" element={<Register onAuthed={setUser} />} />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute user={user} booted={booted}>
            <AppLayout
              navItems={navItems}
              user={user}
              onLogout={onLogout}
              pageLoading={isLoggingOut}
            >
              <Dashboard user={user} />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/users"
        element={
          <ProtectedRoute user={user} booted={booted} allowRoles={["admin"]}>
            <AppLayout
              navItems={navItems}
              user={user}
              onLogout={onLogout}
              pageLoading={isLoggingOut}
            >
              <UserManager />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/employees"
        element={
          <ProtectedRoute user={user} booted={booted} allowRoles={["admin"]}>
            <AppLayout
              navItems={navItems}
              user={user}
              onLogout={onLogout}
              isLoggingOut={isLoggingOut}
            >
              <Employees />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/assets"
        element={
          <ProtectedRoute user={user} booted={booted} allowRoles={["admin"]}>
            <AppLayout
              navItems={navItems}
              user={user}
              onLogout={onLogout}
              isLoggingOut={isLoggingOut}
            >
              <Assets />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/assignments"
        element={
          <ProtectedRoute user={user} booted={booted} allowRoles={["admin"]}>
            <AppLayout
              navItems={navItems}
              user={user}
              onLogout={onLogout}
              isLoggingOut={isLoggingOut}
            >
              <Assignments />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/software"
        element={
          <ProtectedRoute user={user} booted={booted} allowRoles={["admin"]}>
            <AppLayout
              navItems={navItems}
              user={user}
              onLogout={onLogout}
              isLoggingOut={isLoggingOut}
            >
              <Software />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/internet"
        element={
          <ProtectedRoute user={user} booted={booted} allowRoles={["admin"]}>
            <AppLayout
              navItems={navItems}
              user={user}
              onLogout={onLogout}
              isLoggingOut={isLoggingOut}
            >
              <Internet />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/repairs"
        element={
          <ProtectedRoute user={user} booted={booted} allowRoles={["admin"]}>
            <AppLayout
              navItems={navItems}
              user={user}
              onLogout={onLogout}
              isLoggingOut={isLoggingOut}
            >
              <Repairs />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/maintenance"
        element={
          <ProtectedRoute user={user} booted={booted} allowRoles={["admin"]}>
            <AppLayout
              navItems={navItems}
              user={user}
              onLogout={onLogout}
              isLoggingOut={isLoggingOut}
            >
              <Maintenance />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/billing-reminders"
        element={
          <ProtectedRoute user={user} booted={booted} allowRoles={["admin"]}>
            <AppLayout
              navItems={navItems}
              user={user}
              onLogout={onLogout}
              isLoggingOut={isLoggingOut}
            >
              <BillingReminders />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/fingerprint"
        element={
          <ProtectedRoute user={user} booted={booted} allowRoles={["admin"]}>
            <AppLayout
              navItems={navItems}
              user={user}
              onLogout={onLogout}
              isLoggingOut={isLoggingOut}
            >
              <FingerprintAccess />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppInner />
    </BrowserRouter>
  );
}

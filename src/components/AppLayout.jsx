import { useState } from "react";
import Sidebar from "./Sidebar";
import ScreenshotMonitorIcon from "@mui/icons-material/ScreenshotMonitor";
import { Menu, LogOut, Loader2, ShieldCheck, User } from "lucide-react";

export default function AppLayout({
  navItems,
  user,
  onLogout,
  isLoggingOut = false,
  pageLoading = false,
  children,
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Modern Top Navigation */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            {/* Logo and Mobile Menu */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => setDrawerOpen(true)}
                disabled={isLoggingOut}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
                aria-label="Open navigation menu"
              >
                <Menu className="h-5 w-5" />
              </button>

              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-slate-900 to-slate-700">
                  <ScreenshotMonitorIcon className="h-6 w-6 text-white" />
                </div>
              </div>
            </div>

            {/* User Profile and Actions */}
            <div className="flex items-center gap-4">
              {/* User Profile */}
              <div className="hidden items-center gap-3 rounded-full bg-slate-100/80 px-4 py-2 sm:flex">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-sm font-medium text-white">
                    {user?.username?.charAt(0).toUpperCase()}
                  </div>
                  <div className="hidden sm:block">
                    <p className="text-sm font-medium text-slate-900">
                      {user?.username}
                    </p>
                  </div>
                </div>

                <div className="ml-2 h-6 w-px bg-slate-300" />

                <div className="flex items-center gap-1">
                  {user?.role === "admin" ? (
                    <div className="flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1">
                      <ShieldCheck className="h-3.5 w-3.5 text-blue-600" />
                      <span className="text-xs font-medium text-blue-700">
                        Admin
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1">
                      <User className="h-3.5 w-3.5 text-emerald-600" />
                      <span className="text-xs font-medium text-emerald-700">
                        User
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Logout Button */}
              <button
                onClick={onLogout}
                disabled={isLoggingOut}
                className="group flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-all hover:border-red-300 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
              >
                {isLoggingOut ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <LogOut className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
                )}
                <span className="hidden sm:inline">
                  {isLoggingOut ? "Signing out..." : "Sign out"}
                </span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Modern Sidebar */}
      <Sidebar
        navItems={navItems}
        open={drawerOpen}
        setOpen={setDrawerOpen}
        disabled={isLoggingOut}
      />

      {/* Main Content Area */}
      <main className="mx-auto max-w-[90rem] px-4 py-16 sm:px-6 lg:px-8">
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          {children}
        </div>

        {/* Loading Overlay */}
        {(pageLoading || isLoggingOut) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-4 rounded-2xl bg-white p-8 shadow-xl ring-1 ring-slate-200">
              <div className="relative">
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-slate-600" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <ScreenshotMonitorIcon className="h-5 w-5 text-slate-600" />
                </div>
              </div>
              <div className="text-center">
                <p className="font-medium text-slate-900">
                  {isLoggingOut ? "Signing you out..." : "Loading content..."}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {isLoggingOut
                    ? "Please wait while we secure your session"
                    : "Just a moment"}
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

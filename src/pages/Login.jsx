import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { login } from "../auth/authStore";
import { Spinner } from "../components/Loaders";
import { toast } from "react-toastify";

export default function Login({ onAuthed }) {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const user = await login({ email, password });
      onAuthed(user);
      toast.success("Logged in.");
      nav("/dashboard");
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="mx-auto mt-16 max-w-md rounded-2xl border bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Login</h1>
        <p className="mt-1 text-sm text-slate-600">
          Access your IT management system.
        </p>

        {err && (
          <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
            {err}
          </div>
        )}

        <form onSubmit={onSubmit} className="mt-5 space-y-3">
          <div>
            <label className="text-sm text-slate-700">Email</label>
            <input
              className="mt-1 w-full rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-200"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              autoComplete="email"
              required
            />
          </div>

          <div>
            <label className="text-sm text-slate-700">Password</label>
            <input
              className="mt-1 w-full rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-200"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete="current-password"
              required
            />
          </div>

          <button
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? <Spinner label="Signing in..." /> : "Login"}
          </button>
        </form>

        <div className="mt-4 text-sm text-slate-600">
          No account?{" "}
          <Link className="font-medium text-slate-900 underline" to="/register">
            Register
          </Link>
        </div>
      </div>
    </div>
  );
}

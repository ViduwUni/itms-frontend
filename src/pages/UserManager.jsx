import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { apiFetch } from "../api/client";
import { getToken, getStoredUser } from "../auth/authStore";
import { Skeleton } from "../components/Loaders";
import PeopleIcon from "@mui/icons-material/People";
import {
  RefreshCw,
  Mail,
  Edit2,
  Trash2,
  Check,
  X,
  KeyRound,
} from "lucide-react";

export default function UserManager() {
  const me = useMemo(() => getStoredUser(), []);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ username: "", email: "", role: "user" });

  const [pwOpenId, setPwOpenId] = useState(null);
  const [pw, setPw] = useState({ password: "", confirm: "" });

  const [busyId, setBusyId] = useState(null);

  async function loadUsers() {
    setLoading(true);
    try {
      const token = getToken();
      const data = await apiFetch("/api/users", { token });
      setUsers(data.users);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  function openPassword(u) {
    setEditingId(null);
    setPwOpenId(u.id);
    setPw({ password: "", confirm: "" });
  }

  function closePassword() {
    setPwOpenId(null);
    setPw({ password: "", confirm: "" });
  }

  function startEdit(u) {
    setPwOpenId(null);
    setEditingId(u.id);
    setForm({ username: u.username, email: u.email, role: u.role });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm({ username: "", email: "", role: "user" });
  }

  async function updatePassword(id) {
    if (pw.password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    if (pw.password !== pw.confirm) {
      toast.error("Passwords do not match.");
      return;
    }

    setBusyId(id);
    try {
      const token = getToken();
      await apiFetch(`/api/users/${id}/password`, {
        method: "PATCH",
        body: { password: pw.password },
        token,
      });

      toast.success("Password updated.");
      closePassword();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusyId(null);
    }
  }

  async function saveEdit(id) {
    setBusyId(id);
    try {
      const token = getToken();
      const payload = {
        username: form.username.trim(),
        email: form.email.trim(),
        role: form.role,
      };

      const data = await apiFetch(`/api/users/${id}`, {
        method: "PATCH",
        body: payload,
        token,
      });

      setUsers((prev) =>
        prev.map((u) => (u.id === id ? { ...u, ...data.user } : u))
      );

      toast.success("User updated.");
      cancelEdit();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusyId(null);
    }
  }

  async function deleteUser(id) {
    const u = users.find((x) => x.id === id);
    if (!u) return;

    if (me?.id === id) {
      toast.error("You can’t delete your own account.");
      return;
    }

    const ok = window.confirm(`Delete user "${u.username}" (${u.email})?`);
    if (!ok) return;

    setBusyId(id);
    try {
      const token = getToken();
      await apiFetch(`/api/users/${id}`, { method: "DELETE", token });

      setUsers((prev) => prev.filter((x) => x.id !== id));
      toast.success("User deleted.");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusyId(null);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  return (
    <div className="p-6">
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
            <PeopleIcon className="h-5 w-5 text-slate-600" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              User Management
            </h1>
            <p className="text-sm text-slate-500">
              Manage user accounts and permissions
            </p>
          </div>
        </div>

        <button
          onClick={loadUsers}
          className="flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-slate-700 ring-1 ring-slate-200 transition-all hover:bg-slate-50 hover:ring-slate-300 disabled:opacity-50"
          disabled={loading}
        >
          <RefreshCw className="h-4 w-4" />
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
        <div className="sticky top-0 z-10 border-b border-slate-100 bg-white/95 backdrop-blur-sm">
          <div className="grid grid-cols-12 gap-4 p-4">
            <div className="col-span-3 px-2">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Username
              </span>
            </div>
            <div className="col-span-4 px-2">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Email Address
              </span>
            </div>
            <div className="col-span-2 px-2">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Role
              </span>
            </div>
            <div className="col-span-3 px-2">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Actions
              </span>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="space-y-1 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="grid grid-cols-12 gap-4 rounded-lg p-3 hover:bg-slate-50/50"
              >
                <div className="col-span-3">
                  <Skeleton className="h-6 w-3/4" />
                </div>
                <div className="col-span-4">
                  <Skeleton className="h-6 w-full" />
                </div>
                <div className="col-span-2">
                  <Skeleton className="h-6 w-1/2" />
                </div>
                <div className="col-span-3">
                  <Skeleton className="h-6 w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="mb-4 rounded-full bg-slate-100 p-5 ring-2 ring-slate-100">
              <PeopleIcon className="h-8 w-8 text-slate-400" />
            </div>
            <h3 className="mb-2 text-lg font-medium text-slate-900">
              No users found
            </h3>
            <p className="text-center text-sm text-slate-500">
              There are no users in the system yet.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100/80">
            {users.map((u) => {
              const isEditing = editingId === u.id;
              const isBusy = busyId === u.id;
              const isPwOpen = pwOpenId === u.id;

              return (
                <div key={u.id}>
                  {/* Row */}
                  <div className="grid grid-cols-12 gap-4 p-4 transition-all hover:bg-slate-50/50">
                    {/* Username */}
                    <div className="col-span-3 flex items-center px-2">
                      {isEditing ? (
                        <input
                          value={form.username}
                          disabled={isBusy}
                          onChange={(e) =>
                            setForm((p) => ({
                              ...p,
                              username: e.target.value,
                            }))
                          }
                          className="w-full rounded-lg border-0 bg-slate-100 px-3 py-2 text-sm text-slate-900 outline-none ring-1 ring-slate-300 focus:ring-2 focus:ring-slate-400 disabled:opacity-60"
                          placeholder="Username"
                        />
                      ) : (
                        <div className="group flex items-center">
                          <div className="mr-3 flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-sm font-medium text-slate-600">
                            {u.username?.charAt(0)?.toUpperCase() || "U"}
                          </div>
                          <span className="font-medium text-slate-900">
                            {u.username}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Email */}
                    <div className="col-span-4 flex items-center px-2">
                      {isEditing ? (
                        <input
                          value={form.email}
                          disabled={isBusy}
                          onChange={(e) =>
                            setForm((p) => ({ ...p, email: e.target.value }))
                          }
                          className="w-full rounded-lg border-0 bg-slate-100 px-3 py-2 text-sm text-slate-900 outline-none ring-1 ring-slate-300 focus:ring-2 focus:ring-slate-400 disabled:opacity-60"
                          placeholder="email@example.com"
                          type="email"
                        />
                      ) : (
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-slate-400" />
                          <span className="text-slate-700">{u.email}</span>
                        </div>
                      )}
                    </div>

                    {/* Role */}
                    <div className="col-span-2 flex items-center px-2">
                      {isEditing ? (
                        <select
                          value={form.role}
                          disabled={isBusy || me?.id === u.id}
                          onChange={(e) =>
                            setForm((p) => ({ ...p, role: e.target.value }))
                          }
                          className="w-full rounded-lg border-0 bg-slate-100 px-3 py-2 text-sm text-slate-900 outline-none ring-1 ring-slate-300 focus:ring-2 focus:ring-slate-400 disabled:opacity-60"
                        >
                          <option value="user">User</option>
                          <option value="admin">Admin</option>
                        </select>
                      ) : (
                        <div
                          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                            u.role === "admin"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          {u.role === "admin"
                            ? "Administrator"
                            : "Standard User"}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="col-span-3 flex items-center justify-end gap-2 px-2">
                      {/* Password button only when NOT editing */}
                      {!isEditing && (
                        <button
                          onClick={() =>
                            isPwOpen ? closePassword() : openPassword(u)
                          }
                          disabled={isBusy}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition-all hover:bg-slate-50 disabled:opacity-50"
                        >
                          <KeyRound className="h-3.5 w-3.5" />
                          Password
                        </button>
                      )}

                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => saveEdit(u.id)}
                            disabled={isBusy}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white transition-all hover:bg-slate-800 disabled:opacity-50"
                          >
                            <Check className="h-3.5 w-3.5" />
                            {isBusy ? "Saving..." : "Save"}
                          </button>
                          <button
                            onClick={cancelEdit}
                            disabled={isBusy}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition-all hover:bg-slate-50 disabled:opacity-50"
                          >
                            <X className="h-3.5 w-3.5" />
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => startEdit(u)}
                            disabled={isBusy}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition-all hover:bg-slate-50 disabled:opacity-50"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                            Edit
                          </button>
                          <button
                            onClick={() => deleteUser(u.id)}
                            disabled={isBusy || me?.id === u.id}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 transition-all hover:bg-red-100 disabled:opacity-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Password Panel */}
                  {isPwOpen && !isEditing && (
                    <div className="px-6 pb-5">
                      <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
                        <div className="mb-3 text-sm font-semibold text-slate-900">
                          Change password for{" "}
                          <span className="font-bold">{u.username}</span>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                          <div>
                            <label className="text-xs font-medium text-slate-600">
                              New password
                            </label>
                            <input
                              type="password"
                              value={pw.password}
                              disabled={isBusy}
                              onChange={(e) =>
                                setPw((p) => ({
                                  ...p,
                                  password: e.target.value,
                                }))
                              }
                              className="mt-1 w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-1 ring-slate-300 focus:ring-2 focus:ring-slate-400 disabled:opacity-60"
                              placeholder="Min 6 characters"
                            />
                          </div>

                          <div>
                            <label className="text-xs font-medium text-slate-600">
                              Confirm password
                            </label>
                            <input
                              type="password"
                              value={pw.confirm}
                              disabled={isBusy}
                              onChange={(e) =>
                                setPw((p) => ({
                                  ...p,
                                  confirm: e.target.value,
                                }))
                              }
                              className="mt-1 w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-1 ring-slate-300 focus:ring-2 focus:ring-slate-400 disabled:opacity-60"
                              placeholder="Repeat password"
                            />
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap justify-end gap-2">
                          <button
                            onClick={closePassword}
                            disabled={isBusy}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                          >
                            <X className="h-3.5 w-3.5" />
                            Cancel
                          </button>

                          <button
                            onClick={() => updatePassword(u.id)}
                            disabled={isBusy}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                          >
                            <Check className="h-3.5 w-3.5" />
                            {isBusy ? "Updating..." : "Update password"}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

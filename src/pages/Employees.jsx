import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import { apiFetch } from "../api/client";
import { getToken } from "../auth/authStore";
import { Skeleton } from "../components/Loaders";
import {
  Plus,
  Search,
  X,
  Save,
  Edit2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Mail,
  Check,
  Users,
  Download,
  HardHat,
} from "lucide-react";

function useDebounced(value, delay = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

// ✅ Ensures skeleton is visible at least this long (prevents "pop")
async function withMinDelay(promise, ms = 300) {
  const start = Date.now();
  const result = await promise;
  const elapsed = Date.now() - start;
  if (elapsed < ms) await new Promise((r) => setTimeout(r, ms - elapsed));
  return result;
}

export default function Employees() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);

  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const [page, setPage] = useState(1);
  const [limit] = useState(10);

  const [q, setQ] = useState("");
  const dq = useDebounced(q, 250);

  const [department, setDepartment] = useState("");

  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [form, setForm] = useState({ name: "", email: "", department: "" });

  const abortRef = useRef(null);

  const params = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set("page", String(page));
    sp.set("limit", String(limit));
    if (dq.trim()) sp.set("q", dq.trim());
    if (department.trim()) sp.set("department", department.trim());
    return sp.toString();
  }, [page, limit, dq, department]);

  async function load() {
    // Cancel previous request
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);

    try {
      const token = getToken();

      const fetchPromise = fetch(
        `${
          import.meta.env.VITE_API_BASE || "http://localhost:4000"
        }/api/employees?${params}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        }
      ).then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok)
          throw new Error(data?.message || "Failed to load employees");
        return data;
      });

      // ✅ ensures skeleton shows briefly even if API is super fast
      const data = await withMinDelay(fetchPromise, 300);

      setItems(data.items || []);
      setTotal(data.total || 0);
      setPages(data.pages || 1);
    } catch (e) {
      if (e.name !== "AbortError") toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  // Load on mount and when params change
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  // ✅ Reset to page 1 whenever filters change (always)
  useEffect(() => {
    setPage(1);
  }, [dq, department]);

  function startCreate() {
    setEditingId(null);
    setCreating(true);
    setForm({ name: "", email: "", department: "" });
  }

  function cancelCreate() {
    setCreating(false);
    setForm({ name: "", email: "", department: "" });
  }

  function startEdit(emp) {
    setCreating(false);
    setEditingId(emp.id);
    setForm({ name: emp.name, email: emp.email, department: emp.department });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm({ name: "", email: "", department: "" });
  }

  async function createEmployee() {
    const payload = {
      name: form.name.trim(),
      email: form.email.trim(),
      department: form.department.trim(),
    };
    if (!payload.name || !payload.email || !payload.department) {
      toast.error("Name, Email, and Department are required.");
      return;
    }

    setBusyId("create");
    try {
      const token = getToken();
      await apiFetch("/api/employees", {
        method: "POST",
        body: payload,
        token,
      });
      toast.success("Employee created");
      setCreating(false);
      setPage(1);
      await load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusyId(null);
    }
  }

  async function saveEdit(id) {
    const payload = {
      name: form.name.trim(),
      email: form.email.trim(),
      department: form.department.trim(),
    };
    if (!payload.name || !payload.email || !payload.department) {
      toast.error("Name, Email, and Department are required.");
      return;
    }

    setBusyId(id);
    try {
      const token = getToken();
      const data = await apiFetch(`/api/employees/${id}`, {
        method: "PATCH",
        body: payload,
        token,
      });

      setItems((prev) =>
        prev.map((x) => (x.id === id ? { ...x, ...data.item } : x))
      );
      toast.success("Employee updated");
      cancelEdit();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusyId(null);
    }
  }

  async function deleteEmployee(id) {
    const emp = items.find((x) => x.id === id);
    if (!emp) return;

    const ok = window.confirm(`Delete employee "${emp.name}" (${emp.email})?`);
    if (!ok) return;

    setBusyId(id);
    try {
      const token = getToken();
      await apiFetch(`/api/employees/${id}`, { method: "DELETE", token });

      setItems((prev) => prev.filter((x) => x.id !== id));
      toast.success("Employee deleted");

      // If we removed last item on page, reload
      if (items.length === 1 && page > 1) setPage((p) => p - 1);
      else await load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusyId(null);
    }
  }

  async function exportExcel() {
    try {
      const token = getToken();

      const base = import.meta.env.VITE_API_BASE || "http://localhost:4000";
      const url = `${base}/api/employees/export.xlsx`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message || "Export failed");
      }

      const blob = await res.blob();
      const a = document.createElement("a");
      const fileUrl = window.URL.createObjectURL(blob);
      a.href = fileUrl;

      const ts = new Date().toISOString().slice(0, 10);
      a.download = `employees_${ts}.xlsx`;

      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(fileUrl);

      toast.success("Excel exported");
    } catch (e) {
      toast.error(e.message);
    }
  }

  return (
    <div className="p-6">
      <div className="mb-8 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
            <HardHat className="h-5 w-5 text-slate-600" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Employee Management
            </h1>
            <p className="text-sm text-slate-500">
              Manage employee records, departments.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={exportExcel}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Download className="h-4 w-4" />
            Export Excel
          </button>

          <button
            onClick={startCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-800"
          >
            <Plus className="h-4 w-4" />
            Add New Employee
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 pl-10 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
            placeholder="Search employees..."
          />
        </div>

        <input
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
          placeholder="Department filter"
        />

        <div className="flex items-center justify-between rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm">
          <div className="text-slate-700">
            <span className="text-slate-500">Total:</span>
            <span className="ml-1 font-medium text-slate-900">{total}</span>
          </div>
          <div className="text-slate-700">
            <span className="text-slate-500">Page:</span>
            <span className="ml-1 font-medium text-slate-900">{page}</span>
            <span className="mx-1 text-slate-400">/</span>
            <span className="font-medium text-slate-900">{pages}</span>
          </div>
        </div>
      </div>

      {/* Create Form */}
      {creating && (
        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-medium text-slate-900">
            Add New Employee
          </h3>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Name
              </label>
              <input
                value={form.name}
                onChange={(e) =>
                  setForm((p) => ({ ...p, name: e.target.value }))
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                placeholder="Full name"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Email
              </label>
              <input
                value={form.email}
                onChange={(e) =>
                  setForm((p) => ({ ...p, email: e.target.value }))
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                placeholder="email@company.com"
                type="email"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Department
              </label>
              <input
                value={form.department}
                onChange={(e) =>
                  setForm((p) => ({ ...p, department: e.target.value }))
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                placeholder="Department"
              />
            </div>
          </div>

          <div className="mt-5 flex items-center justify-end gap-2">
            <button
              onClick={cancelCreate}
              disabled={busyId === "create"}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              <X className="mr-2 inline h-4 w-4" /> Cancel
            </button>
            <button
              onClick={createEmployee}
              disabled={busyId === "create"}
              className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
            >
              <Save className="mr-2 h-4 w-4" />
              {busyId === "create" ? "Creating..." : "Create Employee"}
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-4 border-b border-slate-200 bg-slate-50/50 px-5 py-4 text-xs font-medium uppercase tracking-wide text-slate-500">
          <div className="col-span-4 px-2">Name</div>
          <div className="col-span-4 px-2">Email</div>
          <div className="col-span-2 px-2">Department</div>
          <div className="col-span-2 px-2 text-right">Actions</div>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="grid grid-cols-12 gap-4 px-5">
                <Skeleton className="col-span-4 h-10" />
                <Skeleton className="col-span-4 h-10" />
                <Skeleton className="col-span-2 h-10" />
                <Skeleton className="col-span-2 h-10" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <div className="rounded-full bg-slate-100 p-4">
              <Users className="h-8 w-8 text-slate-400" />
            </div>
            <p className="mt-4 text-sm font-medium text-slate-700">
              No employees found
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Add your first employee to get started
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100/80">
            {items.map((e) => {
              const isEditing = editingId === e.id;
              const isBusy = busyId === e.id;

              return (
                <div
                  key={e.id}
                  className="grid grid-cols-12 gap-4 px-5 py-4 text-sm transition-colors hover:bg-slate-50/50"
                >
                  {/* Name Column */}
                  <div className="col-span-4 flex items-center px-2">
                    {isEditing ? (
                      <input
                        value={form.name}
                        disabled={isBusy}
                        onChange={(ev) =>
                          setForm((p) => ({ ...p, name: ev.target.value }))
                        }
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                      />
                    ) : (
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-sm font-medium text-blue-700">
                          {e.name?.charAt(0)?.toUpperCase() || "E"}
                        </div>
                        <span className="font-medium text-slate-900">
                          {e.name}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Email Column */}
                  <div className="col-span-4 flex items-center px-2">
                    {isEditing ? (
                      <input
                        value={form.email}
                        disabled={isBusy}
                        onChange={(ev) =>
                          setForm((p) => ({ ...p, email: ev.target.value }))
                        }
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                        type="email"
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-slate-400" />
                        <span className="text-slate-700">{e.email}</span>
                      </div>
                    )}
                  </div>

                  {/* Department Column */}
                  <div className="col-span-2 flex items-center px-2">
                    {isEditing ? (
                      <input
                        value={form.department}
                        disabled={isBusy}
                        onChange={(ev) =>
                          setForm((p) => ({
                            ...p,
                            department: ev.target.value,
                          }))
                        }
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                      />
                    ) : (
                      <div className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700">
                        {e.department}
                      </div>
                    )}
                  </div>

                  {/* Actions Column */}
                  <div className="col-span-2 flex items-center justify-end gap-2 px-2">
                    {isEditing ? (
                      <>
                        <button
                          onClick={() => saveEdit(e.id)}
                          disabled={isBusy}
                          className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
                          title="Save changes"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={cancelEdit}
                          disabled={isBusy}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
                          title="Cancel editing"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => startEdit(e)}
                          disabled={isBusy}
                          className="inline-flex items-center rounded-lg border border-slate-300 bg-white p-2 text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
                          title="Edit employee"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => deleteEmployee(e.id)}
                          disabled={isBusy}
                          className="inline-flex items-center rounded-lg border border-red-200 bg-red-50 p-2 text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50"
                          title="Delete employee"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="mt-6 flex items-center justify-end gap-2">
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1 || loading}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </button>

        <button
          onClick={() => setPage((p) => Math.min(pages, p + 1))}
          disabled={page >= pages || loading}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import { apiFetch } from "../api/client";
import { getToken } from "../auth/authStore";
import { Skeleton } from "../components/Loaders";
import {
  Search,
  Plus,
  X,
  Check,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Mail,
  HandHelping,
} from "lucide-react";

function useDebounced(value, delay = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

async function withMinDelay(promise, ms = 300) {
  const start = Date.now();
  const result = await promise;
  const elapsed = Date.now() - start;
  if (elapsed < ms) await new Promise((r) => setTimeout(r, ms - elapsed));
  return result;
}

export default function Assignments() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);

  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const [page, setPage] = useState(1);
  const [limit] = useState(10);

  const [status, setStatus] = useState("active"); // "active" | "returned"
  const [q, setQ] = useState("");
  const dq = useDebounced(q, 250);

  // ✅ frontend toggle: stop emails for assignments
  const [notifyEmails, setNotifyEmails] = useState(true);

  const abortRef = useRef(null);

  // Assign modal state
  const [open, setOpen] = useState(false);
  const [assignBusy, setAssignBusy] = useState(false);

  const [assetQuery, setAssetQuery] = useState("");
  const [employeeQuery, setEmployeeQuery] = useState("");

  const dAssetQ = useDebounced(assetQuery, 250);
  const dEmpQ = useDebounced(employeeQuery, 250);

  const [assetOptions, setAssetOptions] = useState([]);
  const [employeeOptions, setEmployeeOptions] = useState([]);

  const [form, setForm] = useState({
    assetId: "",
    employeeId: "",
    type: "temporary",
    expectedReturnAt: "",
    remarks: "",
  });

  const params = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set("page", String(page));
    sp.set("limit", String(limit));
    sp.set("status", status);
    if (dq.trim()) sp.set("q", dq.trim());
    return sp.toString();
  }, [page, limit, status, dq]);

  async function load() {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    try {
      const token = getToken();
      const base = import.meta.env.VITE_API_BASE || "http://localhost:4000";

      const fetchPromise = fetch(`${base}/api/assignments?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      }).then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok)
          throw new Error(data?.message || "Failed to load assignments");
        return data;
      });

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

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  useEffect(() => setPage(1), [status, dq]);

  async function loadAssetOptions() {
    try {
      const token = getToken();
      // reuse assets endpoint, just query q and small limit
      const data = await apiFetch(
        `/api/assets?q=${encodeURIComponent(dAssetQ)}&page=1&limit=10`,
        { token }
      );
      setAssetOptions(data.items || []);
    } catch {
      setAssetOptions([]);
    }
  }

  async function loadEmployeeOptions() {
    try {
      const token = getToken();
      const data = await apiFetch(
        `/api/employees?q=${encodeURIComponent(dEmpQ)}&page=1&limit=10`,
        { token }
      );
      setEmployeeOptions(data.items || []);
    } catch {
      setEmployeeOptions([]);
    }
  }

  useEffect(() => {
    if (!open) return;
    loadAssetOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dAssetQ]);

  useEffect(() => {
    if (!open) return;
    loadEmployeeOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dEmpQ]);

  function openAssign() {
    setOpen(true);
    setAssetQuery("");
    setEmployeeQuery("");
    setAssetOptions([]);
    setEmployeeOptions([]);
    setForm({
      assetId: "",
      employeeId: "",
      type: "temporary",
      expectedReturnAt: "",
      remarks: "",
    });
  }

  function closeAssign() {
    setOpen(false);
  }

  async function assign() {
    if (!form.assetId || !form.employeeId) {
      toast.error("Select asset and employee.");
      return;
    }

    setAssignBusy(true);
    try {
      const token = getToken();
      await apiFetch("/api/assignments", {
        method: "POST",
        token,
        body: {
          ...form,
          expectedReturnAt: form.expectedReturnAt || null,
          notify: notifyEmails, // ✅ request override
        },
      });

      toast.success("Assigned successfully");
      closeAssign();
      await load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setAssignBusy(false);
    }
  }

  async function returnIt(assignmentId) {
    setBusyId(assignmentId);
    try {
      const token = getToken();
      await apiFetch(`/api/assignments/${assignmentId}/return`, {
        method: "POST",
        token,
        body: { remarks: "" },
      });
      toast.success("Returned");
      await load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
            <HandHelping className="h-5 w-5 text-slate-600" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Assignments Management
            </h1>
            <p className="text-sm text-slate-500">Assign and return assets.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setNotifyEmails((v) => !v)}
            className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
              notifyEmails
                ? "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                : "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
            }`}
            title="Toggle email notifications for new assignments"
          >
            <Mail className="h-4 w-4" />
            {notifyEmails ? "Emails ON" : "Emails OFF"}
          </button>

          <button
            onClick={openAssign}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            <Plus className="h-4 w-4" />
            New Assignment
          </button>

          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-5 grid gap-3 md:grid-cols-3">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 pl-10 text-sm outline-none focus:ring-2 focus:ring-slate-100"
            placeholder="Search asset tag / employee..."
          />
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm">
          <button
            onClick={() => setStatus("active")}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              status === "active"
                ? "bg-slate-900 text-white"
                : "text-slate-700 hover:bg-slate-50"
            }`}
          >
            Active
          </button>
          <button
            onClick={() => setStatus("returned")}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              status === "returned"
                ? "bg-slate-900 text-white"
                : "text-slate-700 hover:bg-slate-50"
            }`}
          >
            Returned
          </button>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm">
          <div className="text-slate-700">
            <span className="text-slate-500">Total:</span>{" "}
            <span className="font-medium text-slate-900">{total}</span>
          </div>
          <div className="text-slate-700">
            <span className="text-slate-500">Page:</span>{" "}
            <span className="font-medium text-slate-900">{page}</span> /{" "}
            <span className="font-medium text-slate-900">{pages}</span>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="grid grid-cols-12 gap-3 border-b border-slate-200 bg-slate-50/50 px-5 py-4 text-xs font-medium uppercase tracking-wide text-slate-500">
          <div className="col-span-3">Asset</div>
          <div className="col-span-4">Employee</div>
          <div className="col-span-2">Type</div>
          <div className="col-span-2">Assigned</div>
          <div className="col-span-1 text-right">Action</div>
        </div>

        {loading ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="grid grid-cols-12 gap-3">
                <Skeleton className="col-span-3 h-10" />
                <Skeleton className="col-span-4 h-10" />
                <Skeleton className="col-span-2 h-10" />
                <Skeleton className="col-span-2 h-10" />
                <Skeleton className="col-span-1 h-10" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <div className="rounded-full bg-slate-100 p-4">
              <HandHelping className="h-8 w-8 text-slate-400" />
            </div>
            <p className="mt-4 text-sm font-medium text-slate-700">
              No assignments found.
            </p>
            <p className="mt-1 text-sm text-slate-500">
              make your first assignment to get started
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100/80">
            {items.map((x) => {
              const isBusy = busyId === x.id;
              const assignedAt = x.assignedAt
                ? new Date(x.assignedAt).toISOString().slice(0, 10)
                : "—";

              return (
                <div
                  key={x.id}
                  className="grid grid-cols-12 gap-3 px-5 py-3 text-sm hover:bg-slate-50/50"
                >
                  <div className="col-span-3">
                    <div className="font-medium text-slate-900">
                      {x.asset?.assetTag || "—"}
                    </div>
                    <div className="text-xs text-slate-500">
                      {x.asset?.name || ""}
                    </div>
                  </div>

                  <div className="col-span-4">
                    <div className="font-medium text-slate-900">
                      {x.employee?.name || "—"}
                    </div>
                    <div className="text-xs text-slate-500">
                      {x.employee?.email || ""}
                    </div>
                  </div>

                  <div className="col-span-2">
                    <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700">
                      {x.type}
                    </span>
                  </div>

                  <div className="col-span-2 text-slate-700">{assignedAt}</div>

                  <div className="col-span-1 flex justify-end">
                    {status === "active" ? (
                      <button
                        onClick={() => returnIt(x.id)}
                        disabled={isBusy}
                        className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                      >
                        {isBusy ? "..." : "Return"}
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="mt-5 flex items-center justify-end gap-2">
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1 || loading}
          className="inline-flex items-center gap-2 rounded-lg border bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </button>

        <button
          onClick={() => setPage((p) => Math.min(pages, p + 1))}
          disabled={page >= pages || loading}
          className="inline-flex items-center gap-2 rounded-lg border bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Assign Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                New Assignment
              </h2>
              <button
                onClick={closeAssign}
                className="rounded-lg p-2 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Select Asset
                </label>
                <input
                  value={assetQuery}
                  onChange={(e) => setAssetQuery(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-100"
                  placeholder="Search assets..."
                />
                <select
                  value={form.assetId}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, assetId: e.target.value }))
                  }
                  className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">Choose asset...</option>
                  {assetOptions.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.assetTag} — {a.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Select Employee
                </label>
                <input
                  value={employeeQuery}
                  onChange={(e) => setEmployeeQuery(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-100"
                  placeholder="Search employees..."
                />
                <select
                  value={form.employeeId}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, employeeId: e.target.value }))
                  }
                  className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">Choose employee...</option>
                  {employeeOptions.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} — {u.email}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Type
                </label>
                <select
                  value={form.type}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, type: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="temporary">Temporary</option>
                  <option value="permanent">Permanent</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Expected Return (optional)
                </label>
                <input
                  type="date"
                  value={form.expectedReturnAt}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, expectedReturnAt: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Remarks (optional)
                </label>
                <textarea
                  rows={3}
                  value={form.remarks}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, remarks: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                onClick={closeAssign}
                disabled={assignBusy}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={assign}
                disabled={assignBusy}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                <Check className="h-4 w-4" />
                {assignBusy ? "Assigning..." : "Assign"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

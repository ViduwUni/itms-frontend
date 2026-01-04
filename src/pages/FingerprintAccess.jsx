import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import { apiFetch } from "../api/client";
import { getToken } from "../auth/authStore";
import { Skeleton } from "../components/Loaders";
import { Plus, Check, X, Download, RefreshCw } from "lucide-react";

function useDebounced(value, delay = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

async function downloadPdfWithAuth(path, token, filename = "request.pdf") {
  const base = import.meta.env.VITE_API_BASE || "http://localhost:4000";
  const res = await fetch(`${base}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.message || "Failed to download PDF");
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function StatusBadge({ status }) {
  const cls =
    status === "approved"
      ? "bg-emerald-100 text-emerald-800"
      : status === "cancelled"
      ? "bg-red-100 text-red-800"
      : "bg-slate-100 text-slate-700";
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-medium ${cls}`}>
      {status}
    </span>
  );
}

export default function FingerprintAccess() {
  const token = useMemo(() => getToken(), []);
  const [tab, setTab] = useState("requests"); // requests | systems

  // Requests
  const [rLoading, setRLoading] = useState(true);
  const [rBusy, setRBusy] = useState(null);
  const [requests, setRequests] = useState([]);
  const [rTotal, setRTotal] = useState(0);
  // eslint-disable-next-line no-unused-vars
  const [rPages, setRPages] = useState(1);
  const [rPage, setRPage] = useState(1);
  const [rLimit] = useState(10);

  const [rq, setRq] = useState("");
  const drq = useDebounced(rq, 250);
  const [rStatus, setRStatus] = useState(""); // "", open, approved, cancelled

  // Systems
  const [sLoading, setSLoading] = useState(true);
  const [systems, setSystems] = useState([]);
  const [sysForm, setSysForm] = useState({
    name: "",
    location: "",
    deviceId: "",
    enabled: true,
  });

  // Create Request Modal
  const [createOpen, setCreateOpen] = useState(false);
  const [notifyOnApprove, setNotifyOnApprove] = useState(true);

  const [personType, setPersonType] = useState("employee");
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [employees, setEmployees] = useState([]);
  const [empLoading, setEmpLoading] = useState(false);
  const de = useDebounced(employeeSearch, 250);
  const empAbort = useRef(null);

  const [reqForm, setReqForm] = useState({
    employeeId: "",
    tempName: "",
    tempEmail: "",
    tempDepartment: "",
    systemId: "",
    accessType: "permanent",
    validTo: "",
    remarks: "",
  });

  function resetCreate() {
    setPersonType("employee");
    setEmployeeSearch("");
    setEmployees([]);
    setReqForm({
      employeeId: "",
      tempName: "",
      tempEmail: "",
      tempDepartment: "",
      systemId: systems?.[0]?.id || "",
      accessType: "permanent",
      validTo: "",
      remarks: "",
    });
    setNotifyOnApprove(true);
  }

  async function loadSystems() {
    setSLoading(true);
    try {
      const data = await apiFetch(`/api/fingerprint/systems?page=1&limit=100`, {
        token,
      });
      setSystems(data.items || []);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSLoading(false);
    }
  }

  const rParams = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set("page", String(rPage));
    sp.set("limit", String(rLimit));
    if (drq.trim()) sp.set("q", drq.trim());
    if (rStatus) sp.set("status", rStatus);
    return sp.toString();
  }, [rPage, rLimit, drq, rStatus]);

  async function loadRequests() {
    setRLoading(true);
    try {
      const data = await apiFetch(`/api/fingerprint/requests?${rParams}`, {
        token,
      });
      setRequests(data.items || []);
      setRTotal(data.total || 0);
      setRPages(data.pages || 1);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setRLoading(false);
    }
  }

  // employee search (server-side) — uses your existing employees API
  async function searchEmployees() {
    const q = de.trim();
    if (!q) {
      setEmployees([]);
      return;
    }

    // cancel previous
    if (empAbort.current) empAbort.current.abort();
    const controller = new AbortController();
    empAbort.current = controller;

    setEmpLoading(true);
    try {
      const base = import.meta.env.VITE_API_BASE || "http://localhost:4000";
      const res = await fetch(
        `${base}/api/employees?page=1&limit=8&q=${encodeURIComponent(q)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data?.message || "Failed to search employees");
      setEmployees(data.items || []);
    } catch (e) {
      if (e.name !== "AbortError") toast.error(e.message);
    } finally {
      setEmpLoading(false);
    }
  }

  useEffect(() => {
    loadSystems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (tab === "requests") loadRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, rParams]);

  useEffect(() => {
    if (personType === "employee") searchEmployees();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [de, personType]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setRPage(1);
  }, [drq, rStatus]);

  async function createRequest() {
    const payload = {
      personType,
      systemId: reqForm.systemId,
      accessType: reqForm.accessType,
      validTo: reqForm.accessType === "temporary" ? reqForm.validTo : null,
      remarks: reqForm.remarks,
    };

    if (!payload.systemId) return toast.error("Select a fingerprint system");

    if (personType === "employee") {
      if (!reqForm.employeeId) return toast.error("Select an employee");
      payload.employeeId = reqForm.employeeId;
    } else {
      if (!reqForm.tempName.trim())
        return toast.error("Temporary person name is required");
      payload.tempPerson = {
        name: reqForm.tempName,
        email: reqForm.tempEmail,
        department: reqForm.tempDepartment,
      };
    }

    if (payload.accessType === "temporary" && !payload.validTo) {
      return toast.error("Valid To is required for temporary access");
    }

    setRBusy("create");
    try {
      await apiFetch("/api/fingerprint/requests", {
        method: "POST",
        body: payload,
        token,
      });
      toast.success("Request created (OPEN)");
      setCreateOpen(false);
      await loadRequests();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setRBusy(null);
    }
  }

  async function approve(id) {
    const ok = window.confirm(
      "Approve this request? Emails will be sent only on approval."
    );
    if (!ok) return;

    setRBusy(id);
    try {
      await apiFetch(`/api/fingerprint/requests/${id}/approve`, {
        method: "POST",
        body: { notify: notifyOnApprove },
        token,
      });
      toast.success("Request approved");
      await loadRequests();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setRBusy(null);
    }
  }

  async function cancel(id) {
    const reason = window.prompt("Cancel reason (optional):", "");
    setRBusy(id);
    try {
      await apiFetch(`/api/fingerprint/requests/${id}/cancel`, {
        method: "POST",
        body: { reason: reason || "" },
        token,
      });
      toast.success("Request cancelled");
      await loadRequests();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setRBusy(null);
    }
  }

  async function downloadPdf(id) {
    try {
      await downloadPdfWithAuth(
        `/api/fingerprint/requests/${id}/pdf`,
        token,
        `fingerprint-request-${id}.pdf`
      );
    } catch (e) {
      toast.error(e.message);
    }
  }

  // Systems CRUD (simple create only here; you can extend edit/delete like other pages)
  async function createSystem() {
    if (!sysForm.name.trim()) return toast.error("System name is required");
    setRBusy("sys-create");
    try {
      await apiFetch("/api/fingerprint/systems", {
        method: "POST",
        body: sysForm,
        token,
      });
      toast.success("System created");
      setSysForm({ name: "", location: "", deviceId: "", enabled: true });
      await loadSystems();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setRBusy(null);
    }
  }

  return (
    <div className="p-6">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Fingerprint Access
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Create requests (OPEN), approve to send emails + download signed PDF
            form.
          </p>
        </div>

        {tab === "requests" ? (
          <button
            onClick={() => {
              resetCreate();
              setCreateOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            <Plus className="h-4 w-4" />
            New Request
          </button>
        ) : null}
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setTab("requests")}
          className={`rounded-full px-4 py-2 text-sm font-medium ${
            tab === "requests"
              ? "bg-slate-900 text-white"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          Requests
        </button>
        <button
          onClick={() => setTab("systems")}
          className={`rounded-full px-4 py-2 text-sm font-medium ${
            tab === "systems"
              ? "bg-slate-900 text-white"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          Systems
        </button>
      </div>

      {/* Requests tab */}
      {tab === "requests" && (
        <>
          <div className="mb-4 grid gap-3 md:grid-cols-3">
            <input
              value={rq}
              onChange={(e) => setRq(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
              placeholder="Search person/system..."
            />
            <select
              value={rStatus}
              onChange={(e) => setRStatus(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none"
            >
              <option value="">All statuses</option>
              <option value="open">Open</option>
              <option value="approved">Approved</option>
              <option value="cancelled">Cancelled</option>
            </select>

            <div className="flex items-center justify-between rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm">
              <span className="text-slate-600">
                Total: <b className="text-slate-900">{rTotal}</b>
              </span>
              <button
                onClick={loadRequests}
                disabled={rLoading}
                className="inline-flex items-center gap-2 text-slate-700 hover:text-slate-900 disabled:opacity-50"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
            <div className="grid grid-cols-12 gap-4 border-b border-slate-100 bg-slate-50/50 px-5 py-4 text-xs font-medium uppercase tracking-wide text-slate-500">
              <div className="col-span-4">Person</div>
              <div className="col-span-4">System</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2 text-right">Actions</div>
            </div>

            {rLoading ? (
              <div className="space-y-3 p-5">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="grid grid-cols-12 gap-4">
                    <Skeleton className="col-span-4 h-10" />
                    <Skeleton className="col-span-4 h-10" />
                    <Skeleton className="col-span-2 h-10" />
                    <Skeleton className="col-span-2 h-10" />
                  </div>
                ))}
              </div>
            ) : requests.length === 0 ? (
              <div className="p-8 text-sm text-slate-600">
                No requests found.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {requests.map((r) => {
                  const busy = rBusy === r.id;
                  const systemName = r.system?.name || "—";
                  const person = r.person || { name: "—" };

                  return (
                    <div
                      key={r.id}
                      className="grid grid-cols-12 gap-4 px-5 py-4 text-sm hover:bg-slate-50/50"
                    >
                      <div className="col-span-4">
                        <div className="font-medium text-slate-900">
                          {person.name}
                        </div>
                        <div className="text-xs text-slate-500">
                          {person.email || "—"} · {person.department || "—"}
                        </div>
                      </div>
                      <div className="col-span-4">
                        <div className="font-medium text-slate-900">
                          {systemName}
                        </div>
                        <div className="text-xs text-slate-500">
                          {r.system?.location || "—"} ·{" "}
                          {r.system?.deviceId || "—"}
                        </div>
                      </div>
                      <div className="col-span-2 flex items-center">
                        <StatusBadge status={r.status} />
                      </div>
                      <div className="col-span-2 flex items-center justify-end gap-2">
                        <button
                          onClick={() => downloadPdf(r.id)}
                          className="rounded-lg border border-slate-300 bg-white p-2 text-slate-700 hover:bg-slate-50"
                          title="Download PDF"
                        >
                          <Download className="h-4 w-4" />
                        </button>

                        {r.status === "open" && (
                          <>
                            <button
                              onClick={() => approve(r.id)}
                              disabled={busy}
                              className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                              title="Approve (sends emails)"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => cancel(r.id)}
                              disabled={busy}
                              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                              title="Cancel"
                            >
                              <X className="h-4 w-4" />
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

          {/* Notify toggle for approvals (global toggle) */}
          <div className="mt-4 flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={notifyOnApprove}
              onChange={(e) => setNotifyOnApprove(e.target.checked)}
            />
            Notify on approve (Email to HR + Admin + Person if email exists)
          </div>
        </>
      )}

      {/* Systems tab */}
      {tab === "systems" && (
        <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
          <div className="mb-4 text-sm font-semibold text-slate-900">
            Fingerprint Systems
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <input
              value={sysForm.name}
              onChange={(e) =>
                setSysForm((p) => ({ ...p, name: e.target.value }))
              }
              placeholder="System name"
              className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none"
            />
            <input
              value={sysForm.location}
              onChange={(e) =>
                setSysForm((p) => ({ ...p, location: e.target.value }))
              }
              placeholder="Location"
              className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none"
            />
            <input
              value={sysForm.deviceId}
              onChange={(e) =>
                setSysForm((p) => ({ ...p, deviceId: e.target.value }))
              }
              placeholder="Device ID"
              className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none"
            />
            <button
              onClick={createSystem}
              disabled={rBusy === "sys-create"}
              className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {rBusy === "sys-create" ? "Creating..." : "Add System"}
            </button>
          </div>

          <div className="mt-5">
            {sLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : systems.length === 0 ? (
              <div className="text-sm text-slate-600">No systems yet.</div>
            ) : (
              <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                {systems.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between px-4 py-3 text-sm"
                  >
                    <div>
                      <div className="font-medium text-slate-900">{s.name}</div>
                      <div className="text-xs text-slate-500">
                        {s.location || "—"} · {s.deviceId || "—"}
                      </div>
                    </div>
                    <div className="text-xs text-slate-500">
                      {s.enabled ? "Enabled" : "Disabled"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create request modal */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <div className="text-lg font-semibold text-slate-900">
                  New Fingerprint Request
                </div>
                <div className="text-sm text-slate-500">
                  Creates an OPEN request (emails only on approve).
                </div>
              </div>
              <button
                onClick={() => setCreateOpen(false)}
                className="rounded-lg p-2 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Person Type
                </label>
                <select
                  value={personType}
                  onChange={(e) => {
                    setPersonType(e.target.value);
                    setReqForm((p) => ({ ...p, employeeId: "" }));
                  }}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none"
                >
                  <option value="employee">Employee</option>
                  <option value="temporary">Temporary Person</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Fingerprint System
                </label>
                <select
                  value={reqForm.systemId}
                  onChange={(e) =>
                    setReqForm((p) => ({ ...p, systemId: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none"
                >
                  <option value="">Select system...</option>
                  {systems.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              {personType === "employee" ? (
                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Search Employee
                  </label>
                  <input
                    value={employeeSearch}
                    onChange={(e) => setEmployeeSearch(e.target.value)}
                    placeholder="Type name/email..."
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none"
                  />

                  <div className="mt-2 rounded-xl border border-slate-200">
                    {empLoading ? (
                      <div className="p-3">
                        <Skeleton className="h-10 w-full" />
                      </div>
                    ) : employees.length === 0 ? (
                      <div className="p-3 text-sm text-slate-500">
                        No results.
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {employees.map((e) => (
                          <button
                            key={e.id}
                            onClick={() =>
                              setReqForm((p) => ({ ...p, employeeId: e.id }))
                            }
                            className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                              reqForm.employeeId === e.id ? "bg-slate-50" : ""
                            }`}
                          >
                            <div className="font-medium text-slate-900">
                              {e.name}
                            </div>
                            <div className="text-xs text-slate-500">
                              {e.email} · {e.department}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="mt-2 text-xs text-slate-500">
                    Selected employeeId: {reqForm.employeeId || "—"}
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      Name
                    </label>
                    <input
                      value={reqForm.tempName}
                      onChange={(e) =>
                        setReqForm((p) => ({ ...p, tempName: e.target.value }))
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      Email (optional)
                    </label>
                    <input
                      value={reqForm.tempEmail}
                      onChange={(e) =>
                        setReqForm((p) => ({ ...p, tempEmail: e.target.value }))
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      Department (optional)
                    </label>
                    <input
                      value={reqForm.tempDepartment}
                      onChange={(e) =>
                        setReqForm((p) => ({
                          ...p,
                          tempDepartment: e.target.value,
                        }))
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Access Type
                </label>
                <select
                  value={reqForm.accessType}
                  onChange={(e) =>
                    setReqForm((p) => ({ ...p, accessType: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none"
                >
                  <option value="permanent">Permanent</option>
                  <option value="temporary">Temporary</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Valid To
                </label>
                <input
                  type="date"
                  disabled={reqForm.accessType !== "temporary"}
                  value={reqForm.validTo}
                  onChange={(e) =>
                    setReqForm((p) => ({ ...p, validTo: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none disabled:bg-slate-100"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Remarks
                </label>
                <textarea
                  value={reqForm.remarks}
                  onChange={(e) =>
                    setReqForm((p) => ({ ...p, remarks: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none"
                  rows={3}
                />
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={() => setCreateOpen(false)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={createRequest}
                disabled={rBusy === "create"}
                className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {rBusy === "create" ? "Creating..." : "Create Request"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

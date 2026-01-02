import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import { apiFetch } from "../api/client";
import { getToken, getStoredUser } from "../auth/authStore";
import { Skeleton } from "../components/Loaders";
import {
  Hammer,
  Search,
  Download,
  RefreshCw,
  Plus,
  X,
  Save,
  ChevronLeft,
  ChevronRight,
  PanelRightOpen,
  PanelRightClose,
  Check,
  Mail,
  AlertTriangle,
  ClipboardList,
  Users,
} from "lucide-react";

function useDebounced(value, delay = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}
async function withMinDelay(promise, minMs = 300) {
  const start = Date.now();
  const out = await promise;
  const elapsed = Date.now() - start;
  if (elapsed < minMs) await new Promise((r) => setTimeout(r, minMs - elapsed));
  return out;
}
function fmtDate(d) {
  if (!d) return "—";
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return "—";
  return x.toISOString().slice(0, 10);
}
function badgeStatus(s) {
  const base = "inline-flex rounded-full px-3 py-1.5 text-xs font-medium";
  if (s === "open") return `${base} bg-slate-100 text-slate-700`;
  if (s === "in_progress") return `${base} bg-blue-100 text-blue-800`;
  return `${base} bg-emerald-100 text-emerald-800`;
}

function localEmailsDisabled() {
  return localStorage.getItem("maintenanceEmailsDisabled") === "true";
}
function setLocalEmailsDisabled(v) {
  localStorage.setItem("maintenanceEmailsDisabled", v ? "true" : "false");
}

async function downloadWithAuth(path, filename) {
  const token = getToken();
  const base = import.meta.env.VITE_API_BASE || "http://localhost:4000";
  const res = await fetch(`${base}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    let msg = "Download failed";
    try {
      const j = await res.json();
      msg = j?.message || msg;
    } catch (e) {
      console.log(e);
    }
    throw new Error(msg);
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

export default function Maintenance() {
  // eslint-disable-next-line no-unused-vars
  const me = useMemo(() => getStoredUser(), []);

  // Tabs
  const [tab, setTab] = useState("jobs"); // jobs | empassets

  // Global email stop toggle
  const [emailsDisabled, setEmailsDisabled] = useState(localEmailsDisabled());
  useEffect(() => setLocalEmailsDisabled(emailsDisabled), [emailsDisabled]);

  // -------------------------
  // JOBS TAB (list)
  // -------------------------
  const [jobs, setJobs] = useState([]);
  const [jobsTotal, setJobsTotal] = useState(0);
  const [jobsPages, setJobsPages] = useState(1);

  const [jobsLoading, setJobsLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const [page, setPage] = useState(1);
  const [limit] = useState(10);

  const [q, setQ] = useState("");
  const dq = useDebounced(q, 250);

  const [status, setStatus] = useState("");
  const [department, setDepartment] = useState("");

  const abortJobsRef = useRef(null);

  const jobsParams = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set("page", String(page));
    sp.set("limit", String(limit));
    if (dq.trim()) sp.set("q", dq.trim());
    if (status) sp.set("status", status);
    if (department.trim()) sp.set("department", department.trim());
    return sp.toString();
  }, [page, limit, dq, status, department]);

  async function loadJobs() {
    if (abortJobsRef.current) abortJobsRef.current.abort();
    const controller = new AbortController();
    abortJobsRef.current = controller;

    setJobsLoading(true);
    try {
      const token = getToken();
      const base = import.meta.env.VITE_API_BASE || "http://localhost:4000";

      const p = fetch(`${base}/api/maintenance/jobs?${jobsParams}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      }).then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j?.message || "Failed to load jobs");
        return j;
      });

      const data = await withMinDelay(p, 320);
      setJobs(data.items || []);
      setJobsTotal(data.total || 0);
      setJobsPages(data.pages || 1);
    } catch (e) {
      if (e.name !== "AbortError") toast.error(e.message);
    } finally {
      setJobsLoading(false);
    }
  }

  useEffect(() => {
    if (tab !== "jobs") return;
    loadJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, jobsParams]);

  useEffect(() => {
    setPage(1);
  }, [dq, status, department]);

  async function exportJobs() {
    try {
      const sp = new URLSearchParams();
      if (dq.trim()) sp.set("q", dq.trim());
      if (status) sp.set("status", status);
      if (department.trim()) sp.set("department", department.trim());
      await downloadWithAuth(
        `/api/maintenance/jobs/export.xlsx?${sp.toString()}`,
        "maintenance_jobs.xlsx"
      );
      toast.success("Export downloaded");
    } catch (e) {
      toast.error(e.message);
    }
  }

  // Drawer for job details
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerId, setDrawerId] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState(null);

  const [statusNext, setStatusNext] = useState("in_progress");
  const [statusNote, setStatusNote] = useState("");
  const [statusNotify, setStatusNotify] = useState(true);

  const [noteText, setNoteText] = useState("");
  const [noteNotify, setNoteNotify] = useState(false);

  async function openJob(id) {
    setDrawerOpen(true);
    setDrawerId(id);
    setDetail(null);
    setDetailLoading(true);

    try {
      const token = getToken();
      const p = apiFetch(`/api/maintenance/jobs/${id}`, { token });
      const data = await withMinDelay(p, 250);
      setDetail(data.item);

      setStatusNext(
        data.item?.status === "open"
          ? "in_progress"
          : data.item?.status || "open"
      );
      setStatusNote("");
      setStatusNotify(!emailsDisabled);

      setNoteText("");
      setNoteNotify(false);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setDetailLoading(false);
    }
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setDrawerId(null);
    setDetail(null);
  }

  async function changeStatus() {
    if (!drawerId) return;
    setBusyId(`status:${drawerId}`);
    try {
      const token = getToken();
      await apiFetch(`/api/maintenance/jobs/${drawerId}/status`, {
        method: "PATCH",
        token,
        body: {
          status: statusNext,
          note: statusNote.trim(),
          notify: !emailsDisabled && statusNotify,
        },
      });
      toast.success("Status updated");
      await openJob(drawerId);
      await loadJobs();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusyId(null);
    }
  }

  async function addNote() {
    if (!drawerId) return;
    if (!noteText.trim()) return toast.error("Note is required.");
    setBusyId(`note:${drawerId}`);
    try {
      const token = getToken();
      await apiFetch(`/api/maintenance/jobs/${drawerId}/note`, {
        method: "POST",
        token,
        body: { note: noteText.trim(), notify: !emailsDisabled && noteNotify },
      });
      toast.success("Note added");
      await openJob(drawerId);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusyId(null);
    }
  }

  // -------------------------
  // EMPLOYEES & ASSETS TAB
  // -------------------------
  const [eaItems, setEaItems] = useState([]);
  const [eaTotal, setEaTotal] = useState(0);
  const [eaPages, setEaPages] = useState(1);

  const [eaLoading, setEaLoading] = useState(true);
  const [eaPage, setEaPage] = useState(1);

  const [eaQ, setEaQ] = useState("");
  const deaQ = useDebounced(eaQ, 250);
  const [eaDept, setEaDept] = useState("");

  const abortEARef = useRef(null);

  const eaParams = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set("page", String(eaPage));
    sp.set("limit", "10");
    if (deaQ.trim()) sp.set("q", deaQ.trim());
    if (eaDept.trim()) sp.set("department", eaDept.trim());
    return sp.toString();
  }, [eaPage, deaQ, eaDept]);

  async function loadEmployeeAssets() {
    if (abortEARef.current) abortEARef.current.abort();
    const controller = new AbortController();
    abortEARef.current = controller;

    setEaLoading(true);
    try {
      const token = getToken();
      const base = import.meta.env.VITE_API_BASE || "http://localhost:4000";

      const p = fetch(`${base}/api/maintenance/employee-assets?${eaParams}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      }).then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok)
          throw new Error(j?.message || "Failed to load employees/assets");
        return j;
      });

      const data = await withMinDelay(p, 320);
      setEaItems(data.items || []);
      setEaTotal(data.total || 0);
      setEaPages(data.pages || 1);
    } catch (e) {
      if (e.name !== "AbortError") toast.error(e.message);
    } finally {
      setEaLoading(false);
    }
  }

  useEffect(() => {
    if (tab !== "empassets") return;
    loadEmployeeAssets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, eaParams]);

  useEffect(() => setEaPage(1), [deaQ, eaDept]);

  // selection state: { [employeeId]: Set(assetId) }
  const [selected, setSelected] = useState({});

  function toggleSelect(empId, assetId) {
    setSelected((prev) => {
      const next = { ...prev };
      const set = new Set(next[empId] || []);
      if (set.has(assetId)) set.delete(assetId);
      else set.add(assetId);
      next[empId] = Array.from(set);
      return next;
    });
  }

  function clearSelected(empId) {
    setSelected((p) => {
      const n = { ...p };
      delete n[empId];
      return n;
    });
  }

  // Create Job modal (C: choose assets + employee any order)
  const [jobOpen, setJobOpen] = useState(false);
  const [jobForm, setJobForm] = useState({
    employeeId: "",
    assetIds: [],
    purpose: "",
    remarks: "",
    scheduledAt: "",
  });
  const [jobNotify, setJobNotify] = useState(true);

  // Add extra assets (including unassigned) from asset search
  const [assetQ, setAssetQ] = useState("");
  const dAssetQ = useDebounced(assetQ, 250);
  const [assetOptions, setAssetOptions] = useState([]);
  const [assetOptLoading, setAssetOptLoading] = useState(false);

  // choose employee from employee search too
  const [empQ, setEmpQ] = useState("");
  const dEmpQ = useDebounced(empQ, 250);
  const [empOptions, setEmpOptions] = useState([]);
  const [empOptLoading, setEmpOptLoading] = useState(false);

  async function searchAssets(query) {
    setAssetOptLoading(true);
    try {
      const token = getToken();
      const sp = new URLSearchParams();
      sp.set("page", "1");
      sp.set("limit", "10");
      if (query.trim()) sp.set("q", query.trim());
      const data = await apiFetch(`/api/assets?${sp.toString()}`, { token });
      setAssetOptions(data.items || data.assets || []);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setAssetOptLoading(false);
    }
  }

  async function searchEmployees(query) {
    setEmpOptLoading(true);
    try {
      const token = getToken();
      const sp = new URLSearchParams();
      sp.set("page", "1");
      sp.set("limit", "10");
      if (query.trim()) sp.set("q", query.trim());
      const data = await apiFetch(`/api/employees?${sp.toString()}`, { token });
      setEmpOptions(data.items || []);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setEmpOptLoading(false);
    }
  }

  useEffect(() => {
    if (!jobOpen) return;
    searchAssets(dAssetQ);
  }, [dAssetQ, jobOpen]);

  useEffect(() => {
    if (!jobOpen) return;
    searchEmployees(dEmpQ);
  }, [dEmpQ, jobOpen]);

  function openJobModal(prefillEmployeeId = "", prefillAssets = []) {
    setJobForm({
      employeeId: prefillEmployeeId || "",
      assetIds: prefillAssets || [],
      purpose: "",
      remarks: "",
      scheduledAt: "",
    });
    setJobNotify(!emailsDisabled);
    setAssetQ("");
    setEmpQ("");
    setJobOpen(true);
  }

  function closeJobModal() {
    setJobOpen(false);
  }

  function addAssetToJob(id) {
    setJobForm((p) => ({
      ...p,
      assetIds: p.assetIds.includes(id) ? p.assetIds : [...p.assetIds, id],
    }));
  }

  function removeAssetFromJob(id) {
    setJobForm((p) => ({ ...p, assetIds: p.assetIds.filter((x) => x !== id) }));
  }

  async function createJob() {
    if (!jobForm.employeeId) return toast.error("Employee is required.");
    if (!jobForm.assetIds.length)
      return toast.error("Select at least 1 asset.");

    setBusyId("createJob");
    try {
      const token = getToken();
      const payload = {
        employeeId: jobForm.employeeId,
        assetIds: jobForm.assetIds,
        purpose: jobForm.purpose.trim(),
        remarks: jobForm.remarks.trim(),
        scheduledAt: jobForm.scheduledAt ? jobForm.scheduledAt : null,
        notify: !emailsDisabled && jobNotify,
      };

      const data = await apiFetch("/api/maintenance/jobs", {
        method: "POST",
        token,
        body: payload,
      });

      toast.success(`Job created: ${data.jobNo}`);
      closeJobModal();

      // clear selections
      setSelected({});
      if (tab === "jobs") await loadJobs();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusyId(null);
    }
  }

  // Build modal prefill from employee row selections
  function openForEmployeeRow(row) {
    const empId = row.employee?.id;
    const ids = selected[empId] || [];
    if (!ids.length)
      return toast.error("Select at least 1 asset for this employee.");
    openJobModal(empId, ids);
    clearSelected(empId);
  }

  return (
    <div className="relative p-6">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
            <Hammer className="h-5 w-5 text-slate-600" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Maintenance
            </h1>
            <p className="text-sm text-slate-500">
              track maintenance jobs and progress
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setEmailsDisabled((v) => !v)}
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium ${
              emailsDisabled
                ? "bg-rose-100 text-rose-800"
                : "bg-emerald-100 text-emerald-800"
            }`}
          >
            <Mail className="h-4 w-4" />
            {emailsDisabled ? "Emails stopped" : "Emails enabled"}
          </button>

          <button
            onClick={() => openJobModal("", [])}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            <Plus className="h-4 w-4" />
            New Job
          </button>
        </div>
      </div>

      {emailsDisabled && (
        <div className="mb-6 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <AlertTriangle className="h-4 w-4" />
          Email sending is disabled (frontend toggle). Create/complete will not
          send emails.
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6 flex items-center gap-2">
        <button
          onClick={() => setTab("jobs")}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${
            tab === "jobs"
              ? "bg-slate-900 text-white"
              : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
          }`}
        >
          Jobs
        </button>
        <button
          onClick={() => setTab("empassets")}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${
            tab === "empassets"
              ? "bg-slate-900 text-white"
              : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
          }`}
        >
          Employees & Assets
        </button>
      </div>

      {/* ---------------- JOBS TAB ---------------- */}
      {tab === "jobs" && (
        <>
          <div className="mb-6 grid gap-4 md:grid-cols-4">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 pl-10 text-sm outline-none focus:ring-2 focus:ring-slate-100"
                placeholder="Search jobNo / purpose / employee..."
              />
            </div>

            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-100"
            >
              <option value="">All statuses</option>
              <option value="open">open</option>
              <option value="in_progress">in_progress</option>
              <option value="completed">completed</option>
            </select>

            <input
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-100"
              placeholder="Department filter"
            />

            <div className="flex items-center justify-between rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm md:col-span-2">
              <div className="text-slate-700">
                <span className="text-slate-500">Total:</span>{" "}
                <span className="font-medium text-slate-900">{jobsTotal}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={exportJobs}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Download className="h-4 w-4" /> Export
                </button>
                <button
                  onClick={loadJobs}
                  disabled={jobsLoading}
                  className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  <RefreshCw className="h-4 w-4" /> Refresh
                </button>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="grid grid-cols-12 gap-4 border-b border-slate-200 bg-slate-50/50 px-5 py-4 text-xs font-medium uppercase tracking-wide text-slate-500">
              <div className="col-span-2">Job</div>
              <div className="col-span-3">Employee</div>
              <div className="col-span-2">Assets</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2">Scheduled</div>
              <div className="col-span-1 text-right">View</div>
            </div>

            {jobsLoading ? (
              <div className="space-y-3 p-5">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="grid grid-cols-12 gap-4">
                    <Skeleton className="col-span-2 h-10" />
                    <Skeleton className="col-span-3 h-10" />
                    <Skeleton className="col-span-2 h-10" />
                    <Skeleton className="col-span-2 h-10" />
                    <Skeleton className="col-span-2 h-10" />
                    <Skeleton className="col-span-1 h-10" />
                  </div>
                ))}
              </div>
            ) : jobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4">
                <div className="rounded-full bg-slate-100 p-4">
                  <ClipboardList className="h-8 w-8 text-slate-400" />
                </div>
                <p className="mt-4 text-sm font-medium text-slate-700">
                  No jobs found
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Try filters or create a new job
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100/80">
                {jobs.map((j) => (
                  <div
                    key={j.id}
                    className="grid grid-cols-12 gap-4 px-5 py-4 text-sm transition-colors hover:bg-slate-50/50"
                  >
                    <div className="col-span-2">
                      <div className="font-medium text-slate-900">
                        {j.jobNo}
                      </div>
                      <div className="text-xs text-slate-500">
                        {fmtDate(j.createdAt)}
                      </div>
                    </div>
                    <div className="col-span-3">
                      <div className="font-medium text-slate-900">
                        {j.employee?.name || "—"}
                      </div>
                      <div className="text-xs text-slate-500">
                        {j.employee?.email || "—"}
                      </div>
                    </div>
                    <div className="col-span-2 text-slate-700">
                      {j.assetCount || 0} asset
                      {(j.assetCount || 0) !== 1 ? "s" : ""}
                    </div>
                    <div className="col-span-2">
                      <span className={badgeStatus(j.status)}>{j.status}</span>
                    </div>
                    <div className="col-span-2 text-slate-700">
                      {fmtDate(j.scheduledAt)}
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <button
                        onClick={() => openJob(j.id)}
                        className="inline-flex items-center rounded-lg border border-slate-300 bg-white p-2 text-slate-700 hover:bg-slate-50"
                        title="View"
                      >
                        {drawerOpen && drawerId === j.id ? (
                          <PanelRightClose className="h-4 w-4" />
                        ) : (
                          <PanelRightOpen className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-6 flex items-center justify-end gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || jobsLoading}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" /> Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(jobsPages, p + 1))}
              disabled={page >= jobsPages || jobsLoading}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Next <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </>
      )}

      {/* ---------------- EMP & ASSETS TAB ---------------- */}
      {tab === "empassets" && (
        <>
          <div className="mb-6 grid gap-4 md:grid-cols-4">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                value={eaQ}
                onChange={(e) => setEaQ(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 pl-10 text-sm outline-none focus:ring-2 focus:ring-slate-100"
                placeholder="Search employee or asset..."
              />
            </div>
            <input
              value={eaDept}
              onChange={(e) => setEaDept(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-100"
              placeholder="Department filter"
            />
            <div className="flex items-center justify-between rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm">
              <div className="text-slate-700">
                <span className="text-slate-500">Total:</span>{" "}
                <span className="font-medium text-slate-900">{eaTotal}</span>
              </div>
              <button
                onClick={loadEmployeeAssets}
                disabled={eaLoading}
                className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <RefreshCw className="h-4 w-4" /> Refresh
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="grid grid-cols-12 gap-4 border-b border-slate-200 bg-slate-50/50 px-5 py-4 text-xs font-medium uppercase tracking-wide text-slate-500">
              <div className="col-span-4">Employee</div>
              <div className="col-span-7">Assigned Assets (select)</div>
              <div className="col-span-1 text-right">Create</div>
            </div>

            {eaLoading ? (
              <div className="space-y-3 p-5">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="grid grid-cols-12 gap-4">
                    <Skeleton className="col-span-4 h-14" />
                    <Skeleton className="col-span-7 h-14" />
                    <Skeleton className="col-span-1 h-14" />
                  </div>
                ))}
              </div>
            ) : eaItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4">
                <div className="rounded-full bg-slate-100 p-4">
                  <Users className="h-8 w-8 text-slate-400" />
                </div>
                <p className="mt-4 text-sm font-medium text-slate-700">
                  No employees found
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Try changing filters
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100/80">
                {eaItems.map((row) => {
                  const emp = row.employee;
                  const selectedIds = selected[emp.id] || [];

                  return (
                    <div
                      key={emp.id}
                      className="grid grid-cols-12 gap-4 px-5 py-4 text-sm"
                    >
                      <div className="col-span-4">
                        <div className="font-medium text-slate-900">
                          {emp.name}
                        </div>
                        <div className="text-xs text-slate-500">
                          {emp.email}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          Dept: {emp.department || "—"} • Assets:{" "}
                          {row.assetCount}
                        </div>
                      </div>

                      <div className="col-span-7">
                        <div className="flex flex-wrap gap-2">
                          {row.assets.map((a) => {
                            const on = selectedIds.includes(a.id);
                            return (
                              <button
                                key={a.id}
                                onClick={() => toggleSelect(emp.id, a.id)}
                                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                                  on
                                    ? "border-slate-900 bg-slate-900 text-white"
                                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                                }`}
                                title={`${a.assetTag} • ${a.name}`}
                              >
                                {a.assetTag}{" "}
                                <span
                                  className={`${
                                    on ? "text-white/80" : "text-slate-500"
                                  }`}
                                >
                                  • {a.name}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="col-span-1 flex justify-end">
                        <button
                          onClick={() => openForEmployeeRow(row)}
                          disabled={!selectedIds.length}
                          className="inline-flex items-center rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                          title="Create job for selected assets"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-6 flex items-center justify-end gap-2">
            <button
              onClick={() => setEaPage((p) => Math.max(1, p - 1))}
              disabled={eaPage <= 1 || eaLoading}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" /> Previous
            </button>
            <button
              onClick={() => setEaPage((p) => Math.min(eaPages, p + 1))}
              disabled={eaPage >= eaPages || eaLoading}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Next <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </>
      )}

      {/* CREATE JOB MODAL (C: both) */}
      {jobOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-3xl rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  New Maintenance Job
                </h2>
                <p className="text-sm text-slate-500">
                  Pick employee + assets (any order)
                </p>
              </div>
              <button
                onClick={closeJobModal}
                className="rounded-lg p-2 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {/* Employee search */}
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Employee *
                </label>
                <input
                  value={empQ}
                  onChange={(e) => setEmpQ(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-100"
                  placeholder="Search employees (name/email)..."
                />
                <div className="mt-2 rounded-lg border border-slate-200 bg-white p-2">
                  {empOptLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-7 w-full" />
                      <Skeleton className="h-7 w-5/6" />
                    </div>
                  ) : empOptions.length === 0 ? (
                    <div className="text-xs text-slate-500">
                      No employees found.
                    </div>
                  ) : (
                    <div className="max-h-40 overflow-auto">
                      {empOptions.map((e) => (
                        <button
                          key={e.id}
                          onClick={() =>
                            setJobForm((p) => ({ ...p, employeeId: e.id }))
                          }
                          type="button"
                          className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                            jobForm.employeeId === e.id ? "bg-slate-100" : ""
                          }`}
                        >
                          <div>
                            <div className="font-medium text-slate-900">
                              {e.name}
                            </div>
                            <div className="text-xs text-slate-500">
                              {e.email} • {e.department || "—"}
                            </div>
                          </div>
                          {jobForm.employeeId === e.id ? (
                            <Check className="h-4 w-4 text-slate-700" />
                          ) : null}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Asset search (all assets, assigned or not) */}
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Add assets *
                </label>
                <input
                  value={assetQ}
                  onChange={(e) => setAssetQ(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-100"
                  placeholder="Search assets (tag/name)..."
                />
                <div className="mt-2 rounded-lg border border-slate-200 bg-white p-2">
                  {assetOptLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-7 w-full" />
                      <Skeleton className="h-7 w-5/6" />
                    </div>
                  ) : assetOptions.length === 0 ? (
                    <div className="text-xs text-slate-500">
                      No assets found.
                    </div>
                  ) : (
                    <div className="max-h-40 overflow-auto">
                      {assetOptions.map((a) => {
                        const id = (a.id || a._id).toString();
                        const added = jobForm.assetIds.includes(id);
                        return (
                          <button
                            key={id}
                            onClick={() =>
                              added ? removeAssetFromJob(id) : addAssetToJob(id)
                            }
                            type="button"
                            className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                              added ? "bg-slate-100" : ""
                            }`}
                          >
                            <div>
                              <div className="font-medium text-slate-900">
                                {a.assetTag}{" "}
                                <span className="font-normal text-slate-500">
                                  • {a.name}
                                </span>
                              </div>
                              <div className="text-xs text-slate-500">
                                {a.category || "—"} • {a.department || "—"}
                              </div>
                            </div>
                            {added ? (
                              <Check className="h-4 w-4 text-slate-700" />
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Selected asset ids */}
                <div className="mt-2 text-xs text-slate-500">
                  Selected:{" "}
                  <span className="font-medium text-slate-900">
                    {jobForm.assetIds.length}
                  </span>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Purpose
                </label>
                <input
                  value={jobForm.purpose}
                  onChange={(e) =>
                    setJobForm((p) => ({ ...p, purpose: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-100"
                  placeholder="Cleanup / optimisation / reimage..."
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Scheduled date
                </label>
                <input
                  type="date"
                  value={jobForm.scheduledAt}
                  onChange={(e) =>
                    setJobForm((p) => ({ ...p, scheduledAt: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-100"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Remarks
                </label>
                <textarea
                  value={jobForm.remarks}
                  onChange={(e) =>
                    setJobForm((p) => ({ ...p, remarks: e.target.value }))
                  }
                  className="min-h-[90px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-100"
                  placeholder="Optional"
                />
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={jobNotify}
                  onChange={(e) => setJobNotify(e.target.checked)}
                  disabled={emailsDisabled}
                />
                Send email notifications
                {emailsDisabled ? (
                  <span className="ml-2 rounded-full bg-rose-100 px-2 py-1 text-xs font-medium text-rose-800">
                    Disabled globally
                  </span>
                ) : null}
              </label>

              <div className="flex items-center gap-2">
                <button
                  onClick={closeJobModal}
                  disabled={busyId === "createJob"}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  <X className="mr-2 inline h-4 w-4" /> Cancel
                </button>
                <button
                  onClick={createJob}
                  disabled={busyId === "createJob"}
                  className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  <Save className="mr-2 h-4 w-4" />
                  {busyId === "createJob" ? "Creating..." : "Create Job"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DETAILS DRAWER */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/20" onClick={closeDrawer} />
          <div className="absolute right-0 top-0 h-full w-full max-w-xl overflow-auto bg-white shadow-2xl">
            <div className="sticky top-0 z-10 border-b border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Hammer className="h-5 w-5 text-slate-700" />
                  <div>
                    <div className="text-sm font-semibold text-slate-900">
                      Job Details
                    </div>
                    <div className="text-xs text-slate-500">
                      {detail?.jobNo || "—"}
                    </div>
                  </div>
                </div>
                <button
                  onClick={closeDrawer}
                  className="rounded-lg p-2 hover:bg-slate-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="p-4">
              {detailLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-8 w-2/3" />
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : !detail ? (
                <div className="text-sm text-slate-600">No details.</div>
              ) : (
                <>
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-lg font-semibold text-slate-900">
                          {detail.jobNo}
                        </div>
                        <div className="mt-1 text-sm text-slate-500">
                          Created: {fmtDate(detail.createdAt)} • Dept:{" "}
                          {detail.department}
                        </div>
                        <div className="mt-2 text-sm text-slate-700">
                          <span className="font-medium">Employee:</span>{" "}
                          {detail.employee?.name || "—"}{" "}
                          <span className="text-slate-500">
                            ({detail.employee?.email || "—"})
                          </span>
                        </div>
                        <div className="mt-2 text-sm text-slate-700">
                          <span className="font-medium">Purpose:</span>{" "}
                          {detail.purpose || "—"}
                        </div>
                        <div className="mt-1 text-sm text-slate-700">
                          <span className="font-medium">Scheduled:</span>{" "}
                          {fmtDate(detail.scheduledAt)}
                        </div>
                        <div className="mt-1 text-sm text-slate-700">
                          <span className="font-medium">Remarks:</span>{" "}
                          {detail.remarks || "—"}
                        </div>
                      </div>
                      <span className={badgeStatus(detail.status)}>
                        {detail.status}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                    <div className="text-sm font-semibold text-slate-900">
                      Assets
                    </div>
                    <div className="mt-3 space-y-2">
                      {(detail.assets || []).map((a) => (
                        <div key={a.id} className="rounded-lg bg-slate-50 p-3">
                          <div className="text-sm font-medium text-slate-900">
                            {a.assetTag}{" "}
                            <span className="font-normal text-slate-500">
                              • {a.name}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500">
                            {a.category || "—"} • {a.department || "—"} •
                            Serial: {a.serialNumber || "—"}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Status change */}
                  <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                    <div className="text-sm font-semibold text-slate-900">
                      Status update
                    </div>

                    <div className="mt-3 grid gap-3">
                      <select
                        value={statusNext}
                        onChange={(e) => setStatusNext(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-100"
                      >
                        <option value="open">open</option>
                        <option value="in_progress">in_progress</option>
                        <option value="completed">completed</option>
                      </select>

                      <input
                        value={statusNote}
                        onChange={(e) => setStatusNote(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-100"
                        placeholder="Optional note"
                      />

                      <div className="flex items-center justify-between gap-3">
                        <label className="flex items-center gap-2 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={statusNotify}
                            onChange={(e) => setStatusNotify(e.target.checked)}
                            disabled={emailsDisabled}
                          />
                          Send emails (open/completed)
                        </label>

                        <button
                          onClick={changeStatus}
                          disabled={busyId === `status:${drawerId}`}
                          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                        >
                          <Save className="h-4 w-4" />
                          {busyId === `status:${drawerId}`
                            ? "Saving..."
                            : "Update"}
                        </button>
                      </div>

                      <div className="text-xs text-slate-500">
                        When status becomes <b>completed</b>, employee will be
                        emailed to collect from <b>IT Department</b>.
                      </div>
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                    <div className="text-sm font-semibold text-slate-900">
                      Add note
                    </div>
                    <div className="mt-2 grid gap-3">
                      <textarea
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        className="min-h-[90px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-100"
                        placeholder="Write an update..."
                      />

                      <div className="flex items-center justify-between gap-3">
                        <label className="flex items-center gap-2 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={noteNotify}
                            onChange={(e) => setNoteNotify(e.target.checked)}
                            disabled={emailsDisabled}
                          />
                          Email this note
                        </label>

                        <button
                          onClick={addNote}
                          disabled={busyId === `note:${drawerId}`}
                          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                        >
                          <Plus className="h-4 w-4" />
                          {busyId === `note:${drawerId}` ? "Adding..." : "Add"}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Timeline */}
                  <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                    <div className="text-sm font-semibold text-slate-900">
                      Timeline
                    </div>
                    <div className="mt-3 space-y-3">
                      {(detail.logs || []).length === 0 ? (
                        <div className="text-sm text-slate-600">
                          No logs yet.
                        </div>
                      ) : (
                        detail.logs.map((l) => (
                          <div
                            key={l.id}
                            className="rounded-lg bg-slate-50 p-3"
                          >
                            <div className="flex items-center justify-between">
                              <div className="text-xs font-medium text-slate-700">
                                {l.action}
                                {l.fromStatus || l.toStatus ? (
                                  <span className="text-slate-500">
                                    {" "}
                                    • {l.fromStatus || "—"} →{" "}
                                    {l.toStatus || "—"}
                                  </span>
                                ) : null}
                              </div>
                              <div className="text-xs text-slate-500">
                                {fmtDate(l.createdAt)}
                              </div>
                            </div>
                            <div className="mt-1 text-sm text-slate-700 whitespace-pre-wrap">
                              {l.note || "—"}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import { apiFetch } from "../api/client";
import { getToken } from "../auth/authStore";
import { Skeleton } from "../components/Loaders";
import {
  Wrench,
  Plus,
  Search,
  X,
  Save,
  Edit2,
  Trash2,
  Download,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Check,
  PanelRightClose,
  PanelRightOpen,
  Mail,
  ClipboardList,
  AlertTriangle,
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
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

function badgeStatus(status) {
  const base = "inline-flex rounded-full px-3 py-1.5 text-xs font-medium";
  switch (status) {
    case "open":
      return `${base} bg-slate-100 text-slate-700`;
    case "in_progress":
      return `${base} bg-blue-100 text-blue-800`;
    case "waiting_parts":
      return `${base} bg-amber-100 text-amber-800`;
    case "waiting_vendor":
      return `${base} bg-orange-100 text-orange-800`;
    case "resolved":
      return `${base} bg-emerald-100 text-emerald-800`;
    case "closed":
      return `${base} bg-slate-900 text-white`;
    case "cancelled":
      return `${base} bg-rose-100 text-rose-800`;
    default:
      return `${base} bg-slate-100 text-slate-700`;
  }
}

function badgePriority(p) {
  const base = "inline-flex rounded-full px-3 py-1.5 text-xs font-medium";
  switch (p) {
    case "urgent":
      return `${base} bg-rose-100 text-rose-800`;
    case "high":
      return `${base} bg-amber-100 text-amber-800`;
    case "medium":
      return `${base} bg-blue-100 text-blue-800`;
    case "low":
      return `${base} bg-emerald-100 text-emerald-800`;
    default:
      return `${base} bg-slate-100 text-slate-700`;
  }
}

function typeLabel(t) {
  if (t === "hardware") return "Hardware";
  if (t === "software") return "Software";
  if (t === "network") return "Network";
  return "Other";
}

function fmtDate(d) {
  if (!d) return "—";
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return "—";
  return x.toISOString().slice(0, 10);
}

function localEmailsDisabled() {
  return localStorage.getItem("repairsEmailsDisabled") === "true";
}

function setLocalEmailsDisabled(v) {
  localStorage.setItem("repairsEmailsDisabled", v ? "true" : "false");
}

export default function Repairs() {
  // Tabs (for future expansion)
  const [tab] = useState("tickets"); // only tickets now

  // Email global toggle
  const [emailsDisabled, setEmailsDisabled] = useState(localEmailsDisabled());

  useEffect(() => {
    setLocalEmailsDisabled(emailsDisabled);
  }, [emailsDisabled]);

  // List state
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);

  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const [page, setPage] = useState(1);
  const [limit] = useState(10);

  const [q, setQ] = useState("");
  const dq = useDebounced(q, 250);

  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [type, setType] = useState("");
  const [department, setDepartment] = useState("");

  // Date quick filter
  const [dateQuick, setDateQuick] = useState("30d"); // all | 7d | 30d | month
  const dateFrom = useMemo(() => {
    if (dateQuick === "all") return "";
    const now = new Date();
    if (dateQuick === "7d") {
      const d = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
      return d.toISOString().slice(0, 10);
    }
    if (dateQuick === "30d") {
      const d = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
      return d.toISOString().slice(0, 10);
    }
    if (dateQuick === "month") {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      return d.toISOString().slice(0, 10);
    }
    return "";
  }, [dateQuick]);

  const abortRef = useRef(null);

  const params = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set("page", String(page));
    sp.set("limit", String(limit));
    if (dq.trim()) sp.set("q", dq.trim());
    if (status) sp.set("status", status);
    if (priority) sp.set("priority", priority);
    if (type) sp.set("type", type);
    if (department.trim()) sp.set("department", department.trim());
    if (dateFrom) sp.set("dateFrom", dateFrom);
    return sp.toString();
  }, [page, limit, dq, status, priority, type, department, dateFrom]);

  async function load() {
    // cancel previous request
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    try {
      const token = getToken();
      const base = import.meta.env.VITE_API_BASE || "http://localhost:4000";

      const p = fetch(`${base}/api/repairs?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      }).then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j?.message || "Failed to load repairs");
        return j;
      });

      const data = await withMinDelay(p, 320);
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
    if (tab !== "tickets") return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, tab]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [dq, status, priority, type, department, dateFrom]);

  // Create/Edit Modal state
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState(null);

  const [form, setForm] = useState({
    assetId: "",
    employeeId: "",
    title: "",
    description: "",
    type: "hardware",
    priority: "medium",
    warranty: false,
    vendorName: "",
    vendorContact: "",
    costLKR: "",
    remarks: "",
  });

  const [sendEmails, setSendEmails] = useState(true);

  // Asset/Employee search dropdowns (remote)
  const [assetQ, setAssetQ] = useState("");
  const dAssetQ = useDebounced(assetQ, 250);
  const [assetOptions, setAssetOptions] = useState([]);
  const [assetOptLoading, setAssetOptLoading] = useState(false);

  const [empQ, setEmpQ] = useState("");
  const dEmpQ = useDebounced(empQ, 250);
  const [empOptions, setEmpOptions] = useState([]);
  const [empOptLoading, setEmpOptLoading] = useState(false);

  async function searchAssetsRemote(query) {
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

  async function searchEmployeesRemote(query) {
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
    if (!open) return;
    searchAssetsRemote(dAssetQ);
  }, [dAssetQ, open]);

  useEffect(() => {
    if (!open) return;
    searchEmployeesRemote(dEmpQ);
  }, [dEmpQ, open]);

  function startCreate() {
    setEditId(null);
    setForm({
      assetId: "",
      employeeId: "",
      title: "",
      description: "",
      type: "hardware",
      priority: "medium",
      warranty: false,
      vendorName: "",
      vendorContact: "",
      costLKR: "",
      remarks: "",
    });
    setSendEmails(!emailsDisabled);
    setAssetQ("");
    setEmpQ("");
    setOpen(true);
  }

  function startEdit(row) {
    setEditId(row.id);
    // we need full details to edit properly
    openDetails(row.id, true);
  }

  function closeModal() {
    setOpen(false);
    setEditId(null);
  }

  async function submitCreate() {
    if (!form.assetId) return toast.error("Asset is required.");
    if (!form.employeeId) return toast.error("Employee is required.");
    if (!form.title.trim()) return toast.error("Title is required.");

    const payload = {
      assetId: form.assetId,
      employeeId: form.employeeId,
      title: form.title.trim(),
      description: (form.description || "").trim(),
      type: form.type,
      priority: form.priority,
      warranty: !!form.warranty,
      vendorName: (form.vendorName || "").trim(),
      vendorContact: (form.vendorContact || "").trim(),
      costLKR: form.costLKR === "" ? null : Number(form.costLKR),
      remarks: (form.remarks || "").trim(),
      notify: !emailsDisabled && sendEmails,
    };

    if (payload.costLKR != null && !Number.isFinite(payload.costLKR)) {
      return toast.error("Invalid cost (LKR).");
    }
    if (payload.costLKR != null && payload.costLKR < 0) {
      return toast.error("Cost cannot be negative.");
    }

    setBusyId("create");
    try {
      const token = getToken();
      const data = await apiFetch("/api/repairs", {
        method: "POST",
        token,
        body: payload,
      });

      toast.success(`Ticket created: ${data.ticketNo}`);
      closeModal();
      setPage(1);
      await load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusyId(null);
    }
  }

  async function submitUpdate() {
    if (!editId) return;
    if (!form.assetId) return toast.error("Asset is required.");
    if (!form.employeeId) return toast.error("Employee is required.");
    if (!form.title.trim()) return toast.error("Title is required.");

    const payload = {
      assetId: form.assetId,
      employeeId: form.employeeId,
      title: form.title.trim(),
      description: (form.description || "").trim(),
      type: form.type,
      priority: form.priority,
      warranty: !!form.warranty,
      vendorName: (form.vendorName || "").trim(),
      vendorContact: (form.vendorContact || "").trim(),
      costLKR: form.costLKR === "" ? null : Number(form.costLKR),
      remarks: (form.remarks || "").trim(),
      notify: !emailsDisabled && sendEmails,
    };

    if (payload.costLKR != null && !Number.isFinite(payload.costLKR)) {
      return toast.error("Invalid cost (LKR).");
    }

    setBusyId(editId);
    try {
      const token = getToken();
      await apiFetch(`/api/repairs/${editId}`, {
        method: "PATCH",
        token,
        body: payload,
      });

      toast.success("Ticket updated");
      closeModal();
      await load();
      // refresh drawer if open for same ticket
      if (drawerId === editId) await openDetails(editId, false);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusyId(null);
    }
  }

  async function deleteTicket(id) {
    const row = items.find((x) => x.id === id);
    const ok = window.confirm(`Delete ticket ${row?.ticketNo || ""}?`);
    if (!ok) return;

    setBusyId(id);
    try {
      const token = getToken();
      await apiFetch(`/api/repairs/${id}`, { method: "DELETE", token });
      toast.success("Ticket deleted");
      if (items.length === 1 && page > 1) setPage((p) => p - 1);
      else await load();
      if (drawerId === id) closeDrawer();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusyId(null);
    }
  }

  async function exportXlsx() {
    try {
      const sp = new URLSearchParams();
      if (dq.trim()) sp.set("q", dq.trim());
      if (status) sp.set("status", status);
      if (priority) sp.set("priority", priority);
      if (type) sp.set("type", type);
      if (department.trim()) sp.set("department", department.trim());
      if (dateFrom) sp.set("dateFrom", dateFrom);
      await downloadWithAuth(
        `/api/repairs/export.xlsx?${sp.toString()}`,
        `repairs_export.xlsx`
      );
      toast.success("Export downloaded");
    } catch (e) {
      toast.error(e.message);
    }
  }

  // Drawer (details)
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerId, setDrawerId] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState(null);

  const [statusNext, setStatusNext] = useState("in_progress");
  const [statusNote, setStatusNote] = useState("");
  const [statusNotify, setStatusNotify] = useState(true);

  const [noteText, setNoteText] = useState("");
  const [noteNotify, setNoteNotify] = useState(false);

  async function openDetails(id, forEdit = false) {
    setDrawerOpen(true);
    setDrawerId(id);
    setDetail(null);
    setDetailLoading(true);

    try {
      const token = getToken();
      const p = apiFetch(`/api/repairs/${id}`, { token });
      const data = await withMinDelay(p, 250);
      setDetail(data.item);

      // default statusNext
      setStatusNext(
        data.item?.status === "open"
          ? "in_progress"
          : data.item?.status || "open"
      );
      setStatusNote("");
      setStatusNotify(!emailsDisabled);

      setNoteText("");
      setNoteNotify(false);

      if (forEdit) {
        // open modal and prefill
        const t = data.item;

        setEditId(id);
        setForm({
          assetId: t.asset?.id || t.assetId || "",
          employeeId: t.employee?.id || t.employeeId || "",
          title: t.title || "",
          description: t.description || "",
          type: t.type || "hardware",
          priority: t.priority || "medium",
          warranty: !!t.warranty,
          vendorName: t.vendorName || "",
          vendorContact: t.vendorContact || "",
          costLKR: t.costLKR == null ? "" : String(t.costLKR),
          remarks: t.remarks || "",
        });

        setSendEmails(!emailsDisabled);
        setAssetQ("");
        setEmpQ("");
        setOpen(true);
      }
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
    if (!statusNext) return toast.error("Select a status.");

    setBusyId(`status:${drawerId}`);
    try {
      const token = getToken();
      await apiFetch(`/api/repairs/${drawerId}/status`, {
        method: "PATCH",
        token,
        body: {
          status: statusNext,
          note: statusNote.trim(),
          notify: !emailsDisabled && statusNotify,
        },
      });
      toast.success("Status updated");
      await openDetails(drawerId, false);
      await load();
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
      await apiFetch(`/api/repairs/${drawerId}/note`, {
        method: "POST",
        token,
        body: {
          note: noteText.trim(),
          notify: !emailsDisabled && noteNotify,
        },
      });
      toast.success("Note added");
      await openDetails(drawerId, false);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="relative p-6">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
            <Wrench className="h-5 w-5 text-slate-600" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Repairs</h1>
            <p className="text-sm text-slate-500">
              Track repair tickets for assets
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={exportXlsx}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Download className="h-4 w-4" />
            Export
          </button>

          <button
            onClick={startCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            <Plus className="h-4 w-4" />
            New Ticket
          </button>
        </div>
      </div>

      {/* Email toggle + filters */}
      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <div className="md:col-span-2 rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-slate-500" />
              <div>
                <div className="text-sm font-medium text-slate-900">
                  Email Notifications
                </div>
                <div className="text-xs text-slate-500">
                  Temporary stop emails
                </div>
              </div>
            </div>

            <button
              onClick={() => setEmailsDisabled((v) => !v)}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium ${
                emailsDisabled
                  ? "bg-rose-100 text-rose-800"
                  : "bg-emerald-100 text-emerald-800"
              }`}
            >
              {emailsDisabled ? "Stopped" : "Enabled"}
            </button>
          </div>

          {emailsDisabled ? (
            <div className="mt-3 flex items-center gap-2 text-xs text-rose-700">
              <AlertTriangle className="h-4 w-4" />
              Emails will NOT be sent until you enable again.
            </div>
          ) : (
            <div className="mt-3 text-xs text-slate-500">
              Emails will send to Employee + HR + Admin (default).
            </div>
          )}
        </div>

        <div className="relative md:col-span-2">
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 pl-10 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
            placeholder="Search ticketNo / title / assetTag / employee..."
          />
        </div>

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
        >
          <option value="">All statuses</option>
          <option value="open">open</option>
          <option value="in_progress">in_progress</option>
          <option value="waiting_parts">waiting_parts</option>
          <option value="waiting_vendor">waiting_vendor</option>
          <option value="resolved">resolved</option>
          <option value="closed">closed</option>
          <option value="cancelled">cancelled</option>
        </select>

        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
        >
          <option value="">All priorities</option>
          <option value="low">low</option>
          <option value="medium">medium</option>
          <option value="high">high</option>
          <option value="urgent">urgent</option>
        </select>

        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
        >
          <option value="">All types</option>
          <option value="hardware">hardware</option>
          <option value="software">software</option>
          <option value="network">network</option>
          <option value="other">other</option>
        </select>

        <input
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
          placeholder="Department filter"
        />

        <select
          value={dateQuick}
          onChange={(e) => setDateQuick(e.target.value)}
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
        >
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="month">This month</option>
          <option value="all">All time</option>
        </select>

        <div className="flex items-center justify-between rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm">
          <div className="text-slate-700">
            <span className="text-slate-500">Total:</span>{" "}
            <span className="font-medium text-slate-900">{total}</span>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="grid grid-cols-12 gap-4 border-b border-slate-200 bg-slate-50/50 px-5 py-4 text-xs font-medium uppercase tracking-wide text-slate-500">
          <div className="col-span-2">Ticket</div>
          <div className="col-span-3">Asset</div>
          <div className="col-span-3">Title</div>
          <div className="col-span-1">Type</div>
          <div className="col-span-1">Priority</div>
          <div className="col-span-1">Status</div>
          <div className="col-span-1 text-right">Actions</div>
        </div>

        {loading ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="grid grid-cols-12 gap-4">
                <Skeleton className="col-span-2 h-10" />
                <Skeleton className="col-span-3 h-10" />
                <Skeleton className="col-span-3 h-10" />
                <Skeleton className="col-span-1 h-10" />
                <Skeleton className="col-span-1 h-10" />
                <Skeleton className="col-span-1 h-10" />
                <Skeleton className="col-span-1 h-10" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <div className="rounded-full bg-slate-100 p-4">
              <ClipboardList className="h-8 w-8 text-slate-400" />
            </div>
            <p className="mt-4 text-sm font-medium text-slate-700">
              No tickets found
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Try adjusting filters or create a new ticket
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100/80">
            {items.map((r) => {
              const isBusy = busyId === r.id;

              return (
                <div
                  key={r.id}
                  className="grid grid-cols-12 gap-4 px-5 py-4 text-sm transition-colors hover:bg-slate-50/50"
                >
                  <div className="col-span-2">
                    <div className="font-medium text-slate-900">
                      {r.ticketNo}
                    </div>
                    <div className="text-xs text-slate-500">
                      {fmtDate(r.createdAt)}
                    </div>
                  </div>

                  <div className="col-span-3">
                    <div className="font-medium text-slate-900">
                      {r.asset?.assetTag || "—"}{" "}
                      <span className="text-slate-500 font-normal">
                        {r.asset?.name ? `• ${r.asset.name}` : ""}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500">
                      {r.employee?.name || "—"}{" "}
                      {r.employee?.email ? `(${r.employee.email})` : ""}
                    </div>
                  </div>

                  <div className="col-span-3">
                    <div className="text-slate-900 font-medium line-clamp-1">
                      {r.title}
                    </div>
                    <div className="text-xs text-slate-500 line-clamp-1">
                      {r.department || r.asset?.department || "—"}
                    </div>
                  </div>

                  <div className="col-span-1 text-slate-700">
                    {typeLabel(r.type)}
                  </div>

                  <div className="col-span-1">
                    <span className={badgePriority(r.priority)}>
                      {r.priority}
                    </span>
                  </div>

                  <div className="col-span-1">
                    <span className={badgeStatus(r.status)}>{r.status}</span>
                  </div>

                  <div className="col-span-1 flex items-center justify-end gap-2">
                    <button
                      onClick={() => openDetails(r.id, false)}
                      disabled={isBusy}
                      className="inline-flex items-center rounded-lg border border-slate-300 bg-white p-2 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      title="View"
                    >
                      {drawerOpen && drawerId === r.id ? (
                        <PanelRightClose className="h-4 w-4" />
                      ) : (
                        <PanelRightOpen className="h-4 w-4" />
                      )}
                    </button>

                    <button
                      onClick={() => startEdit(r)}
                      disabled={isBusy}
                      className="inline-flex items-center rounded-lg border border-slate-300 bg-white p-2 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      title="Edit"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>

                    <button
                      onClick={() => deleteTicket(r.id)}
                      disabled={isBusy}
                      className="inline-flex items-center rounded-lg border border-red-200 bg-red-50 p-2 text-red-700 hover:bg-red-100 disabled:opacity-50"
                      title="Delete (admin)"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
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
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </button>

        <button
          onClick={() => setPage((p) => Math.min(pages, p + 1))}
          disabled={page >= pages || loading}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* CREATE / EDIT MODAL */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 p-4 pt-10">
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {editId ? "Edit Repair Ticket" : "New Repair Ticket"}
                </h2>
                <p className="text-sm text-slate-500">
                  Asset + employee required
                </p>
              </div>
              <button
                onClick={closeModal}
                className="rounded-lg p-2 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {/* Asset picker */}
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Asset (search) *
                </label>
                <input
                  value={assetQ}
                  onChange={(e) => setAssetQ(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-100"
                  placeholder="Search assets by tag/name..."
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
                    <div className="max-h-44 overflow-auto">
                      {assetOptions.map((a) => (
                        <button
                          key={a.id || a._id}
                          onClick={() =>
                            setForm((p) => ({
                              ...p,
                              assetId: (a.id || a._id).toString(),
                            }))
                          }
                          className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                            form.assetId === (a.id || a._id).toString()
                              ? "bg-slate-100"
                              : ""
                          }`}
                          type="button"
                        >
                          <div>
                            <div className="font-medium text-slate-900">
                              {a.assetTag}{" "}
                              <span className="font-normal text-slate-500">
                                {a.name ? `• ${a.name}` : ""}
                              </span>
                            </div>
                            <div className="text-xs text-slate-500">
                              {a.category || "—"} • {a.department || "—"}
                            </div>
                          </div>
                          {form.assetId === (a.id || a._id).toString() ? (
                            <Check className="h-4 w-4 text-slate-700" />
                          ) : null}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Employee picker */}
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Employee (search) *
                </label>
                <input
                  value={empQ}
                  onChange={(e) => setEmpQ(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-100"
                  placeholder="Search employees by name/email..."
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
                    <div className="max-h-44 overflow-auto">
                      {empOptions.map((e) => (
                        <button
                          key={e.id}
                          onClick={() =>
                            setForm((p) => ({ ...p, employeeId: e.id }))
                          }
                          className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                            form.employeeId === e.id ? "bg-slate-100" : ""
                          }`}
                          type="button"
                        >
                          <div>
                            <div className="font-medium text-slate-900">
                              {e.name}{" "}
                              <span className="font-normal text-slate-500">
                                {e.email ? `• ${e.email}` : ""}
                              </span>
                            </div>
                            <div className="text-xs text-slate-500">
                              {e.department || "—"}
                            </div>
                          </div>
                          {form.employeeId === e.id ? (
                            <Check className="h-4 w-4 text-slate-700" />
                          ) : null}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Title *
                </label>
                <input
                  value={form.title}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, title: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-100"
                  placeholder="Short issue title"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Type
                  </label>
                  <select
                    value={form.type}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, type: e.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-100"
                  >
                    <option value="hardware">hardware</option>
                    <option value="software">software</option>
                    <option value="network">network</option>
                    <option value="other">other</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Priority
                  </label>
                  <select
                    value={form.priority}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, priority: e.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-100"
                  >
                    <option value="low">low</option>
                    <option value="medium">medium</option>
                    <option value="high">high</option>
                    <option value="urgent">urgent</option>
                  </select>
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, description: e.target.value }))
                  }
                  className="min-h-[90px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-100"
                  placeholder="More details (optional)"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="warranty"
                  type="checkbox"
                  checked={form.warranty}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, warranty: e.target.checked }))
                  }
                />
                <label htmlFor="warranty" className="text-sm text-slate-700">
                  Warranty
                </label>
              </div>

              <div className="md:col-span-2 grid gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Vendor
                  </label>
                  <input
                    value={form.vendorName}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, vendorName: e.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-100"
                    placeholder="Vendor name"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Vendor Contact
                  </label>
                  <input
                    value={form.vendorContact}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, vendorContact: e.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-100"
                    placeholder="Phone/email"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Cost (LKR)
                  </label>
                  <input
                    value={form.costLKR}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, costLKR: e.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-100"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Remarks
                </label>
                <input
                  value={form.remarks}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, remarks: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-100"
                  placeholder="Optional"
                />
              </div>
            </div>

            {/* notify */}
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={sendEmails}
                  onChange={(e) => setSendEmails(e.target.checked)}
                  disabled={emailsDisabled}
                />
                Send email notifications
                {emailsDisabled ? (
                  <span className="ml-2 rounded-full bg-rose-100 px-2 py-1 text-xs font-medium text-rose-800">
                    Disabled globally
                  </span>
                ) : null}
              </label>

              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={closeModal}
                  disabled={busyId === "create" || busyId === editId}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  <X className="mr-2 inline h-4 w-4" /> Cancel
                </button>

                {!editId ? (
                  <button
                    onClick={submitCreate}
                    disabled={busyId === "create"}
                    className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                  >
                    <Save className="mr-2 h-4 w-4" />
                    {busyId === "create" ? "Creating..." : "Create Ticket"}
                  </button>
                ) : (
                  <button
                    onClick={submitUpdate}
                    disabled={busyId === editId}
                    className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                  >
                    <Save className="mr-2 h-4 w-4" />
                    {busyId === editId ? "Saving..." : "Save Changes"}
                  </button>
                )}
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
                  <Wrench className="h-5 w-5 text-slate-700" />
                  <div>
                    <div className="text-sm font-semibold text-slate-900">
                      Ticket Details
                    </div>
                    <div className="text-xs text-slate-500">
                      {detail?.ticketNo || "—"}
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
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : !detail ? (
                <div className="text-sm text-slate-600">No details.</div>
              ) : (
                <>
                  {/* Summary */}
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-lg font-semibold text-slate-900">
                          {detail.title}
                        </div>
                        <div className="mt-1 text-sm text-slate-500">
                          Created: {fmtDate(detail.createdAt)} • Department:{" "}
                          {detail.department}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        <span className={badgePriority(detail.priority)}>
                          {detail.priority}
                        </span>
                        <span className={badgeStatus(detail.status)}>
                          {detail.status}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 text-sm text-slate-700 whitespace-pre-wrap">
                      {detail.description || "—"}
                    </div>
                  </div>

                  {/* Asset/Employee */}
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        Asset
                      </div>
                      <div className="mt-2 text-sm font-semibold text-slate-900">
                        {detail.asset?.assetTag}{" "}
                        <span className="font-normal text-slate-500">
                          {detail.asset?.name ? `• ${detail.asset.name}` : ""}
                        </span>
                      </div>
                      <div className="mt-1 text-sm text-slate-600">
                        {detail.asset?.category || "—"} •{" "}
                        {detail.asset?.department || "—"}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        Serial: {detail.asset?.serialNumber || "—"}
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        Employee
                      </div>
                      <div className="mt-2 text-sm font-semibold text-slate-900">
                        {detail.employee?.name || "—"}
                      </div>
                      <div className="mt-1 text-sm text-slate-600">
                        {detail.employee?.email || "—"}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        Dept: {detail.employee?.department || "—"}
                      </div>
                    </div>
                  </div>

                  {/* Actions: Status change */}
                  <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">
                          Status update
                        </div>
                        <div className="text-xs text-slate-500">
                          Changes status + logs (and emails if enabled)
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-3">
                      <select
                        value={statusNext}
                        onChange={(e) => setStatusNext(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-100"
                      >
                        <option value="open">open</option>
                        <option value="in_progress">in_progress</option>
                        <option value="waiting_parts">waiting_parts</option>
                        <option value="waiting_vendor">waiting_vendor</option>
                        <option value="resolved">resolved</option>
                        <option value="closed">closed</option>
                        <option value="cancelled">cancelled</option>
                      </select>

                      <input
                        value={statusNote}
                        onChange={(e) => setStatusNote(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-100"
                        placeholder="Optional note (ex: waiting for part delivery)"
                      />

                      <div className="flex items-center justify-between gap-3">
                        <label className="flex items-center gap-2 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={statusNotify}
                            onChange={(e) => setStatusNotify(e.target.checked)}
                            disabled={emailsDisabled}
                          />
                          Send emails
                          {emailsDisabled ? (
                            <span className="ml-2 rounded-full bg-rose-100 px-2 py-1 text-xs font-medium text-rose-800">
                              Disabled globally
                            </span>
                          ) : null}
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
                    </div>
                  </div>

                  {/* Add note */}
                  <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                    <div className="text-sm font-semibold text-slate-900">
                      Add note
                    </div>
                    <div className="mt-2 grid gap-3">
                      <textarea
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        className="min-h-[90px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-100"
                        placeholder="Write a note (parts, vendor update, diagnosis...)"
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

                  {/* Logs */}
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

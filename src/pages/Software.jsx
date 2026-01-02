import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import { apiFetch } from "../api/client";
import { getToken } from "../auth/authStore";
import { Skeleton } from "../components/Loaders";
import {
  Download,
  Plus,
  Search,
  RefreshCw,
  X,
  Check,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Settings,
  RotateCcw,
  MonitorCloud,
  ListChecks,
  History,
  Ban,
  HandHelping,
} from "lucide-react";

function ActionButton({ children, danger, ...props }) {
  return (
    <button
      {...props}
      className={`flex h-9 w-9 items-center justify-center rounded-lg border
        ${
          danger
            ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
            : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
        }
        disabled:opacity-50`}
    >
      {React.cloneElement(children, { className: "h-4 w-4" })}
    </button>
  );
}

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

function statusBadge(expiryStatus) {
  if (!expiryStatus || expiryStatus === "—")
    return { text: "—", cls: "bg-slate-100 text-slate-600" };
  if (expiryStatus.startsWith("Expired"))
    return { text: expiryStatus, cls: "bg-red-100 text-red-800" };
  if (expiryStatus.startsWith("Expiring"))
    return { text: expiryStatus, cls: "bg-amber-100 text-amber-800" };
  return { text: expiryStatus, cls: "bg-emerald-100 text-emerald-800" };
}

const TAB = {
  domain: { label: "Domains" },
  saas: { label: "SaaS" },
  license: { label: "Licenses" },
};

export default function Software() {
  // Tabs
  const [type, setType] = useState("domain"); // domain | saas | license

  // List state
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);

  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null); // per-row action

  // Filters
  const [page, setPage] = useState(1);
  const [limit] = useState(10);

  const [q, setQ] = useState("");
  const dq = useDebounced(q, 250);

  const [department, setDepartment] = useState("");
  const [expiry, setExpiry] = useState("");

  const abortRef = useRef(null);

  const params = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set("type", type);
    sp.set("page", String(page));
    sp.set("limit", String(limit));
    if (dq.trim()) sp.set("q", dq.trim());
    if (department.trim()) sp.set("department", department.trim());
    if (expiry) sp.set("expiry", expiry);
    return sp.toString();
  }, [type, page, limit, dq, department, expiry]);

  async function load() {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    try {
      const token = getToken();
      const base = import.meta.env.VITE_API_BASE || "http://localhost:4000";

      const fetchPromise = fetch(`${base}/api/software?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      }).then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok)
          throw new Error(data?.message || "Failed to load software");
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

  // Reset page on tab/filters change
  useEffect(() => setPage(1), [type, dq, department, expiry]);

  // ---------------------------
  // Notification recipients UI
  // ---------------------------
  const [settingsOpen, setSettingsOpen] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [emails, setEmails] = useState([]);
  const [emailsText, setEmailsText] = useState("");
  const [settingsBusy, setSettingsBusy] = useState(false);

  async function openSettings() {
    setSettingsOpen(true);
    try {
      const token = getToken();
      const data = await apiFetch("/api/settings/notifications", { token });
      const arr = (data.softwareExpiryEmails || []).map(String);
      setEmails(arr);
      setEmailsText(arr.join("\n"));
    } catch (e) {
      toast.error(e.message);
    }
  }

  async function saveSettings() {
    const raw = emailsText
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean);

    // basic dedupe lowercased
    const unique = [...new Set(raw.map((x) => x.toLowerCase()))];

    setSettingsBusy(true);
    try {
      const token = getToken();
      await apiFetch("/api/settings/notifications", {
        method: "PATCH",
        token,
        body: { softwareExpiryEmails: unique },
      });
      setEmails(unique);
      toast.success("Recipients saved");
      setSettingsOpen(false);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSettingsBusy(false);
    }
  }

  // ---------------------------
  // Create/Edit modal
  // ---------------------------
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState(null); // item or null
  const [formBusy, setFormBusy] = useState(false);

  const emptyForm = {
    name: "",
    vendor: "",
    department: "",
    cost: "",
    currency: "USD",
    autoRenew: false,
    startDate: "",
    expiryDate: "",
    renewalDate: "",
    remarks: "",

    domainName: "",
    registrar: "",

    quantityTotal: "",
    licenseType: "",
    billingCycle: "",
  };

  const [form, setForm] = useState(emptyForm);

  function startCreate() {
    setEditing(null);
    setForm({ ...emptyForm });
    setEditOpen(true);
  }

  function startEdit(item) {
    setEditing(item);
    setForm({
      name: item.name || "",
      vendor: item.vendor || "",
      department: item.department || "",
      cost: item.cost ?? "",
      currency: item.currency || "USD",
      autoRenew: !!item.autoRenew,
      startDate: item.startDate ? String(item.startDate).slice(0, 10) : "",
      expiryDate: item.expiryDate ? String(item.expiryDate).slice(0, 10) : "",
      renewalDate: item.renewalDate
        ? String(item.renewalDate).slice(0, 10)
        : "",
      remarks: item.remarks || "",

      domainName: item.domainName || "",
      registrar: item.registrar || "",

      quantityTotal: item.quantityTotal ?? "",
      licenseType: item.licenseType || "",
      billingCycle: item.billingCycle || "",
    });
    setEditOpen(true);
  }

  function closeEdit() {
    setEditOpen(false);
    setEditing(null);
    setForm({ ...emptyForm });
  }

  async function saveItem() {
    const payload = {
      type,
      name: form.name.trim(),
      vendor: form.vendor.trim(),
      department: form.department.trim(),
      cost: form.cost === "" ? null : Number(form.cost),
      currency: (form.currency || "USD").trim(),
      autoRenew: !!form.autoRenew,
      startDate: form.startDate || null,
      expiryDate: form.expiryDate || null,
      renewalDate: form.renewalDate || null,
      remarks: form.remarks.trim(),

      domainName: form.domainName.trim(),
      registrar: form.registrar.trim(),

      quantityTotal:
        form.quantityTotal === "" ? null : Number(form.quantityTotal),
      licenseType: form.licenseType,
      billingCycle: form.billingCycle,
    };

    if (!payload.name) return toast.error("Name is required.");

    // small type validations
    if (type === "domain" && !payload.domainName)
      return toast.error("Domain name is required.");
    if (
      (type === "saas" || type === "license") &&
      payload.quantityTotal != null &&
      payload.quantityTotal < 1
    ) {
      return toast.error("Seats total must be >= 1");
    }

    setFormBusy(true);
    try {
      const token = getToken();
      if (editing?.id) {
        await apiFetch(`/api/software/${editing.id}`, {
          method: "PATCH",
          token,
          body: payload,
        });
        toast.success("Updated");
      } else {
        await apiFetch(`/api/software`, {
          method: "POST",
          token,
          body: payload,
        });
        toast.success("Created");
      }
      closeEdit();
      await load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setFormBusy(false);
    }
  }

  async function deleteItem(id) {
    const ok = window.confirm("Delete this record?");
    if (!ok) return;

    setBusyId(id);
    try {
      const token = getToken();
      await apiFetch(`/api/software/${id}`, { method: "DELETE", token });
      toast.success("Deleted");
      await load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusyId(null);
    }
  }

  // ---------------------------
  // Renew modal
  // ---------------------------
  const [renewOpen, setRenewOpen] = useState(false);
  const [renewing, setRenewing] = useState(null);
  const [renewForm, setRenewForm] = useState({
    newExpiryDate: "",
    cost: "",
    currency: "USD",
    remarks: "",
  });
  const [renewBusy, setRenewBusy] = useState(false);

  function openRenew(item) {
    setRenewing(item);
    setRenewForm({
      newExpiryDate: item.expiryDate
        ? String(item.expiryDate).slice(0, 10)
        : "",
      cost: item.cost ?? "",
      currency: item.currency || "USD",
      remarks: "",
    });
    setRenewOpen(true);
  }

  function closeRenew() {
    setRenewOpen(false);
    setRenewing(null);
    setRenewForm({ newExpiryDate: "", cost: "", currency: "USD", remarks: "" });
  }

  async function submitRenew() {
    if (!renewing?.id) return;
    if (!renewForm.newExpiryDate)
      return toast.error("New expiry date is required.");

    setRenewBusy(true);
    try {
      const token = getToken();
      await apiFetch(`/api/software/${renewing.id}/renew`, {
        method: "POST",
        token,
        body: {
          newExpiryDate: renewForm.newExpiryDate,
          cost: renewForm.cost === "" ? null : Number(renewForm.cost),
          currency: (renewForm.currency || "USD").trim(),
          remarks: renewForm.remarks.trim(),
        },
      });
      toast.success("Renewed");
      closeRenew();
      await load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setRenewBusy(false);
    }
  }

  // ---------------------------
  // Assign seats modal (optional target)
  // ---------------------------
  const [assignOpen, setAssignOpen] = useState(false);
  const [assigning, setAssigning] = useState(null);
  const [assignBusy, setAssignBusy] = useState(false);

  const [targetType, setTargetType] = useState("employee"); // employee|asset|department
  const [targetId, setTargetId] = useState("");
  const [targetName, setTargetName] = useState(""); // for department
  const [seatCount, setSeatCount] = useState(1);
  const [assignRemarks, setAssignRemarks] = useState("");

  // pickers
  const [empQ, setEmpQ] = useState("");
  const [assetQ, setAssetQ] = useState("");
  const dEmpQ = useDebounced(empQ, 250);
  const dAssetQ = useDebounced(assetQ, 250);
  const [empOpts, setEmpOpts] = useState([]);
  const [assetOpts, setAssetOpts] = useState([]);

  useEffect(() => {
    if (!assignOpen || targetType !== "employee") return;
    (async () => {
      try {
        const token = getToken();
        const data = await apiFetch(
          `/api/employees?q=${encodeURIComponent(dEmpQ)}&page=1&limit=10`,
          { token }
        );
        setEmpOpts(data.items || []);
      } catch {
        setEmpOpts([]);
      }
    })();
  }, [assignOpen, targetType, dEmpQ]);

  useEffect(() => {
    if (!assignOpen || targetType !== "asset") return;
    (async () => {
      try {
        const token = getToken();
        const data = await apiFetch(
          `/api/assets?q=${encodeURIComponent(dAssetQ)}&page=1&limit=10`,
          { token }
        );
        setAssetOpts(data.items || []);
      } catch {
        setAssetOpts([]);
      }
    })();
  }, [assignOpen, targetType, dAssetQ]);

  function openAssign(item) {
    setAssigning(item);
    setAssignOpen(true);
    setTargetType("employee");
    setTargetId("");
    setTargetName("");
    setSeatCount(1);
    setAssignRemarks("");
    setEmpQ("");
    setAssetQ("");
    setEmpOpts([]);
    setAssetOpts([]);
  }

  function closeAssign() {
    setAssignOpen(false);
    setAssigning(null);
  }

  async function submitAssign() {
    if (!assigning?.id) return;

    if (seatCount < 1) return toast.error("Seat count must be >= 1");

    if (targetType === "employee" && !targetId)
      return toast.error("Select an employee");
    if (targetType === "asset" && !targetId)
      return toast.error("Select an asset");
    if (targetType === "department" && !targetName.trim())
      return toast.error("Enter department name");

    setAssignBusy(true);
    try {
      const token = getToken();
      await apiFetch(`/api/software/${assigning.id}/assign`, {
        method: "POST",
        token,
        body: {
          targetType,
          targetId: targetType === "department" ? null : targetId,
          targetName: targetType === "department" ? targetName.trim() : "",
          seatCount: Number(seatCount),
          remarks: assignRemarks.trim(),
        },
      });

      toast.success("Assigned");
      closeAssign();
      await load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setAssignBusy(false);
    }
  }

  // ---------------------------
  // Export
  // ---------------------------
  async function exportExcel() {
    try {
      const token = getToken();
      const base = import.meta.env.VITE_API_BASE || "http://localhost:4000";

      const sp = new URLSearchParams();
      sp.set("type", type);
      if (dq.trim()) sp.set("q", dq.trim());
      if (department.trim()) sp.set("department", department.trim());
      if (expiry) sp.set("expiry", expiry);

      const url = `${base}/api/software/export.xlsx?${sp.toString()}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message || "Export failed");
      }

      const blob = await res.blob();
      const fileUrl = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = fileUrl;
      const ts = new Date().toISOString().slice(0, 10);
      a.download = `software_${type}_${ts}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(fileUrl);

      toast.success("Excel exported");
    } catch (e) {
      toast.error(e.message);
    }
  }

  // ---------------------------
  // Assignments History Modal
  // ---------------------------
  const [asgOpen, setAsgOpen] = useState(false);
  const [asgItem, setAsgItem] = useState(null);
  const [asgStatus, setAsgStatus] = useState("active"); // active|revoked
  const [asgLoading, setAsgLoading] = useState(true);
  const [asgBusyId, setAsgBusyId] = useState(null);
  const [asgRows, setAsgRows] = useState([]);
  const [asgTotal, setAsgTotal] = useState(0);
  const [asgPages, setAsgPages] = useState(1);
  const [asgPage, setAsgPage] = useState(1);
  const asgLimit = 10;

  function openAssignments(item) {
    setAsgItem(item);
    setAsgOpen(true);
    setAsgStatus("active");
    setAsgPage(1);
  }

  function closeAssignments() {
    setAsgOpen(false);
    setAsgItem(null);
    setAsgRows([]);
    setAsgTotal(0);
    setAsgPages(1);
    setAsgBusyId(null);
  }

  async function loadAssignments() {
    if (!asgItem?.id) return;
    setAsgLoading(true);
    try {
      const token = getToken();
      const sp = new URLSearchParams();
      sp.set("page", String(asgPage));
      sp.set("limit", String(asgLimit));
      sp.set("status", asgStatus);

      const data = await apiFetch(
        `/api/software/${asgItem.id}/assignments?${sp.toString()}`,
        { token }
      );
      setAsgRows(data.items || []);
      setAsgTotal(data.total || 0);
      setAsgPages(data.pages || 1);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setAsgLoading(false);
    }
  }

  useEffect(() => {
    if (!asgOpen) return;
    loadAssignments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asgOpen, asgItem?.id, asgPage, asgStatus]);

  useEffect(() => {
    if (!asgOpen) return;
    setAsgPage(1);
  }, [asgStatus, asgOpen]);

  async function revokeAssignment(assignmentId) {
    setAsgBusyId(assignmentId);
    try {
      const token = getToken();
      await apiFetch(`/api/software/assignments/${assignmentId}/revoke`, {
        method: "POST",
        token,
      });
      toast.success("Revoked");
      await loadAssignments();
      await load(); // refresh main list to update used seats
    } catch (e) {
      toast.error(e.message);
    } finally {
      setAsgBusyId(null);
    }
  }

  // ---------------------------
  // Renewals History Modal
  // ---------------------------
  const [renHistOpen, setRenHistOpen] = useState(false);
  const [renItem, setRenItem] = useState(null);
  const [renLoading, setRenLoading] = useState(true);
  const [renRows, setRenRows] = useState([]);
  const [renTotal, setRenTotal] = useState(0);
  const [renPages, setRenPages] = useState(1);
  const [renPage, setRenPage] = useState(1);
  const renLimit = 10;

  function openRenewalsHistory(item) {
    setRenItem(item);
    setRenHistOpen(true);
    setRenPage(1);
  }

  function closeRenewalsHistory() {
    setRenHistOpen(false);
    setRenItem(null);
    setRenRows([]);
    setRenTotal(0);
    setRenPages(1);
  }

  async function loadRenewalsHistory() {
    if (!renItem?.id) return;
    setRenLoading(true);
    try {
      const token = getToken();
      const sp = new URLSearchParams();
      sp.set("page", String(renPage));
      sp.set("limit", String(renLimit));

      const data = await apiFetch(
        `/api/software/${renItem.id}/renewals?${sp.toString()}`,
        { token }
      );
      setRenRows(data.items || []);
      setRenTotal(data.total || 0);
      setRenPages(data.pages || 1);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setRenLoading(false);
    }
  }

  useEffect(() => {
    if (!renHistOpen) return;
    loadRenewalsHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renHistOpen, renItem?.id, renPage]);

  // ---------------------------
  // Render
  // ---------------------------
  return (
    <div className="p-6">
      {/* Header + Tabs */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
              <MonitorCloud className="h-5 w-5 text-slate-600" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">
                Software Management
              </h1>
              <p className="text-sm text-slate-500">
                Track domains, SaaS subscriptions, and licenses with expiry +
                seats.
              </p>
            </div>
          </div>

          <div className="mt-3 inline-flex rounded-xl border border-slate-200 bg-white p-1">
            {Object.keys(TAB).map((k) => (
              <button
                key={k}
                onClick={() => setType(k)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  type === k
                    ? "bg-slate-900 text-white"
                    : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                {TAB[k].label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={openSettings}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Settings className="h-4 w-4" />
            Recipients
          </button>

          <button
            onClick={exportExcel}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Download className="h-4 w-4" />
            Export Excel
          </button>

          <button
            onClick={startCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            <Plus className="h-4 w-4" />
            Add
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
      <div className="mb-5 grid gap-3 md:grid-cols-4">
        <div className="relative md:col-span-2">
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 pl-10 text-sm outline-none focus:ring-2 focus:ring-slate-100"
            placeholder="Search name/vendor/domain..."
          />
        </div>

        <input
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-100"
          placeholder="Department (optional)"
        />

        <select
          value={expiry}
          onChange={(e) => setExpiry(e.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none"
        >
          <option value="">Expiry: All</option>
          <option value="active">Active</option>
          <option value="expiring30">Expiring ≤30d</option>
          <option value="expiring7">Expiring ≤7d</option>
          <option value="expired">Expired</option>
        </select>
      </div>

      {/* Summary */}
      <div className="mb-4 flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm">
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

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {/* Header */}
        <div className="grid grid-cols-12 gap-4 border-b border-slate-200 bg-slate-50/50 px-5 py-4 text-xs font-medium uppercase tracking-wide text-slate-500">
          <div className="col-span-3">Name</div>
          <div className="col-span-2">Vendor</div>
          <div className="col-span-1">Dept</div>
          <div className="col-span-1">Expiry</div>
          <div className="col-span-2">Renewal</div>
          <div className="col-span-1">Seats</div>
          <div className="col-span-2 text-right">Actions</div>
        </div>

        {loading ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="grid grid-cols-12 gap-4">
                <Skeleton className="col-span-3 h-10" />
                <Skeleton className="col-span-2 h-10" />
                <Skeleton className="col-span-1 h-10" />
                <Skeleton className="col-span-1 h-10" />
                <Skeleton className="col-span-2 h-10" />
                <Skeleton className="col-span-1 h-10" />
                <Skeleton className="col-span-2 h-10" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-12">
            <div className="rounded-full bg-slate-100 p-4">
              <MonitorCloud className="h-8 w-8 text-slate-400" />
            </div>
            <p className="mt-4 text-sm font-medium text-slate-700">
              No software found
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Add your first software to get started
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100/80">
            {items.map((x) => {
              const isBusy = busyId === x.id;
              const badge = statusBadge(x.expiryStatus);

              const seatsTotal =
                x.quantityTotal == null ? "—" : x.quantityTotal;
              const seatsUsed = x.quantityTotal == null ? "—" : x.usedSeats;

              return (
                <div
                  key={x.id}
                  className="grid grid-cols-12 gap-4 px-5 py-3 text-sm hover:bg-slate-50/50"
                >
                  {/* Name */}
                  <div className="col-span-3 flex items-center">
                    <div>
                      <div className="font-medium text-slate-900">{x.name}</div>
                      {type === "domain" && x.domainName ? (
                        <div className="text-xs text-slate-500">
                          {x.domainName}
                        </div>
                      ) : (
                        <div className="text-xs text-slate-500">
                          {x.remarks ? x.remarks.slice(0, 40) : ""}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Vendor */}
                  <div className="col-span-2 flex items-center text-slate-700">
                    {x.vendor || "—"}
                  </div>

                  {/* Dept */}
                  <div className="col-span-1 flex items-center text-slate-700">
                    {x.department || "—"}
                  </div>

                  {/* Expiry */}
                  <div className="col-span-1 flex items-center">
                    <span
                      className={`rounded-full px-3 py-1.5 text-xs font-medium ${badge.cls}`}
                    >
                      {badge.text}
                    </span>
                  </div>

                  {/* Renewal */}
                  <div className="col-span-2 flex items-center">
                    <span
                      className={`inline-flex rounded-full px-3 py-1.5 text-xs font-medium ${
                        x.autoRenew
                          ? "bg-indigo-100 text-indigo-800"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {x.autoRenew ? "Auto" : "Manual"}
                    </span>
                  </div>

                  {/* Seats */}
                  <div className="col-span-1 flex items-center text-slate-700">
                    {seatsUsed}/{seatsTotal}
                  </div>

                  {/* Actions */}
                  <div className="col-span-2 flex justify-end">
                    <div className="grid grid-cols-3 gap-2">
                      <ActionButton
                        title="Assign seats"
                        onClick={() => openAssign(x)}
                        disabled={isBusy}
                      >
                        <HandHelping />
                      </ActionButton>

                      <ActionButton
                        title="Renew"
                        onClick={() => openRenew(x)}
                        disabled={isBusy}
                      >
                        <RotateCcw />
                      </ActionButton>

                      <ActionButton
                        title="Edit"
                        onClick={() => startEdit(x)}
                        disabled={isBusy}
                      >
                        <Pencil />
                      </ActionButton>

                      <ActionButton
                        title="Delete"
                        onClick={() => deleteItem(x.id)}
                        disabled={isBusy}
                        danger
                      >
                        <Trash2 />
                      </ActionButton>

                      <ActionButton
                        title="Assignments history"
                        onClick={() => openAssignments(x)}
                        disabled={isBusy}
                      >
                        <ListChecks />
                      </ActionButton>

                      <ActionButton
                        title="Renewals history"
                        onClick={() => openRenewalsHistory(x)}
                        disabled={isBusy}
                      >
                        <History />
                      </ActionButton>
                    </div>
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

      {/* Recipients Modal */}
      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                Expiry Email Recipients
              </h2>
              <button
                onClick={() => setSettingsOpen(false)}
                className="rounded-lg p-2 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mb-3 text-sm text-slate-600">
              Add one email per line. These will be used for software expiry
              alerts (later).
            </p>

            <textarea
              rows={8}
              value={emailsText}
              onChange={(e) => setEmailsText(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-100"
              placeholder={"finance@company.com\nit@company.com"}
            />

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                onClick={() => setSettingsOpen(false)}
                disabled={settingsBusy}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={saveSettings}
                disabled={settingsBusy}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                <Check className="h-4 w-4" />
                {settingsBusy ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-3xl rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                {editing ? "Edit" : "Add"} {TAB[type].label.slice(0, -1)}
              </h2>
              <button
                onClick={closeEdit}
                className="rounded-lg p-2 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Name
                </label>
                <input
                  value={form.name}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, name: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="e.g. Microsoft 365 / Company Domain"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Vendor
                </label>
                <input
                  value={form.vendor}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, vendor: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="e.g. GoDaddy / Microsoft"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Department (optional)
                </label>
                <input
                  value={form.department}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, department: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="e.g. IT"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Auto Renew
                </label>
                <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.autoRenew}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, autoRenew: e.target.checked }))
                    }
                  />
                  Enabled
                </label>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Start Date
                </label>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, startDate: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Expiry Date
                </label>
                <input
                  type="date"
                  value={form.expiryDate}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, expiryDate: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Renewal Date (optional)
                </label>
                <input
                  type="date"
                  value={form.renewalDate}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, renewalDate: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Cost
                </label>
                <input
                  value={form.cost}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, cost: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="e.g. 120"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Currency
                </label>
                <input
                  value={form.currency}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, currency: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="USD"
                />
              </div>

              {/* Type-specific */}
              {type === "domain" ? (
                <>
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      Domain Name
                    </label>
                    <input
                      value={form.domainName}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, domainName: e.target.value }))
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      placeholder="example.com"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      Registrar
                    </label>
                    <input
                      value={form.registrar}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, registrar: e.target.value }))
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      placeholder="GoDaddy"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      Seats Total (optional)
                    </label>
                    <input
                      value={form.quantityTotal}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          quantityTotal: e.target.value,
                        }))
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      placeholder="e.g. 50"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      Billing Cycle
                    </label>
                    <select
                      value={form.billingCycle}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, billingCycle: e.target.value }))
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    >
                      <option value="">—</option>
                      <option value="monthly">Monthly</option>
                      <option value="yearly">Yearly</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      License Type
                    </label>
                    <select
                      value={form.licenseType}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, licenseType: e.target.value }))
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    >
                      <option value="">—</option>
                      <option value="per_user">Per User</option>
                      <option value="per_device">Per Device</option>
                      <option value="on_prem">On Prem</option>
                    </select>
                  </div>
                </>
              )}

              <div className="md:col-span-3">
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Remarks
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
                onClick={closeEdit}
                disabled={formBusy}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={saveItem}
                disabled={formBusy}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                <Check className="h-4 w-4" />
                {formBusy ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Renew Modal */}
      {renewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Renew</h2>
              <button
                onClick={closeRenew}
                className="rounded-lg p-2 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  New Expiry Date
                </label>
                <input
                  type="date"
                  value={renewForm.newExpiryDate}
                  onChange={(e) =>
                    setRenewForm((p) => ({
                      ...p,
                      newExpiryDate: e.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Cost (optional)
                </label>
                <input
                  value={renewForm.cost}
                  onChange={(e) =>
                    setRenewForm((p) => ({ ...p, cost: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Currency
                </label>
                <input
                  value={renewForm.currency}
                  onChange={(e) =>
                    setRenewForm((p) => ({ ...p, currency: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Remarks
                </label>
                <textarea
                  rows={3}
                  value={renewForm.remarks}
                  onChange={(e) =>
                    setRenewForm((p) => ({ ...p, remarks: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                onClick={closeRenew}
                disabled={renewBusy}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={submitRenew}
                disabled={renewBusy}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                <Check className="h-4 w-4" />
                {renewBusy ? "Renewing..." : "Renew"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Modal */}
      {assignOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                Assign Seats
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
                  Target Type
                </label>
                <select
                  value={targetType}
                  onChange={(e) => {
                    setTargetType(e.target.value);
                    setTargetId("");
                    setTargetName("");
                  }}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="employee">Employee</option>
                  <option value="asset">Asset</option>
                  <option value="department">Department</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Seat Count
                </label>
                <input
                  value={seatCount}
                  onChange={(e) => setSeatCount(Number(e.target.value || 1))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  type="number"
                  min={1}
                />
              </div>

              {targetType === "employee" && (
                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Employee
                  </label>
                  <input
                    value={empQ}
                    onChange={(e) => setEmpQ(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Search employee..."
                  />
                  <select
                    value={targetId}
                    onChange={(e) => setTargetId(e.target.value)}
                    className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="">Choose employee...</option>
                    {empOpts.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} — {u.email}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {targetType === "asset" && (
                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Asset
                  </label>
                  <input
                    value={assetQ}
                    onChange={(e) => setAssetQ(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Search asset..."
                  />
                  <select
                    value={targetId}
                    onChange={(e) => setTargetId(e.target.value)}
                    className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="">Choose asset...</option>
                    {assetOpts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.assetTag} — {a.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {targetType === "department" && (
                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Department
                  </label>
                  <input
                    value={targetName}
                    onChange={(e) => setTargetName(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    placeholder="e.g. Finance"
                  />
                </div>
              )}

              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Remarks (optional)
                </label>
                <textarea
                  rows={3}
                  value={assignRemarks}
                  onChange={(e) => setAssignRemarks(e.target.value)}
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
                onClick={submitAssign}
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

      {renHistOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-4xl rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Renewals
                </h2>
                <p className="text-sm text-slate-500">{renItem?.name}</p>
              </div>
              <button
                onClick={closeRenewalsHistory}
                className="rounded-lg p-2 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-3 flex items-center justify-between text-sm">
              <div className="text-slate-700">
                <span className="text-slate-500">Total:</span>{" "}
                <span className="font-medium text-slate-900">{renTotal}</span>
              </div>
              <div className="text-slate-700">
                <span className="text-slate-500">Page:</span>{" "}
                <span className="font-medium text-slate-900">{renPage}</span> /{" "}
                <span className="font-medium text-slate-900">{renPages}</span>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200">
              <div className="grid grid-cols-12 gap-3 border-b border-slate-200 bg-slate-50/50 px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                <div className="col-span-3">Date</div>
                <div className="col-span-3">Old Expiry</div>
                <div className="col-span-3">New Expiry</div>
                <div className="col-span-3">Cost</div>
              </div>

              {renLoading ? (
                <div className="space-y-3 p-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="grid grid-cols-12 gap-3">
                      <Skeleton className="col-span-3 h-10" />
                      <Skeleton className="col-span-3 h-10" />
                      <Skeleton className="col-span-3 h-10" />
                      <Skeleton className="col-span-3 h-10" />
                    </div>
                  ))}
                </div>
              ) : renRows.length === 0 ? (
                <div className="p-4 text-sm text-slate-600">
                  No renewals yet.
                </div>
              ) : (
                <div className="divide-y divide-slate-100/80">
                  {renRows.map((r) => {
                    const date = r.renewedAt
                      ? new Date(r.renewedAt).toISOString().slice(0, 10)
                      : "—";
                    const oldE = r.oldExpiryDate
                      ? new Date(r.oldExpiryDate).toISOString().slice(0, 10)
                      : "—";
                    const newE = r.newExpiryDate
                      ? new Date(r.newExpiryDate).toISOString().slice(0, 10)
                      : "—";
                    const cost =
                      r.cost == null ? "—" : `${r.cost} ${r.currency || ""}`;

                    return (
                      <div
                        key={r.id}
                        className="grid grid-cols-12 gap-3 px-4 py-3 text-sm hover:bg-slate-50/50"
                      >
                        <div className="col-span-3 text-slate-700">{date}</div>
                        <div className="col-span-3 text-slate-700">{oldE}</div>
                        <div className="col-span-3 font-medium text-slate-900">
                          {newE}
                        </div>
                        <div className="col-span-3 text-slate-700">{cost}</div>
                        {r.remarks ? (
                          <div className="col-span-12 -mt-2 pb-2 text-xs text-slate-500">
                            {r.remarks}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                onClick={() => setRenPage((p) => Math.max(1, p - 1))}
                disabled={renPage <= 1 || renLoading}
                className="inline-flex items-center gap-2 rounded-lg border bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </button>
              <button
                onClick={() => setRenPage((p) => Math.min(renPages, p + 1))}
                disabled={renPage >= renPages || renLoading}
                className="inline-flex items-center gap-2 rounded-lg border bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {asgOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-4xl rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Assignments
                </h2>
                <p className="text-sm text-slate-500">
                  {asgItem?.name}{" "}
                  {asgItem?.quantityTotal != null
                    ? `(Seats: ${asgItem?.usedSeats}/${asgItem?.quantityTotal})`
                    : ""}
                </p>
              </div>
              <button
                onClick={closeAssignments}
                className="rounded-lg p-2 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-4 flex items-center justify-between gap-2">
              <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
                <button
                  onClick={() => setAsgStatus("active")}
                  className={`rounded-lg px-4 py-2 text-sm font-medium ${
                    asgStatus === "active"
                      ? "bg-slate-900 text-white"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  Active
                </button>
                <button
                  onClick={() => setAsgStatus("revoked")}
                  className={`rounded-lg px-4 py-2 text-sm font-medium ${
                    asgStatus === "revoked"
                      ? "bg-slate-900 text-white"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  Revoked
                </button>
              </div>

              <div className="text-sm text-slate-700">
                <span className="text-slate-500">Total:</span>{" "}
                <span className="font-medium text-slate-900">{asgTotal}</span>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200">
              <div className="grid grid-cols-12 gap-3 border-b border-slate-200 bg-slate-50/50 px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                <div className="col-span-5">Target</div>
                <div className="col-span-2">Seats</div>
                <div className="col-span-3">Assigned</div>
                <div className="col-span-2 text-right">Action</div>
              </div>

              {asgLoading ? (
                <div className="space-y-3 p-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="grid grid-cols-12 gap-3">
                      <Skeleton className="col-span-5 h-10" />
                      <Skeleton className="col-span-2 h-10" />
                      <Skeleton className="col-span-3 h-10" />
                      <Skeleton className="col-span-2 h-10" />
                    </div>
                  ))}
                </div>
              ) : asgRows.length === 0 ? (
                <div className="p-4 text-sm text-slate-600">
                  No assignments.
                </div>
              ) : (
                <div className="divide-y divide-slate-100/80">
                  {asgRows.map((r) => {
                    const isBusy = asgBusyId === r.id;
                    const assignedAt = r.assignedAt
                      ? new Date(r.assignedAt).toISOString().slice(0, 10)
                      : "—";

                    return (
                      <div
                        key={r.id}
                        className="grid grid-cols-12 gap-3 px-4 py-3 text-sm hover:bg-slate-50/50"
                      >
                        <div className="col-span-5">
                          <div className="font-medium text-slate-900">
                            {r.targetType}
                          </div>
                          <div className="text-xs text-slate-500">
                            {r.targetName || "—"}
                          </div>
                        </div>
                        <div className="col-span-2 text-slate-700">
                          {r.seatCount}
                        </div>
                        <div className="col-span-3 text-slate-700">
                          {assignedAt}
                        </div>

                        <div className="col-span-2 flex justify-end">
                          {asgStatus === "active" ? (
                            <button
                              onClick={() => revokeAssignment(r.id)}
                              disabled={isBusy}
                              className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                            >
                              <Ban className="h-4 w-4" />
                              {isBusy ? "..." : "Revoke"}
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

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                onClick={() => setAsgPage((p) => Math.max(1, p - 1))}
                disabled={asgPage <= 1 || asgLoading}
                className="inline-flex items-center gap-2 rounded-lg border bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </button>
              <button
                onClick={() => setAsgPage((p) => Math.min(asgPages, p + 1))}
                disabled={asgPage >= asgPages || asgLoading}
                className="inline-flex items-center gap-2 rounded-lg border bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

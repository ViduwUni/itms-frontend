import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import { apiFetch } from "../api/client";
import { getToken } from "../auth/authStore";
import { Skeleton } from "../components/Loaders";
import {
  Globe,
  Wifi,
  Package,
  BarChart3,
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
  AlertTriangle,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

function useDebounced(value, delay = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

function ymNow() {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// Prevent “skeleton flash”: ensure loading stays at least minMs
async function withMinDelay(promise, minMs = 300) {
  const start = Date.now();
  const out = await promise;
  const elapsed = Date.now() - start;
  if (elapsed < minMs) await sleep(minMs - elapsed);
  return out;
}

async function downloadWithAuth(path, filename) {
  const token = getToken();
  const base = import.meta.env.VITE_API_BASE || "http://localhost:4000";

  const res = await fetch(`${base}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const ct = res.headers.get("content-type") || "";
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
  // basic sanity
  if (!ct.includes("spreadsheet") && blob.size < 50) {
    throw new Error("File response looks invalid");
  }

  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

function pctBar(percent) {
  // percent can be null (unlimited/no limit)
  if (percent == null)
    return { label: "—", cls: "bg-slate-100 text-slate-600" };
  if (percent >= 100) return { label: "Over", cls: "bg-red-100 text-red-800" };
  if (percent >= 95)
    return { label: "Critical", cls: "bg-rose-100 text-rose-800" };
  if (percent >= 80)
    return { label: "Warning", cls: "bg-amber-100 text-amber-800" };
  return { label: "OK", cls: "bg-emerald-100 text-emerald-800" };
}

export default function Internet() {
  const [tab, setTab] = useState("connections"); // connections | packages | usage

  // -------------------------
  // CONNECTIONS TAB
  // -------------------------
  const [cItems, setCItems] = useState([]);
  const [cTotal, setCTotal] = useState(0);
  const [cPages, setCPages] = useState(1);
  const [cPage, setCPage] = useState(1);
  const cLimit = 10;

  const [cQ, setCQ] = useState("");
  const dcQ = useDebounced(cQ, 250);
  const [cStatus, setCStatus] = useState(""); // "" | active | inactive

  const [cLoading, setCLoading] = useState(true);
  const [cBusyId, setCBusyId] = useState(null);

  const cAbortRef = useRef(null);

  const cParams = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set("page", String(cPage));
    sp.set("limit", String(cLimit));
    if (dcQ.trim()) sp.set("q", dcQ.trim());
    if (cStatus) sp.set("status", cStatus);
    return sp.toString();
  }, [cPage, cLimit, dcQ, cStatus]);

  async function loadConnections() {
    // cancel previous
    if (cAbortRef.current) cAbortRef.current.abort();
    const controller = new AbortController();
    cAbortRef.current = controller;

    setCLoading(true);
    try {
      const token = getToken();
      const base = import.meta.env.VITE_API_BASE || "http://localhost:4000";
      const p = fetch(`${base}/api/internet/connections?${cParams}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      }).then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j?.message || "Failed to load connections");
        return j;
      });

      const data = await withMinDelay(p, 300);
      setCItems(data.items || []);
      setCTotal(data.total || 0);
      setCPages(data.pages || 1);
    } catch (e) {
      if (e.name !== "AbortError") toast.error(e.message);
    } finally {
      setCLoading(false);
    }
  }

  useEffect(() => {
    if (tab !== "connections") return;
    loadConnections();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, cParams]);

  useEffect(() => {
    if (tab !== "connections") return;
    setCPage(1);
  }, [dcQ, cStatus, tab]);

  // Connections modal state
  const [cOpen, setCOpen] = useState(false);
  const [cEditId, setCEditId] = useState(null);
  const [cForm, setCForm] = useState({
    name: "",
    provider: "",
    location: "",
    accountNumber: "",
    routerModel: "",
    serialNumber: "",
    ipAddress: "",
    status: "active",
    remarks: "",
  });

  function openCreateConnection() {
    setCEditId(null);
    setCForm({
      name: "",
      provider: "",
      location: "",
      accountNumber: "",
      routerModel: "",
      serialNumber: "",
      ipAddress: "",
      status: "active",
      remarks: "",
    });
    setCOpen(true);
  }

  function openEditConnection(x) {
    setCEditId(x.id);
    setCForm({
      name: x.name || "",
      provider: x.provider || "",
      location: x.location || "",
      accountNumber: x.accountNumber || "",
      routerModel: x.routerModel || "",
      serialNumber: x.serialNumber || "",
      ipAddress: x.ipAddress || "",
      status: x.status || "active",
      remarks: x.remarks || "",
    });
    setCOpen(true);
  }

  function closeConnectionModal() {
    setCOpen(false);
    setCEditId(null);
  }

  async function saveConnection() {
    const payload = {
      name: cForm.name.trim(),
      provider: cForm.provider.trim(),
      location: cForm.location.trim(),
      accountNumber: cForm.accountNumber.trim(),
      routerModel: cForm.routerModel.trim(),
      serialNumber: cForm.serialNumber.trim(),
      ipAddress: cForm.ipAddress.trim(),
      status: cForm.status,
      remarks: cForm.remarks.trim(),
    };
    if (!payload.name) return toast.error("Name is required.");

    setCBusyId(cEditId || "create");
    try {
      const token = getToken();
      if (!cEditId) {
        await apiFetch("/api/internet/connections", {
          method: "POST",
          token,
          body: payload,
        });
        toast.success("Connection created");
      } else {
        await apiFetch(`/api/internet/connections/${cEditId}`, {
          method: "PATCH",
          token,
          body: payload,
        });
        toast.success("Connection updated");
      }
      closeConnectionModal();
      await loadConnections();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setCBusyId(null);
    }
  }

  async function deleteConnection(id) {
    const x = cItems.find((i) => i.id === id);
    if (!x) return;
    const ok = window.confirm(`Delete connection "${x.name}"?`);
    if (!ok) return;

    setCBusyId(id);
    try {
      const token = getToken();
      await apiFetch(`/api/internet/connections/${id}`, {
        method: "DELETE",
        token,
      });
      toast.success("Connection deleted");
      if (cItems.length === 1 && cPage > 1) setCPage((p) => p - 1);
      else await loadConnections();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setCBusyId(null);
    }
  }

  async function exportConnections() {
    try {
      const filename = "internet_connections.xlsx";
      const sp = new URLSearchParams();
      if (dcQ.trim()) sp.set("q", dcQ.trim());
      if (cStatus) sp.set("status", cStatus);
      await downloadWithAuth(
        `/api/internet/connections/export.xlsx?${sp.toString()}`,
        filename
      );
      toast.success("Export downloaded");
    } catch (e) {
      toast.error(e.message);
    }
  }

  // -------------------------
  // Summery
  // -------------------------

  const [uSummary, setUSummary] = useState(null);
  const [uSummaryLoading, setUSummaryLoading] = useState(false);

  async function loadUsageSummary() {
    setUSummaryLoading(true);
    try {
      const token = getToken();
      const sp = new URLSearchParams();
      sp.set("month", uMonth);
      sp.set("months", "6");
      const data = await apiFetch(
        `/api/internet/usage/summary?${sp.toString()}`,
        { token }
      );
      setUSummary(data);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setUSummaryLoading(false);
    }
  }

  // -------------------------
  // PACKAGES TAB
  // -------------------------
  const [pMonth, setPMonth] = useState(ymNow());
  const [pConnId, setPConnId] = useState("");
  const [pItems, setPItems] = useState([]);
  const [pTotal, setPTotal] = useState(0);
  const [pPages, setPPages] = useState(1);
  const [pPage, setPPage] = useState(1);
  const pLimit = 10;
  const [pLoading, setPLoading] = useState(true);
  const [pBusyId, setPBusyId] = useState(null);

  const pAbortRef = useRef(null);

  const pParams = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set("page", String(pPage));
    sp.set("limit", String(pLimit));
    sp.set("month", pMonth);
    if (pConnId) sp.set("connectionId", pConnId);
    return sp.toString();
  }, [pPage, pLimit, pMonth, pConnId]);

  async function loadPackages() {
    if (pAbortRef.current) pAbortRef.current.abort();
    const controller = new AbortController();
    pAbortRef.current = controller;

    setPLoading(true);
    try {
      const token = getToken();
      const base = import.meta.env.VITE_API_BASE || "http://localhost:4000";

      const p = fetch(`${base}/api/internet/packages?${pParams}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      }).then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j?.message || "Failed to load packages");
        return j;
      });

      const data = await withMinDelay(p, 300);
      setPItems(data.items || []);
      setPTotal(data.total || 0);
      setPPages(data.pages || 1);
    } catch (e) {
      if (e.name !== "AbortError") toast.error(e.message);
    } finally {
      setPLoading(false);
    }
  }

  useEffect(() => {
    if (tab !== "packages") return;
    loadPackages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, pParams]);

  useEffect(() => {
    if (tab !== "packages") return;
    setPPage(1);
  }, [pMonth, pConnId, tab]);

  // Package modal
  const [pOpen, setPOpen] = useState(false);
  const [pEditId, setPEditId] = useState(null);
  const [pForm, setPForm] = useState({
    connectionId: "",
    month: ymNow(),
    packageName: "",
    dataLimitGB: "",
    cost: "",
    currency: "LKR",
    remarks: "",
  });

  function openCreatePackage() {
    setPEditId(null);
    setPForm({
      connectionId: pConnId || "",
      month: pMonth,
      packageName: "",
      dataLimitGB: "",
      cost: "",
      currency: "LKR",
      remarks: "",
    });
    setPOpen(true);
  }

  function openEditPackage(x) {
    setPEditId(x.id);
    setPForm({
      connectionId: x.connectionId || x.connection?._id || "",
      month: pMonth,
      packageName: x.packageName || "",
      dataLimitGB: x.dataLimitGB == null ? "" : String(x.dataLimitGB),
      cost: x.cost == null ? "" : String(x.cost),
      currency: x.currency || "LKR",
      remarks: x.remarks || "",
    });
    setPOpen(true);
  }

  function closePackageModal() {
    setPOpen(false);
    setPEditId(null);
  }

  async function savePackage() {
    const payload = {
      connectionId: pForm.connectionId,
      month: pForm.month,
      packageName: pForm.packageName.trim(),
      dataLimitGB: pForm.dataLimitGB === "" ? null : Number(pForm.dataLimitGB),
      cost: pForm.cost === "" ? null : Number(pForm.cost),
      currency: (pForm.currency || "LKR").trim(),
      remarks: pForm.remarks.trim(),
    };

    if (!payload.connectionId) return toast.error("Select a connection.");
    if (!payload.month) return toast.error("Month is required.");
    if (!payload.packageName) return toast.error("Package name is required.");
    if (payload.dataLimitGB != null && !Number.isFinite(payload.dataLimitGB))
      return toast.error("Invalid data limit.");
    if (payload.cost != null && !Number.isFinite(payload.cost))
      return toast.error("Invalid cost.");

    setPBusyId(pEditId || "create");
    try {
      const token = getToken();
      if (!pEditId) {
        await apiFetch("/api/internet/packages", {
          method: "POST",
          token,
          body: payload,
        });
        toast.success("Package created");
      } else {
        await apiFetch(`/api/internet/packages/${pEditId}`, {
          method: "PATCH",
          token,
          body: {
            packageName: payload.packageName,
            dataLimitGB: payload.dataLimitGB,
            cost: payload.cost,
            currency: payload.currency,
            remarks: payload.remarks,
          },
        });
        toast.success("Package updated");
      }
      closePackageModal();
      await loadPackages();
    } catch (e) {
      // common: unique violation for {connectionId, month}
      toast.error(e.message);
    } finally {
      setPBusyId(null);
    }
  }

  async function deletePackage(id) {
    const x = pItems.find((i) => i.id === id);
    if (!x) return;
    const ok = window.confirm(`Delete package "${x.packageName}"?`);
    if (!ok) return;

    setPBusyId(id);
    try {
      const token = getToken();
      await apiFetch(`/api/internet/packages/${id}`, {
        method: "DELETE",
        token,
      });
      toast.success("Package deleted");
      if (pItems.length === 1 && pPage > 1) setPPage((p) => p - 1);
      else await loadPackages();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setPBusyId(null);
    }
  }

  async function exportPackages() {
    try {
      const sp = new URLSearchParams();
      sp.set("month", pMonth);
      if (pConnId) sp.set("connectionId", pConnId);
      await downloadWithAuth(
        `/api/internet/packages/export.xlsx?${sp.toString()}`,
        `internet_packages_${pMonth}.xlsx`
      );
      toast.success("Export downloaded");
    } catch (e) {
      toast.error(e.message);
    }
  }

  // -------------------------
  // USAGE TAB
  // -------------------------
  const [uMonth, setUMonth] = useState(ymNow());
  const [uQ, setUQ] = useState("");
  const duQ = useDebounced(uQ, 250);

  const [uItems, setUItems] = useState([]);
  const [uTotal, setUTotal] = useState(0);
  const [uPages, setUPages] = useState(1);
  const [uPage, setUPage] = useState(1);
  const uLimit = 10;
  const [uLoading, setULoading] = useState(true);
  const [uBusyId, setUBusyId] = useState(null);

  const uAbortRef = useRef(null);

  const uParams = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set("page", String(uPage));
    sp.set("limit", String(uLimit));
    sp.set("month", uMonth);
    if (duQ.trim()) sp.set("q", duQ.trim());
    return sp.toString();
  }, [uPage, uLimit, uMonth, duQ]);

  useEffect(() => {
    if (tab !== "usage") return;
    loadUsageSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, uMonth]);

  async function loadUsage() {
    if (uAbortRef.current) uAbortRef.current.abort();
    const controller = new AbortController();
    uAbortRef.current = controller;

    setULoading(true);
    try {
      const token = getToken();
      const base = import.meta.env.VITE_API_BASE || "http://localhost:4000";

      const p = fetch(`${base}/api/internet/usage?${uParams}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      }).then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j?.message || "Failed to load usage");
        return j;
      });

      const data = await withMinDelay(p, 350);
      setUItems(data.items || []);
      setUTotal(data.total || 0);
      setUPages(data.pages || 1);
    } catch (e) {
      if (e.name !== "AbortError") toast.error(e.message);
    } finally {
      setULoading(false);
    }
  }

  useEffect(() => {
    if (tab !== "usage") return;
    loadUsage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, uParams]);

  useEffect(() => {
    if (tab !== "usage") return;
    setUPage(1);
  }, [uMonth, duQ, tab]);

  // inline editing
  const [uEditId, setUEditId] = useState(null);
  const [uForm, setUForm] = useState({
    startReadingGB: "",
    endReadingGB: "",
    manualUsedGB: "",
    remarks: "",
  });

  function startUsageEdit(r) {
    setUEditId(r.id);
    setUForm({
      startReadingGB: r.startReadingGB == null ? "" : String(r.startReadingGB),
      endReadingGB: r.endReadingGB == null ? "" : String(r.endReadingGB),
      manualUsedGB: r.manualUsedGB == null ? "" : String(r.manualUsedGB),
      remarks: r.remarks || "",
    });
  }

  function cancelUsageEdit() {
    setUEditId(null);
    setUForm({
      startReadingGB: "",
      endReadingGB: "",
      manualUsedGB: "",
      remarks: "",
    });
  }

  async function saveUsageEdit(id) {
    const payload = {
      startReadingGB:
        uForm.startReadingGB === "" ? null : Number(uForm.startReadingGB),
      endReadingGB:
        uForm.endReadingGB === "" ? null : Number(uForm.endReadingGB),
      manualUsedGB:
        uForm.manualUsedGB === "" ? null : Number(uForm.manualUsedGB),
      remarks: uForm.remarks.trim(),
    };

    for (const k of ["startReadingGB", "endReadingGB", "manualUsedGB"]) {
      const v = payload[k];
      if (v != null && !Number.isFinite(v))
        return toast.error("Invalid number value.");
      if (v != null && v < 0) return toast.error("Values cannot be negative.");
    }

    setUBusyId(id);
    try {
      const token = getToken();
      await apiFetch(`/api/internet/usage/${id}`, {
        method: "PATCH",
        token,
        body: payload,
      });
      toast.success("Usage updated");
      cancelUsageEdit();
      await loadUsage();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setUBusyId(null);
    }
  }

  async function generateMonth() {
    setUBusyId("gen");
    try {
      const token = getToken();
      const sp = new URLSearchParams();
      sp.set("month", uMonth);
      const data = await apiFetch(
        `/api/internet/usage/generate-month?${sp.toString()}`,
        {
          method: "POST",
          token,
        }
      );
      toast.success(`Generated: ${data.created || 0}`);
      await loadUsage();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setUBusyId(null);
    }
  }

  async function exportUsage() {
    try {
      const sp = new URLSearchParams();
      sp.set("month", uMonth);
      await downloadWithAuth(
        `/api/internet/usage/export.xlsx?${sp.toString()}`,
        `internet_usage_${uMonth}.xlsx`
      );
      toast.success("Export downloaded");
    } catch (e) {
      toast.error(e.message);
    }
  }

  // -------------------------
  // Shared: Connection options for Packages select
  // (we fetch once, small set, fast)
  // -------------------------
  const [connOptions, setConnOptions] = useState([]);
  const [connOptLoading, setConnOptLoading] = useState(false);

  async function loadConnOptionsOnce() {
    if (connOptions.length) return;
    setConnOptLoading(true);
    try {
      const token = getToken();
      // load up to 200 active connections for dropdown
      const data = await apiFetch(
        `/api/internet/connections?page=1&limit=200&status=active`,
        { token }
      );
      setConnOptions(data.items || []);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setConnOptLoading(false);
    }
  }

  useEffect(() => {
    if (tab === "packages" || tab === "usage") loadConnOptionsOnce();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // -------------------------
  // UI
  // -------------------------
  const tabs = [
    { id: "connections", label: "Connections", icon: Wifi },
    { id: "packages", label: "Packages", icon: Package },
    { id: "usage", label: "Usage", icon: BarChart3 },
  ];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
            <Globe className="h-5 w-5 text-slate-600" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Internet Tracking
            </h1>
            <p className="text-sm text-slate-500">
              Track connections, packages, and monthly data usage
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {tab === "connections" && (
            <>
              <button
                onClick={exportConnections}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <Download className="h-4 w-4" />
                Export
              </button>
              <button
                onClick={openCreateConnection}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
              >
                <Plus className="h-4 w-4" />
                New Connection
              </button>
            </>
          )}

          {tab === "packages" && (
            <>
              <button
                onClick={exportPackages}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <Download className="h-4 w-4" />
                Export
              </button>
              <button
                onClick={openCreatePackage}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
              >
                <Plus className="h-4 w-4" />
                New Package
              </button>
            </>
          )}

          {tab === "usage" && (
            <>
              <button
                onClick={exportUsage}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <Download className="h-4 w-4" />
                Export
              </button>
              <button
                onClick={generateMonth}
                disabled={uBusyId === "gen"}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                <RefreshCw className="h-4 w-4" />
                {uBusyId === "gen" ? "Generating..." : "Generate Month"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-2">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-slate-900 text-white"
                  : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* CONNECTIONS TAB */}
      {tab === "connections" && (
        <>
          <div className="mb-5 grid gap-4 md:grid-cols-3">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                value={cQ}
                onChange={(e) => setCQ(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 pl-10 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                placeholder="Search connections..."
              />
            </div>

            <select
              value={cStatus}
              onChange={(e) => setCStatus(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>

            <div className="flex items-center justify-between rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm">
              <div className="text-slate-700">
                <span className="text-slate-500">Total:</span>{" "}
                <span className="font-medium text-slate-900">{cTotal}</span>
              </div>
              <div className="text-slate-700">
                <span className="text-slate-500">Page:</span>{" "}
                <span className="font-medium text-slate-900">{cPage}</span> /{" "}
                <span className="font-medium text-slate-900">{cPages}</span>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="grid grid-cols-12 gap-4 border-b border-slate-200 bg-slate-50/50 px-5 py-4 text-xs font-medium uppercase tracking-wide text-slate-500">
              <div className="col-span-4">Name</div>
              <div className="col-span-2">Provider</div>
              <div className="col-span-2">Location</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2 text-right">Actions</div>
            </div>

            {cLoading ? (
              <div className="space-y-3 p-5">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="grid grid-cols-12 gap-4">
                    <Skeleton className="col-span-4 h-10" />
                    <Skeleton className="col-span-2 h-10" />
                    <Skeleton className="col-span-2 h-10" />
                    <Skeleton className="col-span-2 h-10" />
                    <Skeleton className="col-span-2 h-10" />
                  </div>
                ))}
              </div>
            ) : cItems.length === 0 ? (
              <div className="p-6 text-sm text-slate-600">
                No connections found.
              </div>
            ) : (
              <div className="divide-y divide-slate-100/80">
                {cItems.map((x) => {
                  const isBusy = cBusyId === x.id;
                  return (
                    <div
                      key={x.id}
                      className="grid grid-cols-12 gap-4 px-5 py-4 text-sm transition-colors hover:bg-slate-50/50"
                    >
                      <div className="col-span-4">
                        <div className="font-medium text-slate-900">
                          {x.name}
                        </div>
                        <div className="text-xs text-slate-500">
                          {x.ipAddress || x.routerModel || "—"}
                        </div>
                      </div>
                      <div className="col-span-2 text-slate-700">
                        {x.provider || "—"}
                      </div>
                      <div className="col-span-2 text-slate-700">
                        {x.location || "—"}
                      </div>
                      <div className="col-span-2">
                        <span
                          className={`inline-flex rounded-full px-3 py-1.5 text-xs font-medium ${
                            x.status === "active"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {x.status}
                        </span>
                      </div>
                      <div className="col-span-2 flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditConnection(x)}
                          disabled={isBusy}
                          className="inline-flex items-center rounded-lg border border-slate-300 bg-white p-2 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                          title="Edit"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => deleteConnection(x.id)}
                          disabled={isBusy}
                          className="inline-flex items-center rounded-lg border border-red-200 bg-red-50 p-2 text-red-700 hover:bg-red-100 disabled:opacity-50"
                          title="Delete"
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

          <div className="mt-6 flex items-center justify-end gap-2">
            <button
              onClick={() => setCPage((p) => Math.max(1, p - 1))}
              disabled={cPage <= 1 || cLoading}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </button>
            <button
              onClick={() => setCPage((p) => Math.min(cPages, p + 1))}
              disabled={cPage >= cPages || cLoading}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </>
      )}

      {/* PACKAGES TAB */}
      {tab === "packages" && (
        <>
          <div className="mb-5 grid gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Month
              </label>
              <input
                type="month"
                value={pMonth}
                onChange={(e) => setPMonth(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Connection
              </label>
              <select
                value={pConnId}
                onChange={(e) => setPConnId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
              >
                <option value="">All connections</option>
                {connOptLoading ? <option>Loading...</option> : null}
                {connOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm">
              <div className="text-slate-700">
                <span className="text-slate-500">Total:</span>{" "}
                <span className="font-medium text-slate-900">{pTotal}</span>
              </div>
              <div className="text-slate-700">
                <span className="text-slate-500">Page:</span>{" "}
                <span className="font-medium text-slate-900">{pPage}</span> /{" "}
                <span className="font-medium text-slate-900">{pPages}</span>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="grid grid-cols-12 gap-4 border-b border-slate-200 bg-slate-50/50 px-5 py-4 text-xs font-medium uppercase tracking-wide text-slate-500">
              <div className="col-span-4">Connection</div>
              <div className="col-span-3">Package</div>
              <div className="col-span-2">Limit (GB)</div>
              <div className="col-span-2">Cost</div>
              <div className="col-span-1 text-right">Actions</div>
            </div>

            {pLoading ? (
              <div className="space-y-3 p-5">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="grid grid-cols-12 gap-4">
                    <Skeleton className="col-span-4 h-10" />
                    <Skeleton className="col-span-3 h-10" />
                    <Skeleton className="col-span-2 h-10" />
                    <Skeleton className="col-span-2 h-10" />
                    <Skeleton className="col-span-1 h-10" />
                  </div>
                ))}
              </div>
            ) : pItems.length === 0 ? (
              <div className="p-6 text-sm text-slate-600">
                No packages found for this month.
              </div>
            ) : (
              <div className="divide-y divide-slate-100/80">
                {pItems.map((x) => {
                  const isBusy = pBusyId === x.id;
                  const conn = x.connection?.name || "—";
                  const lim =
                    x.dataLimitGB == null ? "Unlimited" : x.dataLimitGB;
                  const cost =
                    x.cost == null ? "—" : `${x.cost} ${x.currency || "LKR"}`;

                  return (
                    <div
                      key={x.id}
                      className="grid grid-cols-12 gap-4 px-5 py-4 text-sm transition-colors hover:bg-slate-50/50"
                    >
                      <div className="col-span-4">
                        <div className="font-medium text-slate-900">{conn}</div>
                        <div className="text-xs text-slate-500">
                          {x.connection?.provider || "—"}
                        </div>
                      </div>
                      <div className="col-span-3 text-slate-700">
                        {x.packageName}
                      </div>
                      <div className="col-span-2 text-slate-700">{lim}</div>
                      <div className="col-span-2 text-slate-700">{cost}</div>
                      <div className="col-span-1 flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditPackage(x)}
                          disabled={isBusy}
                          className="inline-flex items-center rounded-lg border border-slate-300 bg-white p-2 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                          title="Edit"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => deletePackage(x.id)}
                          disabled={isBusy}
                          className="inline-flex items-center rounded-lg border border-red-200 bg-red-50 p-2 text-red-700 hover:bg-red-100 disabled:opacity-50"
                          title="Delete"
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

          <div className="mt-6 flex items-center justify-end gap-2">
            <button
              onClick={() => setPPage((p) => Math.max(1, p - 1))}
              disabled={pPage <= 1 || pLoading}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </button>
            <button
              onClick={() => setPPage((p) => Math.min(pPages, p + 1))}
              disabled={pPage >= pPages || pLoading}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </>
      )}

      {/* USAGE TAB */}
      {tab === "usage" && (
        <>
          <div className="mb-5 grid gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Month
              </label>
              <input
                type="month"
                value={uMonth}
                onChange={(e) => setUMonth(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
              />
            </div>

            <div className="relative">
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Search
              </label>
              <Search className="absolute left-3 top-[2.45rem] h-4 w-4 text-slate-400" />
              <input
                value={uQ}
                onChange={(e) => setUQ(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 pl-10 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                placeholder="Name / provider / location..."
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm">
              <div className="text-slate-700">
                <span className="text-slate-500">Total:</span>{" "}
                <span className="font-medium text-slate-900">{uTotal}</span>
              </div>
              <div className="text-slate-700">
                <span className="text-slate-500">Page:</span>{" "}
                <span className="font-medium text-slate-900">{uPage}</span> /{" "}
                <span className="font-medium text-slate-900">{uPages}</span>
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="mb-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Company Usage ({uMonth})
                </div>

                {uSummaryLoading ? (
                  <div className="mt-2">
                    <Skeleton className="h-8 w-44" />
                    <Skeleton className="mt-3 h-20 w-72" />
                  </div>
                ) : (
                  <>
                    <div className="mt-2 text-3xl font-semibold text-slate-900">
                      {(uSummary?.currentTotalUsedGB || 0).toFixed(1)} GB
                    </div>
                    <div className="mt-1 text-sm text-slate-500">
                      Last {uSummary?.months || 6} months trend
                    </div>
                  </>
                )}
              </div>

              <div className="h-24 w-full max-w-md">
                {uSummaryLoading ? (
                  <Skeleton className="h-24 w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={uSummary?.series || []}
                      margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                    >
                      <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Area
                        type="monotone"
                        dataKey="totalUsedGB"
                        strokeWidth={2}
                        fillOpacity={0.2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="grid grid-cols-12 gap-4 border-b border-slate-200 bg-slate-50/50 px-5 py-4 text-xs font-medium uppercase tracking-wide text-slate-500">
              <div className="col-span-3">Connection</div>
              <div className="col-span-2">Package</div>
              <div className="col-span-1">Limit</div>
              <div className="col-span-1">Used</div>
              <div className="col-span-2">% / Status</div>
              <div className="col-span-3">Readings / Manual / Remarks</div>
            </div>

            {uLoading ? (
              <div className="space-y-3 p-5">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="grid grid-cols-12 gap-4">
                    <Skeleton className="col-span-3 h-10" />
                    <Skeleton className="col-span-2 h-10" />
                    <Skeleton className="col-span-1 h-10" />
                    <Skeleton className="col-span-1 h-10" />
                    <Skeleton className="col-span-2 h-10" />
                    <Skeleton className="col-span-3 h-10" />
                  </div>
                ))}
              </div>
            ) : uItems.length === 0 ? (
              <div className="p-6 text-sm text-slate-600">
                No usage rows found. Click <b>Generate Month</b> to create rows
                for all active connections.
              </div>
            ) : (
              <div className="divide-y divide-slate-100/80">
                {uItems.map((r) => {
                  const isEditing = uEditId === r.id;
                  const isBusy = uBusyId === r.id;

                  const badge = pctBar(r.percent);

                  const limitTxt = r.limitGB == null ? "—" : r.limitGB;
                  const usedTxt = r.usedGB ?? 0;

                  return (
                    <div
                      key={r.id}
                      className="grid grid-cols-12 gap-4 px-5 py-4 text-sm hover:bg-slate-50/50"
                    >
                      <div className="col-span-3">
                        <div className="font-medium text-slate-900">
                          {r.connectionName}
                        </div>
                        <div className="text-xs text-slate-500">
                          {r.provider || "—"} • {r.location || "—"}
                        </div>
                      </div>

                      <div className="col-span-2 text-slate-700">
                        {r.packageName || "—"}
                      </div>
                      <div className="col-span-1 text-slate-700">
                        {limitTxt}
                      </div>
                      <div className="col-span-1 font-medium text-slate-900">
                        {usedTxt}
                      </div>

                      <div className="col-span-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex rounded-full px-3 py-1.5 text-xs font-medium ${badge.cls}`}
                          >
                            {badge.label}
                            {r.percent != null ? ` • ${r.percent}%` : ""}
                          </span>
                          {r.percent != null && r.percent >= 95 ? (
                            <AlertTriangle className="h-4 w-4 text-rose-500" />
                          ) : null}
                        </div>
                        {r.limitGB != null ? (
                          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full bg-slate-900"
                              style={{
                                width: `${Math.min(
                                  100,
                                  Math.max(0, r.percent || 0)
                                )}%`,
                              }}
                            />
                          </div>
                        ) : (
                          <div className="mt-2 text-xs text-slate-400">
                            No limit
                          </div>
                        )}
                      </div>

                      <div className="col-span-3">
                        {isEditing ? (
                          <div className="space-y-2">
                            <div className="grid grid-cols-3 gap-2">
                              <input
                                disabled={isBusy}
                                value={uForm.startReadingGB}
                                onChange={(e) =>
                                  setUForm((p) => ({
                                    ...p,
                                    startReadingGB: e.target.value,
                                  }))
                                }
                                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-slate-100"
                                placeholder="Start"
                              />
                              <input
                                disabled={isBusy}
                                value={uForm.endReadingGB}
                                onChange={(e) =>
                                  setUForm((p) => ({
                                    ...p,
                                    endReadingGB: e.target.value,
                                  }))
                                }
                                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-slate-100"
                                placeholder="End"
                              />
                              <input
                                disabled={isBusy}
                                value={uForm.manualUsedGB}
                                onChange={(e) =>
                                  setUForm((p) => ({
                                    ...p,
                                    manualUsedGB: e.target.value,
                                  }))
                                }
                                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-slate-100"
                                placeholder="Manual"
                              />
                            </div>
                            <input
                              disabled={isBusy}
                              value={uForm.remarks}
                              onChange={(e) =>
                                setUForm((p) => ({
                                  ...p,
                                  remarks: e.target.value,
                                }))
                              }
                              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-slate-100"
                              placeholder="Remarks"
                            />

                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => saveUsageEdit(r.id)}
                                disabled={isBusy}
                                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                              >
                                <Check className="h-4 w-4" />
                                {isBusy ? "Saving..." : "Save"}
                              </button>
                              <button
                                onClick={cancelUsageEdit}
                                disabled={isBusy}
                                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                              >
                                <X className="h-4 w-4" />
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="text-xs text-slate-600">
                              Start:{" "}
                              <span className="font-medium text-slate-900">
                                {r.startReadingGB ?? "—"}
                              </span>{" "}
                              • End:{" "}
                              <span className="font-medium text-slate-900">
                                {r.endReadingGB ?? "—"}
                              </span>{" "}
                              • Manual:{" "}
                              <span className="font-medium text-slate-900">
                                {r.manualUsedGB ?? "—"}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <div className="text-xs text-slate-500 line-clamp-1">
                                {r.remarks || "—"}
                              </div>
                              <button
                                onClick={() => startUsageEdit(r)}
                                disabled={isBusy}
                                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                              >
                                <Edit2 className="h-4 w-4" />
                                Edit
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-6 flex items-center justify-end gap-2">
            <button
              onClick={() => setUPage((p) => Math.max(1, p - 1))}
              disabled={uPage <= 1 || uLoading}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </button>
            <button
              onClick={() => setUPage((p) => Math.min(uPages, p + 1))}
              disabled={uPage >= uPages || uLoading}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </>
      )}

      {/* CONNECTION MODAL */}
      {cOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {cEditId ? "Edit Connection" : "New Connection"}
                </h2>
                <p className="text-sm text-slate-500">Router/link details</p>
              </div>
              <button
                onClick={closeConnectionModal}
                className="rounded-lg p-2 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Name *
                </label>
                <input
                  value={cForm.name}
                  onChange={(e) =>
                    setCForm((p) => ({ ...p, name: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-100"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Provider
                </label>
                <input
                  value={cForm.provider}
                  onChange={(e) =>
                    setCForm((p) => ({ ...p, provider: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-100"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Location
                </label>
                <input
                  value={cForm.location}
                  onChange={(e) =>
                    setCForm((p) => ({ ...p, location: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-100"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Status
                </label>
                <select
                  value={cForm.status}
                  onChange={(e) =>
                    setCForm((p) => ({ ...p, status: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-100"
                >
                  <option value="active">active</option>
                  <option value="inactive">inactive</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Account #
                </label>
                <input
                  value={cForm.accountNumber}
                  onChange={(e) =>
                    setCForm((p) => ({ ...p, accountNumber: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-100"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Router Model
                </label>
                <input
                  value={cForm.routerModel}
                  onChange={(e) =>
                    setCForm((p) => ({ ...p, routerModel: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-100"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Serial
                </label>
                <input
                  value={cForm.serialNumber}
                  onChange={(e) =>
                    setCForm((p) => ({ ...p, serialNumber: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-100"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  IP Address
                </label>
                <input
                  value={cForm.ipAddress}
                  onChange={(e) =>
                    setCForm((p) => ({ ...p, ipAddress: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-100"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Remarks
                </label>
                <input
                  value={cForm.remarks}
                  onChange={(e) =>
                    setCForm((p) => ({ ...p, remarks: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-100"
                />
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={closeConnectionModal}
                disabled={cBusyId === (cEditId || "create")}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <X className="mr-2 inline h-4 w-4" /> Cancel
              </button>
              <button
                onClick={saveConnection}
                disabled={cBusyId === (cEditId || "create")}
                className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                <Save className="mr-2 h-4 w-4" />
                {cBusyId === (cEditId || "create") ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PACKAGE MODAL */}
      {pOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {pEditId ? "Edit Package" : "New Package"}
                </h2>
                <p className="text-sm text-slate-500">
                  Monthly plan for a connection
                </p>
              </div>
              <button
                onClick={closePackageModal}
                className="rounded-lg p-2 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Connection *
                </label>
                <select
                  value={pForm.connectionId}
                  onChange={(e) =>
                    setPForm((p) => ({ ...p, connectionId: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-100"
                >
                  <option value="">Select connection</option>
                  {connOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Month *
                </label>
                <input
                  type="month"
                  value={pForm.month}
                  onChange={(e) =>
                    setPForm((p) => ({ ...p, month: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-100"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Package Name *
                </label>
                <input
                  value={pForm.packageName}
                  onChange={(e) =>
                    setPForm((p) => ({ ...p, packageName: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-100"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Data Limit (GB)
                </label>
                <input
                  value={pForm.dataLimitGB}
                  onChange={(e) =>
                    setPForm((p) => ({ ...p, dataLimitGB: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-100"
                  placeholder="Leave empty for Unlimited"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Cost (LKR)
                </label>
                <input
                  value={pForm.cost}
                  onChange={(e) =>
                    setPForm((p) => ({ ...p, cost: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-100"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Remarks
                </label>
                <input
                  value={pForm.remarks}
                  onChange={(e) =>
                    setPForm((p) => ({ ...p, remarks: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-100"
                />
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={closePackageModal}
                disabled={pBusyId === (pEditId || "create")}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <X className="mr-2 inline h-4 w-4" /> Cancel
              </button>
              <button
                onClick={savePackage}
                disabled={pBusyId === (pEditId || "create")}
                className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                <Save className="mr-2 h-4 w-4" />
                {pBusyId === (pEditId || "create") ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

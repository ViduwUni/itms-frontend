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
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Laptop,
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

function toDateInputValue(v) {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function calcAgeYears(purchaseDate) {
  if (!purchaseDate) return "—";
  const d = new Date(purchaseDate);
  if (Number.isNaN(d.getTime())) return "—";
  const years = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
  if (years < 0) return "—";
  return `${years.toFixed(1)}y`;
}

function warrantyBadge(warrantyExpiry) {
  if (!warrantyExpiry) return { text: "—", cls: "bg-slate-100 text-slate-600" };

  const now = new Date();
  const exp = new Date(warrantyExpiry);
  if (Number.isNaN(exp.getTime()))
    return { text: "—", cls: "bg-slate-100 text-slate-600" };

  if (exp < now) return { text: "Expired", cls: "bg-red-100 text-red-800" };

  const days = Math.ceil(
    (exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (days <= 30)
    return { text: `Expiring (${days}d)`, cls: "bg-amber-100 text-amber-800" };

  return { text: "Active", cls: "bg-emerald-100 text-emerald-800" };
}

export default function Assets() {
  const [items, setItems] = useState([]);
  // eslint-disable-next-line no-unused-vars
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);

  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const [page, setPage] = useState(1);
  const [limit] = useState(10);

  const [q, setQ] = useState("");
  const dq = useDebounced(q, 250);

  const [department, setDepartment] = useState("");
  const [category, setCategory] = useState("");

  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [expiringSoon, setExpiringSoon] = useState(false);

  const [form, setForm] = useState({
    assetTag: "",
    name: "",
    category: "",
    brand: "",
    model: "",
    serialNumber: "",
    purchaseDate: "",
    warrantyExpiry: "",
    department: "",
    remarks: "",
  });

  const abortRef = useRef(null);

  const params = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set("page", String(page));
    sp.set("limit", String(limit));
    if (dq.trim()) sp.set("q", dq.trim());
    if (department.trim()) sp.set("department", department.trim());
    if (category.trim()) sp.set("category", category.trim());
    if (expiringSoon) sp.set("expiringSoon", "1");
    return sp.toString();
  }, [page, limit, dq, department, category, expiringSoon]);

  async function load() {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    try {
      const token = getToken();
      const base = import.meta.env.VITE_API_BASE || "http://localhost:4000";

      const fetchPromise = fetch(`${base}/api/assets?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      }).then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.message || "Failed to load assets");
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

  useEffect(() => {
    setPage(1);
  }, [dq, department, category, expiringSoon]);

  function startCreate() {
    setEditingId(null);
    setCreating(true);
    setForm({
      assetTag: "",
      name: "",
      category: "",
      brand: "",
      model: "",
      serialNumber: "",
      purchaseDate: "",
      warrantyExpiry: "",
      department: "",
      remarks: "",
    });
  }

  function cancelCreate() {
    setCreating(false);
  }

  function startEdit(a) {
    setCreating(false);
    setEditingId(a.id);
    setForm({
      assetTag: a.assetTag || "",
      name: a.name || "",
      category: a.category || "",
      brand: a.brand || "",
      model: a.model || "",
      serialNumber: a.serialNumber || "",
      purchaseDate: toDateInputValue(a.purchaseDate),
      warrantyExpiry: toDateInputValue(a.warrantyExpiry),
      department: a.department || "",
      remarks: a.remarks || "",
    });
  }

  function cancelEdit() {
    setEditingId(null);
  }

  function validate(payload) {
    if (
      !payload.assetTag ||
      !payload.name ||
      !payload.category ||
      !payload.department
    ) {
      toast.error("Asset Tag, Name, Category, and Department are required.");
      return false;
    }
    return true;
  }

  async function createAsset() {
    const payload = {
      ...form,
      assetTag: form.assetTag.trim(),
      name: form.name.trim(),
      category: form.category.trim(),
      brand: form.brand.trim(),
      model: form.model.trim(),
      serialNumber: form.serialNumber.trim(),
      department: form.department.trim(),
      remarks: form.remarks.trim(),
      purchaseDate: form.purchaseDate || null,
      warrantyExpiry: form.warrantyExpiry || null,
    };
    if (!validate(payload)) return;

    setBusyId("create");
    try {
      const token = getToken();
      await apiFetch("/api/assets", { method: "POST", body: payload, token });
      toast.success("Asset created");
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
      ...form,
      assetTag: form.assetTag.trim(),
      name: form.name.trim(),
      category: form.category.trim(),
      brand: form.brand.trim(),
      model: form.model.trim(),
      serialNumber: form.serialNumber.trim(),
      department: form.department.trim(),
      remarks: form.remarks.trim(),
      purchaseDate: form.purchaseDate || null,
      warrantyExpiry: form.warrantyExpiry || null,
    };
    if (!validate(payload)) return;

    setBusyId(id);
    try {
      const token = getToken();
      const data = await apiFetch(`/api/assets/${id}`, {
        method: "PATCH",
        body: payload,
        token,
      });
      setItems((prev) =>
        prev.map((x) => (x.id === id ? { ...x, ...data.item } : x))
      );
      toast.success("Asset updated");
      cancelEdit();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusyId(null);
    }
  }

  async function deleteAsset(id) {
    const a = items.find((x) => x.id === id);
    if (!a) return;

    const ok = window.confirm(`Delete asset "${a.assetTag}" (${a.name})?`);
    if (!ok) return;

    setBusyId(id);
    try {
      const token = getToken();
      await apiFetch(`/api/assets/${id}`, { method: "DELETE", token });
      setItems((prev) => prev.filter((x) => x.id !== id));
      toast.success("Asset deleted");
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

      const sp = new URLSearchParams();
      if (expiringSoon) sp.set("expiringSoon", "1");
      if (dq.trim()) sp.set("q", dq.trim());
      if (department.trim()) sp.set("department", department.trim());
      if (category.trim()) sp.set("category", category.trim());

      const url = `${base}/api/assets/export.xlsx?${sp.toString()}`;

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
      a.download = `assets_${ts}.xlsx`;

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
      <div className="mb-8 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
            <Laptop className="h-5 w-5 text-slate-600" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Asset Management
            </h1>
            <p className="text-sm text-slate-500">Track company assets</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={exportExcel}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            <Download className="h-4 w-4" />
            Export Excel
          </button>

          <button
            onClick={startCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800"
          >
            <Plus className="h-4 w-4" />
            Add Asset
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
            placeholder="Search tag / name / serial / dept / etc..."
          />
        </div>

        <input
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
          placeholder="Filter by department (optional)"
        />

        <input
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
          placeholder="Filter by category (optional)"
        />

        <button
          onClick={() => setExpiringSoon((v) => !v)}
          className={`rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
            expiringSoon
              ? "border-amber-300 bg-amber-50 text-amber-800"
              : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          Expiring ≤30d
        </button>
      </div>

      {/* Create form */}
      {creating && (
        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-3">
            {[
              ["assetTag", "Asset Tag *"],
              ["name", "Name *"],
              ["category", "Category *"],
              ["brand", "Brand"],
              ["model", "Model"],
              ["serialNumber", "Serial Number"],
              ["purchaseDate", "Purchase Date", "date"],
              ["warrantyExpiry", "Warranty Expiry", "date"],
              ["department", "Department *"],
            ].map(([key, label, type]) => (
              <div key={key}>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  {label}
                </label>
                <input
                  type={type || "text"}
                  value={form[key]}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, [key]: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                />
              </div>
            ))}

            <div className="md:col-span-3">
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Remarks
              </label>
              <textarea
                value={form.remarks}
                onChange={(e) =>
                  setForm((p) => ({ ...p, remarks: e.target.value }))
                }
                rows={3}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
              />
            </div>
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <button
              onClick={cancelCreate}
              disabled={busyId === "create"}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              <X className="mr-2 inline h-4 w-4" /> Cancel
            </button>
            <button
              onClick={createAsset}
              disabled={busyId === "create"}
              className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
            >
              <Save className="mr-2 h-4 w-4" />
              {busyId === "create" ? "Creating..." : "Create Asset"}
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {/* Table Header - Fixed 12-column grid */}
        <div className="grid grid-cols-12 gap-4 border-b border-slate-200 bg-slate-50/50 px-5 py-4 text-xs font-medium uppercase tracking-wide text-slate-500">
          <div className="col-span-1 px-2">Tag</div>
          <div className="col-span-2 px-2">Name</div>
          <div className="col-span-1 px-2">Category</div>
          <div className="col-span-2 px-2">Brand/Model</div>
          <div className="col-span-2 px-2">Serial</div>
          <div className="col-span-1 px-2">Age</div>
          <div className="col-span-1 px-2">Warranty</div>
          <div className="col-span-1 px-2">Dept</div>
          <div className="col-span-1 px-2 text-right">Actions</div>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="grid grid-cols-12 gap-4 px-5">
                <Skeleton className="col-span-1 h-10" />
                <Skeleton className="col-span-2 h-10" />
                <Skeleton className="col-span-1 h-10" />
                <Skeleton className="col-span-2 h-10" />
                <Skeleton className="col-span-2 h-10" />
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
              <Laptop className="h-8 w-8 text-slate-400" />
            </div>
            <p className="mt-4 text-sm font-medium text-slate-700">
              No assets found
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Add your first asset to get started
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100/80">
            {items.map((a) => {
              const isEditing = editingId === a.id;
              const isBusy = busyId === a.id;

              return (
                <div
                  key={a.id}
                  className="grid grid-cols-12 gap-4 px-5 py-4 text-sm transition-colors hover:bg-slate-50/50"
                >
                  {/* Tag Column */}
                  <div className="col-span-1 flex items-center px-2">
                    {isEditing ? (
                      <input
                        value={form.assetTag}
                        disabled={isBusy}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, assetTag: e.target.value }))
                        }
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                      />
                    ) : (
                      <div className="font-medium text-slate-900">
                        {a.assetTag}
                      </div>
                    )}
                  </div>

                  {/* Name Column */}
                  <div className="col-span-2 flex items-center px-2">
                    {isEditing ? (
                      <input
                        value={form.name}
                        disabled={isBusy}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, name: e.target.value }))
                        }
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                      />
                    ) : (
                      <div className="text-slate-800">{a.name}</div>
                    )}
                  </div>

                  {/* Category Column */}
                  <div className="col-span-1 flex items-center px-2">
                    {isEditing ? (
                      <input
                        value={form.category}
                        disabled={isBusy}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, category: e.target.value }))
                        }
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                      />
                    ) : (
                      <div className="text-slate-700">{a.category}</div>
                    )}
                  </div>

                  {/* Brand/Model Column */}
                  <div className="col-span-2 flex items-center px-2">
                    {isEditing ? (
                      <div className="grid gap-2 w-full">
                        <input
                          value={form.brand}
                          disabled={isBusy}
                          onChange={(e) =>
                            setForm((p) => ({ ...p, brand: e.target.value }))
                          }
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                          placeholder="Brand"
                        />
                        <input
                          value={form.model}
                          disabled={isBusy}
                          onChange={(e) =>
                            setForm((p) => ({ ...p, model: e.target.value }))
                          }
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                          placeholder="Model"
                        />
                      </div>
                    ) : (
                      <div className="text-slate-700">
                        {a.brand || "—"}
                        {a.model ? ` / ${a.model}` : ""}
                      </div>
                    )}
                  </div>

                  {/* Serial Column */}
                  <div className="col-span-2 flex items-center px-2">
                    {isEditing ? (
                      <input
                        value={form.serialNumber}
                        disabled={isBusy}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            serialNumber: e.target.value,
                          }))
                        }
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                      />
                    ) : (
                      <div className="text-slate-700">
                        {a.serialNumber || "—"}
                      </div>
                    )}
                  </div>

                  {/* Age Column */}
                  <div className="col-span-1 flex items-center px-2">
                    <span className="text-slate-700">
                      {calcAgeYears(a.purchaseDate)}
                    </span>
                  </div>

                  {/* Warranty Column */}
                  <div className="col-span-1 flex items-center px-2">
                    {(() => {
                      const b = warrantyBadge(a.warrantyExpiry);
                      return (
                        <span
                          className={`inline-block rounded-full px-3 py-1.5 text-xs font-medium ${b.cls}`}
                        >
                          {b.text}
                        </span>
                      );
                    })()}
                  </div>

                  {/* Department Column */}
                  <div className="col-span-1 flex items-center px-2">
                    {isEditing ? (
                      <input
                        value={form.department}
                        disabled={isBusy}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, department: e.target.value }))
                        }
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                      />
                    ) : (
                      <div className="text-slate-700">{a.department}</div>
                    )}
                  </div>

                  {/* Actions Column */}
                  <div className="col-span-1 flex items-center justify-end gap-2 px-2">
                    {isEditing ? (
                      <>
                        <button
                          onClick={() => saveEdit(a.id)}
                          disabled={isBusy}
                          className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
                          title="Save changes"
                        >
                          <Check className="h-3.5 w-3.5" />
                          {isBusy ? "" : "Save"}
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
                          onClick={() => startEdit(a)}
                          disabled={isBusy}
                          className="inline-flex items-center rounded-lg border border-slate-300 bg-white p-2 text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
                          title="Edit asset"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => deleteAsset(a.id)}
                          disabled={isBusy}
                          className="inline-flex items-center rounded-lg border border-red-200 bg-red-50 p-2 text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50"
                          title="Delete asset"
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

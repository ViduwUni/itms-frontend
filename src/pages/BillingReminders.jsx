import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { apiFetch } from "../api/client";
import { getToken } from "../auth/authStore";
import { Skeleton } from "../components/Loaders";
import { Plus, Save, Trash2, Send, RefreshCw } from "lucide-react";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";

function clampDay(n) {
  const x = Number(n || 1);
  return Math.max(1, Math.min(31, x));
}

export default function BillingReminders() {
  const token = useMemo(() => getToken(), []);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  // eslint-disable-next-line no-unused-vars
  const [config, setConfig] = useState(null);
  const [status, setStatus] = useState(null);

  // local edit fields
  const [title, setTitle] = useState("Monthly Bills Reminder");
  const [enabled, setEnabled] = useState(true);
  const [dayMode, setDayMode] = useState("lastDay");
  const [dayOfMonth, setDayOfMonth] = useState(28);
  const [timeHHmm, setTimeHHmm] = useState("09:30");
  const [categories, setCategories] = useState([]);
  const [extraEmails, setExtraEmails] = useState([]);
  const [newEmail, setNewEmail] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await apiFetch("/api/billing-reminders", { token });
      setConfig(res.config);
      setStatus(res.status);

      setTitle(res.config.title || "Monthly Bills Reminder");
      setEnabled(!!res.config.enabled);
      setDayMode(res.config.schedule?.dayMode || "lastDay");
      setDayOfMonth(res.config.schedule?.dayOfMonth || 28);
      setTimeHHmm(res.config.schedule?.timeHHmm || "09:30");
      setCategories(res.config.categories || []);
      setExtraEmails(res.config.extraEmails || []);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addCategory() {
    setCategories((p) => [
      ...p,
      { key: `custom_${Date.now()}`, label: "New Category" },
    ]);
  }

  function removeCategory(key) {
    setCategories((p) => p.filter((c) => c.key !== key));
  }

  function updateCategory(key, patch) {
    setCategories((p) =>
      p.map((c) => (c.key === key ? { ...c, ...patch } : c))
    );
  }

  function addEmail() {
    const e = newEmail.trim().toLowerCase();
    if (!e) return;
    if (!/^\S+@\S+\.\S+$/.test(e)) return toast.error("Invalid email");
    setExtraEmails((p) => Array.from(new Set([...p, e])));
    setNewEmail("");
  }

  function removeEmail(e) {
    setExtraEmails((p) => p.filter((x) => x !== e));
  }

  async function save() {
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        enabled,
        schedule: {
          dayMode,
          dayOfMonth: clampDay(dayOfMonth),
          timeHHmm,
          timezone: "Asia/Colombo",
        },
        categories: categories.map((c) => ({
          key: String(c.key || "").trim(),
          label: String(c.label || "").trim(),
        })),
        extraEmails,
      };

      const res = await apiFetch("/api/billing-reminders", {
        method: "PATCH",
        body: payload,
        token,
      });

      setConfig(res.config);
      setStatus(res.status);
      toast.success("Reminder settings saved");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function sendTest() {
    setTesting(true);
    try {
      await apiFetch("/api/billing-reminders/test", { method: "POST", token });
      toast.success("Test email sent");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setTesting(false);
    }
  }

  const statusLine = (() => {
    if (!status) return "—";
    const due = status.dueAt
      ? new Date(status.dueAt).toISOString().slice(0, 16).replace("T", " ")
      : "—";
    const sent = status.sentAt
      ? new Date(status.sentAt).toISOString().slice(0, 16).replace("T", " ")
      : null;

    if (!status.enabled) return "Disabled";
    if (status.status === "sent") return `Sent (${sent})`;
    if (status.overdue) return `Overdue (was due ${due})`;
    return `Next due: ${due}`;
  })();

  return (
    <div className="p-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
            <NotificationsActiveIcon className="h-5 w-5 text-slate-600" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Billing Reminders
            </h1>
            <p className="text-sm text-slate-500">
              Monthly invoice reminders (Admin + optional extra emails)
            </p>
          </div>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="mt-3 h-10 w-full" />
          <Skeleton className="mt-3 h-10 w-full" />
          <Skeleton className="mt-3 h-40 w-full" />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Left: Settings */}
          <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200 lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-900">
                Settings
              </div>
              <div className="text-xs text-slate-500">{statusLine}</div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Title
                </label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                />
              </div>

              <div className="flex items-end gap-3">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => setEnabled(e.target.checked)}
                  />
                  Enabled
                </label>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Day mode
                </label>
                <select
                  value={dayMode}
                  onChange={(e) => setDayMode(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                >
                  <option value="lastDay">Last day of month</option>
                  <option value="customDay">Custom day</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Custom day (1–31)
                </label>
                <input
                  type="number"
                  value={dayOfMonth}
                  disabled={dayMode !== "customDay"}
                  onChange={(e) => setDayOfMonth(clampDay(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 disabled:bg-slate-100"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Time (HH:mm)
                </label>
                <input
                  value={timeHHmm}
                  onChange={(e) => setTimeHHmm(e.target.value)}
                  placeholder="09:30"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                />
                <p className="mt-1 text-xs text-slate-500">
                  Timezone: Asia/Colombo
                </p>
              </div>
            </div>

            {/* Categories */}
            <div className="mt-6">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-900">
                  Categories
                </div>
                <button
                  onClick={addCategory}
                  className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800"
                >
                  <Plus className="h-4 w-4" />
                  Add category
                </button>
              </div>

              <div className="space-y-3">
                {categories.map((c) => (
                  <div
                    key={c.key}
                    className="grid gap-3 rounded-xl bg-slate-50 p-3 md:grid-cols-12"
                  >
                    <div className="md:col-span-5">
                      <label className="mb-1 block text-xs font-medium text-slate-600">
                        Key
                      </label>
                      <input
                        value={c.key}
                        onChange={(e) =>
                          updateCategory(c.key, { key: e.target.value })
                        }
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none"
                      />
                    </div>
                    <div className="md:col-span-6">
                      <label className="mb-1 block text-xs font-medium text-slate-600">
                        Label
                      </label>
                      <input
                        value={c.label}
                        onChange={(e) =>
                          updateCategory(c.key, { label: e.target.value })
                        }
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none"
                      />
                    </div>
                    <div className="md:col-span-1 flex items-end justify-end">
                      <button
                        onClick={() => removeCategory(c.key)}
                        className="rounded-lg border border-red-200 bg-red-50 p-2 text-red-700 hover:bg-red-100"
                        title="Remove"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Save/Test */}
            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                onClick={sendTest}
                disabled={testing}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                {testing ? "Sending..." : "Send test"}
              </button>

              <button
                onClick={save}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>

          {/* Right: Extra emails */}
          <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
            <div className="text-sm font-semibold text-slate-900">
              Extra emails
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Admin always receives it. Add more recipients here.
            </p>

            <div className="mt-4 flex gap-2">
              <input
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="someone@company.com"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none"
              />
              <button
                onClick={addEmail}
                className="rounded-lg bg-slate-900 px-3 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
              >
                Add
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {extraEmails.length === 0 ? (
                <div className="text-sm text-slate-500">
                  No extra recipients.
                </div>
              ) : (
                extraEmails.map((e) => (
                  <button
                    key={e}
                    onClick={() => removeEmail(e)}
                    className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
                    title="Click to remove"
                  >
                    {e}
                  </button>
                ))
              )}
            </div>

            <div className="mt-6 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
              <div>
                <b>Offline safe:</b> if server is down at due time, it sends
                when it’s back.
              </div>
              <div className="mt-2">
                <b>Status:</b> {statusLine}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

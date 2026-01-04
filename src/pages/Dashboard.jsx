import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../api/client";
import { getToken } from "../auth/authStore";
import { Skeleton } from "../components/Loaders";
import { toast } from "react-toastify";
import {
  Boxes,
  Users,
  Wrench,
  Hammer,
  ShieldAlert,
  RefreshCw,
  Activity,
  CalendarClock,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Legend,
} from "recharts";

async function withMinDelay(promise, minMs = 300) {
  const start = Date.now();
  const result = await promise;
  const elapsed = Date.now() - start;
  if (elapsed < minMs) {
    await new Promise((r) => setTimeout(r, minMs - elapsed));
  }
  return result;
}

function moneyLKR(amount) {
  const value = Number(amount || 0);
  return `LKR ${value.toLocaleString()}`;
}

// eslint-disable-next-line no-unused-vars
function KpiCard({ title, value, sub, icon: Icon, accent }) {
  const accents = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    red: "bg-rose-50 text-rose-600",
    violet: "bg-violet-50 text-violet-600",
  };

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {title}
          </p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{value}</p>
          {sub && <p className="mt-1 text-sm text-slate-500">{sub}</p>}
        </div>
        <div className={`rounded-xl p-3 ${accents[accent]}`}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [isLoading, setIsLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  const token = useMemo(() => getToken(), []);

  async function loadDashboardData() {
    setIsLoading(true);
    try {
      const res = await withMinDelay(
        apiFetch("/api/dashboard/summary", { token }),
        320
      );
      setDashboardData(res);
    } catch (e) {
      toast.error(e.message || "Failed to load dashboard data");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const kpis = dashboardData?.kpis || {};
  const alerts = dashboardData?.alerts || {};
  const charts = dashboardData?.charts || {};
  const recent = dashboardData?.recent || [];
  const dueWindowDays = dashboardData?.meta?.dueWindowDays || 14;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-[1600px] px-6 py-6">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">Dashboard</h1>
            <p className="mt-1 text-sm text-slate-500">
              Overview & alerts for next {dueWindowDays} days
            </p>
          </div>
          <button
            onClick={loadDashboardData}
            disabled={isLoading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus:ring-2 focus:ring-slate-300"
          >
            <RefreshCw
              className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        </div>

        {/* KPIs */}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {isLoading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-32 rounded-2xl bg-white p-5 ring-1 ring-slate-200"
              >
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="mt-4 h-8 w-2/3" />
                <Skeleton className="mt-2 h-4 w-1/3" />
              </div>
            ))
          ) : (
            <>
              <KpiCard
                title="Total Assets"
                value={kpis.totalAssets}
                sub={`Assigned: ${kpis.assignedAssets}`}
                icon={Boxes}
                accent="blue"
              />
              <KpiCard
                title="Unassigned Assets"
                value={kpis.unassignedAssets}
                sub="Ready to allocate"
                icon={Boxes}
                accent="amber"
              />
              <KpiCard
                title="Employees"
                value={kpis.totalEmployees}
                sub="Active directory"
                icon={Users}
                accent="violet"
              />
              <KpiCard
                title="Open Repairs"
                value={kpis.openRepairs}
                sub="Open + in progress"
                icon={Wrench}
                accent="red"
              />
              <KpiCard
                title="Open Maintenance"
                value={kpis.openMaintenance}
                sub="Open + in progress"
                icon={Hammer}
                accent="amber"
              />
              <KpiCard
                title="Renewals Due"
                value={kpis.renewalsDue}
                sub={`Next ${dueWindowDays} days`}
                icon={CalendarClock}
                accent="blue"
              />
              <KpiCard
                title="Warranty Expiring"
                value={kpis.warrantyDue}
                sub={`Next ${dueWindowDays} days`}
                icon={ShieldAlert}
                accent="red"
              />
              <KpiCard
                title="Internet Usage"
                value={`${(kpis.internetUsageThisMonthGB || 0).toFixed(1)} GB`}
                sub={moneyLKR(kpis.internetCostThisMonthLKR)}
                icon={Activity}
                accent="green"
              />
            </>
          )}
        </div>

        {/* Alerts + Charts */}
        <div className="mt-8 grid gap-6 xl:grid-cols-3">
          {/* Alerts */}
          <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
            <h3 className="text-sm font-semibold text-slate-900">
              Attention Needed
            </h3>
            <p className="text-sm text-slate-500">Next {dueWindowDays} days</p>

            <div className="mt-5 space-y-3">
              {[
                ["License renewals", alerts.renewalsDue],
                ["Warranty expiring", alerts.warrantyDue],
                ["Repairs overdue", alerts.repairsOverdue],
                ["Maintenance overdue", alerts.maintenanceOverdue],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 hover:bg-slate-100"
                >
                  <span className="text-sm text-slate-700">{label}</span>
                  <span className="text-lg font-semibold text-slate-900">
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Charts */}
          <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200 xl:col-span-2">
            <h3 className="text-sm font-semibold text-slate-900">Trends</h3>
            <p className="text-sm text-slate-500 mb-4">
              Last 6 months overview
            </p>

            <div className="grid gap-5 md:grid-cols-2">
              <div className="rounded-xl bg-slate-50 p-4 h-64">
                <ResponsiveContainer>
                  <BarChart data={charts.ticketTrend || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Bar
                      dataKey="repairs"
                      fill="#3b82f6"
                      radius={[2, 2, 0, 0]}
                    />
                    <Bar
                      dataKey="maintenance"
                      fill="#10b981"
                      radius={[2, 2, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="rounded-xl bg-slate-50 p-4 h-64">
                <ResponsiveContainer>
                  <LineChart data={charts.internetTrend || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="usedGB"
                      stroke="#8b5cf6"
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="costLKR"
                      stroke="#f59e0b"
                      strokeDasharray="5 5"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="mt-8 rounded-2xl bg-white p-5 ring-1 ring-slate-200">
          <h3 className="text-sm font-semibold text-slate-900">
            Recent Activity
          </h3>
          <p className="text-sm text-slate-500">Latest 10 updates</p>

          <div className="mt-5 divide-y divide-slate-100">
            {recent.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between py-3 px-2 rounded-lg hover:bg-slate-50"
              >
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                    {a.kind}
                  </span>
                  <span className="text-sm text-slate-900">{a.note}</span>
                </div>
                <span className="text-xs text-slate-500">
                  {new Date(a.createdAt).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

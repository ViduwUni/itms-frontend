export default function Dashboard({ user }) {
  return (
    <div>
      <h1 className="text-xl font-semibold">Dashboard</h1>
      <p className="mt-2 text-slate-600">
        Welcome{" "}
        <span className="font-medium text-slate-900">{user?.username}</span>!
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border p-4">
          <div className="text-sm text-slate-500">Role</div>
          <div className="mt-1 text-lg font-semibold">{user?.role}</div>
        </div>
        <div className="rounded-2xl border p-4">
          <div className="text-sm text-slate-500">Next</div>
          <div className="mt-1 text-slate-700">
            Build modules (assets, tickets, inventory…) on top of this shell.
          </div>
        </div>
      </div>
    </div>
  );
}

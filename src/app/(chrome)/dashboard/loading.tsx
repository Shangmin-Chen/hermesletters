export default function DashboardLoading() {
  return (
    <main className="flex flex-1 flex-col items-center p-4 pt-10 sm:p-6">
      <div className="w-full max-w-2xl space-y-6 animate-pulse">
        <div className="rounded-xl border border-border bg-card p-6 space-y-3">
          <div className="h-5 w-40 rounded bg-muted" />
          <div className="h-4 w-64 rounded bg-muted" />
          <div className="h-10 w-36 rounded bg-muted" />
        </div>
        <div className="rounded-xl border border-border bg-card p-6 space-y-3">
          <div className="h-5 w-32 rounded bg-muted" />
          <div className="h-4 w-52 rounded bg-muted" />
          <div className="h-4 w-full rounded bg-muted" />
          <div className="h-4 w-4/5 rounded bg-muted" />
        </div>
      </div>
    </main>
  );
}

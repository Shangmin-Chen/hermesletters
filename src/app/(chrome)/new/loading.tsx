export default function NewLetterLoading() {
  return (
    <main className="flex flex-1 flex-col items-center justify-start p-6 pt-8">
      <div className="w-full max-w-2xl space-y-2 animate-pulse">
        <div className="h-7 w-40 rounded bg-muted" />
        <div className="h-4 w-72 rounded bg-muted" />
        <div className="mt-6 space-y-8">
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <div className="h-5 w-24 rounded bg-muted" />
            <div className="h-10 w-full rounded bg-muted" />
            <div className="h-10 w-full rounded bg-muted" />
          </div>
          <div className="rounded-xl border border-border space-y-0 overflow-hidden">
            <div className="bg-muted/50 border-b border-border px-5 py-3">
              <div className="h-5 w-24 rounded bg-muted" />
            </div>
            <div className="bg-paper h-64" />
          </div>
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <div className="h-5 w-32 rounded bg-muted" />
            <div className="h-10 w-full rounded bg-muted" />
            <div className="h-10 w-full rounded bg-muted" />
          </div>
          <div className="h-12 w-full rounded bg-muted" />
        </div>
      </div>
    </main>
  );
}

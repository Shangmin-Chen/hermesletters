export default function ReceivedLetterLoading() {
  return (
    <main className="flex flex-1 flex-col p-4 pt-8 sm:p-6 sm:pt-12">
      <div className="mx-auto max-w-xl animate-pulse">
        <div className="mb-6 h-5 w-20 rounded bg-muted" />
        <div className="rounded-2xl border border-border bg-card shadow-md overflow-hidden">
          <div className="bg-muted border-b border-border px-6 py-8 text-center space-y-3">
            <div className="mx-auto h-14 w-14 rounded-full bg-muted-foreground/20" />
            <div className="mx-auto h-6 w-48 rounded bg-muted-foreground/20" />
            <div className="mx-auto h-4 w-36 rounded bg-muted-foreground/20" />
          </div>
          <div className="px-6 py-8 sm:px-10 space-y-3">
            <div className="h-4 w-full rounded bg-muted" />
            <div className="h-4 w-5/6 rounded bg-muted" />
            <div className="h-4 w-full rounded bg-muted" />
            <div className="h-4 w-4/5 rounded bg-muted" />
            <div className="h-4 w-full rounded bg-muted" />
          </div>
        </div>
      </div>
    </main>
  );
}

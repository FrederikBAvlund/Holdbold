export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-6">
      <div className="rounded-[1.375rem] border border-line bg-surface shadow-[var(--shadow-sm)] w-full max-w-md p-6 text-center sm:p-8">
        <h1 className="font-display text-4xl font-extrabold uppercase text-ink">
          Du er offline
        </h1>
        <p className="mt-3 text-ink/70">
          Holdbold kunne ikke hente ny data lige nu. Tjek internetforbindelsen og prøv igen.
        </p>
      </div>
    </main>
  );
}

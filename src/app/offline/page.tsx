export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-6">
      <div className="card w-full max-w-md p-8 text-center">
        <h1 className="text-3xl font-semibold text-ink" style={{ fontFamily: "var(--font-display)" }}>
          Du er offline
        </h1>
        <p className="mt-3 text-ink/70">
          Holdbold kunne ikke hente ny data lige nu. Tjek internetforbindelsen og proev igen.
        </p>
      </div>
    </main>
  );
}

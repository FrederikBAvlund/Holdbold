export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-6">
      <div className="card w-full max-w-md p-6 text-center sm:p-8">
        <h1 className="font-display text-3xl font-bold text-ink">
          Du er offline
        </h1>
        <p className="mt-3 text-ink/70">
          Holdbold kunne ikke hente ny data lige nu. Tjek internetforbindelsen og proev igen.
        </p>
      </div>
    </main>
  );
}

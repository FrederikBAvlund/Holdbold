import { redirect } from "next/navigation";

// Indstillinger er blevet til Profil. Gamle links og notifikationer sendes videre.
export default function IndstillingerRedirect({
  searchParams
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === "string") params.set(key, value);
  }
  const query = params.toString();
  redirect(`/dashboard/profil${query ? `?${query}` : ""}`);
}

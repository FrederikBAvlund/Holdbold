import Link from "next/link";
import { fineEventHref } from "./boderUtils";

export function FineEventLink({ event }: { event: { id: string; title: string; date: string } }) {
  return (
    <p className="mt-1 text-xs text-ink/60">
      <Link href={fineEventHref(event)} className="font-medium text-moss underline-offset-2 hover:underline">
        {event.title} · {new Date(event.date).toLocaleDateString("da-DK")}
      </Link>
    </p>
  );
}

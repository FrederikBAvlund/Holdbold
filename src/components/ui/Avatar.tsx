import { cn } from "@/lib/utils";

const AVATAR_TONES = [
  "bg-[#fde68a] text-[#78350f]",
  "bg-[#bfdbfe] text-[#1e3a8a]",
  "bg-[#bbf7d0] text-[#14532d]",
  "bg-[#fecdd3] text-[#881337]",
  "bg-[#ddd6fe] text-[#4c1d95]",
  "bg-[#fed7aa] text-[#7c2d12]",
  "bg-[#a5f3fc] text-[#164e63]"
];

export function initials(name: string | null | undefined) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function toneFor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}

const sizes = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-lg",
  xl: "h-20 w-20 text-2xl"
};

export default function Avatar({
  name,
  image,
  size = "md",
  className,
  ring
}: {
  name: string | null | undefined;
  image?: string | null;
  size?: keyof typeof sizes;
  className?: string;
  ring?: boolean;
}) {
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold",
        sizes[size],
        !image && toneFor(name ?? "?"),
        ring && "ring-2 ring-surface",
        className
      )}
      title={name ?? undefined}
    >
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" className="h-full w-full object-cover" loading="lazy" />
      ) : (
        initials(name)
      )}
    </span>
  );
}

export function AvatarStack({
  people,
  max = 4,
  size = "sm",
  ringClass = "ring-surface",
  className
}: {
  people: Array<{ id: string; name: string | null; image?: string | null }>;
  max?: number;
  size?: "xs" | "sm" | "md";
  ringClass?: string;
  className?: string;
}) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  return (
    <span className={cn("flex items-center", className)}>
      {shown.map((person, index) => (
        <Avatar
          key={person.id}
          name={person.name}
          image={person.image}
          size={size}
          className={cn("ring-2", ringClass, index > 0 && "-ml-2")}
        />
      ))}
      {rest > 0 ? (
        <span
          className={cn(
            "-ml-2 inline-flex items-center justify-center rounded-full bg-ink/10 font-bold text-ink/70 ring-2",
            ringClass,
            sizes[size]
          )}
        >
          +{rest}
        </span>
      ) : null}
    </span>
  );
}

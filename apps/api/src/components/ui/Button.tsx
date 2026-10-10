import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import Icon, { type IconName } from "@/components/ui/Icon";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "success" | "inverse";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-primary text-on-primary shadow-[0_8px_20px_-10px_var(--primary)] hover:brightness-105",
  secondary: "bg-ink/[0.06] text-ink hover:bg-ink/10",
  ghost: "text-ink/75 hover:bg-ink/[0.06] hover:text-ink",
  danger: "bg-danger/10 text-danger hover:bg-danger/15",
  success: "bg-in text-on-solid hover:brightness-105",
  inverse: "bg-on-primary/15 text-on-primary hover:bg-on-primary/25"
};

const sizes: Record<Size, string> = {
  sm: "min-h-9 px-3.5 text-sm gap-1.5 rounded-xl",
  md: "min-h-11 px-4 text-[0.9375rem] gap-2 rounded-2xl",
  lg: "min-h-[3.25rem] px-6 text-base gap-2 rounded-2xl"
};

/** Knap-udseende til links (<a>/<Link>), så de ligner Button. */
export function buttonClasses({
  variant = "primary",
  size = "md",
  block,
  className
}: {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  className?: string;
} = {}) {
  return cn(
    "inline-flex select-none items-center justify-center font-semibold transition duration-150 active:scale-[0.97]",
    variants[variant],
    sizes[size],
    block && "w-full",
    className
  );
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  iconRight?: IconName;
  loading?: boolean;
  block?: boolean;
  children?: ReactNode;
};

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent", className)}
    />
  );
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", icon, iconRight, loading, block, className, children, disabled, type, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type ?? "button"}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex select-none items-center justify-center font-semibold transition duration-150 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        // Handlingsknapper låses, når en lukket sæson vises (se SeasonReadOnlyMain).
        (variant === "primary" || variant === "success" || variant === "danger") && "season-lock",
        sizes[size],
        block && "w-full",
        className
      )}
      {...props}
    >
      {loading ? <Spinner /> : icon ? <Icon name={icon} className="h-[1.15em] w-[1.15em]" /> : null}
      {children}
      {iconRight && !loading ? <Icon name={iconRight} className="h-[1.15em] w-[1.15em]" /> : null}
    </button>
  );
});

export default Button;

export function IconButton({
  icon,
  label,
  variant = "secondary",
  className,
  badge,
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  icon: IconName;
  label: string;
  variant?: Variant;
  badge?: number;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition active:scale-95 disabled:opacity-50",
        variants[variant],
        className
      )}
      {...props}
    >
      <Icon name={icon} />
      {badge && badge > 0 ? <CountBadge count={badge} className="absolute -right-0.5 -top-0.5" /> : null}
    </button>
  );
}

export function CountBadge({ count, className }: { count: number; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-out px-1 text-[10px] font-bold leading-none text-white ring-2 ring-bg",
        className
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

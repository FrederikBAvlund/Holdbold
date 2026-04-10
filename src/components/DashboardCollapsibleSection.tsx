"use client";

import type { ReactNode } from "react";

type DashboardCollapsibleSectionProps = {
  id: string;
  title: ReactNode;
  collapsed: boolean;
  onToggle: () => void;
  className?: string;
  headingLevel?: "h2" | "h3";
  children: React.ReactNode;
};

export default function DashboardCollapsibleSection({
  id,
  title,
  collapsed,
  onToggle,
  className = "card-soft",
  headingLevel = "h3",
  children
}: DashboardCollapsibleSectionProps) {
  const Heading = headingLevel;
  return (
    <div className={className}>
      <button
        type="button"
        className="flex w-full items-start justify-between gap-3 text-left"
        onClick={onToggle}
        aria-expanded={!collapsed}
        aria-controls={`dashboard-section-${id}`}
      >
        <Heading className={headingLevel === "h2" ? "text-xl font-semibold text-ink" : "text-lg font-semibold text-ink"}>
          {title}
        </Heading>
        <span className="shrink-0 text-sm text-ink/45" aria-hidden>
          {collapsed ? "▶" : "▼"}
        </span>
      </button>
      {collapsed ? null : (
        <div id={`dashboard-section-${id}`} className="mt-3">
          {children}
        </div>
      )}
    </div>
  );
}

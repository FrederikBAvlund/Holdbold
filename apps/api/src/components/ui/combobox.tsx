"use client";

import * as React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

export type ComboboxOption = {
  value: string;
  label: string;
  rightLabel?: string;
  searchLabel?: string;
};

type ComboboxProps = {
  value: string;
  onChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  className?: string;
};

export function Combobox({
  value,
  onChange,
  options,
  placeholder = "Vælg...",
  searchPlaceholder = "Søg...",
  emptyLabel = "Ingen resultater",
  className
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const selected = options.find((option) => option.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "input flex w-full max-w-full items-center justify-between gap-2 overflow-hidden text-left",
            !selected && "text-ink/40",
            className
          )}
        >
          <span className="min-w-0 flex-1 truncate">{selected ? selected.label : placeholder}</span>
          {selected?.rightLabel ? (
            <span className="shrink-0 text-sm font-semibold text-ink/70 max-[380px]:hidden">{selected.rightLabel}</span>
          ) : null}
          <span className="shrink-0 text-xs">▾</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-1.5rem)] p-0"
        align="start"
        sideOffset={6}
      >
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyLabel}</CommandEmpty>
            {options.map((option) => (
              <CommandItem
                key={option.value}
                value={option.searchLabel ?? `${option.label} ${option.rightLabel ?? ""}`}
                onSelect={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                {option.rightLabel ? (
                  <span className="shrink-0 text-xs font-semibold text-ink/65">{option.rightLabel}</span>
                ) : null}
                {value === option.value ? <span className="ml-auto text-xs">✓</span> : null}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TabDef {
  id: string;
  label: string;
  icon?: LucideIcon;
  count?: number;
}

export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: TabDef[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="border-b border-border flex items-center gap-1 overflow-x-auto scroll-thin">
      {tabs.map((t) => {
        const on = t.id === active;
        const Icon = t.icon;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={cn(
              "relative px-3.5 py-2.5 text-sm font-medium whitespace-nowrap inline-flex items-center gap-2 transition-colors",
              on ? "text-navy-900" : "text-muted hover:text-ink",
            )}
          >
            {Icon && <Icon className="size-4" strokeWidth={2} />}
            {t.label}
            {typeof t.count === "number" && (
              <span className={cn("text-xs font-semibold rounded-full px-1.5 py-0.5", on ? "bg-navy-100 text-navy-800" : "bg-navy-50 text-muted")}>
                {t.count}
              </span>
            )}
            {on && <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-navy-900 rounded-full" />}
          </button>
        );
      })}
    </div>
  );
}

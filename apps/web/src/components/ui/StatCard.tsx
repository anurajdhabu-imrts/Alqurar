import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sparkline } from "./Sparkline";

type Tone = "navy" | "amber" | "success" | "warning" | "error";

const chipClasses: Record<Tone, string> = {
  navy: "bg-linear-to-br from-navy-600 to-navy-800 text-white shadow-navy",
  amber: "bg-linear-to-br from-amber-400 to-amber-500 text-[#2a1c04] shadow-glow",
  success: "bg-linear-to-br from-[#23a866] to-[#16794d] text-white",
  warning: "bg-linear-to-br from-[#ea9a2b] to-[#c2700a] text-white",
  error: "bg-linear-to-br from-[#d8503f] to-[#c0392b] text-white",
};

const sparkColor: Record<Tone, string> = {
  navy: "#2f5e98",
  amber: "#e8920c",
  success: "#18794e",
  warning: "#c2700a",
  error: "#c0392b",
};

export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  tone = "navy",
  delta,
  deltaDir = "up",
  spark,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: LucideIcon;
  tone?: Tone;
  delta?: string;
  deltaDir?: "up" | "down" | "flat";
  spark?: number[];
}) {
  return (
    <div className="card card-hover p-5">
      <div className="flex items-start justify-between gap-3">
        <span className={cn("size-11 grid place-items-center rounded-xl", chipClasses[tone])}>
          <Icon className="size-5" strokeWidth={2.2} />
        </span>
        {delta && (
          <span
            className={cn(
              "badge",
              deltaDir === "up" && "bg-success-bg text-success",
              deltaDir === "down" && "bg-error-bg text-error",
              deltaDir === "flat" && "bg-navy-50 text-muted",
            )}
          >
            {deltaDir === "up" && <ArrowUpRight className="size-3" strokeWidth={2.4} />}
            {deltaDir === "down" && <ArrowDownRight className="size-3" strokeWidth={2.4} />}
            {delta}
          </span>
        )}
      </div>

      <p className="mt-4 text-sm font-medium text-muted">{label}</p>
      <div className="mt-1 flex items-end justify-between gap-2">
        <p className="text-[26px] leading-none font-bold font-display text-ink tracking-tight">{value}</p>
        {spark && <Sparkline data={spark} color={sparkColor[tone]} />}
      </div>
      {sub && <p className="mt-2.5 text-xs text-faint">{sub}</p>}
    </div>
  );
}

import type { CriticalPathActivity } from "@/types";

const byRef: Record<string, CriticalPathActivity[]> = {
  "EOT-2026-014": [
    { id: "a1", name: "Podium foundations", plannedStart: "2026-01-05", plannedEnd: "2026-02-02", actualStart: "2026-01-05", actualEnd: "2026-02-02", delayDays: 0, onCriticalPath: true },
    { id: "a2", name: "L3 transfer slab — rebar fixing", plannedStart: "2026-02-03", plannedEnd: "2026-02-24", actualStart: "2026-03-21", actualEnd: "2026-04-11", delayDays: 46, onCriticalPath: true, citation: "Letter DCT-1142 · IRS row 18" },
    { id: "a3", name: "L3 transfer slab — concrete pour", plannedStart: "2026-02-25", plannedEnd: "2026-03-06", actualStart: "2026-04-12", actualEnd: "2026-04-22", delayDays: 47, onCriticalPath: true, citation: "Site diary 12 Apr" },
    { id: "a4", name: "L4 columns & formwork", plannedStart: "2026-03-09", plannedEnd: "2026-04-03", actualStart: "2026-04-23", actualEnd: "2026-05-18", delayDays: 47, onCriticalPath: true },
    { id: "a5", name: "Podium MEP first-fix", plannedStart: "2026-03-16", plannedEnd: "2026-04-17", actualStart: "2026-03-18", actualEnd: "2026-04-20", delayDays: 3, onCriticalPath: false },
  ],
};

const fallback: CriticalPathActivity[] = [
  { id: "f1", name: "Preceding activity", plannedStart: "2026-02-01", plannedEnd: "2026-02-21", actualStart: "2026-02-01", actualEnd: "2026-02-21", delayDays: 0, onCriticalPath: true },
  { id: "f2", name: "Impacted activity", plannedStart: "2026-02-22", plannedEnd: "2026-03-15", actualStart: "2026-03-12", actualEnd: "2026-04-02", delayDays: 18, onCriticalPath: true, citation: "Supporting record" },
  { id: "f3", name: "Following activity", plannedStart: "2026-03-16", plannedEnd: "2026-04-10", actualStart: "2026-04-03", actualEnd: "2026-04-28", delayDays: 18, onCriticalPath: true },
];

export const getCriticalPath = (ref: string): CriticalPathActivity[] => byRef[ref] ?? fallback;

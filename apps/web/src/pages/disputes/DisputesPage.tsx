import {
  CalendarClock,
  FileSearch,
  FolderKanban,
  GanttChartSquare,
  Gavel,
  Scale,
  ScrollText,
  Users,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

const features = [
  { icon: FolderKanban, title: "Case Management Workspace", desc: "Organise documents, correspondence and submissions by arbitration, adjudication or mediation case." },
  { icon: FileSearch, title: "AI Document Review", desc: "Summarise large document sets — surface key facts, contradictions and evidence gaps across thousands of files." },
  { icon: ScrollText, title: "Evidence Organiser", desc: "Tag and cross-reference evidence against specific claim heads and disputed facts." },
  { icon: GanttChartSquare, title: "Chronology Builder", desc: "Auto-extract dates, events and parties from emails, letters and minutes into a factual chronology." },
  { icon: Users, title: "Expert Witness Prep", desc: "Generate targeted questions, anticipate counter-arguments and produce briefing notes." },
  { icon: Scale, title: "Settlement Range Modelling", desc: "Benchmark claim strengths against comparable outcomes to model likely settlement ranges." },
  { icon: Gavel, title: "Submission Drafting", desc: "Draft submissions, defences and rejoinders with clause citations and case-law references." },
  { icon: CalendarClock, title: "Hearing Preparation", desc: "Hearing bundle organiser, witness statement cross-reference and timeline visualisation." },
];

export function DisputesPage() {
  return (
    <>
      <PageHeader
        title="Dispute Resolution"
        subtitle="Full case file management and AI-assisted dispute intelligence for arbitration and adjudication."
      />

      <Card className="p-6 sm:p-8 bg-navy-900 text-white border-navy-800 mb-5 relative overflow-hidden">
        <div className="absolute -top-16 -right-10 size-64 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="relative flex items-start gap-4">
          <span className="size-12 shrink-0 rounded-xl bg-amber-500/15 grid place-items-center">
            <Scale className="size-6 text-amber-400" />
          </span>
          <div>
            <span className="badge bg-amber-500/15 text-amber-300 mb-2">Phase 2 · Planned</span>
            <h2 className="text-xl font-bold font-display">Dispute Resolution & Management module</h2>
            <p className="mt-1.5 text-navy-200 max-w-2xl text-sm">
              The full three-pillar product adds dispute resolution alongside EOT Claims and CLM. The
              capabilities below are scoped for Phase 2 (weeks 1–9).
            </p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {features.map((f) => (
          <Card key={f.title} className="p-5 card-hover">
            <span className="size-10 rounded-xl bg-linear-to-br from-navy-50 to-navy-100 text-navy-700 grid place-items-center">
              <f.icon className="size-5" strokeWidth={2} />
            </span>
            <h3 className="mt-3 font-semibold text-ink">{f.title}</h3>
            <p className="mt-1 text-sm text-muted">{f.desc}</p>
          </Card>
        ))}
      </div>
    </>
  );
}

import { useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, BookText, Download, FileText, GitBranch, ListChecks, Paperclip, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { DocumentsPanel } from "@/components/DocumentsPanel";
import { obligationTone, riskTone, variationTone } from "@/lib/status";
import { formatCurrencyFull, formatDate, relativeDays } from "@/lib/utils";
import { getContract } from "@/mock/data";
import { getContractDocuments } from "@/mock/documents";

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className="text-xs text-faint uppercase tracking-wide">{label}</p>
      <p className="text-sm font-medium text-ink mt-0.5">{value}</p>
    </div>
  );
}

export function ContractDetailPage() {
  const { ref } = useParams<{ ref: string }>();
  const contract = ref ? getContract(ref) : undefined;
  const [tab, setTab] = useState("overview");

  if (!contract) {
    return (
      <div className="text-center py-20">
        <p className="text-lg font-semibold text-ink">Contract not found</p>
        <p className="text-muted mt-1">No contract matches “{ref}”.</p>
        <Link to="/contracts" className="btn btn-outline mt-4 inline-flex">Back to contracts</Link>
      </div>
    );
  }

  const documents = getContractDocuments(contract.ref);
  const confColor = contract.riskScore >= 65 ? "#c0392b" : contract.riskScore >= 45 ? "#c2700a" : "#18794e";
  const highRiskClauses = contract.clauses.filter((c) => c.risk === "High").length;
  const openObligations = contract.obligations.filter((o) => o.status !== "Met").length;

  return (
    <>
      <Link to="/contracts" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-navy-700 mb-4">
        <ArrowLeft className="size-4" /> Contracts
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-[26px] leading-tight font-bold text-ink tracking-tight">{contract.ref}</h1>
            <Badge tone={contract.status === "Active" ? "info" : "neutral"}>{contract.status}</Badge>
            <Badge tone={riskTone[contract.riskLevel]} dot>{contract.riskLevel} risk</Badge>
          </div>
          <p className="mt-1.5 text-muted">{contract.title}</p>
          <p className="text-sm text-faint">{contract.project} · {contract.standard}</p>
        </div>
        <button className="btn btn-outline btn-sm"><Download className="size-4" /> Export</button>
      </div>

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: "overview", label: "Overview", icon: FileText },
          { id: "clauses", label: "Clauses", icon: BookText, count: contract.clauses.length },
          { id: "obligations", label: "Obligations", icon: ListChecks, count: contract.obligations.length },
          { id: "variations", label: "Variations", icon: GitBranch, count: contract.variations.length },
          { id: "documents", label: "Documents", icon: Paperclip, count: documents.length },
        ]}
      />

      <div className="pt-5">
        {/* ── Overview ── */}
        {tab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <Card>
                <CardHeader title="Contract details" />
                <div className="p-5 grid grid-cols-2 sm:grid-cols-3 gap-5">
                  <Field label="Employer" value={contract.employer} />
                  <Field label="Contractor" value={contract.contractor} />
                  <Field label="Standard" value={contract.standard} />
                  <Field label="Contract Value" value={formatCurrencyFull(contract.value, contract.currency)} />
                  <Field label="Commencement" value={formatDate(contract.startDate)} />
                  <Field label="Completion" value={formatDate(contract.completionDate)} />
                </div>
              </Card>
            </div>

            <div className="space-y-4">
              <Card className="p-5">
                <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <ShieldAlert className="size-4" style={{ color: confColor }} /> Contract risk score
                </div>
                <p className="mt-3 text-3xl font-bold font-display tabular-nums" style={{ color: confColor }}>
                  {contract.riskScore}<span className="text-base text-faint font-normal">/100</span>
                </p>
                <div className="mt-2 h-2 rounded-full bg-navy-100 overflow-hidden">
                  <div className="h-2 rounded-full" style={{ width: `${contract.riskScore}%`, backgroundColor: confColor }} />
                </div>
                <p className="mt-3 text-xs text-muted">Composite of high-risk clauses, upcoming deadlines and unresolved obligations.</p>
              </Card>
              <Card className="p-5 space-y-4">
                <div className="flex items-center justify-between"><span className="text-sm text-muted">High-risk clauses</span><span className="font-semibold text-ink">{highRiskClauses}</span></div>
                <div className="flex items-center justify-between"><span className="text-sm text-muted">Open obligations</span><span className="font-semibold text-ink">{openObligations}</span></div>
                <div className="flex items-center justify-between"><span className="text-sm text-muted">Variations</span><span className="font-semibold text-ink">{contract.variations.length}</span></div>
              </Card>
            </div>
          </div>
        )}

        {/* ── Clauses ── */}
        {tab === "clauses" && (
          <Card className="overflow-hidden">
            <CardHeader title="Key clauses" subtitle="AI-extracted & risk-tagged" />
            <div className="overflow-x-auto scroll-thin">
              <table className="w-full text-sm min-w-[560px]">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-faint border-b border-border">
                    <th className="font-semibold px-5 py-2.5">Clause</th>
                    <th className="font-semibold px-3 py-2.5">Ref</th>
                    <th className="font-semibold px-3 py-2.5">Summary</th>
                    <th className="font-semibold px-5 py-2.5">Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {contract.clauses.map((cl) => (
                    <tr key={cl.id} className="border-b border-border last:border-0 align-top">
                      <td className="px-5 py-3 font-medium text-ink whitespace-nowrap">{cl.type}</td>
                      <td className="px-3 py-3 text-muted whitespace-nowrap">{cl.reference}</td>
                      <td className="px-3 py-3 text-muted">{cl.summary}</td>
                      <td className="px-5 py-3"><Badge tone={riskTone[cl.risk]}>{cl.risk}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* ── Obligations ── */}
        {tab === "obligations" && (
          <Card>
            <CardHeader title="Obligation register" subtitle={`${contract.obligations.length} tracked`} />
            <ul className="divide-y divide-border">
              {contract.obligations.map((o) => (
                <li key={o.id} className="px-5 py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">{o.description}</p>
                    <p className="text-xs text-muted mt-0.5">{o.responsibleParty} · Clause {o.reference}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <Badge tone={obligationTone[o.status]}>{o.status}</Badge>
                    <p className="text-xs text-faint mt-1">{formatDate(o.dueDate)} · {relativeDays(o.dueDate)}</p>
                  </div>
                </li>
              ))}
              {contract.obligations.length === 0 && <li className="px-5 py-6 text-sm text-muted text-center">No open obligations.</li>}
            </ul>
          </Card>
        )}

        {/* ── Variations ── */}
        {tab === "variations" && (
          <Card>
            <CardHeader title="Variations / change orders" />
            <ul className="divide-y divide-border">
              {contract.variations.map((v) => (
                <li key={v.id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-ink">{v.ref} · {v.title}</p>
                    <p className="text-xs text-faint mt-0.5">{formatDate(v.date)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-ink tabular-nums">{formatCurrencyFull(v.value, contract.currency)}</p>
                    <Badge tone={variationTone[v.status]}>{v.status}</Badge>
                  </div>
                </li>
              ))}
              {contract.variations.length === 0 && <li className="px-5 py-6 text-sm text-muted text-center">No variations logged.</li>}
            </ul>
          </Card>
        )}

        {/* ── Documents ── */}
        {tab === "documents" && (
          <Card className="p-5">
            <div className="mb-4">
              <h3 className="text-base font-semibold text-ink">Contract repository</h3>
              <p className="text-sm text-muted">Agreement, conditions, schedules and amendments — parsed and indexed for clause extraction.</p>
            </div>
            <DocumentsPanel seed={documents} kind="contract" />
          </Card>
        )}
      </div>
    </>
  );
}

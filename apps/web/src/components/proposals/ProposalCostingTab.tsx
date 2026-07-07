import { useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  Download,
  ImagePlus,
  Loader2,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import {
  useClientProposal,
  useGenerateClientProposal,
  useSaveProposalInputs,
} from "@/hooks/useClientProposal";
import { useDelayEvents } from "@/hooks/useDelayEvents";
import { useProjectById } from "@/store/projects";
import type { ProposalInputs, ProposalLineItem } from "@/api/clientProposals";
import type { ProjectDelayEvent } from "@/types";
import { formatCurrencyFull, formatDate } from "@/lib/utils";

const TODAY = new Date().toISOString().slice(0, 10);

/** Parse an admin amount string ("1,200", "OMR 400") to a number. */
function parseNum(v?: string): number {
  const n = parseFloat(String(v ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isNaN(n) ? 0 : n;
}

/** Trim a delay event's narrative to a short one-line description. */
function shortDesc(text: string): string {
  const clean = (text || "").replace(/\s+/g, " ").trim();
  if (clean.length <= 140) return clean;
  return clean.slice(0, 137).trimEnd() + "…";
}

/** Turn the identified delay events into priced line items (amount left blank). */
function eventsToLines(events: ProjectDelayEvent[]): ProposalLineItem[] {
  return events.map((e) => ({ item: e.title, description: shortDesc(e.narrative), timeline: "", amount: "" }));
}

/** Build the form state from stored inputs, seeding prices from the delay events. */
function buildForm(inp: ProposalInputs, employer: string | undefined, events: ProjectDelayEvent[]): ProposalInputs {
  return {
    reference: inp.reference ?? "",
    date: inp.date ?? TODAY,
    clientCompany: inp.clientCompany ?? employer ?? "",
    attention: inp.attention ?? "",
    clientAddress: inp.clientAddress ?? "",
    subject: inp.subject ?? "Proposal for Claims Support Services",
    signatory: inp.signatory ?? "Hemanth Sarvabhotla, Director",
    discount: inp.discount ?? "",
    feeBasis: inp.feeBasis ?? "",
    notes: inp.notes ?? "",
    logo: inp.logo ?? "",
    lineItems: inp.lineItems?.length
      ? inp.lineItems
      : events.length
        ? eventsToLines(events)
        : [{ item: "", timeline: "", description: "", amount: "" }],
  };
}

/**
 * Proposal tab — the AI-generated, costed client proposal. The admin fills in the
 * cover-letter fields, prices the commercial line items and uploads the client's
 * logo BEFORE generating. Once generated the form is hidden behind an Edit button.
 */
export function ProposalCostingTab({ proposalId }: { proposalId: string }) {
  const { data: proposal, isLoading } = useClientProposal(proposalId);
  const record = useProjectById(proposalId);
  const generate = useGenerateClientProposal(proposalId);
  const saveInputs = useSaveProposalInputs(proposalId);
  const { data: events = [], isLoading: eventsLoading } = useDelayEvents(proposalId);
  const fileRef = useRef<HTMLInputElement>(null);

  const running = proposal?.status === "running" || generate.isPending;
  const failed = proposal?.status === "failed";
  const doc = proposal?.content ?? null;
  const currency = record?.currency ?? "OMR";

  const [form, setForm] = useState<ProposalInputs>({});
  const [editing, setEditing] = useState(false);
  // Seed the form once, during render (React's "adjust state on render" pattern,
  // as used elsewhere in the app). The priced line items come from the identified
  // delay events, so wait for them to load unless prices were already saved.
  const [seededFor, setSeededFor] = useState<string | null>(null);
  const seedReady = !!proposal && (!!proposal.inputs?.lineItems?.length || !eventsLoading);
  if (seedReady && seededFor !== proposalId) {
    setSeededFor(proposalId);
    setForm(buildForm(proposal!.inputs ?? {}, record?.employer, events));
  }

  // The form shows before the first generation, or when the admin clicks Edit.
  const showForm = editing || (!doc && !running);

  const set = (key: keyof ProposalInputs) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const lines = form.lineItems ?? [];
  function setLine(i: number, key: keyof ProposalLineItem, value: string) {
    setForm((f) => {
      const next = [...(f.lineItems ?? [])];
      next[i] = { ...next[i], [key]: value };
      return { ...f, lineItems: next };
    });
  }
  function addLine() {
    setForm((f) => ({ ...f, lineItems: [...(f.lineItems ?? []), { item: "", timeline: "", description: "", amount: "" }] }));
  }
  function removeLine(i: number) {
    setForm((f) => ({ ...f, lineItems: (f.lineItems ?? []).filter((_, x) => x !== i) }));
  }
  /** Reset the line items to the current delay events, keeping any prices the
   *  admin already typed for events with the same name. */
  function reloadFromEvents() {
    setForm((f) => {
      const priced = new Map((f.lineItems ?? []).map((l) => [l.item, l.amount]));
      const next = eventsToLines(events).map((l) => ({ ...l, amount: priced.get(l.item) ?? "" }));
      return { ...f, lineItems: next };
    });
  }

  const previewTotal = lines.reduce((s, l) => s + parseNum(l.amount), 0) - parseNum(form.discount);

  function onLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 700 * 1024) {
      window.alert("Logo is too large — please use an image under ~700 KB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setForm((f) => ({ ...f, logo: String(reader.result) }));
    reader.readAsDataURL(file);
  }

  function handleGenerate() {
    if (doc && !window.confirm("Regenerate the client proposal? This replaces the current draft.")) return;
    generate.mutate(form, { onSuccess: () => setEditing(false) });
  }

  const [downloading, setDownloading] = useState(false);
  async function handleDownloadPdf() {
    if (!doc) return;
    setDownloading(true);
    try {
      const { downloadProposalPdf, fetchAsDataUrl } = await import("@/lib/proposalPdf");
      const alqararLogo = await fetchAsDataUrl("/Al Qarar Logo.png");
      downloadProposalPdf(doc, {
        clientLogo: proposal?.inputs?.logo,
        alqararLogo,
        clientCompany: proposal?.inputs?.clientCompany || record?.employer,
        projectName: record?.name,
        subject: proposal?.inputs?.subject,
      });
    } finally {
      setDownloading(false);
    }
  }

  function startEdit() {
    setForm(buildForm(proposal?.inputs ?? {}, record?.employer, events));
    setEditing(true);
  }
  function cancelEdit() {
    setForm(buildForm(proposal?.inputs ?? {}, record?.employer, events));
    setEditing(false);
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-ink">Client proposal</h3>
          <p className="text-xs text-muted mt-0.5">
            Fill in the details and prices, then generate. The proposal is drafted around the identified delay events.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {doc && !running && !editing && (
            <>
              <button className="btn btn-outline btn-sm" onClick={handleDownloadPdf} disabled={downloading}>
                {downloading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} Download PDF
              </button>
              <button className="btn btn-primary btn-sm" onClick={startEdit}>
                <Pencil className="size-4" /> Edit
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Admin form — fill first, then Generate ── */}
      {showForm && (
        <Card>
          <CardHeader
            title="Proposal details"
            subtitle="These drive the cover letter, reference, date, logo and commercials. The narrative is drafted from the delay events."
            action={
              <button className="btn btn-outline btn-sm" onClick={() => saveInputs.mutate(form)} disabled={saveInputs.isPending || running}>
                {saveInputs.isPending ? <Loader2 className="size-3.5 animate-spin" /> : saveInputs.isSuccess ? <Check className="size-3.5 text-success" /> : null}
                Save
              </button>
            }
          />
          <div className="p-5 space-y-6">
            {/* Client logo */}
            <div>
              <p className="label mb-1.5">Client logo</p>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onLogoFile} />
              {form.logo ? (
                <div className="flex items-center gap-3">
                  <img src={form.logo} alt="Client logo" className="h-14 max-w-48 object-contain rounded-lg border border-border bg-white p-1.5" />
                  <button className="btn btn-outline btn-sm" onClick={() => fileRef.current?.click()}>Replace</button>
                  <button className="btn btn-ghost btn-sm text-error" onClick={() => setForm((f) => ({ ...f, logo: "" }))}>
                    <X className="size-4" /> Remove
                  </button>
                </div>
              ) : (
                <button className="w-full sm:w-auto inline-flex items-center gap-2 rounded-xl border border-dashed border-border-strong hover:border-navy-300 transition-colors px-5 py-4 text-sm text-muted" onClick={() => fileRef.current?.click()}>
                  <ImagePlus className="size-5 text-faint" /> Upload the client's logo (shown on the proposal)
                </button>
              )}
            </div>

            {/* Cover-letter fields */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label" htmlFor="pr-ref">Proposal reference</label>
                <input id="pr-ref" className="input" placeholder="AQMS/Proposal/26/13 (auto if blank)" value={form.reference ?? ""} onChange={set("reference")} />
              </div>
              <div>
                <label className="label" htmlFor="pr-date">Proposal date</label>
                <input id="pr-date" type="date" className="input" value={form.date ?? ""} onChange={set("date")} />
              </div>
              <div>
                <label className="label" htmlFor="pr-company">Client company (addressee)</label>
                <input id="pr-company" className="input" placeholder="e.g. Muscat Pharmacy & Stores LLC" value={form.clientCompany ?? ""} onChange={set("clientCompany")} />
              </div>
              <div>
                <label className="label" htmlFor="pr-attn">Attention (contact & designation)</label>
                <input id="pr-attn" className="input" placeholder="e.g. Mr. Sanjay Batheja, Company Secretary" value={form.attention ?? ""} onChange={set("attention")} />
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="pr-addr">Client address</label>
                <textarea id="pr-addr" className="input min-h-16" placeholder="Building / Street, P.O. Box, City, Country" value={form.clientAddress ?? ""} onChange={set("clientAddress")} />
              </div>
              <div>
                <label className="label" htmlFor="pr-subject">Subject</label>
                <input id="pr-subject" className="input" value={form.subject ?? ""} onChange={set("subject")} />
              </div>
              <div>
                <label className="label" htmlFor="pr-sign">Signatory (name & title)</label>
                <input id="pr-sign" className="input" value={form.signatory ?? ""} onChange={set("signatory")} />
              </div>
            </div>

            {/* Prices — one line per identified delay event; admin enters the price */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="label mb-0">Prices — identified delay events</p>
                  <p className="text-xs text-faint mt-0.5">Each analysed delay event is listed below — just enter a price (and optional timeline) for each.</p>
                </div>
                <div className="flex items-center gap-2">
                  {events.length > 0 && (
                    <button className="btn btn-ghost btn-sm" onClick={reloadFromEvents} title="Reload the list from the current delay events">
                      <Sparkles className="size-3.5" /> Reload events
                    </button>
                  )}
                  <button className="btn btn-outline btn-sm" onClick={addLine}><Plus className="size-3.5" /> Add line</button>
                </div>
              </div>
              <div className="space-y-2">
                {lines.length === 0 && (
                  <p className="text-xs text-muted">
                    {eventsLoading ? "Loading delay events…" : "No delay events identified yet — add priced lines manually, or identify events in the Delay Events tab."}
                  </p>
                )}
                {lines.map((l, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center rounded-lg border border-border px-3 py-2">
                    <div className="col-span-12 sm:col-span-6 min-w-0">
                      {l.item || l.description ? (
                        <>
                          <p className="text-sm font-medium text-ink leading-snug">{l.item || "—"}</p>
                          {l.description && <p className="text-xs text-muted leading-snug mt-0.5">{l.description}</p>}
                        </>
                      ) : (
                        <input className="input" placeholder="Item name (custom line)" value={l.item} onChange={(e) => setLine(i, "item", e.target.value)} />
                      )}
                    </div>
                    <input className="input col-span-5 sm:col-span-3" placeholder="Timeline (optional)" value={l.timeline ?? ""} onChange={(e) => setLine(i, "timeline", e.target.value)} />
                    <input className="input col-span-6 sm:col-span-2 text-right tabular-nums" placeholder={`Price ${currency}`} value={l.amount} onChange={(e) => setLine(i, "amount", e.target.value)} />
                    <button className="btn btn-ghost px-2 col-span-1 text-error h-9 justify-self-end" onClick={() => removeLine(i)} aria-label="Remove line"><Trash2 className="size-4" /></button>
                  </div>
                ))}
              </div>
              <div className="mt-3 grid sm:grid-cols-2 gap-4 items-end">
                <div>
                  <label className="label" htmlFor="pr-disc">Special discount (optional)</label>
                  <input id="pr-disc" className="input" placeholder={`e.g. 400`} value={form.discount ?? ""} onChange={set("discount")} />
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted">Net total</p>
                  <p className="text-lg font-bold font-display tabular-nums text-ink">{formatCurrencyFull(previewTotal, currency)}</p>
                </div>
              </div>
              <p className="text-xs text-faint mt-1">Amounts are in {currency}. These exact prices are used in the proposal — the AI does not invent fees.</p>
            </div>

            {/* Extra guidance */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label" htmlFor="pr-fee">Fee basis / commercial notes (optional)</label>
                <input id="pr-fee" className="input" placeholder="e.g. lump sum per package" value={form.feeBasis ?? ""} onChange={set("feeBasis")} />
              </div>
              <div>
                <label className="label" htmlFor="pr-notes">Additional instructions for the AI (optional)</label>
                <input id="pr-notes" className="input" placeholder="Anything to emphasise, include or exclude…" value={form.notes ?? ""} onChange={set("notes")} />
              </div>
            </div>
          </div>

          {/* Footer actions */}
          <div className="px-5 py-4 border-t border-border flex items-center justify-end gap-2">
            {editing && <button className="btn btn-outline" onClick={cancelEdit} disabled={running}>Cancel</button>}
            <button className="btn btn-primary" onClick={handleGenerate} disabled={running}>
              {running ? <><Loader2 className="size-4 animate-spin" /> Generating…</> : <><Sparkles className="size-4" /> {doc ? "Regenerate" : "Generate with AI"}</>}
            </button>
          </div>
        </Card>
      )}

      {failed && !running && (
        <div className="flex items-start gap-2 rounded-lg bg-error-bg/60 px-3 py-2.5 text-xs text-error">
          <AlertTriangle className="size-4 shrink-0 mt-px" />
          <span>{proposal?.error || "Failed to generate the proposal."}</span>
        </div>
      )}

      {isLoading ? (
        <Card className="p-10 text-center text-sm text-muted inline-flex items-center justify-center gap-2 w-full">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </Card>
      ) : running && !doc ? (
        <Card className="p-10 text-center">
          <span className="size-12 mx-auto rounded-xl bg-navy-50 text-navy-600 grid place-items-center">
            <Loader2 className="size-6 animate-spin" />
          </span>
          <h3 className="mt-3 font-semibold text-ink">Drafting the client proposal with AI…</h3>
          <p className="mt-1 text-sm text-muted max-w-md mx-auto">
            Claude is assembling the proposal from the delay events and your details. This can take a minute or two.
          </p>
        </Card>
      ) : doc ? (
        <Card className="p-0 overflow-hidden">
          <article className="px-6 py-6 sm:px-10 sm:py-8 max-w-3xl mx-auto">
            <header className="border-b border-border pb-4 mb-6">
              <div className="flex items-center justify-between gap-4 mb-4">
                {proposal?.inputs?.logo ? (
                  <img src={proposal.inputs.logo} alt="Client logo" className="h-12 max-w-48 object-contain" />
                ) : (
                  <span />
                )}
                <img src="/Al Qarar Logo.png" alt="Al Qarar" className="h-11 object-contain" />
              </div>
              <p className="text-[11px] uppercase tracking-wide text-faint inline-flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-amber-500" /> AI-generated draft
                {proposal?.updatedAt ? ` · ${formatDate(proposal.updatedAt)}` : ""}
              </p>
              <h1 className="mt-2 text-xl font-bold text-ink leading-snug">{doc.title}</h1>
              {(doc.reference || doc.date) && (
                <p className="mt-1 text-xs text-muted">{[doc.reference, doc.date].filter(Boolean).join(" · ")}</p>
              )}
            </header>

            <div className="space-y-6">
              {doc.sections.map((s, i) => (
                <section key={i}>
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-navy-700 mb-1.5">
                    {i + 1}. {s.heading}
                  </h2>
                  <p className="text-sm text-ink/90 leading-relaxed whitespace-pre-wrap">{s.body}</p>
                </section>
              ))}
            </div>

            {/* Commercial proposal — costing table */}
            {doc.costing.length > 0 && (() => {
              const showTimeline = doc.costing.some((c) => c.timeline?.trim());
              const totalCols = showTimeline ? 3 : 2;
              return (
                <section className="mt-8">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-navy-700 mb-3">Commercial Proposal</h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-faint">
                          <th className="py-2 pr-3 font-semibold">Item</th>
                          <th className="py-2 px-3 font-semibold">Description</th>
                          {showTimeline && <th className="py-2 px-3 font-semibold whitespace-nowrap">Timeline</th>}
                          <th className="py-2 pl-3 font-semibold text-right whitespace-nowrap">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {doc.costing.map((c, i) => (
                          <tr key={i} className="border-b border-border/60 align-top">
                            <td className="py-2.5 pr-3 font-medium text-ink">{c.item}</td>
                            <td className="py-2.5 px-3 text-muted">{c.description}</td>
                            {showTimeline && <td className="py-2.5 px-3 text-muted whitespace-nowrap">{c.timeline || "—"}</td>}
                            <td className="py-2.5 pl-3 text-right tabular-nums text-ink whitespace-nowrap">
                              {formatCurrencyFull(c.amount, doc.currency)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan={totalCols} className="py-3 pr-3 text-right font-semibold text-ink">Total</td>
                          <td className="py-3 pl-3 text-right font-bold tabular-nums text-ink whitespace-nowrap">
                            {formatCurrencyFull(doc.total, doc.currency)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {doc.paymentTerms && doc.paymentTerms.length > 0 && (
                    <div className="mt-5">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-faint mb-2">Payment Terms</h3>
                      <ul className="space-y-1.5">
                        {doc.paymentTerms.map((t, i) => (
                          <li key={i} className="flex gap-2 text-sm text-ink/90">
                            <span className="text-navy-400 mt-1.5 size-1.5 rounded-full bg-navy-300 shrink-0" />
                            <span>{t}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </section>
              );
            })()}

            <p className="mt-8 pt-4 border-t border-border text-[11px] text-faint">
              AI-generated draft{proposal?.model ? ` · ${proposal.model}` : ""}. Review and verify the scope and figures before issuing to the client.
            </p>
          </article>
        </Card>
      ) : null}
    </div>
  );
}

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
import { ProposalDocumentView } from "@/components/proposals/ProposalDocumentView";
import {
  useClientProposal,
  useGenerateClientProposal,
  useSaveProposalInputs,
} from "@/hooks/useClientProposal";
import { useDelayEvents } from "@/hooks/useDelayEvents";
import { useCostingQuery } from "@/hooks/useCosting";
import { useProjectById } from "@/store/projects";
import type { ProposalInputs, ProposalLineItem } from "@/api/clientProposals";
import type { ProjectDelayEvent } from "@/types";
import { formatCurrencyFull } from "@/lib/utils";
import { DELAY_GROUP_DESC, DELAY_GROUP_ITEM, rowNumbers } from "@/lib/proposalCosting";

const TODAY = new Date().toISOString().slice(0, 10);
const CURRENCIES = ["OMR", "AED", "USD", "SAR", "QAR", "KWD", "BHD"];

/** Fixed anchor lines that always wrap the delay-event lines. */
const ANCHOR_FIRST: ProposalLineItem = {
  item: "Document Review & Claim Strategy",
  description: "Compilation, indexing and review of contract documents and correspondence; entitlement and strategy assessment across all identified events.",
  timeline: "",
  amount: "",
};
const ANCHOR_LAST: ProposalLineItem = {
  item: "Statement of Claim & Final Submission",
  description: "Consolidation, supporting appendices, quality review and submission-ready claim package.",
  timeline: "",
  amount: "",
};
/** Header the identified delay events are nested under; priced by its children. */
const DELAY_GROUP: ProposalLineItem = {
  item: DELAY_GROUP_ITEM,
  description: DELAY_GROUP_DESC,
  timeline: "",
  amount: "",
  group: true,
};
/** Point 3 — the professional fee, priced from the Cost Sheet (Suggested Pricing). */
const COSTING_LINE: ProposalLineItem = {
  item: "Costing",
  description: "Professional fee for the claim assignment, based on the estimated work-hours in the cost sheet.",
  timeline: "",
  amount: "",
  costing: true,
};

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

/** Turn the identified delay events into priced sub-lines of the Delay Analysis group. */
function eventsToLines(events: ProjectDelayEvent[]): ProposalLineItem[] {
  return events.map((e) => ({ item: e.title, description: shortDesc(e.narrative), timeline: "", amount: "", sub: true }));
}

const FIXED_ITEMS = [ANCHOR_FIRST.item, ANCHOR_LAST.item, DELAY_GROUP.item, COSTING_LINE.item];

/**
 * Build the full line-items list: anchor-first, the Delay Analysis group header with
 * one sub-line per delay event, the Costing line (point 3), any custom lines, then
 * anchor-last.
 */
function buildLineItems(saved: ProposalLineItem[] | undefined, events: ProjectDelayEvent[]): ProposalLineItem[] {
  if (saved?.length) {
    // Ensure the anchors, group header and Costing line exist; preserve saved content.
    const first = saved.find((l) => l.item === ANCHOR_FIRST.item) ?? { ...ANCHOR_FIRST };
    const last = saved.find((l) => l.item === ANCHOR_LAST.item) ?? { ...ANCHOR_LAST };
    const group = saved.find((l) => l.item === DELAY_GROUP.item) ?? { ...DELAY_GROUP };
    const costing = saved.find((l) => l.item === COSTING_LINE.item) ?? { ...COSTING_LINE };
    const inner = saved.filter((l) => !FIXED_ITEMS.includes(l.item));
    // Proposals saved before grouping have flat event lines — nest them.
    const nested = inner.filter((l) => l.sub ?? true).map((l) => ({ ...l, sub: true }));
    const extras = inner.filter((l) => l.sub === false);
    return [first, { ...group, group: true }, ...nested, { ...costing, costing: true }, ...extras, last];
  }
  const eventLines = events.length ? eventsToLines(events) : [{ item: "", timeline: "", description: "", amount: "", sub: true }];
  return [{ ...ANCHOR_FIRST }, { ...DELAY_GROUP }, ...eventLines, { ...COSTING_LINE }, { ...ANCHOR_LAST }];
}

/** Build the form state from stored inputs, seeding prices from the delay events. */
function buildForm(inp: ProposalInputs, employer: string | undefined, projectCurrency: string, events: ProjectDelayEvent[]): ProposalInputs {
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
    currency: inp.currency ?? projectCurrency,
    lineItems: buildLineItems(inp.lineItems, events),
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
  const { data: costSheet } = useCostingQuery(proposalId);
  const fileRef = useRef<HTMLInputElement>(null);

  // The Cost Sheet rolled up for the Costing line (point 3), matching the backend
  // _costing_summary: one base line per activity (name, work-hours, base cost) plus
  // the marked-up components. The Costing line expands into these rows in the table.
  const costingActivities = (costSheet?.activities ?? [])
    .map((a) => ({
      name: a.description,
      hours: a.entries.reduce((t, e) => t + (Number.isFinite(e.hours) ? e.hours : 0), 0),
      amount: a.entries.reduce((t, e) => t + (Number.isFinite(e.hours) ? e.hours : 0) * (Number.isFinite(e.rate) ? e.rate : 0), 0),
    }))
    .filter((a) => a.amount > 0 || a.hours > 0);
  const sheetSummary = costSheet?.summary;
  const costingMarkups = sheetSummary
    ? [
        { item: "Contingency", pct: sheetSummary.contingencyPct, amount: sheetSummary.contingencyAmount },
        { item: "Overheads", pct: sheetSummary.overheadsPct, amount: sheetSummary.overheadsAmount },
        { item: "Profit", pct: sheetSummary.profitPct, amount: sheetSummary.profitAmount },
        { item: "Income Tax", pct: sheetSummary.incomeTaxPct, amount: sheetSummary.incomeTaxAmount },
        { item: "VAT", pct: sheetSummary.vatPct, amount: sheetSummary.vatAmount },
      ].filter((m) => Math.round(m.amount * 1000) !== 0)
    : [];
  const costingSummary = {
    hours: costingActivities.reduce((t, a) => t + a.hours, 0),
    amount: sheetSummary?.suggestedPricing ?? 0,
    hasSheet: costingActivities.length > 0,
  };

  const running = proposal?.status === "running" || generate.isPending;
  const failed = proposal?.status === "failed";
  const doc = proposal?.content ?? null;
  const projectCurrency = record?.currency ?? "OMR";

  const [form, setForm] = useState<ProposalInputs>({});
  const [editing, setEditing] = useState(false);
  // Seed the form once, during render (React's "adjust state on render" pattern,
  // as used elsewhere in the app). The priced line items come from the identified
  // delay events, so wait for them to load unless prices were already saved.
  const [seededFor, setSeededFor] = useState<string | null>(null);
  const seedReady = !!proposal && (!!proposal.inputs?.lineItems?.length || !eventsLoading);
  if (seedReady && seededFor !== proposalId) {
    setSeededFor(proposalId);
    setForm(buildForm(proposal!.inputs ?? {}, record?.employer, projectCurrency, events));
  }

  const currency = form.currency ?? projectCurrency;

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
  /** Add a custom, ungrouped line just above the closing anchor. */
  function addLine() {
    setForm((f) => {
      const next = [...(f.lineItems ?? [])];
      const line: ProposalLineItem = { item: "", timeline: "", description: "", amount: "", sub: false };
      const at = next.findIndex((l) => l.item === ANCHOR_LAST.item);
      if (at === -1) next.push(line);
      else next.splice(at, 0, line);
      return { ...f, lineItems: next };
    });
  }
  function removeLine(i: number) {
    setForm((f) => ({ ...f, lineItems: (f.lineItems ?? []).filter((_, x) => x !== i) }));
  }
  /** Reset the delay-event sub-lines from the current events, keeping any prices and
   *  timelines already typed and preserving the anchors, group header and custom lines. */
  function reloadFromEvents() {
    setForm((f) => {
      const savedVals = new Map((f.lineItems ?? []).map((l) => [l.item, { amount: l.amount, timeline: l.timeline }]));
      const eventLines = eventsToLines(events).map((l) => ({
        ...l,
        amount: savedVals.get(l.item)?.amount ?? "",
        timeline: savedVals.get(l.item)?.timeline ?? ""
      }));
      const first = f.lineItems?.find((l) => l.item === ANCHOR_FIRST.item) ?? { ...ANCHOR_FIRST };
      const last = f.lineItems?.find((l) => l.item === ANCHOR_LAST.item) ?? { ...ANCHOR_LAST };
      const group = f.lineItems?.find((l) => l.item === DELAY_GROUP.item) ?? { ...DELAY_GROUP };
      const costing = f.lineItems?.find((l) => l.item === COSTING_LINE.item) ?? { ...COSTING_LINE };
      const extras = (f.lineItems ?? []).filter((l) => l.sub === false && !FIXED_ITEMS.includes(l.item));
      return { ...f, lineItems: [first, { ...group, group: true }, ...eventLines, { ...costing, costing: true }, ...extras, last] };
    });
  }

  const numbers = rowNumbers(lines);
  /** The effective amount of a line: the Costing line takes the Cost Sheet's
   *  Suggested Pricing; a group is the subtotal of its children; every other line
   *  uses its typed price. */
  function amountOf(i: number): number {
    const l = lines[i];
    if (l.costing) return costingSummary.hasSheet ? costingSummary.amount : parseNum(l.amount);
    if (l.group) {
      let sum = 0;
      for (let j = i + 1; j < lines.length && lines[j].sub; j++) sum += amountOf(j);
      return sum;
    }
    return parseNum(l.amount);
  }
  const previewTotal = lines.reduce((s, l, i) => (l.group ? s : s + amountOf(i)), 0) - parseNum(form.discount);

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
    setForm(buildForm(proposal?.inputs ?? {}, record?.employer, projectCurrency, events));
    setEditing(true);
  }
  function cancelEdit() {
    setForm(buildForm(proposal?.inputs ?? {}, record?.employer, projectCurrency, events));
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
                <input id="pr-ref" className="input" placeholder="AQMS/Proposal/26/13" value={form.reference ?? ""} onChange={set("reference")} />
                <p className="mt-1 text-xs text-faint">Auto-assigned; edit only if this proposal needs a specific reference.</p>
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
              <div>
                <label className="label" htmlFor="pr-currency">Currency</label>
                <select
                  id="pr-currency"
                  className="input"
                  value={form.currency ?? projectCurrency}
                  onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                >
                  {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            {/* Prices — one line per identified delay event; admin enters the price */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="label mb-0">Prices — identified delay events</p>
                  <p className="text-xs text-faint mt-0.5">Enter a price for each line. The Costing line (point 3) is priced automatically from the Costing tab.</p>
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
                {lines.map((l, i) => {
                  const isAnchor = l.item === ANCHOR_FIRST.item || l.item === ANCHOR_LAST.item;
                  // The group header is priced by its children, so it shows a subtotal
                  // instead of a price input.
                  if (l.group) {
                    const subtotal = amountOf(i);
                    return (
                      <div key={i} className="flex items-start justify-between gap-3 rounded-lg border border-navy-200 bg-navy-50/50 px-3 py-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold leading-snug text-navy-700">{numbers[i]}. {l.item}</p>
                          {l.description && <p className="text-xs text-muted leading-snug mt-0.5">{l.description}</p>}
                        </div>
                        <p className="text-sm font-semibold tabular-nums text-navy-700 whitespace-nowrap pt-0.5">
                          {formatCurrencyFull(subtotal, currency)}
                        </p>
                      </div>
                    );
                  }
                  // The Costing line (point 3) is priced from the Cost Sheet, not typed.
                  // It expands into one base row per activity plus a row for each
                  // non-zero markup — shown here so the admin sees the table rows.
                  if (l.costing) {
                    return (
                      <div key={i} className="rounded-lg border border-navy-200 bg-navy-50/50 px-3 py-2 space-y-1.5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold leading-snug text-navy-700">{numbers[i]}. Costing</p>
                            <p className="text-[11px] text-faint mt-0.5">Priced from the Costing tab; each activity and markup below appears as its own line.</p>
                          </div>
                          {costingSummary.hasSheet ? (
                            <p className="text-sm font-semibold tabular-nums text-navy-700 whitespace-nowrap pt-0.5">{formatCurrencyFull(costingSummary.amount, currency)}</p>
                          ) : (
                            <p className="text-xs text-faint whitespace-nowrap pt-0.5">Build the Costing tab to price this</p>
                          )}
                        </div>
                        {/* Description and timeline carried onto the fee line(s) in the
                            generated table — editable like any other line. */}
                        <div className="grid grid-cols-12 gap-2">
                          <textarea
                            rows={2}
                            className="input col-span-12 sm:col-span-9 text-xs leading-snug"
                            placeholder="Description (optional)"
                            value={l.description ?? ""}
                            onChange={(e) => setLine(i, "description", e.target.value)}
                          />
                          <input
                            className="input col-span-12 sm:col-span-3"
                            placeholder="Timeline (optional)"
                            value={l.timeline ?? ""}
                            onChange={(e) => setLine(i, "timeline", e.target.value)}
                          />
                        </div>
                        {costingSummary.hasSheet && (
                          <div className="pl-3 border-l-2 border-navy-200 space-y-1">
                            {costingActivities.map((a, k) => (
                              <div key={`a${k}`} className="flex items-baseline justify-between gap-3 text-xs">
                                <span className="text-ink min-w-0">
                                  {a.name || "Professional fee"}
                                </span>
                                <span className="tabular-nums text-muted whitespace-nowrap">{formatCurrencyFull(a.amount, currency)}</span>
                              </div>
                            ))}
                            {costingMarkups.map((m, k) => (
                              <div key={`m${k}`} className="flex items-baseline justify-between gap-3 text-xs">
                                <span className="text-muted">
                                  {m.item}
                                </span>
                                <span className="tabular-nums text-muted whitespace-nowrap">{formatCurrencyFull(m.amount, currency)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  }
                  return (
                    <div key={i} className={`grid grid-cols-12 gap-2 items-center rounded-lg border px-3 py-2 ${
                      isAnchor ? "border-navy-200 bg-navy-50/50" : "border-border"
                    } ${l.sub ? "ml-4 sm:ml-6 border-l-2 border-l-navy-200" : ""}`}>
                      <div className="col-span-12 sm:col-span-6 min-w-0">
                        {l.item || l.description ? (
                          <>
                            <p className={`text-sm font-medium leading-snug ${isAnchor ? "text-navy-700" : "text-ink"}`}>
                              <span className="text-faint tabular-nums mr-1.5">{numbers[i]}</span>
                              {l.item || "—"}
                            </p>
                            {l.description && <p className="text-xs text-muted leading-snug mt-0.5">{l.description}</p>}
                          </>
                        ) : (
                          <input className="input" placeholder="Item name (custom line)" value={l.item} onChange={(e) => setLine(i, "item", e.target.value)} />
                        )}
                      </div>
                      <input className="input col-span-5 sm:col-span-3" placeholder="Timeline (optional)" value={l.timeline ?? ""} onChange={(e) => setLine(i, "timeline", e.target.value)} />
                      <input className="input col-span-6 sm:col-span-2 text-right tabular-nums" placeholder={`Price ${currency}`} value={l.amount} onChange={(e) => setLine(i, "amount", e.target.value)} />
                      {isAnchor
                        ? <span className="col-span-1" />
                        : <button className="btn btn-ghost px-2 col-span-1 text-error h-9 justify-self-end" onClick={() => removeLine(i)} aria-label="Remove line"><Trash2 className="size-4" /></button>
                      }
                    </div>
                  );
                })}
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
              <p className="text-xs text-faint mt-1">Amounts are in {currency}. Typed prices are used verbatim; the Costing line is the Suggested Pricing from the Costing tab.</p>
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
          <ProposalDocumentView
            draft
            content={doc}
            clientLogo={proposal?.inputs?.logo}
            updatedAt={proposal?.updatedAt}
            model={proposal?.model}
          />
        </Card>
      ) : null}
    </div>
  );
}

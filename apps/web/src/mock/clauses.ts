import type { ClauseRef } from "@/types";

export const clauseBooks = [
  "FIDIC Red 1999",
  "FIDIC Yellow 2017",
  "FIDIC Silver 2017",
  "NEC4",
] as const;

export const clauseLibrary: ClauseRef[] = [
  { id: "cl-1", book: "FIDIC Red 1999", clause: "8.4", title: "Extension of Time for Completion", summary: "Contractor entitled to EOT for variations, exceptionally adverse climatic conditions, unforeseeable shortages, and Employer delays.", tags: ["EOT", "delay"] },
  { id: "cl-2", book: "FIDIC Red 1999", clause: "20.1", title: "Contractor's Claims", summary: "Notice within 28 days of the event, else time-barred; detailed particulars within 42 days.", tags: ["notice", "time-bar"] },
  { id: "cl-3", book: "FIDIC Red 1999", clause: "4.12", title: "Unforeseeable Physical Conditions", summary: "Relief where physical conditions were not reasonably foreseeable by an experienced contractor.", tags: ["ground", "EOT", "cost"] },
  { id: "cl-4", book: "FIDIC Yellow 2017", clause: "8.5", title: "Extension of Time for Completion", summary: "Grounds for EOT including Variations, causes under the Contract, and delays attributable to the Employer.", tags: ["EOT", "delay"] },
  { id: "cl-5", book: "FIDIC Yellow 2017", clause: "20.2.1", title: "Notice of Claim", summary: "Claiming Party shall give Notice within 28 days of becoming aware (or should have become aware) of the event or circumstance.", tags: ["notice", "time-bar"] },
  { id: "cl-6", book: "FIDIC Yellow 2017", clause: "20.2.4", title: "Fully detailed Claim", summary: "A fully detailed Claim with contractual/legal basis and supporting particulars within 84 days.", tags: ["notice", "particulars"] },
  { id: "cl-7", book: "FIDIC Yellow 2017", clause: "13.3", title: "Variation Procedure", summary: "Engineer may instruct Variations; Contractor responds with proposal and quotation within 28 days.", tags: ["variation", "change"] },
  { id: "cl-8", book: "FIDIC Yellow 2017", clause: "8.8", title: "Delay Damages", summary: "Liquidated damages for late completion, subject to the stated daily rate and overall cap.", tags: ["LDs", "damages"] },
  { id: "cl-9", book: "FIDIC Silver 2017", clause: "5.1", title: "General Design Obligations", summary: "Single-point design responsibility rests with the Contractor under the Silver Book.", tags: ["design", "risk"] },
  { id: "cl-10", book: "FIDIC Silver 2017", clause: "8.5", title: "Extension of Time for Completion", summary: "EOT grounds with reduced Employer risk allocation typical of EPC turnkey contracts.", tags: ["EOT", "delay"] },
  { id: "cl-11", book: "FIDIC Silver 2017", clause: "18", title: "Exceptional Events", summary: "Relief for exceptional events (force majeure); 14-day notice requirement.", tags: ["force majeure", "notice"] },
  { id: "cl-12", book: "NEC4", clause: "60.1", title: "Compensation Events", summary: "Twenty-one listed compensation events covering changes, Employer's risks and physical conditions.", tags: ["compensation event", "change"] },
  { id: "cl-13", book: "NEC4", clause: "61.3", title: "Notifying a Compensation Event", summary: "Contractor notifies within 8 weeks of becoming aware, otherwise no change to Prices or Completion Date.", tags: ["notice", "time-bar"] },
  { id: "cl-14", book: "NEC4", clause: "62", title: "Quotations for Compensation Events", summary: "Quotation comprising changes to Prices and any delay to the Completion Date, with programme.", tags: ["quotation", "programme"] },
  { id: "cl-15", book: "NEC4", clause: "15.1", title: "Early Warning", summary: "Both Parties give early warning of matters that could increase cost, delay completion or impair performance.", tags: ["early warning", "risk"] },
  { id: "cl-16", book: "NEC4", clause: "63.5", title: "Assessing Delay", summary: "Delay assessed as the length of time planned Completion is later than in the Accepted Programme.", tags: ["delay", "programme"] },
];

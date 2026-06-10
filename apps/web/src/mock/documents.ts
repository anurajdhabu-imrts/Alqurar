import type { ClaimDocument } from "@/types";

const claimDocs: Record<string, ClaimDocument[]> = {
  "EOT-2026-014": [
    { id: "doc-1", name: "Programme_Rev3_Baseline.xml", type: "P6 XML", sizeKB: 2480, status: "Parsed", pages: 0, uploadedAt: "2026-04-18" },
    { id: "doc-2", name: "Information_Release_Schedule.xlsx", type: "XLSX", sizeKB: 320, status: "Parsed", uploadedAt: "2026-04-18" },
    { id: "doc-3", name: "Letter_IFC_drawings_late_DCT-1142.pdf", type: "PDF", sizeKB: 880, status: "Parsed", pages: 4, uploadedAt: "2026-04-19" },
    { id: "doc-4", name: "Site_Diary_Feb2026_scanned.pdf", type: "Scan", sizeKB: 6120, status: "Parsed", ocr: true, pages: 28, uploadedAt: "2026-04-20" },
    { id: "doc-5", name: "Variation_Order_VO-31.docx", type: "DOCX", sizeKB: 145, status: "Parsing", uploadedAt: "2026-05-18" },
  ],
};

const claimDocsFallback: ClaimDocument[] = [
  { id: "df-1", name: "Programme_Baseline.xml", type: "P6 XML", sizeKB: 1980, status: "Parsed", uploadedAt: "2026-05-02" },
  { id: "df-2", name: "Correspondence_bundle.pdf", type: "PDF", sizeKB: 1340, status: "Parsed", pages: 12, uploadedAt: "2026-05-03" },
  { id: "df-3", name: "Site_records_scanned.pdf", type: "Scan", sizeKB: 4200, status: "Parsed", ocr: true, pages: 19, uploadedAt: "2026-05-04" },
];

const contractDocs: Record<string, ClaimDocument[]> = {
  "DCT-MC-001": [
    { id: "cd-1", name: "Main_Contract_Agreement_executed.pdf", type: "PDF", sizeKB: 5400, status: "Parsed", pages: 214, uploadedAt: "2024-09-01" },
    { id: "cd-2", name: "Particular_Conditions_FIDIC_Yellow.pdf", type: "PDF", sizeKB: 1820, status: "Parsed", pages: 64, uploadedAt: "2024-09-01" },
    { id: "cd-3", name: "Schedule_of_Prices.xlsx", type: "XLSX", sizeKB: 540, status: "Parsed", uploadedAt: "2024-09-02" },
    { id: "cd-4", name: "Amendment_01_signed.docx", type: "DOCX", sizeKB: 210, status: "Parsed", uploadedAt: "2025-06-14" },
  ],
};

const contractDocsFallback: ClaimDocument[] = [
  { id: "cdf-1", name: "Contract_Agreement.pdf", type: "PDF", sizeKB: 3600, status: "Parsed", pages: 120, uploadedAt: "2024-06-01" },
  { id: "cdf-2", name: "Conditions_of_Contract.pdf", type: "PDF", sizeKB: 1500, status: "Parsed", pages: 58, uploadedAt: "2024-06-01" },
  { id: "cdf-3", name: "Bill_of_Quantities.xlsx", type: "XLSX", sizeKB: 480, status: "Parsed", uploadedAt: "2024-06-02" },
];

export const getClaimDocuments = (ref: string): ClaimDocument[] => claimDocs[ref] ?? claimDocsFallback;
export const getContractDocuments = (ref: string): ClaimDocument[] => contractDocs[ref] ?? contractDocsFallback;

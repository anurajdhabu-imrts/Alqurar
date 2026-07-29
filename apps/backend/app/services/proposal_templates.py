"""Per-proposal-type templates — the single backend source of truth for how the
selected proposal type (Project.proposalType) changes the two proposal outputs:

  1. COSTING  — `costing_activities` seeds the proposal's Cost Sheet with that
     service line's standard work packages when the proposal is created
     (auto-seeded, then edited/priced freely by the analyst).
  2. PROPOSAL — `build_system_prompt` / `user_directive` steer the AI so the
     generated client proposal carries the right title, subject, scope, approach,
     methodology and commercial framing for the service line.

The five service lines mirror Al Qarar's standard proposal documents:
Claims Support Services, Quantum Expert, EOT Claims, (Delay/)Arbitration Expert and
Quantum Claims. `delay_driven` marks the lines whose commercials are scoped around
the identified delay events (claims support, EOT, delay expert) versus the
cost-driven lines (quantum expert, quantum claims).
"""
from typing import Dict, List

# ── Templates ────────────────────────────────────────────────────────────────────
TEMPLATES: Dict[str, Dict] = {
    "claims_support": {
        "label": "Claims Support Services",
        "title": "PROPOSAL FOR CLAIMS SUPPORT SERVICES",
        "subject": "Proposal for Claims Support Services",
        "delay_driven": True,
        "offer": (
            "prepare and manage their Extension of Time (EOT) and quantum / "
            "delay-and-disruption claims before formal dispute resolution"
        ),
        "sections": (
            "1. Cover Letter — addressed to the client company with the subject line, a short "
            "covering note, and a sign-off 'Yours sincerely, Hemanth Sarvabhotla, Director'.\n"
            "2. Background & Introduction — the client's need for claims support on this project, "
            "a short AQMS introduction and track record, and the core-services list.\n"
            "3. Our Approach — the two-stage approach: a Stage 1 claims strategy report "
            "(strengths, weaknesses, risks, way forward) then Stage 2 preparation of the approved "
            "claims (entitlement, factual narrative, causation, time impact, quantum support).\n"
            "4. Scope of Work & Methodology — Stage 1 (contract & records review, strategy report) "
            "and Stage 2 (EOT claim, quantum claim), and the methodology (data collection; delay "
            "analysis using the contract method or SCL/AACE good practice; quantum build-up; report "
            "preparation).\n"
            "5. Team Handling the Assignment — the standard AQMS team, each with a short bio.\n"
            "6. Terms & Conditions — Service Assignment; Payment; Taxation (exclusive of VAT); "
            "Conflict of Interest; Liability (limited to fees paid); Governing Law (Sultanate of "
            "Oman); Confidentiality; Indemnification."
        ),
        "commercial": (
            "Line items grouped by deliverable and tied to the identified events — e.g. document "
            "review & claims strategy report, baseline/updates validation, EOT claim, quantum claim, "
            "supporting documentation. Scale the effort and fees to the number and complexity of the "
            "identified delay events."
        ),
        "costing_activities": [
            "Document review & claims strategy report",
            "Validation of baseline programme & updates",
            "Extension of Time (EOT) claim preparation",
            "Quantum (cost) claim preparation",
            "Claim documentation & supporting appendices",
        ],
    },
    "quantum_expert": {
        "label": "Quantum Expert",
        "title": "PROPOSAL FOR QUANTUM EXPERT SERVICES",
        "subject": "Proposal for Quantum Expert Services",
        "delay_driven": False,
        "offer": (
            "act as the Claimant-appointed independent Quantum Expert in the arbitration — "
            "reviewing, validating and substantiating the financial entitlements and giving "
            "expert evidence before the Tribunal"
        ),
        "sections": (
            "1. Cover Letter — addressed to the client (or their legal counsel) with the subject "
            "line, a short covering note, and a sign-off 'Yours sincerely, Hemanth Sarvabhotla, "
            "Director'.\n"
            "2. Introduction — the dispute and the appointment of a Quantum Expert to provide "
            "independent quantum review, strategic advisory support and expert evidence; a short "
            "AQMS introduction and track record.\n"
            "3. Our Role & Approach — an independent, forensic quantum approach: review/validate the "
            "quantum case and heads of claim (prolongation, disruption/loss of productivity, idle "
            "resources, financing charges, other damages), assess methodology and calculations for "
            "arbitration, and respond to the opposing expert.\n"
            "4. Scope of Work — initial review & assessment; first quantum expert report; joint "
            "statement & final quantum report; preparation & hearing support (expert evidence, "
            "cross-examination, witness conferencing).\n"
            "5. Proposed Experts — the standard AQMS quantum experts, each with a short bio.\n"
            "6. Terms & Conditions — Service Assignment; Payment; Taxation (exclusive of VAT); "
            "Conflict of Interest; Liability (limited to fees paid); Governing Law (Sultanate of "
            "Oman); Confidentiality; Indemnification."
        ),
        "commercial": (
            "Fixed-fee components for the expert engagement — e.g. case familiarization & review of "
            "pleadings, quantum assessment review & refinement, primary quantum expert report, joint "
            "statement / final quantum report, and arbitration hearing support — plus standard hourly "
            "rates for uncertain / additional scope. Do NOT scope these around delay events."
        ),
        "costing_activities": [
            "Case familiarization, kick-off & review of pleadings",
            "Quantum assessment review & refinement",
            "Preparation of Primary Quantum Expert Report",
            "Joint statement & Final Quantum Report",
            "Arbitration hearing support",
        ],
    },
    "eot_claims": {
        "label": "EOT Claims",
        "title": "PROPOSAL FOR EXTENSION OF TIME (EOT) CLAIM SERVICES",
        "subject": "Proposal for Extension of Time (EOT) Claim Services",
        "delay_driven": True,
        "offer": (
            "prepare or strengthen the Contractor's Extension of Time (EOT) claim — establishing "
            "entitlement, causation and critical-path impact for the identified delay events"
        ),
        "sections": (
            "1. Cover Letter — addressed to the client company with the subject line, a short "
            "covering note, and a sign-off 'Yours sincerely, Hemanth Sarvabhotla, Director'.\n"
            "2. Background & Introduction — the client's need to prepare/strengthen the EOT claim on "
            "this project, a short AQMS introduction and track record, and the core-services list.\n"
            "3. Our Approach — review any previously submitted EOT and the Engineer's response; "
            "establish a robust programme suitable for delay analysis; forensic delay analysis in "
            "line with the contract and industry standards; entitlement, causation, concurrency and "
            "mitigation.\n"
            "4. Scope of Work & Methodology — baseline/updates validation, delay analysis (critical "
            "path / windows / Time Impact Analysis), net EOT entitlement, and the claim narrative "
            "and chronology tied to the identified delay events.\n"
            "5. Team Handling the Assignment — the standard AQMS team, each with a short bio.\n"
            "6. Terms & Conditions — Service Assignment; Payment; Taxation (exclusive of VAT); "
            "Conflict of Interest; Liability (limited to fees paid); Governing Law (Sultanate of "
            "Oman); Confidentiality; Indemnification."
        ),
        "commercial": (
            "Line items scoped around the EOT deliverables tied to the identified events — e.g. "
            "review of prior EOT, baseline/updates validation, forensic delay analysis, EOT claim "
            "preparation, and supporting documentation. Scale the effort and fees to the number and "
            "complexity of the identified delay events."
        ),
        "costing_activities": [
            "Review of previously submitted EOT & Engineer's response",
            "Baseline programme validation & updates",
            "Forensic delay analysis (critical path / windows)",
            "Extension of Time (EOT) claim preparation",
            "Claim narrative, chronology & supporting documentation",
        ],
    },
    "arbitration_expert": {
        "label": "Arbitration Expert",
        "title": "PROPOSAL FOR DELAY EXPERT SERVICES",
        "subject": "Proposal for Delay Expert Services",
        "delay_driven": True,
        "offer": (
            "act as the Claimant-appointed independent Delay Expert in the arbitration — reviewing, "
            "testing, updating and presenting the Contractor's delay position and giving expert "
            "evidence before the Tribunal"
        ),
        "sections": (
            "1. Cover Letter — addressed to the client (or their legal counsel) with the subject "
            "line, a short covering note, and a sign-off 'Yours sincerely, Hemanth Sarvabhotla, "
            "Director'.\n"
            "2. Introduction — the appointment of a Delay Expert to provide expert delay analysis, "
            "advisory support and expert evidence in the arbitration; a short AQMS introduction and "
            "track record.\n"
            "3. Our Role & Approach — build on the previously prepared EOT claim, independently "
            "reassess it for arbitration, update the forensic delay analysis, prepare expert/rebuttal "
            "reports, assist counsel, and give oral expert evidence — maintaining independence.\n"
            "4. Scope of Work — review of existing EOT; contract & records review; updated delay "
            "analysis; expert report preparation; rebuttal of the Respondent's delay case; joint "
            "expert meetings; hearing support; post-hearing support.\n"
            "5. Team Handling the Assignment — the standard AQMS delay expert(s), each with a short "
            "bio.\n"
            "6. Terms & Conditions — Service Assignment; Payment; Taxation (exclusive of VAT); "
            "Conflict of Interest; Liability (limited to fees paid); Governing Law (Sultanate of "
            "Oman); Confidentiality; Indemnification."
        ),
        "commercial": (
            "Part A fixed-fee components — e.g. case familiarization & review of pleadings, updated "
            "forensic delay analysis & chronology refinement, primary delay expert report, rebuttal "
            "report, hearing preparation, hearing attendance (per day), experts' joint meeting — plus "
            "Part B variable/uncertain scope items and standard hourly rates."
        ),
        "costing_activities": [
            "Case familiarization, kick-off & review of pleadings",
            "Updated forensic delay analysis & chronology refinement",
            "Preparation of Primary Delay Expert Report",
            "Rebuttal report",
            "Hearing preparation (schedules, graphics, demonstratives)",
            "Arbitration hearing attendance",
            "Experts' joint meeting",
        ],
    },
    "quantum_claims": {
        "label": "Quantum Claims",
        "title": "PROPOSAL FOR QUANTUM CLAIM SERVICES",
        "subject": "Proposal for Quantum Claim Services",
        "delay_driven": False,
        "offer": (
            "prepare a substantiated quantum (cost) claim before arbitration — calculating and "
            "evidencing the financial entitlement arising from the project issues"
        ),
        "sections": (
            "1. Cover Letter — addressed to the client company with the subject line, a short "
            "covering note, and a sign-off 'Yours sincerely, Hemanth Sarvabhotla, Director'.\n"
            "2. Background & Introduction — the client's need to prepare a quantum (cost) claim on "
            "this project, a short AQMS introduction and track record, and the core-services list.\n"
            "3. Our Approach — align cost/accounting heads with the contract preliminaries/BOQ, "
            "collect and validate cost data, and quantify the heads of claim (prolongation, "
            "disruption/loss of productivity, idle resources, overheads, financing charges) with a "
            "clear cause-and-effect narrative.\n"
            "4. Scope of Work & Methodology — review of cost heads, contract alignment, cost-data "
            "collection & validation, and a detailed cost claim supported by a comprehensive "
            "narrative establishing contractual basis and entitlement.\n"
            "5. Team Handling the Assignment — the standard AQMS team, each with a short bio.\n"
            "6. Terms & Conditions — Service Assignment; Payment; Taxation (exclusive of VAT); "
            "Conflict of Interest; Liability (limited to fees paid); Governing Law (Sultanate of "
            "Oman); Confidentiality; Indemnification."
        ),
        "commercial": (
            "Line items for the quantum-claim preparation — e.g. review & alignment of cost heads, "
            "cost-data collection & validation, quantum (cost) claim preparation, and supporting "
            "evidence & documentation. Do NOT scope these around delay events."
        ),
        "costing_activities": [
            "Review of cost & accounting heads",
            "Alignment with contract preliminaries / BOQ",
            "Cost data collection & validation",
            "Quantum (cost) claim preparation",
            "Supporting evidence & documentation",
        ],
    },
}

_DEFAULT = "claims_support"


def get_template(ptype: str) -> Dict:
    """The template for a proposal type, falling back to Claims Support Services."""
    return TEMPLATES.get(ptype or "", TEMPLATES[_DEFAULT])


def costing_activities(ptype: str) -> List[str]:
    """The standard Cost-Sheet work packages to auto-seed for a proposal type."""
    return list(get_template(ptype)["costing_activities"])


def is_delay_driven(ptype: str) -> bool:
    return bool(get_template(ptype)["delay_driven"])


def build_system_prompt(ptype: str, aqms_profile: str) -> str:
    """Assemble the proposal-generation system prompt for a proposal type, weaving
    the type's title, service offer, section briefs and commercial framing into the
    shared AQMS skeleton (ground rules, admin-field handling, output format)."""
    t = get_template(ptype)
    delay_rule = (
        "- The proposal must be built around the SPECIFIC delay events identified — name them, "
        "summarise them, and scope and price the work against them. This is what makes the proposal "
        "bespoke to the client.\n"
        if t["delay_driven"]
        else "- Ground the proposal in the specific project, its issues and heads of claim; use the "
        "identified delay events as context where relevant, but scope and price around the expert / "
        "cost-claim deliverables below (do NOT price per delay event).\n"
    )
    return (
        f"You are the commercial lead at Al Qarar Management Solutions (AQMS) preparing a formal, "
        f"submission-ready '{t['title']}' to a prospective CLIENT, offering to {t['offer']}. You are "
        f"given the project details, the register of delay events our AI has IDENTIFIED from the "
        f"client's uploaded documents, and the list of those documents.\n\n"
        + aqms_profile + "\n\n"
        "GROUND RULES:\n"
        + delay_rule +
        "- Be factual and professional. Only rely on the firm profile above and the information "
        "provided; do NOT invent clause numbers, dates, parties or figures that are not given.\n"
        "- Address the client by their company name (the Employer/Client provided).\n\n"
        f"Produce these narrative sections, in this order, in 'sections' (heading + body). Use the "
        f"subject line '{t['subject']}' in the Cover Letter:\n"
        + t["sections"] + "\n\n"
        "COMMERCIAL PROPOSAL (returned as structured fields, not prose):\n"
        "- 'costing': " + t["commercial"] + " Each line has a short 'item', a one-line 'description', "
        "a 'timeline' (indicative, e.g. 'Week 1-3' — empty string if not applicable) and an 'amount' "
        "(a number in the project currency).\n"
        "- 'currency': the project currency. 'total': the sum of the line-item amounts.\n"
        "- 'paymentTerms': 3-5 short bullet strings for the payment schedule (e.g. advance on "
        "signing, interim on draft submission, balance on final submission), each payable within "
        "7-30 days of invoice, exclusive of VAT.\n"
        "- 'reference': an AQMS proposal reference in the form 'AQMS/Proposal/<yy>/<nn>'.\n"
        "- 'date': the proposal date provided.\n\n"
        "ADMIN-PROVIDED FIELDS: the user may supply specific fields (client company, attention line, "
        "client address, subject, reference, date, signatory, a special discount, a fee basis, and "
        "free-form instructions). When provided, USE THEM EXACTLY — they take precedence over anything "
        "you would otherwise draft:\n"
        "- Put the client company, attention line and address at the top of the Cover Letter and use "
        "the given subject, reference and date.\n"
        "- Sign the Cover Letter off with the given signatory.\n"
        "- If a special discount is given, add it to 'costing' as a final line named 'Less special "
        "discount' with a NEGATIVE amount, and make 'total' the net (line items minus discount).\n"
        "- Follow any additional instructions/fee basis given.\n\n"
        "Each section 'body' is plain text; use blank lines between paragraphs and '- ' for bullets. "
        "If the identified-events register is empty, still produce a credible scoping proposal and "
        "state that the scope and fees will be refined once the documents are reviewed."
    )


def user_directive(ptype: str, currency: str, today: str) -> str:
    """The closing instruction appended to the user message for a proposal type."""
    t = get_template(ptype)
    return (
        f"\n\nDraft the AQMS {t['label']} proposal now (title: '{t['title']}'). Price all amounts "
        f"in {currency} and date it {today}."
    )

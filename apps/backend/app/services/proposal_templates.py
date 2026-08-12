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

# ── Shared briefs for the EOT Claims line ────────────────────────────────────────
# The EOT proposal is AQMS's most frequently issued document, so its structure,
# wording and house formatting are pinned down here rather than left to the model.
# These briefs mirror the issued "Extension of Time Claim Management Services"
# proposal: bold sub-headings, bold-lead bullets, numbered scope items, full team
# introductions and the standard conditions.

_EOT_FORMAT_RULES = (
    "FORMATTING — the document is rendered from this light markup, so follow it exactly:\n"
    "- Separate every paragraph with a BLANK line. Paragraphs run 2-4 sentences; never write a "
    "wall of text.\n"
    "- A sub-heading is its own line wrapped in double asterisks, with a blank line before and "
    "after it — e.g. '**A. Our Approach**'. Never put a sub-heading on the same line as body "
    "text, and never use markdown '#' headings, tables or code fences.\n"
    "- Bullets start with '- ' at the left margin. Where a bullet has a lead-in term, bold it and "
    "follow with an em dash: '- **Understanding the Contractual Framework** — a detailed review "
    "of the contract provisions governing delay, disruption and extension of time.'\n"
    "- Numbered scope items start with '1) ', '2) ' … at the left margin; nest their detail "
    "beneath them as bullets indented by two spaces ('  - '). Where a numbered item has "
    "roman-numeral sub-items, write each as '  i) **Title**' indented by two spaces with its own "
    "bullets ('  - ') beneath it — the markup carries only two indent levels, so never indent "
    "further than two spaces.\n"
    "- Use **bold** inline only for defined terms, party names, deliverables and clause "
    "references — never for a whole paragraph or a whole bullet.\n"
    "- Keep one idea per bullet, one to three lines each. Write in formal, impersonal, "
    "submission-ready English; no marketing superlatives and no first-person asides.\n"
    "\n"
    "WRITING & GROUNDING — the document goes to the client as written, so:\n"
    "- Write in British English throughout ('programme', 'analyse', 'substantiation', "
    "'organisation'), in formal business English using construction-claims and contractual "
    "terminology, referring to the firm in the third person.\n"
    "- Never invent or assume a fact. Do not infer a date, amount, clause number, project status, "
    "delay event, party name or contractual relationship that the project information does not "
    "give.\n"
    "- Where a detail was not provided, LEAVE IT OUT — drop the line, the phrase or the whole "
    "sentence and write around the gap so the text still reads naturally. Never stand in for a "
    "missing detail with a placeholder ('[CLIENT ADDRESS]', 'TBC', 'XXX'), a dash, a blank run of "
    "underscores, a sample value or a plausible guess. A proposal that simply does not mention "
    "the client's address is correct; one that prints an empty or invented address is not. This "
    "applies to every field — address, attention line, reference, date, contact, location, "
    "contract particulars and clause references alike.\n"
    "- Preserve the distinctions the project information draws: Employer vs Engineer, Main "
    "Contractor vs Subcontractor vs Nominated Subcontractor, EOT vs quantum, delay vs disruption, "
    "entitlement vs quantum. Use the terminology the project's own documents use.\n"
    "- Do not state that a party is responsible for a delay, or that entitlement has been "
    "established, unless the project information supports it. These matters are under assessment "
    "— write them with the appropriate professional caution.\n"
    "- Use 'Extension of Time (EOT)' in full on first reference in each section, then 'EOT'.\n"
    "- Never refer to AI, models or automated analysis anywhere in the document — no 'based on "
    "our analysis of the AI output', no 'the system identified'. The delay events are the events "
    "identified from the project records.\n"
)

_EOT_COVER_LETTER_BRIEF = (
    "Lay this out as a letter, not an essay, and use no bullets and no sub-headings.\n"
    "  Letterhead — the client company on its own line prefixed 'M/s', then the address lines "
    "beneath it ONLY where an address was given (where none was, go straight on — do not leave a "
    "gap or write a placeholder address); a blank line; 'Kind Attn: <recipient name and "
    "designation>' ONLY where a recipient was given, omitting the line entirely otherwise; a "
    "blank line; the subject line; a blank line; 'Dear Sir,'.\n"
    "  Subject — 'Subject: Proposal for Extension of Time (EOT) Claim Services at <project "
    "name>', unless the admin supplied a subject, in which case use theirs verbatim. The subject "
    "must match the service line: this is an EOT assignment, so do not describe it as a quantum "
    "claim, an expert appointment or a dispute engagement.\n"
    "  Then three short paragraphs — no more:\n"
    "    1) Thank the client for the invitation to provide our expertise in managing the "
    "Extension of Time claims on the project, and state the purpose of the proposal. Refer to a "
    "meeting, discussion or correspondence ONLY where a date or reference for it is given; where "
    "none is, write the paragraph without any such reference rather than inventing one.\n"
    "    2) A concise capability paragraph — two sentences at most — on the planning, delay "
    "analysis, contractual and commercial expertise AQMS brings to THIS assignment. This is not "
    "a company profile: leave the track record, the service list and the firm's history to the "
    "Background & Introduction, and do not repeat that section here.\n"
    "    3) Confidence that our services will support the client's contractual position and "
    "claim objectives, appreciation for the opportunity, and an offer to clarify or discuss any "
    "aspect of the proposal.\n"
    "  Then a blank line, 'Yours sincerely,', and the signatory name and title on their own "
    "lines — the admin-supplied signatory if given, otherwise 'Hemanth Sarvabhotla' / 'Director'."
)

_EOT_BACKGROUND_BRIEF = (
    "Four to six paragraphs, in this order, followed by the core-services list. Write flowing "
    "paragraphs — the only bullets in this section are the delay-event register and the "
    "core-services list.\n"
    "  1) Client requirement and project context — who intends to engage the claims service "
    "provider, the project name and (where given) its location, the client's role on the project "
    "(Employer, Main Contractor, Subcontractor, Nominated Subcontractor, JV or other), the "
    "project's current stage, and the purpose of the engagement: the preparation and management "
    "of the Extension of Time (EOT) claims, with a focus on entitlement realisation and "
    "protection of the client's contractual rights.\n"
    "  2) The circumstances giving rise to the claim — the documented delays, late or incomplete "
    "information, approval and instruction delays, access or design changes, variations and "
    "additional scope, disruption or suspension, and the Employer's / Engineer's / Main "
    "Contractor's actions, as they appear in the identified events and the project information. "
    "Draw ONLY on events actually identified for this project; never pad the paragraph with delay "
    "types that are merely common in construction claims. Connect the events logically to the "
    "client's scope and its potential entitlement, and keep the wording cautious — these matters "
    "are still under assessment, so do not assert that a party is responsible or that entitlement "
    "is established unless the project information says so.\n"
    "  Then list the delay-event register in full — this is what makes the proposal bespoke, so "
    "include EVERY event given, in the order given, and never abbreviate the list or write "
    "'and others'. Introduce it with the line 'The following delay events have been identified "
    "from the uploaded project records and form the basis of this proposal:' and give one bullet "
    "per event, each on the pattern '- <ref>: <title> — <n> days, critical path.' — i.e. the "
    "event's reference, a colon, its title, then an em dash and the days impact ONLY where that "
    "figure is greater than zero, then ', critical path' ONLY where the event's critical-path "
    "flag is 'yes', closing with a full stop. Where the days impact is zero and the event is not "
    "on the critical path, the bullet is just '- <ref>: <title>.'. Never write '0 days' or 'not "
    "on the critical path'. Use the reference, title, days impact and critical-path flag "
    "exactly as supplied — do not renumber the events, reword their titles, or infer, round or "
    "invent a days figure. If the register is empty, omit this list and the introductory line "
    "altogether.\n"
    "  3) The claim objective — what the assignment is intended to achieve: establishing "
    "entitlement to additional time, identifying and substantiating the delay events, "
    "establishing causation and responsibility, assessing the impact on the project programme "
    "and the critical path, addressing concurrency where the project information supports it, and "
    "supporting the client's contractual position. Where the events carry cost consequences, note "
    "the relationship between the time impact and the resulting prolongation and disruption costs "
    "— but keep the emphasis on time; do not turn this into a quantum proposal.\n"
    "  4) The company introduction — AQMS as a specialist construction claims and "
    "project-management consultancy, described from the firm profile above. Name the disciplines "
    "relevant to THIS assignment (contracts and commercial management; project planning, "
    "monitoring and controls; forensic planning and delay analysis; Extension of Time claims; "
    "claims documentation; arbitration and expert-witness support). Do not pad it with services "
    "the assignment does not touch.\n"
    "  5) Experience and credibility — the firm's relevant experience, drawn ONLY from the "
    "figures in the firm profile above. Do not carry over a claim count, client count or number "
    "of years from any other proposal, and do not round, inflate or invent one. Where the profile "
    "gives no figure for something, write it qualitatively instead — e.g. 'the team has extensive "
    "experience in handling complex EOT, quantum, delay and commercial claims across the GCC, "
    "India and other regions'.\n"
    "  6) Professional strengths — experienced claims professionals, technical and commercial "
    "expertise, contractual understanding, analytical capability, evidence-based assessment, "
    "structured claim preparation, an understanding of the relationship between delay and its "
    "cost consequences, and practical construction-industry experience. Communicate professional "
    "credibility, not sales promotion; no superlatives and no exaggerated claims.\n"
    "  Close with a '**Our Core Services**' sub-heading and the core services as bold-lead "
    "bullets, each with a half-line description — selecting only those relevant to this "
    "assignment (typically Extension of Time Claims; Forensic Planning and Delay Analysis; "
    "Contracts & Commercial Management; Claims Documentation; Preparation of Commercial Claims; "
    "Arbitration Support and Expert Witness)."
)

_EOT_APPROACH_BRIEF = (
    "Reproduce AQMS's standard approach and scope text below, in this order and substantially "
    "verbatim. Keep every heading, numbered item and bullet — adapt only the party names (JV / "
    "Contractor / Client) and add a short project-specific sentence where an item is naturally "
    "informed by the identified delay events. Do not summarise it away, and do not reorder it.\n"
    "  Opening paragraph (no bullets): AQMS's approach to claims management is founded on the "
    "principle that successful outcomes require objectivity, meticulous attention to detail and a "
    "thorough understanding of the contractual framework. Our team adopts a systematic and "
    "comprehensive methodology to ensure accuracy, consistency and fairness in the evaluation "
    "process, structured around the key steps below.\n"
    "  '**A. Our Approach**' — bold-lead bullets, in this order:\n"
    "    - Understanding the Contractual Framework — detailed review and analysis of the relevant "
    "contract provisions pertaining to delay, disruption, Extension of Time (EOT) and the "
    "associated cost entitlements.\n"
    "    - Compilation and Review of Documents — collection and critical assessment of all "
    "relevant documentation, including the contract, baseline and updated programmes, progress "
    "records and correspondence.\n"
    "    - In-depth Study of the Delay Events / Issues — reconstruction of the sequence of events "
    "leading to the delays and/or disruptions, focused on establishing causation, criticality and "
    "responsibility.\n"
    "    - Extension of Time Claim — end-to-end management of EOT claims, including detailed delay "
    "analysis using the appropriate methodology (e.g. impacted as-planned, time impact analysis or "
    "windows analysis), from identification and substantiation through to submission, negotiation "
    "and final resolution.\n"
    "    - Quantification of Damages — detailed evaluation of the financial impact arising from "
    "the delays and disruptions, including prolongation costs, disruption costs and loss of "
    "productivity and/or profit (if any).\n"
    "  '**B. Scope of Services — Employer / Engineer Related Matters**' — three numbered items, "
    "each written as a bold lead-in line followed by its explanatory paragraph:\n"
    "    1) **Review and Strengthen Existing Claims** — assess the current claims for contractual "
    "compliance, technical robustness and evidentiary support, and enhance them where necessary to "
    "improve entitlement and defensibility. The process will commence with a detailed review to "
    "understand the current status and position of the claim. Where necessary, the claim will be "
    "strengthened by identifying gaps and weaknesses, improving the narrative and cause-and-effect "
    "linkage, and enhancing the supporting documentation. This will be followed by the development "
    "of a comprehensive and well-substantiated claim or response to the Engineer. Thereafter, "
    "continuous support will be provided throughout the lifecycle of the claim, including "
    "submission, follow-up and engagement with the Engineer, until the claim is fully concluded.\n"
    "    2) **Establish a Structured Claims Management Framework** — develop and implement a "
    "systematic approach for the identification, preparation, submission and tracking of future "
    "claims. A structured and iterative approach will be adopted to manage time-related claims and "
    "establish a defensible position, in coordination with the client's team. This includes "
    "reviewing the existing claims management system, identifying gaps and time-related issues, "
    "and continuously monitoring project records and the critical path to capture delay events. "
    "The process will ensure timely contractual notices, proper categorisation of events and "
    "assessment of admissibility and entitlement. A clear chronology with supporting evidence will "
    "be developed, followed by evaluation of time entitlement, including concurrency, leading to "
    "the preparation, submission and negotiation of Extension of Time (EOT) claims.\n"
    "    3) **Claims Management Support** — provide continuous support in the management of all "
    "claims, including coordination, review and integration of subcontractor claims to ensure "
    "consistency and alignment with the main contract. The process includes the five sub-items "
    "below; write each as a nested bold lead-in line ('  i) **Contract Management Process "
    "(Time-related)**'), then its bullets nested beneath it, then a closing nested line giving the "
    "purpose:\n"
    "      i) Contract Management Process (Time-related) — bullets: conduct a detailed review of "
    "the contract conditions, project documents and related correspondence; prepare a "
    "comprehensive Contractual Risk Register capturing potential exposures related to time, "
    "notices and compliance; establish clear protocols for contractual notices, communication "
    "requirements and compliance procedures. Purpose: this will enable a clear and structured "
    "understanding of all contractual risks and entitlements, enabling the development of a "
    "strong, defensible strategy from the beginning of the assignment.\n"
    "      ii) Monitoring Contractual Compliance & Notice Management — bullets: track all "
    "contractual obligations, timelines and deliverables throughout the project; provide support "
    "for drafting and issuing timely contractual notices to protect entitlements; maintain updated "
    "registers for delays, variations and relevant contractual events. Purpose: this will ensure "
    "the Contractor's adherence to the contractual procedure and avoid any time-bar situation and "
    "the consequent loss of contractual entitlement.\n"
    "      iii) EOT Support — bullets: perform detailed delay analysis and prepare Extension of "
    "Time (EOT) submissions in line with the contract requirements; develop and substantiate all "
    "claim documents with supporting evidence, calculations and justifications; represent and "
    "support the client in negotiations, clarifications and determinations with the stakeholders. "
    "Purpose: mitigation of exposure to liquidated damages and maximisation of legitimate "
    "entitlements through well-supported, defensible claims.\n"
    "      iv) Contractual Reporting — bullets: prepare and submit monthly contractual health "
    "reports focused exclusively on claims; the report will cover key risks, delays, notices, "
    "entitlement status and required actions. Purpose: to ensure the client has clear visibility "
    "and control over its contractual position and is supported in making informed management "
    "decisions.\n"
    "      v) Claim Document Structure — a lead line stating that the structure of the claim "
    "document will be developed by considering all relevant aspects of the claim and with due "
    "reference to the contract documents, established industry practices and internationally "
    "recognised guidelines, followed by these bold-lead bullets: **Project Description** (brief "
    "description of the project and the relevant contract details); **Executive Summary of the "
    "Claim** (a concise summary of the claim with the key details of its basis, such as idling "
    "costs, schedule impact, additional work, changes in scope and acceleration); **Contractual "
    "Basis of the Claim** (the specific contract clauses relied on to establish admissibility and "
    "compliance with the contract's requirements as to notices, timelines and formats, and the "
    "obligations of the various stakeholders and how they correlate to the claim); **Detailed "
    "Claim Description and Background** (a structured narrative of the circumstances in formal "
    "language, a chronology of events emphasising the key dates and occurrences, the supporting "
    "evidence — contract documents, letters, emails, minutes of meeting, inspection records, "
    "photographs, site instructions and change orders, all affixed with an easy-to-retrieve "
    "numbering system — and the impact analysis on schedule, cost or both); **Delay Analysis** "
    "(schedule analysis against the baseline or other agreed programme, critical-path impact, and "
    "delay apportionment establishing the culpable and excusable delays); **Conclusion** (a recap "
    "of the main points of the claim and a clear statement of the relief requested, e.g. extension "
    "of time, additional payment or other compensation); and **Attachments** (all supporting "
    "documents referenced in the claim, listed and arranged with numbering and cross-references "
    "for easy retrieval).\n"
    "  '**C. Scope of Services — Subcontractor Time-Related Claims**' — a lead paragraph stating "
    "that AQMS will additionally manage the time-related claims received from subcontractors, "
    "including domestic subcontractors, subconsultants and nominated subcontractors operating the "
    "Provisional Sum packages, followed by bullets, in this order:\n"
    "    - Review the main contractor–subcontractor provisions and identify the entitlement "
    "triggers (e.g. delays in approvals, access, design and coordination).\n"
    "    - Proactively identify potential bottlenecks and issue early delay warning notifications "
    "to the relevant subcontractors to mitigate delays and protect entitlement.\n"
    "    - Review and assess the claims submitted by subcontractors for contractual and technical "
    "validity, responsibility and overall merit.\n"
    "    - Prepare reasoned assessments and rebuttals on contractual and factual grounds.\n"
    "    - Determine the client's entitlement position in respect of each subcontractor's claim "
    "(accept, partially accept or reject) and respond in line with that contractual position.\n"
    "    - Where claims are justified, develop and pursue the corresponding upstream claim with "
    "the Engineer / Employer.\n"
    "    - Ensure consistency between the downstream (subcontractor) and upstream (Employer) "
    "positions, aligned with the client's overall claims strategy."
)

_EOT_TEAM_BRIEF = (
    "Reproduce AQMS's standard team introductions below, in this order and substantially verbatim "
    "— do not shorten, merge or reorder them, and do not compress them into bullets. For each "
    "member: the name, credentials and role on their own bold line ('**Kariyadan Nausher, PMP, "
    "ACIArb — Principal Consultant**'), a blank line, then the paragraph(s) of their introduction "
    "exactly as given (keep the paragraph breaks), then a blank line before the next member:\n"
    "  **Kariyadan Nausher, PMP, ACIArb — Principal Consultant**\n"
    "  With over three decades of experience in Oman's construction industry, Nausher has "
    "successfully led and managed numerous complex, high-value projects involving a wide range of "
    "clients, contractors and stakeholders. He brings proven expertise in project management, "
    "strategic planning and contract administration across diverse construction sectors.\n"
    "  Nausher is a Member of the Society of Construction Law (U.K.) and is registered as a "
    "Technical Expert with the Oman Commercial Arbitration Centre, reflecting his recognised "
    "standing in the field and commitment to professional excellence.\n"
    "  **Hemanth Sarvabhotla — Director**\n"
    "  A seasoned management professional, Hemanth brings over 20 years of extensive experience in "
    "delivering large-scale multi-disciplinary Design & Build contracts. He is recognised for his "
    "strong leadership capabilities, exceptional construction management expertise and meticulous "
    "attention to detail.\n"
    "  Hemanth's career includes the successful execution of complex projects where he has "
    "consistently ensured adherence to quality, cost and schedule objectives.\n"
    "  **Vamsi Krishna Valluri, MCIArb, RICS Expert Witness — Technical Head**\n"
    "  Vamsi is a seasoned delay and quantum expert with over 18 years of experience in project "
    "planning, claims management and forensic analysis across major infrastructure and building "
    "projects in the Middle East and India.\n"
    "  He specialises in the preparation, evaluation and defence of complex Extension of Time "
    "(EOT) and quantum claims, with strong expertise in CPM-based delay analysis techniques, "
    "including windows analysis and time impact analysis, to establish causation, assess "
    "concurrency and substantiate entitlement.\n"
    "  Vamsi has extensive experience in providing independent expert reviews, managing claims "
    "throughout the project lifecycle and resolving high-value disputes through well-structured "
    "contractual strategies and robust evidentiary support. Vamsi has successfully represented "
    "contractors on mega projects, leading to favourable outcomes in time and cost claims.\n"
    "  A registered expert with RICS and a member of CIArb, Vamsi is also certified as a "
    "construction claims specialist and delay analyst, bringing a high level of technical rigour "
    "and credibility to expert reports, arbitration support and dispute resolution proceedings.\n"
    "  **Mohamed Ismail, PMP — Consultant, Planning & Controls**\n"
    "  Mohamed Ismail is a Planning Consultant and Claims Specialist with 14 years of experience "
    "in the delivery of major infrastructure and aviation projects. He specialises in the "
    "development and defence of EOT and prolongation claims, utilising forensic critical path "
    "analysis and forensic record-keeping to secure project entitlements.\n"
    "  **Ajmal Aboo, PMP — Consultant, Planning & Controls**\n"
    "  With a career spanning 13+ years in major infrastructure and aviation projects, Ajmal Aboo "
    "is an expert in navigating the complexities of project delays. As a Planning Consultant, his "
    "core strength lies in the preparation, substantiation and defence of EOT claims. By "
    "leveraging profound forensic planning techniques, he ensures that contractors and "
    "stakeholders are protected against schedule risks, consistently delivering the strategic "
    "oversight needed to resolve disputes and secure project timelines.\n"
    "Close the section with the standalone bold line: '**The team will be further supported by "
    "other members from Al Qarar on a need basis.**'"
)

_EOT_TERMS_BRIEF = (
    "Reproduce AQMS's standard conditions below, in this order, as numbered items — the number "
    "and a bold heading on the line ('1) **Service Assignment**'), then the condition text "
    "beneath it. Keep the substance exactly; adapt only the party names:\n"
    "  1) Service Assignment — AQMS (the Service Provider) will provide the services described "
    "above to the Client (the Service Seeker) from its offices; any service beyond the described "
    "scope is subject to prior agreement on fees and requires a work order; the Service "
    "Provider's reports will adhere to industry standards, guidelines and the contract "
    "conditions based on the documents made available to it; and the Service Seeker will make "
    "its authorised representatives available for meetings and discussions, online or in person, "
    "as needed during the engagement.\n"
    "  2) Payment — payments shall be made to the Service Provider's designated bank account "
    "unless otherwise specified in writing.\n"
    "  3) Taxation — all amounts are exclusive of VAT, sales tax and any other applicable taxes, "
    "which are the responsibility of the Service Seeker as mandated by law.\n"
    "  4) Conflict of Interest — conflict-of-interest situations are addressed on a first-come, "
    "first-served basis and will be communicated before entering an engagement.\n"
    "  5) Liability — the deliverables comprise guidance and recommendations to the Service "
    "Seeker; the Service Provider is not liable for consequences arising from them, and its "
    "liability under this agreement is limited to the fees paid by the Service Seeker.\n"
    "  6) Governing Law — any dispute arising from this agreement is subject to the laws of the "
    "Sultanate of Oman.\n"
    "  7) Confidentiality — neither party will disclose information about the other or its "
    "associates to third parties without the prior written consent of an authorised official.\n"
    "  8) Indemnification — the Client (Service Seeker) will indemnify and hold harmless the "
    "Consultant (Service Provider), its officers, directors, employees and agents from any "
    "claims, liabilities, damages, losses, expenses and costs arising from the Client's use of "
    "the Consultant's management and advisory services, including reasonable attorney's fees.\n"
    "Do NOT add a fee or payment-schedule section here — the commercial table and payment terms "
    "are rendered from the structured fields immediately after this section."
)

_EOT_SECTIONS = (
    "1. Covering Letter — " + _EOT_COVER_LETTER_BRIEF + "\n"
    "2. Background & Introduction — " + _EOT_BACKGROUND_BRIEF + "\n"
    "3. Our Approach & Scope of Services — " + _EOT_APPROACH_BRIEF + "\n"
    "4. Methodology — how the EOT claim will actually be built, under these sub-headings:\n"
    "   '**Delay Analysis Methodology**' — bold-lead bullets for: data collection and records "
    "review; validation of the baseline programme and its updates as a programme fit for "
    "analysis; selection of the analysis method in line with the contract and recognised "
    "guidance (the SCL Delay and Disruption Protocol and AACE 29R-03) — impacted as-planned, "
    "time impact analysis, or as-planned versus as-built windows analysis, stating what drives "
    "the choice; establishing cause and effect, criticality and concurrency; assessment of "
    "mitigation and acceleration; and the resulting net EOT entitlement.\n"
    "   Do NOT repeat the claim document structure here — it is already set out in section 3 "
    "under 'Claims Management Support'.\n"
    "   '**Deliverables & Reporting**' — bullets for the EOT claim submission(s) tied to the "
    "identified delay events, the delay and notice registers, the monthly contractual health "
    "report, and support through the Engineer's determination.\n"
    "5. Team Handling the Assignment — " + _EOT_TEAM_BRIEF + "\n"
    "6. Terms & Conditions — " + _EOT_TERMS_BRIEF
)

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
        "sections": _EOT_SECTIONS,
        "format_rules": _EOT_FORMAT_RULES,
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
    # A template may pin down its own house formatting (the EOT line does); the rest
    # fall back to the light default markup.
    format_rules = t.get("format_rules") or (
        "Each section 'body' is plain text; use blank lines between paragraphs and '- ' for "
        "bullets.\n"
    )
    return (
        f"You are the commercial lead at Al Qarar Management Solutions (AQMS) preparing a formal, "
        f"submission-ready '{t['title']}' to a prospective CLIENT, offering to {t['offer']}. You are "
        f"given the project details, the register of delay events IDENTIFIED from the client's "
        f"uploaded project records, and the list of those documents.\n\n"
        + aqms_profile + "\n\n"
        "GROUND RULES:\n"
        + delay_rule +
        "- Be factual and professional. Only rely on the firm profile above and the information "
        "provided; do NOT invent clause numbers, dates, parties or figures that are not given.\n"
        "- Address the client by their company name (the Employer/Client provided).\n\n"
        f"Produce these narrative sections, in this order, in 'sections' (heading + body). Use the "
        f"subject line '{t['subject']}' in the Cover Letter. Give each section a plain heading "
        f"WITHOUT its number — the document numbers them. Do NOT write a fee, price or "
        f"payment-schedule section: the commercial table and payment terms are rendered from the "
        f"structured fields below, immediately after the final narrative section:\n"
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
        "free-form instructions). Only the fields actually filled in are listed below; ANY FIELD NOT "
        "LISTED WAS LEFT BLANK — omit it from the document entirely rather than printing a "
        "placeholder, an empty line or an invented value in its place. When provided, USE THEM "
        "EXACTLY — they take precedence over anything you would otherwise draft:\n"
        "- Put the client company, attention line and address at the top of the Cover Letter and use "
        "the given subject, reference and date.\n"
        "- Sign the Cover Letter off with the given signatory.\n"
        "- If a special discount is given, add it to 'costing' as a final line named 'Less special "
        "discount' with a NEGATIVE amount, and make 'total' the net (line items minus discount).\n"
        "- Follow any additional instructions/fee basis given.\n\n"
        + format_rules +
        "\nIf the identified-events register is empty, still produce a credible scoping proposal "
        "and state that the scope and fees will be refined once the documents are reviewed."
    )


def user_directive(ptype: str, currency: str, today: str) -> str:
    """The closing instruction appended to the user message for a proposal type."""
    t = get_template(ptype)
    return (
        f"\n\nDraft the AQMS {t['label']} proposal now (title: '{t['title']}'). Price all amounts "
        f"in {currency} and date it {today}."
    )

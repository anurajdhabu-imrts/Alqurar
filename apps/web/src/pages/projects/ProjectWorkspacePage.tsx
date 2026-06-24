import { useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  FileSignature,
  FileText,
  FolderKanban,
  GanttChartSquare,
  ListChecks,
  MessageSquareText,
  Paperclip,
  Pencil,
  UserPlus,
  Users,
} from "lucide-react";
import { Badge, type Tone } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { DocumentsPanel } from "@/components/DocumentsPanel";
import { UploadedDocsList } from "@/components/client/UploadedDocsList";
import { AssignClientsModal } from "@/components/projects/AssignClientsModal";
import { useProjectClients } from "@/hooks/useAssignments";
import { useProjectDocuments, useCreateProjectDoc } from "@/hooks/useProjectDocuments";
import { useUsersQuery } from "@/hooks/useUsers";
import { useClientProfiles } from "@/store/clientProfiles";
import { useAllProjects } from "@/store/projects";
import { docTypeFromName } from "@/mock/clientData";
import { useAuthStore } from "@/store/authStore";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Project } from "@/types";

const statusTone: Record<Project["status"], Tone> = {
  Active: "success",
  Closeout: "warning",
  Completed: "info",
};

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className="text-xs text-faint uppercase tracking-wide">{label}</p>
      <p className="text-sm font-medium text-ink mt-0.5">{value ?? "—"}</p>
    </div>
  );
}

/** Placeholder for the analysis tabs still to be built. */
function ComingSoon({ icon: Icon, title, desc }: { icon: typeof FileText; title: string; desc: string }) {
  return (
    <Card className="p-10 text-center">
      <span className="size-12 mx-auto rounded-xl bg-navy-50 text-navy-600 grid place-items-center">
        <Icon className="size-6" />
      </span>
      <h3 className="mt-3 font-semibold text-ink">{title}</h3>
      <p className="mt-1 text-sm text-muted max-w-md mx-auto">{desc}</p>
      <span className="badge bg-amber-50 text-amber-700 mt-3 inline-flex">Coming next</span>
    </Card>
  );
}

export function ProjectWorkspacePage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const projects = useAllProjects();
  const project = projects.find((p) => p.id === id);

  const { data: clientIds } = useProjectClients(id);
  const { data: users = [] } = useUsersQuery();
  const profiles = useClientProfiles();
  const { data: docs = [] } = useProjectDocuments(id);
  const createDoc = useCreateProjectDoc();
  const currentUser = useAuthStore((s) => s.user);

  const [tab, setTab] = useState("overview");
  const [assignOpen, setAssignOpen] = useState(false);

  const clients = useMemo(() => {
    return (clientIds ?? []).map((cid) => {
      const u = users.find((x) => x.id === cid);
      const prof = profiles.find((p) => p.userId === cid || (u && p.email.toLowerCase() === u.email.toLowerCase()));
      return { id: cid, name: u?.name ?? cid, email: u?.email ?? "", company: prof?.company };
    });
  }, [clientIds, users, profiles]);

  if (!project) {
    return (
      <div className="text-center py-20">
        <p className="text-lg font-semibold text-ink">Project not found</p>
        <p className="text-muted mt-1">It may have been deleted.</p>
        <Link to="/projects" className="btn btn-outline mt-4 inline-flex">Back to projects</Link>
      </div>
    );
  }

  function handleUploaded(file: File) {
    createDoc.mutate({
      id: `doc-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
      projectId: id,
      name: file.name,
      type: docTypeFromName(file.name),
      sizeKB: Math.max(1, Math.round(file.size / 1024)),
      uploadedAt: new Date().toISOString(),
      uploadedBy: currentUser?.name ?? "Al Qarar",
      status: "Uploaded",
    });
  }

  return (
    <>
      <Link to="/projects" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-navy-700 mb-4">
        <ArrowLeft className="size-4" /> Projects
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-[26px] leading-tight font-bold text-ink tracking-tight">{project.name}</h1>
            <Badge tone={statusTone[project.status]} dot>{project.status}</Badge>
          </div>
          <p className="text-sm text-faint mt-1">{project.code} · {project.standard}{project.location ? ` · ${project.location}` : ""}</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn btn-outline btn-sm" onClick={() => setAssignOpen(true)}>
            <UserPlus className="size-4" /> Assign clients
          </button>
          {project.source === "created" && (
            <button className="btn btn-outline btn-sm" onClick={() => navigate(`/projects/${id}/edit`)}>
              <Pencil className="size-4" /> Edit
            </button>
          )}
        </div>
      </div>

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: "overview", label: "Overview", icon: FolderKanban },
          { id: "dataroom", label: "Data Room", icon: Paperclip, count: docs.length },
          { id: "events", label: "Delay Events", icon: ListChecks },
          { id: "windows", label: "Windows Analysis", icon: GanttChartSquare },
          { id: "queries", label: "Queries", icon: MessageSquareText },
          { id: "claim", label: "EOT Claim", icon: FileSignature },
        ]}
      />

      <div className="pt-5">
        {/* ── Overview ── */}
        {tab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-4">
              <Card>
                <CardHeader title="Project details" />
                <div className="p-5 grid grid-cols-2 sm:grid-cols-3 gap-5">
                  <Field label="Employer" value={project.employer || "—"} />
                  <Field label="Engineer" value={project.engineer || "—"} />
                  <Field label="Contractor" value={project.contractor || "—"} />
                  <Field label="Contract" value={project.standard} />
                  <Field label="Value" value={project.value ? `${formatCurrency(project.value)} ${project.currency}` : "—"} />
                  <Field label="LOA / LPO ref" value={project.loaRef || "—"} />
                </div>
              </Card>
              <Card>
                <CardHeader title="Key dates" subtitle="Anchor the windows / delay analysis" />
                <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-5">
                  <Field label="Commencement" value={project.commencementDate ? formatDate(project.commencementDate) : "—"} />
                  <Field label="Baseline completion" value={project.completionDate ? formatDate(project.completionDate) : "—"} />
                  <Field label="Time for completion" value={project.timeForCompletionDays ? `${project.timeForCompletionDays} days` : "—"} />
                  <Field label="Data date" value={project.dataDate ? formatDate(project.dataDate) : "—"} />
                </div>
              </Card>
              <Card>
                <CardHeader title="Baseline programme" />
                <div className="p-5">
                  {project.baselineProgramme ? (
                    <p className="text-sm text-ink inline-flex items-center gap-2">
                      <Paperclip className="size-4 text-navy-600" /> {project.baselineProgramme}
                    </p>
                  ) : (
                    <p className="text-sm text-muted">No baseline programme uploaded yet.</p>
                  )}
                </div>
              </Card>
            </div>

            <div className="space-y-4">
              <Card>
                <CardHeader
                  title="Assigned clients"
                  subtitle={`${clients.length} client(s)`}
                  action={
                    <button className="btn btn-outline btn-sm" onClick={() => setAssignOpen(true)}>
                      <UserPlus className="size-3.5" /> Assign
                    </button>
                  }
                />
                <div className="divide-y divide-border">
                  {clients.length === 0 && (
                    <p className="px-5 py-6 text-sm text-muted">No clients assigned yet.</p>
                  )}
                  {clients.map((c) => (
                    <div key={c.id} className="px-5 py-3 flex items-center gap-3">
                      <span className="size-9 shrink-0 rounded-full bg-navy-100 text-navy-800 grid place-items-center text-xs font-semibold">
                        {(c.company ?? c.name).slice(0, 2).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink truncate flex items-center gap-1.5">
                          <Building2 className="size-3.5 text-faint shrink-0" /> {c.company ?? c.name}
                        </p>
                        <p className="text-xs text-muted truncate">{c.email}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="p-5">
                <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <Users className="size-4 text-navy-500" /> Documents
                </div>
                <p className="mt-2 text-3xl font-bold font-display tabular-nums text-ink">{docs.length}</p>
                <button className="btn btn-outline btn-sm mt-3" onClick={() => setTab("dataroom")}>
                  <Paperclip className="size-3.5" /> Open Data Room
                </button>
              </Card>
            </div>
          </div>
        )}

        {/* ── Data Room ── */}
        {tab === "dataroom" && (
          <div className="space-y-4">
            <Card className="p-5">
              <div className="mb-4">
                <h3 className="text-base font-semibold text-ink">Document data room</h3>
                <p className="text-sm text-muted">
                  Upload the contract, programme, correspondence and site records for this project. Each file is read by
                  AI, which classifies it and explains how it bears on the claim. Delay events are extracted from here.
                </p>
              </div>
              <DocumentsPanel
                seed={[]}
                kind="claim"
                claimContext={{ standard: project.standard }}
                onUploaded={handleUploaded}
              />
            </Card>

            <Card>
              <CardHeader title="Uploaded documents" subtitle={`${docs.length} document(s) — incl. files uploaded by the client`} />
              <UploadedDocsList docs={docs} />
            </Card>
          </div>
        )}

        {/* ── Pipeline tabs (next to build) ── */}
        {tab === "events" && (
          <ComingSoon
            icon={ListChecks}
            title="Delay Events"
            desc="AI-identified delay events from the uploaded documents — each with its chronology, FIDIC clause, cause (Employer / Contractor / Concurrent) and admissibility."
          />
        )}
        {tab === "windows" && (
          <ComingSoon
            icon={GanttChartSquare}
            title="Windows Analysis"
            desc="Window-by-window forensic delay analysis producing the cumulative Employer vs Contractor delay and the total EOT entitlement."
          />
        )}
        {tab === "queries" && (
          <ComingSoon
            icon={MessageSquareText}
            title="Queries / RFI"
            desc="The register of questions raised to the client/engineer for missing information, with responses and status."
          />
        )}
        {tab === "claim" && (
          <ComingSoon
            icon={FileSignature}
            title="EOT Claim"
            desc="The consolidated Extension of Time claim assembled from the events and windows analysis, exportable to Word/PDF."
          />
        )}
      </div>

      {assignOpen && <AssignClientsModal project={project} onClose={() => setAssignOpen(false)} />}
    </>
  );
}

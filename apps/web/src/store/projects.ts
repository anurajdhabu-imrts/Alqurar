// ── Projects ───────────────────────────────────────────────────────────────
// Projects are the central object of the platform. The contract-derived demo
// projects stay in-code; admin-created projects are stored on the BACKEND
// (app/api/v1/projects.py) so they resolve from any browser or device — which
// is what the client portal needs to show an assigned project. (Previously
// these lived in localStorage, so a client on another browser couldn't see them.)
import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { convertProposalApi, createProjectApi, deleteProjectApi, listProjectsApi } from "@/api/projects";
import type { Project } from "@/types";

/** A Project plus the extra detail captured by the creation wizard. */
export interface ProjectDetails extends Project {
  location?: string;
  /** The Engineer (employer's representative). */
  engineer?: string;
  /** Letter of Award / LPO reference. */
  loaRef?: string;
  commencementDate?: string;
  /** Time for Completion, in calendar days. */
  timeForCompletionDays?: number;
  /** Current programme data date. */
  dataDate?: string;
  /** Filename of the uploaded approved baseline programme (.xer). */
  baselineProgramme?: string;
  createdAt?: string;
  /** Where the project came from. */
  source: "contract" | "created";
  /** "project" (default) or "proposal" — proposals live in the Proposals area
   *  but reuse the same documents / delay-event pipeline. */
  kind?: "project" | "proposal";
}

export const projectsKey = ["projects"] as const;

/** Created projects fetched from the backend. */
export function useProjectsQuery() {
  return useQuery({ queryKey: projectsKey, queryFn: listProjectsApi, staleTime: 30_000 });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (project: ProjectDetails) => createProjectApi(project),
    onSuccess: (created) => {
      // Seed the cache so the new record is available immediately (e.g. when the
      // proposal wizard navigates straight into the new proposal's workspace),
      // then refetch to reconcile.
      qc.setQueryData<ProjectDetails[]>(projectsKey, (old) => {
        const list = old ?? [];
        const rest = list.filter((p) => p.id !== created.id);
        return [...rest, created];
      });
      qc.invalidateQueries({ queryKey: projectsKey });
    },
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string) => deleteProjectApi(projectId),
    onSuccess: () => qc.invalidateQueries({ queryKey: projectsKey }),
  });
}

/** Confirm a proposal → copy it into a new ordinary project. Returns the created
 *  project so the caller can link straight to it. */
export function useConvertProposal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ proposalId, newId, newCode }: { proposalId: string; newId: string; newCode: string }) =>
      convertProposalApi(proposalId, newId, newCode),
    onSuccess: (created) => {
      qc.setQueryData<ProjectDetails[]>(projectsKey, (old) => {
        const list = old ?? [];
        const rest = list.filter((p) => p.id !== created.id);
        return [...rest, created];
      });
      qc.invalidateQueries({ queryKey: projectsKey });
      // Confirm also assigns + confirms the client server-side — refresh those.
      qc.invalidateQueries({ queryKey: ["assignments"] });
      qc.invalidateQueries({ queryKey: ["client-profiles"] });
    },
  });
}

/** All ordinary projects (excludes proposals, which have their own area). */
export function useAllProjects(): ProjectDetails[] {
  const { data } = useProjectsQuery();
  return useMemo(() => (data ?? []).filter((p) => (p.kind ?? "project") !== "proposal"), [data]);
}

/** All proposals (kind === "proposal"), newest first. */
export function useAllProposals(): ProjectDetails[] {
  const { data } = useProjectsQuery();
  return useMemo(() => {
    const list = (data ?? []).filter((p) => p.kind === "proposal");
    return list.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  }, [data]);
}

/** A single proposal/project by id (searches the full unfiltered list). */
export function useProjectById(id: string): ProjectDetails | undefined {
  const { data } = useProjectsQuery();
  return useMemo(() => (data ?? []).find((p) => p.id === id), [data, id]);
}

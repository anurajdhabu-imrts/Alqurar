// ── Projects ───────────────────────────────────────────────────────────────
// Projects are the central object of the platform. The contract-derived demo
// projects stay in-code; admin-created projects are stored on the BACKEND
// (app/api/v1/projects.py) so they resolve from any browser or device — which
// is what the client portal needs to show an assigned project. (Previously
// these lived in localStorage, so a client on another browser couldn't see them.)
import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createProjectApi, deleteProjectApi, listProjectsApi } from "@/api/projects";
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
    onSuccess: () => qc.invalidateQueries({ queryKey: projectsKey }),
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string) => deleteProjectApi(projectId),
    onSuccess: () => qc.invalidateQueries({ queryKey: projectsKey }),
  });
}

/** All projects created in the app (stored on the backend). */
export function useAllProjects(): ProjectDetails[] {
  const { data } = useProjectsQuery();
  return useMemo(() => data ?? [], [data]);
}

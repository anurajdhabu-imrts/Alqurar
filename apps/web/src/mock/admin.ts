import type { ManagedUser, PermissionGroup, Role } from "@/types";

export const permissionGroups: PermissionGroup[] = [
  {
    module: "EOT Claims",
    perms: [
      { id: "claims.view", label: "View claims" },
      { id: "claims.create", label: "Create & edit claims" },
      { id: "claims.generate", label: "Generate AI drafts" },
      { id: "claims.submit", label: "Submit claims" },
      { id: "claims.delete", label: "Delete claims" },
      { id: "claims.assign_client", label: "Assign clients to projects" },
    ],
  },
  {
    module: "Contracts",
    perms: [
      { id: "contracts.view", label: "View contracts" },
      { id: "contracts.manage", label: "Manage clauses & obligations" },
    ],
  },
  {
    module: "Obligations & Notices",
    perms: [
      { id: "notices.view", label: "View notice timeline" },
      { id: "notices.manage", label: "Manage notices & deadlines" },
    ],
  },
  {
    module: "Dispute Resolution",
    perms: [
      { id: "disputes.view", label: "View dispute cases" },
      { id: "disputes.manage", label: "Manage dispute cases" },
    ],
  },
  {
    module: "Administration",
    perms: [
      { id: "admin.users", label: "Manage users" },
      { id: "admin.roles", label: "Manage roles & permissions" },
      { id: "admin.settings", label: "Platform settings" },
    ],
  },
  {
    module: "Client Portal",
    perms: [
      { id: "client.dashboard", label: "Access client dashboard" },
      { id: "client.projects.view", label: "View assigned projects" },
      { id: "client.documents.upload", label: "Upload claim documents" },
      { id: "client.documents.delete", label: "Delete uploaded documents" },
    ],
  },
];

export const allPermissionIds = permissionGroups.flatMap((g) => g.perms.map((p) => p.id));

export const seedRoles: Role[] = [
  {
    id: "r-admin",
    name: "Administrator",
    description: "Full access to all projects, users and platform settings.",
    color: "#0a2540",
    system: true,
    permissionIds: allPermissionIds,
  },
  {
    id: "r-claims",
    name: "Claims Manager",
    description: "Create and manage EOT claims, delay events and submissions.",
    color: "#e8920c",
    system: true,
    permissionIds: [
      "claims.view",
      "claims.create",
      "claims.generate",
      "claims.submit",
      "contracts.view",
      "notices.view",
      "notices.manage",
      "disputes.view",
    ],
  },
  {
    id: "r-contract",
    name: "Contract Manager",
    description: "Manage contracts, clauses, obligations and variations.",
    color: "#2563eb",
    system: true,
    permissionIds: ["claims.view", "contracts.view", "contracts.manage", "notices.view", "notices.manage"],
  },
  {
    id: "r-legal",
    name: "Legal Reviewer",
    description: "Review and approve AI-generated outputs and submissions.",
    color: "#18794e",
    system: true,
    permissionIds: ["claims.view", "claims.generate", "claims.submit", "contracts.view", "notices.view", "disputes.view", "disputes.manage"],
  },
  {
    id: "r-client",
    name: "Client View",
    description: "Read-only client portal: assigned projects and claim document upload.",
    color: "#5a6878",
    system: true,
    permissionIds: [
      "claims.view",
      "contracts.view",
      "notices.view",
      "disputes.view",
      "client.dashboard",
      "client.projects.view",
      "client.documents.upload",
    ],
  },
];

export const seedUsers: ManagedUser[] = [
  { id: "u-1", name: "Akshay Patil", email: "claims@alqarar.ae", role: "Administrator", status: "Active", lastActive: "2026-05-20" },
  { id: "u-2", name: "Sara Khan", email: "sara.khan@alqarar.ae", role: "Claims Manager", status: "Active", lastActive: "2026-05-20" },
  { id: "u-3", name: "Omar Haddad", email: "omar.haddad@alqarar.ae", role: "Contract Manager", status: "Active", lastActive: "2026-05-19" },
  { id: "u-4", name: "Priya Nair", email: "priya.nair@alqarar.ae", role: "Legal Reviewer", status: "Active", lastActive: "2026-05-18" },
  { id: "u-5", name: "Mona Al-Rashid", email: "mona.r@alqarar.ae", role: "Claims Manager", status: "Active", lastActive: "2026-05-17" },
  { id: "u-6", name: "James Whitfield", email: "j.whitfield@client.com", role: "Client View", status: "Invited", lastActive: "" },
  { id: "u-7", name: "Daniel Cruz", email: "daniel.cruz@alqarar.ae", role: "Contract Manager", status: "Suspended", lastActive: "2026-04-28" },
];

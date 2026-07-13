import { useMemo, useState } from "react";
import { Loader2, Pencil, Search, Trash2, UserCog, UserPlus } from "lucide-react";
import { apiErrorMessage } from "@/api/client";
import { Badge, type Tone } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmployeeModal } from "@/components/employees/EmployeeModal";
import { useDeleteEmployee, useEmployeesQuery } from "@/hooks/useEmployees";
import { useHasPermission } from "@/hooks/usePermission";
import { formatCurrencyFull } from "@/lib/utils";
import type { Employee, EmployeeStatus } from "@/api/employees";

const statusTone: Record<EmployeeStatus, Tone> = {
  Active: "success",
  Inactive: "neutral",
};

export function EmployeesPage() {
  const { data: employees = [], isLoading, isError, error } = useEmployeesQuery();
  const canManage = useHasPermission("admin.users");
  const deleteEmployee = useDeleteEmployee();

  const [query, setQuery] = useState("");
  const [editTarget, setEditTarget] = useState<Employee | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter(
      (e) =>
        e.designation.toLowerCase().includes(q) ||
        (e.department ?? "").toLowerCase().includes(q),
    );
  }, [employees, query]);

  const summary = [
    { label: "Total employees", value: employees.length },
    { label: "Active", value: employees.filter((e) => e.status === "Active").length },
    { label: "Roles", value: new Set(employees.map((e) => e.designation)).size },
    {
      label: "Avg. hourly rate",
      value: employees.length
        ? formatCurrencyFull(
            Math.round(employees.reduce((n, e) => n + e.hourlyRate, 0) / employees.length),
            "",
          ).trim()
        : "—",
    },
  ];

  return (
    <>
      <PageHeader
        title="Employees"
        subtitle="Master data for proposal costing. Rates set here populate the costing dropdowns; each costing snapshots the rate at the time it is saved."
        actions={
          canManage && (
            <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
              <UserPlus className="size-4" /> Add employee
            </button>
          )
        }
      />

      {isError && (
        <p className="mb-4 text-sm text-error bg-error-bg rounded-lg px-3 py-2">
          {apiErrorMessage(error, "Couldn't load employees — is the backend running?")}
        </p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
        {summary.map((s) => (
          <div key={s.label} className="card p-4">
            <p className="text-xs font-medium text-muted">{s.label}</p>
            <p className="mt-1 text-2xl font-bold font-display text-ink tabular-nums">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-faint" />
          <input
            className="input pl-9"
            placeholder="Search role or department…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <span className="text-sm text-muted ml-auto">{filtered.length} of {employees.length}</span>
      </div>

      <Card>
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full text-sm min-w-[680px]">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-faint border-b border-border bg-navy-50/40">
                <th className="font-semibold px-5 py-3">Designation / role</th>
                <th className="font-semibold px-3 py-3">Department</th>
                <th className="font-semibold px-3 py-3 text-right">Hourly rate</th>
                <th className="font-semibold px-3 py-3">Status</th>
                {canManage && <th className="font-semibold px-5 py-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {isLoading && employees.length === 0 && (
                <tr>
                  <td colSpan={canManage ? 5 : 4} className="px-5 py-12 text-center text-muted">
                    <Loader2 className="size-4 animate-spin inline mr-2" /> Loading employees…
                  </td>
                </tr>
              )}
              {!isLoading &&
                filtered.map((e) => (
                  <tr key={e.id} className="border-b border-border last:border-0 hover:bg-navy-50/50">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="size-9 shrink-0 rounded-full bg-linear-to-br from-navy-700 to-navy-900 text-white grid place-items-center text-xs font-semibold">
                          {e.designation.slice(0, 2).toUpperCase()}
                        </div>
                        <span className="font-semibold text-ink">{e.designation}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-muted">{e.department || <span className="text-faint">—</span>}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-ink font-medium">
                      {formatCurrencyFull(e.hourlyRate, "")}/hr
                    </td>
                    <td className="px-3 py-3"><Badge tone={statusTone[e.status]} dot>{e.status}</Badge></td>
                    {canManage && (
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button className="btn btn-ghost px-2 h-8" onClick={() => setEditTarget(e)} title="Edit" aria-label="Edit employee">
                            <Pencil className="size-4 text-muted" />
                          </button>
                          <button className="btn btn-ghost px-2 h-8 text-error hover:bg-error-bg" onClick={() => setDeleteTarget(e)} title="Delete" aria-label="Delete employee">
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={canManage ? 5 : 4} className="px-5 py-12 text-center text-muted">
                    {employees.length === 0 ? (
                      <div>
                        <UserCog className="size-8 mx-auto text-faint mb-3" />
                        <p className="font-semibold text-ink">No employees yet</p>
                        <p className="text-sm mt-1">Add your team so their rates are available for proposal costing.</p>
                      </div>
                    ) : (
                      "No employees match your search."
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {showAdd && <EmployeeModal onClose={() => setShowAdd(false)} />}
      {editTarget && <EmployeeModal employee={editTarget} onClose={() => setEditTarget(null)} />}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete employee?"
        message={
          deleteTarget
            ? `${deleteTarget.designation} will be removed from the master list. Costings already saved keep their snapshotted rate and are unaffected.`
            : ""
        }
        confirmLabel="Delete employee"
        onConfirm={() => {
          if (deleteTarget) deleteEmployee.mutate(deleteTarget.id);
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}

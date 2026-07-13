import { useState } from "react";
import { Loader2, UserCog, X } from "lucide-react";
import { apiErrorMessage } from "@/api/client";
import { useCreateEmployee, useUpdateEmployee } from "@/hooks/useEmployees";
import type { Employee, EmployeeStatus } from "@/api/employees";

const STATUSES: EmployeeStatus[] = ["Active", "Inactive"];

/** Common consultancy roles, offered as datalist suggestions so designations stay
 * consistent (the costing role dropdown groups by exact designation). */
const ROLE_SUGGESTIONS = [
  "Director",
  "Principal Consultant",
  "Technical Lead",
  "Senior Consultant",
  "Consultant",
  "Planning Engineer",
  "Quantum Analyst",
];

/** Create or edit an employee. Passing `employee` switches to edit mode. */
export function EmployeeModal({
  employee,
  onClose,
}: {
  employee?: Employee | null;
  onClose: () => void;
}) {
  const create = useCreateEmployee();
  const update = useUpdateEmployee();
  const isEdit = Boolean(employee);

  const [designation, setDesignation] = useState(employee?.designation ?? "");
  const [hourlyRate, setHourlyRate] = useState(employee ? String(employee.hourlyRate) : "");
  const [department, setDepartment] = useState(employee?.department ?? "");
  const [status, setStatus] = useState<EmployeeStatus>(employee?.status ?? "Active");
  const [error, setError] = useState("");

  async function onSave() {
    setError("");
    if (!designation.trim()) return setError("Designation / role is required.");
    const rate = parseFloat(hourlyRate);
    if (!Number.isFinite(rate) || rate < 0) return setError("Enter a valid hourly rate.");

    const payload = {
      designation: designation.trim(),
      hourlyRate: rate,
      department: department.trim() || undefined,
      status,
    };

    try {
      if (isEdit && employee) {
        await update.mutateAsync({ id: employee.id, patch: payload });
      } else {
        await create.mutateAsync(payload);
      }
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err, "Could not save — is the backend running?"));
    }
  }

  const saving = create.isPending || update.isPending;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-navy-950/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card w-full max-w-md p-6 shadow-lg max-h-[90vh] flex flex-col">
        <div className="flex items-start justify-between gap-4 mb-4">
          <h3 className="text-lg font-bold text-ink inline-flex items-center gap-2">
            <UserCog className="size-4.5 text-navy-700" /> {isEdit ? "Edit employee" : "Add employee"}
          </h3>
          <button className="btn btn-ghost px-2" onClick={onClose} aria-label="Close">
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scroll-thin -mx-1 px-1 space-y-3">
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Designation / role</label>
            <input
              className="input"
              list="employee-role-suggestions"
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
              placeholder="e.g. Principal Consultant"
            />
            <datalist id="employee-role-suggestions">
              {ROLE_SUGGESTIONS.map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Hourly rate</label>
              <input
                className="input"
                type="number"
                min="0"
                step="0.01"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">
                Department <span className="text-faint font-normal">(optional)</span>
              </label>
              <input className="input" value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="e.g. Claims" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Status</label>
            <select className="input" value={status} onChange={(e) => setStatus(e.target.value as EmployeeStatus)}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <p className="text-xs text-faint mt-1">Inactive employees are hidden from the costing dropdowns.</p>
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-error bg-error-bg rounded-md px-3 py-2">{error}</p>}

        <div className="flex items-center justify-end gap-2 pt-4 mt-2 border-t border-border">
          <button className="btn btn-outline" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={onSave} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {saving ? "Saving…" : isEdit ? "Save changes" : "Add employee"}
          </button>
        </div>
      </div>
    </div>
  );
}

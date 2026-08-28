import { useEffect, useState, type FormEvent } from 'react';
import { createEmployee, updateEmployee } from '../../api/employees';
import type { Employee, EmployeeInput, EmployeeStatus } from '../../types/employee';
import { FormModal } from '../ui/FormModal';
import '../../styles/forms.css';

type EmployeeFormModalProps = {
  open: boolean;
  token: string;
  employee?: Employee | null;
  onClose: () => void;
  onSaved: () => void;
  onError: (message: string) => void;
};

function todayDate() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function EmployeeFormModal({
  open,
  token,
  employee,
  onClose,
  onSaved,
  onError,
}: EmployeeFormModalProps) {
  const now = new Date();
  const [form, setForm] = useState<EmployeeInput>({
    fullName: '',
    fatherOrSpouseName: '',
    phone: '',
    position: '',
    joiningDate: todayDate(),
    monthlySalary: 0,
    status: 'ACTIVE',
  });
  const [originalSalary, setOriginalSalary] = useState(0);
  const [salaryEffectiveMonth, setSalaryEffectiveMonth] = useState(
    String(now.getMonth() + 1),
  );
  const [salaryEffectiveYear, setSalaryEffectiveYear] = useState(
    String(now.getFullYear()),
  );
  const [salaryChangeReason, setSalaryChangeReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (employee) {
      const salary = Number(employee.monthlySalary ?? 0);
      setOriginalSalary(salary);
      setForm({
        fullName: employee.fullName,
        fatherOrSpouseName:
          employee.fatherOrSpouseName ?? employee.fatherName ?? '',
        phone: employee.phone,
        alternatePhone: employee.alternatePhone ?? '',
        email: employee.email ?? '',
        cnic: employee.cnic ?? '',
        address: employee.address ?? '',
        city: employee.city ?? '',
        position: employee.position,
        department: employee.department ?? '',
        joiningDate: employee.joiningDate.slice(0, 10),
        monthlySalary: salary,
        bankName: employee.bankName ?? '',
        accountTitle: employee.accountTitle ?? '',
        accountNumberOrIban: employee.accountNumberOrIban ?? '',
        emergencyContactName: employee.emergencyContactName ?? '',
        emergencyContactPhone: employee.emergencyContactPhone ?? '',
        status: employee.status,
        notes: employee.notes ?? '',
      });
    } else {
      setOriginalSalary(0);
      setForm({
        fullName: '',
        fatherOrSpouseName: '',
        phone: '',
        position: '',
        joiningDate: todayDate(),
        monthlySalary: 0,
        status: 'ACTIVE',
      });
    }
    setSalaryEffectiveMonth(String(new Date().getMonth() + 1));
    setSalaryEffectiveYear(String(new Date().getFullYear()));
    setSalaryChangeReason('');
  }, [open, employee]);

  function setField<K extends keyof EmployeeInput>(
    key: K,
    value: EmployeeInput[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const salaryChanged =
    Boolean(employee) && Number(form.monthlySalary) !== originalSalary;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;

    if (
      !form.fullName.trim() ||
      !form.fatherOrSpouseName.trim() ||
      !form.phone.trim() ||
      !form.position.trim()
    ) {
      onError('Full name, father name, phone and position are required.');
      return;
    }

    if (salaryChanged && salaryChangeReason.trim().length < 3) {
      onError('Salary change requires a reason and effective month/year.');
      return;
    }

    const payload: EmployeeInput = {
      ...form,
      fullName: form.fullName.trim(),
      fatherOrSpouseName: form.fatherOrSpouseName.trim(),
      phone: form.phone.trim(),
      position: form.position.trim(),
      monthlySalary: Number(form.monthlySalary) || 0,
      cnic: form.cnic?.trim() || undefined,
    };

    if (salaryChanged) {
      payload.salaryEffectiveMonth = Number(salaryEffectiveMonth);
      payload.salaryEffectiveYear = Number(salaryEffectiveYear);
      payload.salaryChangeReason = salaryChangeReason.trim();
    }

    setSaving(true);
    try {
      if (employee) {
        await updateEmployee(token, employee.id, payload);
      } else {
        await createEmployee(token, {
          ...payload,
          monthlySalary: payload.monthlySalary ?? 0,
        });
      }
      onSaved();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Unable to save employee.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormModal
      open={open}
      title={employee ? 'Edit Employee' : 'Add Employee'}
      onClose={onClose}
    >
      <form className="form-grid" onSubmit={handleSubmit}>
        <div className="form-grid form-grid--2">
          <label className="form-field">
            <span>Full Name</span>
            <input
              value={form.fullName}
              onChange={(e) => setField('fullName', e.target.value)}
              required
            />
          </label>
          <label className="form-field">
            <span>Father Name</span>
            <input
              value={form.fatherOrSpouseName}
              onChange={(e) => setField('fatherOrSpouseName', e.target.value)}
              required
            />
          </label>
          <label className="form-field">
            <span>Phone</span>
            <input
              value={form.phone}
              onChange={(e) => setField('phone', e.target.value)}
              required
            />
          </label>
          <label className="form-field">
            <span>Alternate Phone</span>
            <input
              value={form.alternatePhone ?? ''}
              onChange={(e) => setField('alternatePhone', e.target.value)}
            />
          </label>
          <label className="form-field">
            <span>Email</span>
            <input
              type="email"
              value={form.email ?? ''}
              onChange={(e) => setField('email', e.target.value)}
            />
          </label>
          <label className="form-field">
            <span>CNIC</span>
            <input
              value={form.cnic ?? ''}
              onChange={(e) => setField('cnic', e.target.value)}
            />
          </label>
          <label className="form-field">
            <span>Position</span>
            <input
              value={form.position}
              onChange={(e) => setField('position', e.target.value)}
              required
            />
          </label>
          <label className="form-field">
            <span>Department</span>
            <input
              value={form.department ?? ''}
              onChange={(e) => setField('department', e.target.value)}
            />
          </label>
          <label className="form-field">
            <span>Joining Date</span>
            <input
              type="date"
              value={form.joiningDate}
              onChange={(e) => setField('joiningDate', e.target.value)}
              required
            />
          </label>
          <label className="form-field">
            <span>Status</span>
            <select
              value={form.status ?? 'ACTIVE'}
              onChange={(e) =>
                setField('status', e.target.value as EmployeeStatus)
              }
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="RESIGNED">Resigned</option>
              <option value="TERMINATED">Terminated</option>
            </select>
          </label>
          <label className="form-field">
            <span>Monthly Salary (PKR)</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.monthlySalary}
              onChange={(e) =>
                setField('monthlySalary', Number(e.target.value))
              }
              required
            />
          </label>
          <label className="form-field">
            <span>City</span>
            <input
              value={form.city ?? ''}
              onChange={(e) => setField('city', e.target.value)}
            />
          </label>
        </div>

        {salaryChanged ? (
          <div className="form-grid form-grid--2">
            <label className="form-field">
              <span>Salary Effective Month</span>
              <input
                type="number"
                min="1"
                max="12"
                value={salaryEffectiveMonth}
                onChange={(e) => setSalaryEffectiveMonth(e.target.value)}
                required
              />
            </label>
            <label className="form-field">
              <span>Salary Effective Year</span>
              <input
                type="number"
                min="2000"
                max="2100"
                value={salaryEffectiveYear}
                onChange={(e) => setSalaryEffectiveYear(e.target.value)}
                required
              />
            </label>
            <label className="form-field form-field--full">
              <span>Salary Change Reason</span>
              <input
                value={salaryChangeReason}
                onChange={(e) => setSalaryChangeReason(e.target.value)}
                required
              />
            </label>
          </div>
        ) : null}

        <div className="form-grid form-grid--2">
          <label className="form-field">
            <span>Bank Name</span>
            <input
              value={form.bankName ?? ''}
              onChange={(e) => setField('bankName', e.target.value)}
            />
          </label>
          <label className="form-field">
            <span>Account Title</span>
            <input
              value={form.accountTitle ?? ''}
              onChange={(e) => setField('accountTitle', e.target.value)}
            />
          </label>
          <label className="form-field">
            <span>Account Number / IBAN</span>
            <input
              value={form.accountNumberOrIban ?? ''}
              onChange={(e) => setField('accountNumberOrIban', e.target.value)}
            />
          </label>
        </div>

        <label className="form-field">
          <span>Address</span>
          <textarea
            value={form.address ?? ''}
            onChange={(e) => setField('address', e.target.value)}
          />
        </label>

        <div className="form-grid form-grid--2">
          <label className="form-field">
            <span>Emergency Contact Name</span>
            <input
              value={form.emergencyContactName ?? ''}
              onChange={(e) =>
                setField('emergencyContactName', e.target.value)
              }
            />
          </label>
          <label className="form-field">
            <span>Emergency Contact Phone</span>
            <input
              value={form.emergencyContactPhone ?? ''}
              onChange={(e) =>
                setField('emergencyContactPhone', e.target.value)
              }
            />
          </label>
        </div>

        <label className="form-field">
          <span>Notes</span>
          <textarea
            value={form.notes ?? ''}
            onChange={(e) => setField('notes', e.target.value)}
          />
        </label>

        <div className="form-actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving ? 'Saving…' : employee ? 'Update' : 'Save Employee'}
          </button>
        </div>
      </form>
    </FormModal>
  );
}

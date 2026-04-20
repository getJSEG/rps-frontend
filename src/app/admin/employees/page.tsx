"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AdminNavbar from "../../components/AdminNavbar";
import { canAccessAdminPanel, isAuthenticated } from "../../../utils/roles";
import { FiEdit, FiTrash2 } from "react-icons/fi";
import { employeesAPI, getProductImageUrl } from "../../../utils/api";

interface Employee {
  id: number;
  email: string;
  full_name: string;
  telephone: string | null;
  role: string;
  is_active: boolean;
  is_approved: boolean;
  profile_image: string | null;
  hire_date: string | null;
  created_at: string;
  updated_at?: string;
}

const emptyForm = {
  full_name: "",
  email: "",
  password: "",
  telephone: "",
  role: "employee" as "admin" | "employee",
  profile_image: "",
  hire_date: "",
};

/** Matches backend `employeeController.js` STRONG_PASSWORD_REGEX */
const STRONG_PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d).+$/;

const PASSWORD_RULES_HINT =
  "Use at least 6 characters with one uppercase letter and one number.";

type FieldErrors = {
  full_name?: string;
  email?: string;
  password?: string;
};

/** Maps backend error messages to field-level vs form-level display (create + update). */
function mapEmployeeApiError(message: string): { fields?: FieldErrors; form?: string } {
  const m = message.trim();
  if (!m) return { form: "Something went wrong." };
  if (/password must include at least one uppercase/i.test(m) || /uppercase letter and one number/i.test(m)) {
    return { fields: { password: m } };
  }
  if (/password must be at least 6/i.test(m)) return { fields: { password: m } };
  if (/email already exists|account with this email/i.test(m)) return { fields: { email: m } };
  return { form: m };
}

const getImageSrc = (path: string | null | undefined): string => {
  if (!path || typeof path !== "string") return "";
  const p = path.trim();
  if (!p) return "";
  if (p.startsWith("uploads/")) return getProductImageUrl(`/${p}`);
  return getProductImageUrl(p);
};

export default function EmployeesPage() {
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [addForm, setAddForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState({
    full_name: "",
    email: "",
    telephone: "",
    is_active: true,
    is_approved: true,
    password: "",
    role: "employee" as "admin" | "employee",
    profile_image: "",
    hire_date: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showAddPassword, setShowAddPassword] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [addFormImagePreview, setAddFormImagePreview] = useState<string>("");
  const [editFormImagePreview, setEditFormImagePreview] = useState<string>("");
  const [addFieldErrors, setAddFieldErrors] = useState<FieldErrors>({});
  const [addFormError, setAddFormError] = useState<string | null>(null);
  const [editFieldErrors, setEditFieldErrors] = useState<FieldErrors>({});
  const [editFormError, setEditFormError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isAuthenticated()) {
      router.push("/");
      return;
    }
    if (!canAccessAdminPanel()) {
      router.push("/");
      return;
    }
  }, [router]);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await employeesAPI.getAll();
      setEmployees(res.employees || []);
    } catch (e: any) {
      setError(e?.message || "Failed to load employees");
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const openAdd = () => {
    setAddForm(emptyForm);
    setAddFormImagePreview("");
    setAddFieldErrors({});
    setAddFormError(null);
    setShowAddModal(true);
  };

  const closeAddModal = () => {
    setShowAddModal(false);
    setAddFieldErrors({});
    setAddFormError(null);
  };

  const openEdit = (emp: Employee) => {
    setSelectedEmployee(emp);
    setEditFormImagePreview("");
    setEditFieldErrors({});
    setEditFormError(null);
    setEditForm({
      full_name: emp.full_name || "",
      email: emp.email || "",
      telephone: emp.telephone || "",
      is_active: emp.is_active ?? true,
      is_approved: emp.is_approved ?? true,
      password: "",
      role: (emp.role === "admin" ? "admin" : "employee") as "admin" | "employee",
      profile_image: emp.profile_image || "",
      hire_date: emp.hire_date ? emp.hire_date.slice(0, 10) : "",
    });
    setShowEditModal(true);
  };

  const openDelete = (emp: Employee) => {
    setSelectedEmployee(emp);
    setShowDeleteConfirm(true);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors: FieldErrors = {};
    if (!addForm.full_name.trim()) nextErrors.full_name = "Full name is required.";
    if (!addForm.email.trim()) nextErrors.email = "Email is required.";
    if (!addForm.password) nextErrors.password = "Password is required.";
    else if (addForm.password.length < 6) {
      nextErrors.password = "Password must be at least 6 characters.";
    } else if (!STRONG_PASSWORD_REGEX.test(addForm.password)) {
      nextErrors.password = "Password must include at least one uppercase letter and one number.";
    }
    setAddFormError(null);
    if (Object.keys(nextErrors).length > 0) {
      setAddFieldErrors(nextErrors);
      return;
    }
    setAddFieldErrors({});
    setSubmitting(true);
    setMessage(null);
    try {
      await employeesAPI.create({
        full_name: addForm.full_name.trim(),
        email: addForm.email.trim(),
        password: addForm.password,
        telephone: addForm.telephone.trim() || undefined,
        role: addForm.role,
        profile_image: addForm.profile_image.trim() || undefined,
        hire_date: addForm.hire_date.trim() || undefined,
      });
      setMessage({ type: "success", text: "Employee added successfully." });
      closeAddModal();
      fetchEmployees();
    } catch (err: any) {
      const raw = err?.message || "Failed to add employee.";
      const mapped = mapEmployeeApiError(typeof raw === "string" ? raw : String(raw));
      setAddFieldErrors(mapped.fields || {});
      setAddFormError(mapped.form ?? null);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee) return;
    const nextErrors: FieldErrors = {};
    if (!editForm.full_name.trim()) nextErrors.full_name = "Full name is required.";
    if (!editForm.email.trim()) nextErrors.email = "Email is required.";
    if (editForm.password) {
      if (editForm.password.length < 6) {
        nextErrors.password = "Password must be at least 6 characters.";
      } else if (!STRONG_PASSWORD_REGEX.test(editForm.password)) {
        nextErrors.password = "Password must include at least one uppercase letter and one number.";
      }
    }
    setEditFormError(null);
    if (Object.keys(nextErrors).length > 0) {
      setEditFieldErrors(nextErrors);
      return;
    }
    setEditFieldErrors({});
    setSubmitting(true);
    setMessage(null);
    try {
      const payload: any = {
        full_name: editForm.full_name.trim(),
        email: editForm.email.trim(),
        telephone: editForm.telephone.trim() || undefined,
        is_active: editForm.is_active,
        is_approved: editForm.is_approved,
        role: editForm.role,
        profile_image: editForm.profile_image.trim() || undefined,
        hire_date: editForm.hire_date.trim() || undefined,
      };
      if (editForm.password) payload.password = editForm.password;
      await employeesAPI.update(String(selectedEmployee.id), payload);
      setMessage({ type: "success", text: "Employee updated successfully." });
      setShowEditModal(false);
      setSelectedEmployee(null);
      setEditFieldErrors({});
      setEditFormError(null);
      fetchEmployees();
    } catch (err: any) {
      const raw = err?.message || "Failed to update employee.";
      const mapped = mapEmployeeApiError(typeof raw === "string" ? raw : String(raw));
      setEditFieldErrors(mapped.fields || {});
      setEditFormError(mapped.form ?? null);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedEmployee) return;
    setSubmitting(true);
    setMessage(null);
    try {
      await employeesAPI.delete(String(selectedEmployee.id));
      setMessage({ type: "success", text: "Employee deleted successfully." });
      setShowDeleteConfirm(false);
      setSelectedEmployee(null);
      fetchEmployees();
    } catch (err: any) {
      setMessage({ type: "error", text: err?.message || "Failed to delete employee." });
    } finally {
      setSubmitting(false);
    }
  };

  const clearMessage = () => setMessage(null);

  const fieldClass =
    "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-400/25";

  const withFieldError = (err?: string) => `${fieldClass}${err ? " border-rose-400 focus:border-rose-500 focus:ring-rose-400/25" : ""}`;

  return (
    <AdminNavbar title="Employees" subtitle="Team accounts and access">
      <div className="overflow-hidden rounded-xl border border-slate-200/60 bg-white shadow-sm shadow-slate-900/5">
        <div className="flex flex-col gap-4 border-b border-slate-100 bg-slate-50/80 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Directory</h2>
            <p className="mt-0.5 text-sm text-slate-500">Manage staff profiles, roles, and approval state.</p>
          </div>
          <button
            type="button"
            onClick={openAdd}
            className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-slate-800"
          >
            Add employee
          </button>
        </div>

        {message && (
          <div
            role="alert"
            className={`mx-5 mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-4 py-3 text-sm font-medium sm:mx-6 ${
              message.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-rose-200 bg-rose-50 text-rose-900"
            }`}
          >
            <span>{message.text}</span>
            <button type="button" onClick={clearMessage} className="text-sm underline decoration-slate-400 hover:opacity-80">
              Dismiss
            </button>
          </div>
        )}

        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center gap-2 px-6 py-14 text-slate-500">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
              Loading…
            </div>
          ) : error ? (
            <div className="px-6 py-14 text-center text-rose-700">{error}</div>
          ) : employees.length === 0 ? (
            <div className="px-6 py-14 text-center text-slate-500">No employees yet. Add one to get started.</div>
          ) : (
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/90 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3.5 sm:px-6">Image</th>
                  <th className="px-4 py-3.5 sm:px-6">Name</th>
                  <th className="px-4 py-3.5 sm:px-6">Hire date</th>
                  <th className="px-4 py-3.5 sm:px-6">Role</th>
                  <th className="px-4 py-3.5 sm:px-6">Status</th>
                  <th className="px-4 py-3.5 sm:px-6">Email</th>
                  <th className="px-4 py-3.5 text-right sm:px-6">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {employees.map((emp) => (
                  <tr
                    key={emp.id}
                    className="cursor-pointer transition-colors hover:bg-slate-50/90"
                    onClick={() => router.push(`/admin/employees/${emp.id}`)}
                  >
                    <td className="whitespace-nowrap px-4 py-4 sm:px-6">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-100">
                          {emp.profile_image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={getImageSrc(emp.profile_image)}
                              alt={emp.full_name || "Employee"}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-lg font-semibold text-slate-500">
                              {(emp.full_name || "?").charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 font-medium text-slate-900 sm:px-6">
                        {emp.full_name || "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-slate-600 sm:px-6">
                        {emp.hire_date
                          ? (() => {
                              try {
                                const d = new Date(emp.hire_date);
                                return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
                              } catch {
                                return "—";
                              }
                            })()
                          : "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 sm:px-6">
                        <span
                          className={`inline-flex rounded-lg px-3 py-1 text-xs font-medium ring-1 ${
                            emp.role === "admin"
                              ? "bg-violet-50 text-violet-800 ring-violet-200/80"
                              : "bg-slate-100 text-slate-700 ring-slate-200/80"
                          }`}
                        >
                          {emp.role === "admin" ? "Admin" : "Employee"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 sm:px-6">
                        <div className="flex items-center gap-3">
                          <span
                            className={`inline-flex rounded-lg px-3 py-1 text-xs font-medium ring-1 ${
                              emp.is_active
                                ? "bg-emerald-50 text-emerald-800 ring-emerald-200/80"
                                : "bg-slate-100 text-slate-600 ring-slate-200/80"
                            }`}
                          >
                            {emp.is_active ? "Active" : "Inactive"}
                          </span>
                          <span
                            className={`inline-flex rounded-lg px-3 py-1 text-xs font-medium ring-1 ${
                              emp.is_approved
                                ? "bg-sky-50 text-sky-800 ring-sky-200/80"
                                : "bg-amber-50 text-amber-900 ring-amber-200/80"
                            }`}
                          >
                            {emp.is_approved ? "Approved" : "Pending"}
                          </span>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-slate-600 sm:px-6">{emp.email}</td>
                      <td className="whitespace-nowrap px-4 py-4 text-right sm:px-6" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end items-center gap-3">
                          <button
                            type="button"
                            onClick={() => openEdit(emp)}
                            className="font-medium text-sky-600 hover:text-sky-800 transition-colors p-1"
                            title="Edit"
                          >
                            <FiEdit size={18} />
                          </button>
                          <button 
                            type="button" 
                            onClick={() => openDelete(emp)} 
                            className="font-medium text-rose-600 hover:text-rose-800 transition-colors p-1"
                            title="Delete"
                          >
                            <FiTrash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-slate-200/60 bg-white p-6 shadow-2xl shadow-slate-900/20">
            <h3 className="mb-4 text-lg font-semibold text-slate-500">Add employee</h3>
            {addFormError && (
              <div
                role="alert"
                className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-900"
              >
                {addFormError}
              </div>
            )}
            <form noValidate onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  value={addForm.full_name}
                  onChange={(e) => {
                    setAddForm((f) => ({ ...f, full_name: e.target.value }));
                    setAddFieldErrors((er) => ({ ...er, full_name: undefined }));
                    setAddFormError(null);
                  }}
                  className={withFieldError(addFieldErrors.full_name)}
                  required
                  aria-invalid={!!addFieldErrors.full_name}
                />
                {addFieldErrors.full_name && (
                  <p className="mt-1 text-sm text-rose-600">{addFieldErrors.full_name}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input
                  type="email"
                  value={addForm.email}
                  onChange={(e) => {
                    setAddForm((f) => ({ ...f, email: e.target.value }));
                    setAddFieldErrors((er) => ({ ...er, email: undefined }));
                    setAddFormError(null);
                  }}
                  className={withFieldError(addFieldErrors.email)}
                  required
                  aria-invalid={!!addFieldErrors.email}
                />
                {addFieldErrors.email && (
                  <p className="mt-1 text-sm text-rose-600">{addFieldErrors.email}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                <p className="mb-1 text-xs text-slate-500">{PASSWORD_RULES_HINT}</p>
                <div className="relative">
                  <input
                    type={showAddPassword ? "text" : "password"}
                    value={addForm.password}
                    onChange={(e) => {
                      setAddForm((f) => ({ ...f, password: e.target.value }));
                      setAddFieldErrors((er) => ({ ...er, password: undefined }));
                      setAddFormError(null);
                    }}
                    className={`${withFieldError(addFieldErrors.password)} pr-10`}
                    required
                    minLength={6}
                    aria-invalid={!!addFieldErrors.password}
                  />
                  <button
                    type="button"
                    onClick={() => setShowAddPassword((s) => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-700"
                    tabIndex={-1}
                    aria-label={showAddPassword ? "Hide password" : "Show password"}
                  >
                    {showAddPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                {addFieldErrors.password && (
                  <p className="mt-1 text-sm text-rose-600">{addFieldErrors.password}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telephone</label>
                <input
                  type="text"
                  value={addForm.telephone}
                  onChange={(e) => setAddForm((f) => ({ ...f, telephone: e.target.value }))}
                  className={fieldClass}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={addForm.role}
                  onChange={(e) => setAddForm((f) => ({ ...f, role: e.target.value as "admin" | "employee" }))}
                  className={fieldClass}
                >
                  <option value="employee">Employee</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Profile Image (file)</label>
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const objectUrl = URL.createObjectURL(file);
                    setAddFormImagePreview(objectUrl);
                    const reader = new FileReader();
                    reader.onload = () => {
                      URL.revokeObjectURL(objectUrl);
                      setAddFormImagePreview(reader.result as string);
                    };
                    reader.readAsDataURL(file);
                    setUploadingImage(true);
                    setAddFormError(null);
                    try {
                      const { url } = await employeesAPI.uploadImage(file);
                      setAddForm((f) => ({ ...f, profile_image: url }));
                    } catch (err: any) {
                      setAddFormError(err?.message || "Image upload failed");
                    } finally {
                      setUploadingImage(false);
                      e.target.value = "";
                    }
                  }}
                  className={fieldClass}
                />
                {(addForm.profile_image || addFormImagePreview) && (
                  <div className="mt-2 flex items-center gap-3">
                    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full border-2 border-slate-200 bg-slate-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={addForm.profile_image ? getImageSrc(addForm.profile_image) : addFormImagePreview}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <span className="text-sm text-gray-500">
                      {addForm.profile_image ? "Uploaded" : uploadingImage ? "Uploading…" : "Selected"}
                    </span>
                  </div>
                )}
                {uploadingImage && <p className="text-sm text-gray-500 mt-1">Uploading...</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hire Date</label>
                <input
                  type="date"
                  value={addForm.hire_date}
                  onChange={(e) => setAddForm((f) => ({ ...f, hire_date: e.target.value }))}
                  className={fieldClass}
                />
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-slate-800 disabled:opacity-50"
                >
                  {submitting ? "Adding..." : "Add"}
                </button>
                <button
                  type="button"
                  onClick={closeAddModal}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-slate-200/60 bg-white p-6 shadow-2xl shadow-slate-900/20">
            <h3 className="mb-4 text-lg font-semibold text-slate-900">Edit employee</h3>
            {editFormError && (
              <div
                role="alert"
                className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-900"
              >
                {editFormError}
              </div>
            )}
            <form noValidate onSubmit={handleEdit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  value={editForm.full_name}
                  onChange={(e) => {
                    setEditForm((f) => ({ ...f, full_name: e.target.value }));
                    setEditFieldErrors((er) => ({ ...er, full_name: undefined }));
                    setEditFormError(null);
                  }}
                  className={withFieldError(editFieldErrors.full_name)}
                  required
                  aria-invalid={!!editFieldErrors.full_name}
                />
                {editFieldErrors.full_name && (
                  <p className="mt-1 text-sm text-rose-600">{editFieldErrors.full_name}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => {
                    setEditForm((f) => ({ ...f, email: e.target.value }));
                    setEditFieldErrors((er) => ({ ...er, email: undefined }));
                    setEditFormError(null);
                  }}
                  className={withFieldError(editFieldErrors.email)}
                  required
                  aria-invalid={!!editFieldErrors.email}
                />
                {editFieldErrors.email && (
                  <p className="mt-1 text-sm text-rose-600">{editFieldErrors.email}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telephone</label>
                <input
                  type="text"
                  value={editForm.telephone}
                  onChange={(e) => setEditForm((f) => ({ ...f, telephone: e.target.value }))}
                  className={fieldClass}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value as "admin" | "employee" }))}
                  className={fieldClass}
                >
                  <option value="employee">Employee</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Profile Image (file)</label>
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const objectUrl = URL.createObjectURL(file);
                    setEditFormImagePreview(objectUrl);
                    const reader = new FileReader();
                    reader.onload = () => {
                      URL.revokeObjectURL(objectUrl);
                      setEditFormImagePreview(reader.result as string);
                    };
                    reader.readAsDataURL(file);
                    setUploadingImage(true);
                    setEditFormError(null);
                    try {
                      const { url } = await employeesAPI.uploadImage(file);
                      setEditForm((f) => ({ ...f, profile_image: url }));
                    } catch (err: any) {
                      setEditFormError(err?.message || "Image upload failed");
                    } finally {
                      setUploadingImage(false);
                      e.target.value = "";
                    }
                  }}
                  className={fieldClass}
                />
                {(editForm.profile_image || selectedEmployee?.profile_image || editFormImagePreview) && (
                  <div className="mt-2 flex items-center gap-3">
                    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full border-2 border-slate-200 bg-slate-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={
                          editFormImagePreview
                            ? editFormImagePreview
                            : getImageSrc(editForm.profile_image || selectedEmployee?.profile_image || "")
                        }
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <span className="text-sm text-gray-500">
                      {editFormImagePreview
                        ? uploadingImage
                          ? "Uploading…"
                          : "Selected"
                        : editForm.profile_image
                        ? "New image uploaded"
                        : "Current"}
                    </span>
                  </div>
                )}
                {uploadingImage && <p className="text-sm text-gray-500 mt-1">Uploading...</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hire Date</label>
                <input
                  type="date"
                  value={editForm.hire_date}
                  onChange={(e) => setEditForm((f) => ({ ...f, hire_date: e.target.value }))}
                  className={fieldClass}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Password (leave blank to keep)</label>
                <p className="mb-1 text-xs text-slate-500">If set: {PASSWORD_RULES_HINT}</p>
                <div className="relative">
                  <input
                    type={showEditPassword ? "text" : "password"}
                    value={editForm.password}
                    onChange={(e) => {
                      setEditForm((f) => ({ ...f, password: e.target.value }));
                      setEditFieldErrors((er) => ({ ...er, password: undefined }));
                      setEditFormError(null);
                    }}
                    className={`${withFieldError(editFieldErrors.password)} pr-10`}
                    minLength={6}
                    placeholder="Optional"
                    aria-invalid={!!editFieldErrors.password}
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditPassword((s) => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 p-1"
                    tabIndex={-1}
                    aria-label={showEditPassword ? "Hide password" : "Show password"}
                  >
                    {showEditPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                {editFieldErrors.password && (
                  <p className="mt-1 text-sm text-rose-600">{editFieldErrors.password}</p>
                )}
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editForm.is_active}
                    onChange={(e) => setEditForm((f) => ({ ...f, is_active: e.target.checked }))}
                    className="rounded border-slate-300 text-slate-900 focus:ring-sky-400/40"
                  />
                  <span className="text-sm text-gray-700">Active</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editForm.is_approved}
                    onChange={(e) => setEditForm((f) => ({ ...f, is_approved: e.target.checked }))}
                    className="rounded border-slate-300 text-slate-900 focus:ring-sky-400/40"
                  />
                  <span className="text-sm text-gray-700">Approved</span>
                </label>
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-slate-800 disabled:opacity-50"
                >
                  {submitting ? "Saving..." : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedEmployee(null);
                    setEditFieldErrors({});
                    setEditFormError(null);
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {showDeleteConfirm && selectedEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-slate-200/60 bg-white p-6 shadow-2xl shadow-slate-900/20">
            <h3 className="mb-2 text-lg font-semibold text-slate-900">Delete employee</h3>
            <p className="mb-5 text-sm text-slate-600">
              Remove <strong className="text-slate-900">{selectedEmployee.full_name}</strong> ({selectedEmployee.email})?
              This cannot be undone.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleDelete}
                disabled={submitting}
                className="rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-rose-700 disabled:opacity-50"
              >
                {submitting ? "Deleting..." : "Delete"}
              </button>
              <button
                type="button"
                onClick={() => { setShowDeleteConfirm(false); setSelectedEmployee(null); }}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminNavbar>
  );
}

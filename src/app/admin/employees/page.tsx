"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AdminNavbar from "../../components/AdminNavbar";
import { canAccessAdminPanel, isAuthenticated } from "../../../utils/roles";
import { employeesAPI } from "../../../utils/api";

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

// Backend returns path like /uploads/employees/xxx.jpg; build full URL for img src
const getImageSrc = (path: string | null | undefined): string => {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  const base =
    typeof window !== "undefined"
      ? (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api").replace(/\/api\/?$/, "")
      : "http://localhost:5000";
  return `${base}${path.startsWith("/") ? path : "/" + path}`;
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
    setShowAddModal(true);
  };

  const openEdit = (emp: Employee) => {
    setSelectedEmployee(emp);
    setEditFormImagePreview("");
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
    if (!addForm.full_name.trim() || !addForm.email.trim() || !addForm.password) {
      setMessage({ type: "error", text: "Name, email and password are required." });
      return;
    }
    if (addForm.password.length < 6) {
      setMessage({ type: "error", text: "Password must be at least 6 characters." });
      return;
    }
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
      setShowAddModal(false);
      fetchEmployees();
    } catch (err: any) {
      setMessage({ type: "error", text: err?.message || "Failed to add employee." });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee) return;
    if (!editForm.full_name.trim() || !editForm.email.trim()) {
      setMessage({ type: "error", text: "Name and email are required." });
      return;
    }
    if (editForm.password && editForm.password.length < 6) {
      setMessage({ type: "error", text: "Password must be at least 6 characters." });
      return;
    }
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
      fetchEmployees();
    } catch (err: any) {
      setMessage({ type: "error", text: err?.message || "Failed to update employee." });
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

  return (
    <AdminNavbar title="Employees">
      <div className="flex-1 p-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-800">Employees</h2>
            <button
              onClick={openAdd}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              Add Employee
            </button>
          </div>

          {message && (
            <div
              className={`mx-6 mt-4 px-4 py-2 rounded-lg ${
                message.type === "success" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
              }`}
            >
              {message.text}
              <button type="button" onClick={clearMessage} className="ml-2 underline">
                Dismiss
              </button>
            </div>
          )}

          <div className="overflow-x-auto">
            {loading ? (
              <div className="px-6 py-12 text-center text-gray-500">Loading employees...</div>
            ) : error ? (
              <div className="px-6 py-12 text-center text-red-600">{error}</div>
            ) : employees.length === 0 ? (
              <div className="px-6 py-12 text-center text-gray-500">No employees yet. Add one to get started.</div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Image
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Hire Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {employees.map((emp) => (
                    <tr
                      key={emp.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => router.push(`/admin/employees/${emp.id}`)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center shrink-0">
                          {emp.profile_image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={getImageSrc(emp.profile_image)}
                              alt={emp.full_name || "Employee"}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-gray-500 text-lg font-semibold">
                              {(emp.full_name || "?").charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {emp.full_name || "—"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
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
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            emp.role === "admin" ? "bg-purple-100 text-purple-800" : "bg-slate-100 text-slate-800"
                          }`}
                        >
                          {emp.role === "admin" ? "Admin" : "Employee"}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            emp.is_active ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-700"
                          }`}
                        >
                          {emp.is_active ? "Active" : "Inactive"}
                        </span>
                        <span
                          className={`ml-1 inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            emp.is_approved ? "bg-blue-100 text-blue-800" : "bg-yellow-100 text-yellow-800"
                          }`}
                        >
                          {emp.is_approved ? "Approved" : "Pending"}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{emp.email}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => openEdit(emp)}
                          className="text-blue-600 hover:text-blue-800 font-medium mr-4"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => openDelete(emp)}
                          className="text-red-600 hover:text-red-800 font-medium"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Add Employee</h3>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  value={addForm.full_name}
                  onChange={(e) => setAddForm((f) => ({ ...f, full_name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input
                  type="email"
                  value={addForm.email}
                  onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password * (min 6)</label>
                <div className="relative">
                  <input
                    type={showAddPassword ? "text" : "password"}
                    value={addForm.password}
                    onChange={(e) => setAddForm((f) => ({ ...f, password: e.target.value }))}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowAddPassword((s) => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 p-1"
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
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telephone</label>
                <input
                  type="text"
                  value={addForm.telephone}
                  onChange={(e) => setAddForm((f) => ({ ...f, telephone: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={addForm.role}
                  onChange={(e) => setAddForm((f) => ({ ...f, role: e.target.value as "admin" | "employee" }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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
                    setMessage(null);
                    try {
                      const { url } = await employeesAPI.uploadImage(file);
                      setAddForm((f) => ({ ...f, profile_image: url }));
                    } catch (err: any) {
                      setMessage({ type: "error", text: err?.message || "Image upload failed" });
                    } finally {
                      setUploadingImage(false);
                      e.target.value = "";
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                {(addForm.profile_image || addFormImagePreview) && (
                  <div className="mt-2 flex items-center gap-3">
                    <div className="w-20 h-20 rounded-full overflow-hidden bg-gray-200 border-2 border-gray-300 shrink-0">
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {submitting ? "Adding..." : "Add"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Edit Employee</h3>
            <form onSubmit={handleEdit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  value={editForm.full_name}
                  onChange={(e) => setEditForm((f) => ({ ...f, full_name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telephone</label>
                <input
                  type="text"
                  value={editForm.telephone}
                  onChange={(e) => setEditForm((f) => ({ ...f, telephone: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value as "admin" | "employee" }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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
                    setMessage(null);
                    try {
                      const { url } = await employeesAPI.uploadImage(file);
                      setEditForm((f) => ({ ...f, profile_image: url }));
                    } catch (err: any) {
                      setMessage({ type: "error", text: err?.message || "Image upload failed" });
                    } finally {
                      setUploadingImage(false);
                      e.target.value = "";
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                {(editForm.profile_image || selectedEmployee?.profile_image || editFormImagePreview) && (
                  <div className="mt-2 flex items-center gap-3">
                    <div className="w-20 h-20 rounded-full overflow-hidden bg-gray-200 border-2 border-gray-300 shrink-0">
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Password (leave blank to keep)</label>
                <div className="relative">
                  <input
                    type={showEditPassword ? "text" : "password"}
                    value={editForm.password}
                    onChange={(e) => setEditForm((f) => ({ ...f, password: e.target.value }))}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    minLength={6}
                    placeholder="Optional"
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
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editForm.is_active}
                    onChange={(e) => setEditForm((f) => ({ ...f, is_active: e.target.checked }))}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm text-gray-700">Active</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editForm.is_approved}
                    onChange={(e) => setEditForm((f) => ({ ...f, is_approved: e.target.checked }))}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm text-gray-700">Approved</span>
                </label>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {submitting ? "Saving..." : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowEditModal(false); setSelectedEmployee(null); }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-2">Delete Employee</h3>
            <p className="text-gray-600 mb-4">
              Are you sure you want to delete <strong>{selectedEmployee.full_name}</strong> ({selectedEmployee.email})?
              This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleDelete}
                disabled={submitting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {submitting ? "Deleting..." : "Delete"}
              </button>
              <button
                onClick={() => { setShowDeleteConfirm(false); setSelectedEmployee(null); }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
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

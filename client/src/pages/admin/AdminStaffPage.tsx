import React, { useEffect, useState, useCallback } from 'react';
import {
  Users,
  Search,
  Plus,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Truck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  X,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  UserX,
  Lock,
  Edit2,
  Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import {
  staffService,
  StaffUser,
  StaffRole,
  CreateStaffDto,
} from '../../services/staff.service';
import { useDebounce } from '../../hooks/useDebounce';

const ROLE_BADGE_STYLES: Record<StaffRole, { bg: string; text: string; border: string; label: string; icon: React.ComponentType<{ className?: string }> }> = {
  owner: {
    bg: 'bg-amber-500/15',
    text: 'text-amber-400',
    border: 'border-amber-500/30',
    label: 'Owner',
    icon: ShieldAlert,
  },
  admin: {
    bg: 'bg-indigo-500/15',
    text: 'text-indigo-400',
    border: 'border-indigo-500/30',
    label: 'Admin',
    icon: ShieldCheck,
  },
  staff: {
    bg: 'bg-emerald-500/15',
    text: 'text-emerald-400',
    border: 'border-emerald-500/30',
    label: 'Staff',
    icon: Shield,
  },
  delivery_manager: {
    bg: 'bg-sky-500/15',
    text: 'text-sky-400',
    border: 'border-sky-500/30',
    label: 'Delivery Manager',
    icon: Truck,
  },
};

export const AdminStaffPage: React.FC = () => {
  const { user: currentUser } = useAuth();

  // ── List & Filter State ────────────────────────────────────────────────────
  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [selectedRole, setSelectedRole] = useState<StaffRole | ''>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // ── Create Modal State ──────────────────────────────────────────────────────
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateStaffDto>({
    name: '',
    email: '',
    password: '',
    role: 'staff',
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');

  // ── Edit Name Modal State ───────────────────────────────────────────────────
  const [editingStaff, setEditingStaff] = useState<StaffUser | null>(null);
  const [editName, setEditName] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');

  // ── Action in progress ─────────────────────────────────────────────────────
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // ── Fetch Staff List ───────────────────────────────────────────────────────
  const fetchStaff = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await staffService.getStaff({
        page,
        limit: 15,
        role: selectedRole || undefined,
        search: debouncedSearch.trim() || undefined,
      });
      setStaffList(res.results || []);
      setTotal(res.total || 0);
      setPages(res.pages || 1);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch staff directory');
    } finally {
      setLoading(false);
    }
  }, [page, selectedRole, debouncedSearch]);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  // ── Determine allowed roles to assign based on caller role ─────────────────
  const isCallerOwner = currentUser?.role === 'owner';

  const getCreatableRoles = (): Array<'staff' | 'delivery_manager' | 'admin'> => {
    if (isCallerOwner) {
      return ['staff', 'delivery_manager', 'admin'];
    }
    return ['staff', 'delivery_manager'];
  };

  const getAssignableRoles = (targetStaff: StaffUser): StaffRole[] => {
    if (isCallerOwner) {
      return ['staff', 'delivery_manager', 'admin', 'owner'];
    }
    // Admins can only assign staff or delivery_manager
    return ['staff', 'delivery_manager'];
  };

  const canModifyStaff = (targetStaff: StaffUser): boolean => {
    if (!currentUser) return false;
    // Self-modification protection
    if (targetStaff._id === currentUser._id) return false;

    // Owners can modify anyone (except self-rule above)
    if (isCallerOwner) return true;

    // Admins cannot modify owners or other admins
    if (targetStaff.role === 'owner' || targetStaff.role === 'admin') {
      return false;
    }

    return true;
  };

  // ── Toggle Active / Deactivate ─────────────────────────────────────────────
  const handleToggleActive = async (staff: StaffUser) => {
    if (!canModifyStaff(staff)) {
      toast.error('You do not have permission to modify this account');
      return;
    }

    const nextStatus = !staff.active;
    const actionLabel = nextStatus ? 'activate' : 'deactivate';

    if (
      !window.confirm(
        `Are you sure you want to ${actionLabel} ${staff.name}'s account?`
      )
    ) {
      return;
    }

    setUpdatingId(staff._id);
    try {
      await staffService.updateStaff(staff._id, { active: nextStatus });
      toast.success(
        `Account ${actionLabel}d for ${staff.name}`
      );
      fetchStaff();
    } catch (err: any) {
      toast.error(err.message || `Failed to ${actionLabel} account`);
    } finally {
      setUpdatingId(null);
    }
  };

  // ── Change Role ────────────────────────────────────────────────────────────
  const handleRoleChange = async (staff: StaffUser, newRole: StaffRole) => {
    if (newRole === staff.role) return;

    if (!canModifyStaff(staff)) {
      toast.error('You do not have permission to change this role');
      return;
    }

    if (!isCallerOwner && (newRole === 'admin' || newRole === 'owner')) {
      toast.error('Only owners can grant admin or owner privileges');
      return;
    }

    if (
      !window.confirm(
        `Change ${staff.name}'s role from ${staff.role.replace('_', ' ')} to ${newRole.replace('_', ' ')}?`
      )
    ) {
      return;
    }

    setUpdatingId(staff._id);
    try {
      await staffService.updateStaff(staff._id, { role: newRole });
      toast.success(`Role updated to ${newRole.replace('_', ' ')}`);
      fetchStaff();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update role');
    } finally {
      setUpdatingId(null);
    }
  };

  // ── Submit Create Staff ────────────────────────────────────────────────────
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');

    if (!createForm.name.trim()) {
      setCreateError('Name is required');
      return;
    }
    if (!createForm.email.trim()) {
      setCreateError('Email is required');
      return;
    }
    if (!createForm.password || createForm.password.length < 8) {
      setCreateError('Temporary password must be at least 8 characters');
      return;
    }

    setCreateLoading(true);
    try {
      await staffService.createStaff(createForm);
      toast.success(`Staff account created for ${createForm.name}`);
      setIsCreateOpen(false);
      setCreateForm({
        name: '',
        email: '',
        password: '',
        role: 'staff',
      });
      fetchStaff();
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create staff member');
    } finally {
      setCreateLoading(false);
    }
  };

  // ── Submit Edit Name ───────────────────────────────────────────────────────
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff) return;
    setEditError('');

    if (!editName.trim()) {
      setEditError('Name cannot be empty');
      return;
    }

    setEditLoading(true);
    try {
      await staffService.updateStaff(editingStaff._id, { name: editName.trim() });
      toast.success('Staff name updated');
      setEditingStaff(null);
      fetchStaff();
    } catch (err: any) {
      setEditError(err.message || 'Failed to update staff name');
    } finally {
      setEditLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Top Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Users className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-white font-display tracking-wide">
              Staff Directory & Management
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Provision team accounts, configure permissions, and manage staff activation.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setCreateError('');
            setIsCreateOpen(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-500/10 transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Provision Staff Member</span>
        </button>
      </div>

      {/* ── Filter Bar ──────────────────────────────────────────────────────── */}
      <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-4 backdrop-blur-md flex flex-col md:flex-row gap-3 items-center justify-between">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by name or email..."
            className="w-full pl-9 pr-3.5 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-colors"
          />
          {search && (
            <button
              onClick={() => {
                setSearch('');
                setPage(1);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Role Filter Tabs & Refresh */}
        <div className="flex items-center gap-2.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => {
                setSelectedRole('');
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                selectedRole === ''
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              All
            </button>
            {(['owner', 'admin', 'staff', 'delivery_manager'] as StaffRole[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => {
                  setSelectedRole(r);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                  selectedRole === r
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {ROLE_BADGE_STYLES[r].label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={fetchStaff}
            disabled={loading}
            className="p-2 bg-slate-950/80 border border-slate-800 rounded-xl text-slate-400 hover:text-white hover:border-slate-700 transition-colors disabled:opacity-50"
            title="Refresh list"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── Table Container ─────────────────────────────────────────────────── */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden backdrop-blur-md shadow-xl">
        {loading ? (
          <div className="py-20 text-center">
            <RefreshCw className="w-8 h-8 text-amber-400 animate-spin mx-auto mb-3 opacity-80" />
            <p className="text-xs text-slate-400 font-medium">Loading staff accounts...</p>
          </div>
        ) : error ? (
          <div className="py-16 text-center px-4">
            <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto mb-2" />
            <p className="text-sm font-semibold text-rose-300">{error}</p>
            <button
              onClick={fetchStaff}
              className="mt-3 px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 font-semibold rounded-lg"
            >
              Try Again
            </button>
          </div>
        ) : staffList.length === 0 ? (
          <div className="py-16 text-center px-4">
            <Users className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-slate-300">No staff members found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {search || selectedRole
                ? 'Try adjusting your search criteria or role filters.'
                : 'Get started by provisioning your first team member.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/50 text-[10px] uppercase font-bold tracking-wider text-slate-400">
                  <th className="py-3 px-4">Staff Member</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Joined Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {staffList.map((staff) => {
                  const isSelf = staff._id === currentUser?._id;
                  const canEdit = canModifyStaff(staff);
                  const roleStyle = ROLE_BADGE_STYLES[staff.role] || ROLE_BADGE_STYLES.staff;
                  const RoleIcon = roleStyle.icon;
                  const isBusy = updatingId === staff._id;
                  const assignableRoles = getAssignableRoles(staff);

                  return (
                    <tr
                      key={staff._id}
                      className={`hover:bg-slate-800/30 transition-colors ${
                        isSelf ? 'bg-amber-500/[0.03]' : ''
                      }`}
                    >
                      {/* Name / Avatar / Email */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700/60 flex items-center justify-center font-bold text-sm text-slate-200 uppercase flex-shrink-0">
                            {staff.name.charAt(0)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-white text-xs">
                                {staff.name}
                              </span>
                              {isSelf && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                  You
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono">
                              {staff.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Role Pill & Dropdown */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-bold uppercase tracking-wider ${roleStyle.bg} ${roleStyle.text} ${roleStyle.border}`}
                          >
                            <RoleIcon className="w-3.5 h-3.5" />
                            {roleStyle.label}
                          </span>

                          {/* Role selector dropdown */}
                          {canEdit ? (
                            <select
                              value={staff.role}
                              onChange={(e) =>
                                handleRoleChange(staff, e.target.value as StaffRole)
                              }
                              disabled={isBusy}
                              className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-lg px-2 py-1 focus:border-amber-500 focus:outline-none transition-colors"
                              title="Change Role"
                            >
                              {assignableRoles.map((r) => (
                                <option key={r} value={r}>
                                  {ROLE_BADGE_STYLES[r].label}
                                </option>
                              ))}
                            </select>
                          ) : isSelf ? (
                            <span
                              className="text-[10px] text-slate-500 italic flex items-center gap-1"
                              title="Self-modification protected"
                            >
                              <Lock className="w-3 h-3 text-slate-600" />
                              Self-locked
                            </span>
                          ) : null}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        {staff.active ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="w-3 h-3" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            <XCircle className="w-3 h-3" />
                            Deactivated
                          </span>
                        )}
                      </td>

                      {/* Joined Date */}
                      <td className="py-3.5 px-4 text-slate-400 font-mono text-[11px]">
                        {new Date(staff.createdAt).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          {/* Edit Name Button */}
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingStaff(staff);
                                setEditName(staff.name);
                                setEditError('');
                              }}
                              disabled={isBusy}
                              className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-lg transition-colors"
                              title="Edit Name"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Toggle Active / Deactivate */}
                          {canEdit ? (
                            <button
                              type="button"
                              onClick={() => handleToggleActive(staff)}
                              disabled={isBusy}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                                staff.active
                                  ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                  : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              }`}
                            >
                              {staff.active ? (
                                <>
                                  <UserX className="w-3.5 h-3.5" />
                                  <span>Deactivate</span>
                                </>
                              ) : (
                                <>
                                  <UserCheck className="w-3.5 h-3.5" />
                                  <span>Activate</span>
                                </>
                              )}
                            </button>
                          ) : isSelf ? (
                            <span className="text-[10px] text-slate-500 font-medium px-2 py-1 bg-slate-950/60 rounded border border-slate-800">
                              Cannot alter self
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-500 font-medium px-2 py-1 bg-slate-950/60 rounded border border-slate-800">
                              Restricted
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Pagination Footer ─────────────────────────────────────────────── */}
        {!loading && staffList.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800 bg-slate-950/40 text-xs text-slate-400">
            <div>
              Showing <span className="font-semibold text-white">{staffList.length}</span> of{' '}
              <span className="font-semibold text-white">{total}</span> accounts
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-400 hover:text-white hover:border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-[11px] font-mono font-semibold px-2">
                Page {page} of {pages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
                disabled={page >= pages}
                className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-400 hover:text-white hover:border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Create Staff Modal ──────────────────────────────────────────────── */}
      {isCreateOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-fade-in">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                </div>
                <h3 className="font-bold text-white text-sm">Provision Staff Account</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4 text-xs">
              {createError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{createError}</span>
                </div>
              )}

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={createForm.name}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, name: e.target.value })
                  }
                  placeholder="e.g. Somsak Prasert"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={createForm.email}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, email: e.target.value })
                  }
                  placeholder="name@larvo-atelier.com"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Temporary Password
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={createForm.password}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, password: e.target.value })
                  }
                  placeholder="At least 8 characters"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Staff will be provisioned directly without public email verification.
                </span>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Role Assignment
                </label>
                <select
                  value={createForm.role}
                  onChange={(e) =>
                    setCreateForm({
                      ...createForm,
                      role: e.target.value as 'staff' | 'delivery_manager' | 'admin',
                    })
                  }
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-amber-500 transition-colors"
                >
                  {getCreatableRoles().map((role) => (
                    <option key={role} value={role}>
                      {ROLE_BADGE_STYLES[role].label}
                    </option>
                  ))}
                </select>
                {!isCallerOwner && (
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Note: Only Owner accounts can provision Admin roles.
                  </span>
                )}
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl shadow-md transition-colors disabled:opacity-50"
                >
                  {createLoading ? 'Provisioning...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit Staff Name Modal ───────────────────────────────────────────── */}
      {editingStaff && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-fade-in">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-white text-sm">Update Staff Name</h3>
              <button
                type="button"
                onClick={() => setEditingStaff(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-5 space-y-4 text-xs">
              {editError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{editError}</span>
                </div>
              )}

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingStaff(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl disabled:opacity-50"
                >
                  {editLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

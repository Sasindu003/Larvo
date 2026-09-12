import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  User,
  Lock,
  MapPin,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  Star,
  Shield,
  Phone,
  Mail,
  AlertCircle,
  Loader2,
  X,
  Wallet,
  ArrowRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { userService, Address } from '../services/user.service';

export const ProfilePage: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'addresses'>('profile');

  // ── Profile Name Form ────────────────────────────────────────────────────────
  const [name, setName] = useState(user?.name || '');
  const [savingProfile, setSavingProfile] = useState(false);

  // ── Change Password Form ─────────────────────────────────────────────────────
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  // ── Address Modal / Form State ───────────────────────────────────────────────
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [deletingAddressId, setDeletingAddressId] = useState<string | null>(null);
  const [addressLoading, setAddressLoading] = useState(false);

  const initialAddressForm: Omit<Address, '_id'> = {
    label: 'Home',
    line1: '',
    line2: '',
    city: '',
    province: '',
    postalCode: '',
    country: 'Thailand',
    phone: '',
    isDefault: false,
  };

  const [addressForm, setAddressForm] = useState<Omit<Address, '_id'>>(initialAddressForm);

  if (!user) return null;

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Name cannot be empty');
      return;
    }

    setSavingProfile(true);
    try {
      await userService.updateProfile({ name: name.trim() });
      await refreshUser();
      toast.success('Profile updated successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      toast.error('Please enter your current password');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('New password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    setSavingPassword(true);
    try {
      await userService.updatePassword({ currentPassword, newPassword });
      toast.success('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to change password');
    } finally {
      setSavingPassword(false);
    }
  };

  const openAddAddressModal = () => {
    setEditingAddressId(null);
    setAddressForm({
      ...initialAddressForm,
      isDefault: (user.addresses || []).length === 0,
    });
    setIsAddressModalOpen(true);
  };

  const openEditAddressModal = (address: Address) => {
    setEditingAddressId(address._id || null);
    setAddressForm({
      label: address.label,
      line1: address.line1,
      line2: address.line2 || '',
      city: address.city,
      province: address.province,
      postalCode: address.postalCode,
      country: address.country || 'Thailand',
      phone: address.phone || '',
      isDefault: address.isDefault,
    });
    setIsAddressModalOpen(true);
  };

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addressForm.line1.trim() || !addressForm.city.trim() || !addressForm.postalCode.trim()) {
      toast.error('Please fill in all required address fields');
      return;
    }

    setAddressLoading(true);
    try {
      if (editingAddressId) {
        await userService.updateAddress(editingAddressId, addressForm);
        toast.success('Address updated successfully');
      } else {
        await userService.addAddress(addressForm);
        toast.success('Address added to address book');
      }
      await refreshUser();
      setIsAddressModalOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save address');
    } finally {
      setAddressLoading(false);
    }
  };

  const handleSetDefaultAddress = async (addressId: string) => {
    try {
      await userService.updateAddress(addressId, { isDefault: true });
      await refreshUser();
      toast.success('Default delivery address updated');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update default address');
    }
  };

  const handleDeleteAddress = async () => {
    if (!deletingAddressId) return;

    setAddressLoading(true);
    try {
      await userService.deleteAddress(deletingAddressId);
      await refreshUser();
      toast.success('Address removed');
      setDeletingAddressId(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete address');
    } finally {
      setAddressLoading(false);
    }
  };

  const addresses = user.addresses || [];

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Top Banner & User Summary */}
      <div className="bg-white rounded-2xl border border-sand-200 shadow-sm p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-ink-900 text-cream-100 flex items-center justify-center font-display text-2xl font-bold shadow-md">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold font-display text-ink-950">{user.name}</h1>
              <span className="px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider rounded-full bg-sand-200 text-ink-800 border border-sand-300">
                {user.role.replace('_', ' ')}
              </span>
            </div>
            <p className="text-xs text-ink-500 flex items-center gap-1.5 mt-1">
              <Mail className="w-3.5 h-3.5" />
              {user.email}
            </p>
          </div>
        </div>

        {/* Quick Stats Pill */}
        <div className="flex items-center gap-3 self-stretch sm:self-auto border-t sm:border-t-0 pt-4 sm:pt-0 border-sand-200">
          <Link
            to="/wallet"
            className="bg-amber-50/90 hover:bg-amber-100/90 rounded-xl px-4 py-2.5 border border-amber-200 text-center flex-1 sm:flex-initial transition-colors group"
            title="View Reward Points Wallet"
          >
            <div className="text-xs font-semibold text-amber-800 flex items-center justify-center gap-1">
              <Wallet className="w-3.5 h-3.5 text-amber-600" />
              Reward Wallet
            </div>
            <div className="text-xs font-bold text-amber-950 group-hover:underline mt-0.5">
              View Balance &rarr;
            </div>
          </Link>
          <div className="bg-cream-100 rounded-xl px-4 py-2.5 border border-sand-200 text-center flex-1 sm:flex-initial">
            <div className="text-xs font-semibold text-ink-500">Saved Addresses</div>
            <div className="text-base font-bold text-ink-900">{addresses.length}</div>
          </div>
          <div className="bg-cream-100 rounded-xl px-4 py-2.5 border border-sand-200 text-center flex-1 sm:flex-initial">
            <div className="text-xs font-semibold text-ink-500">Wishlist Items</div>
            <div className="text-base font-bold text-ink-900">{(user.wishlist || []).length}</div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-sand-200 gap-2 sm:gap-6 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('profile')}
          className={`flex items-center gap-2 pb-3 px-2 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'profile'
              ? 'border-ink-900 text-ink-950'
              : 'border-transparent text-ink-500 hover:text-ink-900'
          }`}
        >
          <User className="w-4 h-4" />
          <span>Profile Details</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('addresses')}
          className={`flex items-center gap-2 pb-3 px-2 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'addresses'
              ? 'border-ink-900 text-ink-950'
              : 'border-transparent text-ink-500 hover:text-ink-900'
          }`}
        >
          <MapPin className="w-4 h-4" />
          <span>Address Book ({addresses.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('security')}
          className={`flex items-center gap-2 pb-3 px-2 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'security'
              ? 'border-ink-900 text-ink-950'
              : 'border-transparent text-ink-500 hover:text-ink-900'
          }`}
        >
          <Lock className="w-4 h-4" />
          <span>Password & Security</span>
        </button>
      </div>

      {/* ── TAB 1: Profile Details ─────────────────────────────────────────── */}
      {activeTab === 'profile' && (
        <div className="bg-white rounded-2xl border border-sand-200 p-6 sm:p-8 shadow-sm space-y-6">
          {/* Reward Points Card inside Profile tab */}
          <div className="bg-gradient-to-r from-amber-50/70 to-sand-100/60 rounded-xl border border-amber-200/80 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-ink-900 text-white flex items-center justify-center shrink-0 shadow-sm">
                <Wallet className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-ink-950">Reward Points & Store Credit</h3>
                <p className="text-xs text-ink-600">Track and redeem your earned refund points on checkout orders.</p>
              </div>
            </div>
            <Link
              to="/wallet"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-ink-900 text-white rounded-lg text-xs font-semibold hover:bg-ink-800 transition-colors shrink-0 shadow-sm"
            >
              <span>Open Wallet</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div>
            <h2 className="text-lg font-bold text-ink-950">Personal Information</h2>
            <p className="text-xs text-ink-500">Update your public display name</p>
          </div>

          <form onSubmit={handleUpdateProfile} className="space-y-4 max-w-lg">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-ink-700 mb-1.5">
                Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your full name"
                required
                className="w-full bg-cream-50 border border-sand-300 rounded-lg px-4 py-2.5 text-sm text-ink-900 focus:bg-white focus:outline-none focus:border-ink-600 focus:ring-2 focus:ring-sand-200 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-ink-700 mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                value={user.email}
                disabled
                className="w-full bg-sand-100 border border-sand-200 rounded-lg px-4 py-2.5 text-sm text-ink-400 cursor-not-allowed"
              />
              <span className="text-[11px] text-ink-400 mt-1 block">
                Email address cannot be modified once registered.
              </span>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={savingProfile || name.trim() === user.name}
                className="px-6 py-2.5 bg-ink-900 hover:bg-ink-800 disabled:opacity-50 text-white rounded-lg text-xs font-semibold tracking-wide shadow-sm transition-colors flex items-center gap-2"
              >
                {savingProfile && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Save Changes</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── TAB 2: Address Book ────────────────────────────────────────────── */}
      {activeTab === 'addresses' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-ink-950">Saved Delivery Addresses</h2>
              <p className="text-xs text-ink-500">
                Manage your delivery destinations for quick and smooth checkout.
              </p>
            </div>
            <button
              type="button"
              onClick={openAddAddressModal}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-ink-900 hover:bg-ink-800 text-white rounded-lg text-xs font-semibold tracking-wide shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Address</span>
            </button>
          </div>

          {addresses.length === 0 ? (
            <div className="bg-white rounded-2xl border border-sand-200 p-10 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-sand-100 text-ink-400 flex items-center justify-center mx-auto">
                <MapPin className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-ink-900">No addresses saved yet</h3>
                <p className="text-xs text-ink-500 max-w-sm mx-auto">
                  Add your home, office, or primary delivery address to speed up order placement.
                </p>
              </div>
              <button
                type="button"
                onClick={openAddAddressModal}
                className="px-5 py-2 text-xs font-semibold bg-sand-200 hover:bg-sand-300 text-ink-900 rounded-lg transition-colors"
              >
                Add Your First Address
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {addresses.map((address) => (
                <div
                  key={address._id}
                  className={`bg-white rounded-2xl p-5 border transition-all flex flex-col justify-between ${
                    address.isDefault
                      ? 'border-amber-500 shadow-md ring-1 ring-amber-500/20'
                      : 'border-sand-200 hover:border-sand-300'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-sand-100 text-ink-800 border border-sand-200">
                          {address.label}
                        </span>
                        {address.isDefault && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-300">
                            <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                            Default Address
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditAddressModal(address)}
                          className="p-1.5 text-ink-500 hover:text-ink-900 hover:bg-sand-100 rounded-md transition-colors"
                          title="Edit address"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingAddressId(address._id || null)}
                          className="p-1.5 text-ink-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                          title="Delete address"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="text-xs text-ink-700 space-y-1">
                      <p className="font-semibold text-ink-900 text-sm">{address.line1}</p>
                      {address.line2 && <p>{address.line2}</p>}
                      <p>
                        {address.city}, {address.province} {address.postalCode}
                      </p>
                      <p className="text-ink-500">{address.country}</p>
                      {address.phone && (
                        <p className="flex items-center gap-1.5 text-ink-500 pt-1">
                          <Phone className="w-3.5 h-3.5" />
                          <span>{address.phone}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-sand-100 flex items-center justify-between">
                    {!address.isDefault ? (
                      <button
                        type="button"
                        onClick={() => handleSetDefaultAddress(address._id!)}
                        className="text-xs font-semibold text-ink-700 hover:text-amber-700 flex items-center gap-1.5 transition-colors"
                      >
                        <Star className="w-3.5 h-3.5" />
                        <span>Set as Default</span>
                      </button>
                    ) : (
                      <span className="text-[11px] font-medium text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Used for one-click checkout
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 3: Password & Security ─────────────────────────────────────── */}
      {activeTab === 'security' && (
        <div className="bg-white rounded-2xl border border-sand-200 p-6 sm:p-8 shadow-sm space-y-6">
          <div>
            <h2 className="text-lg font-bold text-ink-950">Change Account Password</h2>
            <p className="text-xs text-ink-500">
              Ensure your account is using a secure, unique password.
            </p>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-4 max-w-lg">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-ink-700 mb-1.5">
                Current Password
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full bg-cream-50 border border-sand-300 rounded-lg px-4 py-2.5 text-sm text-ink-900 focus:bg-white focus:outline-none focus:border-ink-600 focus:ring-2 focus:ring-sand-200 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-ink-700 mb-1.5">
                New Password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="w-full bg-cream-50 border border-sand-300 rounded-lg px-4 py-2.5 text-sm text-ink-900 focus:bg-white focus:outline-none focus:border-ink-600 focus:ring-2 focus:ring-sand-200 transition-all"
              />
              <span className="text-[11px] text-ink-400 mt-1 block">
                Must be at least 6 characters.
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-ink-700 mb-1.5">
                Confirm New Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full bg-cream-50 border border-sand-300 rounded-lg px-4 py-2.5 text-sm text-ink-900 focus:bg-white focus:outline-none focus:border-ink-600 focus:ring-2 focus:ring-sand-200 transition-all"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={savingPassword}
                className="px-6 py-2.5 bg-ink-900 hover:bg-ink-800 disabled:opacity-50 text-white rounded-lg text-xs font-semibold tracking-wide shadow-sm transition-colors flex items-center gap-2"
              >
                {savingPassword && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Update Password</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Add / Edit Address Modal ───────────────────────────────────────── */}
      {isAddressModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog">
          <div
            className="fixed inset-0 bg-ink-950/60 backdrop-blur-sm transition-opacity"
            onClick={() => setIsAddressModalOpen(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl border border-sand-200 max-w-lg w-full p-6 sm:p-8 z-10 animate-fade-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-sand-200">
              <h3 className="text-base font-bold text-ink-950">
                {editingAddressId ? 'Edit Address' : 'Add New Address'}
              </h3>
              <button
                type="button"
                onClick={() => setIsAddressModalOpen(false)}
                className="p-1.5 rounded-full text-ink-400 hover:text-ink-900 hover:bg-sand-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAddress} className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-ink-700 mb-1">
                    Label (e.g. Home, Work)
                  </label>
                  <input
                    type="text"
                    value={addressForm.label}
                    onChange={(e) => setAddressForm({ ...addressForm, label: e.target.value })}
                    required
                    placeholder="Home"
                    className="w-full bg-cream-50 border border-sand-300 rounded-lg px-3 py-2 text-xs text-ink-900 focus:bg-white focus:outline-none focus:border-ink-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink-700 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={addressForm.phone}
                    onChange={(e) => setAddressForm({ ...addressForm, phone: e.target.value })}
                    placeholder="+66 81 234 5678"
                    className="w-full bg-cream-50 border border-sand-300 rounded-lg px-3 py-2 text-xs text-ink-900 focus:bg-white focus:outline-none focus:border-ink-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-700 mb-1">
                  Street Address Line 1 *
                </label>
                <input
                  type="text"
                  value={addressForm.line1}
                  onChange={(e) => setAddressForm({ ...addressForm, line1: e.target.value })}
                  required
                  placeholder="House / Unit number, Street name"
                  className="w-full bg-cream-50 border border-sand-300 rounded-lg px-3 py-2 text-xs text-ink-900 focus:bg-white focus:outline-none focus:border-ink-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-700 mb-1">
                  Address Line 2 (Optional)
                </label>
                <input
                  type="text"
                  value={addressForm.line2}
                  onChange={(e) => setAddressForm({ ...addressForm, line2: e.target.value })}
                  placeholder="Apartment, suite, building, floor"
                  className="w-full bg-cream-50 border border-sand-300 rounded-lg px-3 py-2 text-xs text-ink-900 focus:bg-white focus:outline-none focus:border-ink-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-ink-700 mb-1">
                    City / District *
                  </label>
                  <input
                    type="text"
                    value={addressForm.city}
                    onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                    required
                    placeholder="Bangkok"
                    className="w-full bg-cream-50 border border-sand-300 rounded-lg px-3 py-2 text-xs text-ink-900 focus:bg-white focus:outline-none focus:border-ink-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink-700 mb-1">
                    Province / State *
                  </label>
                  <input
                    type="text"
                    value={addressForm.province}
                    onChange={(e) => setAddressForm({ ...addressForm, province: e.target.value })}
                    required
                    placeholder="Bangkok"
                    className="w-full bg-cream-50 border border-sand-300 rounded-lg px-3 py-2 text-xs text-ink-900 focus:bg-white focus:outline-none focus:border-ink-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-ink-700 mb-1">
                    Postal Code *
                  </label>
                  <input
                    type="text"
                    value={addressForm.postalCode}
                    onChange={(e) => setAddressForm({ ...addressForm, postalCode: e.target.value })}
                    required
                    placeholder="10110"
                    className="w-full bg-cream-50 border border-sand-300 rounded-lg px-3 py-2 text-xs text-ink-900 focus:bg-white focus:outline-none focus:border-ink-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink-700 mb-1">
                    Country
                  </label>
                  <input
                    type="text"
                    value={addressForm.country}
                    onChange={(e) => setAddressForm({ ...addressForm, country: e.target.value })}
                    required
                    placeholder="Thailand"
                    className="w-full bg-cream-50 border border-sand-300 rounded-lg px-3 py-2 text-xs text-ink-900 focus:bg-white focus:outline-none focus:border-ink-600"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isDefaultCheckbox"
                  checked={addressForm.isDefault}
                  onChange={(e) => setAddressForm({ ...addressForm, isDefault: e.target.checked })}
                  className="w-4 h-4 rounded text-ink-900 focus:ring-ink-900"
                />
                <label htmlFor="isDefaultCheckbox" className="text-xs font-medium text-ink-800">
                  Set as default delivery address
                </label>
              </div>

              <div className="pt-4 border-t border-sand-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddressModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-ink-700 hover:bg-sand-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addressLoading}
                  className="px-5 py-2 bg-ink-900 hover:bg-ink-800 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors flex items-center gap-2"
                >
                  {addressLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingAddressId ? 'Save Changes' : 'Add Address'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Address Confirmation Modal ──────────────────────────────── */}
      {deletingAddressId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog">
          <div
            className="fixed inset-0 bg-ink-950/60 backdrop-blur-sm transition-opacity"
            onClick={() => setDeletingAddressId(null)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl border border-sand-200 max-w-sm w-full p-6 z-10 animate-fade-in text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-ink-950">Remove Address?</h3>
              <p className="text-xs text-ink-500">
                Are you sure you want to remove this address from your address book?
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingAddressId(null)}
                className="px-4 py-2 text-xs font-semibold text-ink-700 hover:bg-sand-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAddress}
                disabled={addressLoading}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5"
              >
                {addressLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

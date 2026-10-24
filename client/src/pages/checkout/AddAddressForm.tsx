import React from 'react';
import { Building2, RefreshCw } from 'lucide-react';
import { Address } from '../../services/user.service';
import { Button } from '../../components/ui/Button';
import { INITIAL_ADDRESS_FORM } from './constants';

interface AddAddressFormProps {
  addressesCount: number;
  addressForm: Omit<Address, '_id'>;
  setAddressForm: React.Dispatch<React.SetStateAction<Omit<Address, '_id'>>>;
  addressLoading: boolean;
  onCancel: () => void;
  onSubmit: (e: React.FormEvent) => Promise<void>;
}

export const AddAddressForm: React.FC<AddAddressFormProps> = ({
  addressesCount,
  addressForm,
  setAddressForm,
  addressLoading,
  onCancel,
  onSubmit,
}) => {
  return (
    <div className="border border-sand-300 rounded-xl p-5 sm:p-6 bg-sand-50/50 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between border-b border-sand-200 pb-3">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-ink-700" />
          <h3 className="text-sm font-bold text-ink-950">Add New Delivery Destination</h3>
        </div>
        {addressesCount > 0 && (
          <button
            type="button"
            onClick={() => {
              onCancel();
              setAddressForm(INITIAL_ADDRESS_FORM);
            }}
            className="text-xs text-ink-500 hover:text-ink-900 underline underline-offset-2"
          >
            Cancel
          </button>
        )}
      </div>

      <form onSubmit={onSubmit} className="space-y-4 text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-ink-700 font-semibold mb-1">
              Address Label (e.g. Home, Office, Studio) *
            </label>
            <input
              type="text"
              required
              value={addressForm.label}
              onChange={(e) => setAddressForm({ ...addressForm, label: e.target.value })}
              placeholder="Home"
              className="w-full px-3 py-2 rounded-lg border border-sand-300 bg-white text-ink-900 focus:ring-2 focus:ring-ink-900 focus:border-transparent outline-none"
            />
          </div>

          <div>
            <label className="block text-ink-700 font-semibold mb-1">
              Contact Phone
            </label>
            <input
              type="tel"
              maxLength={13}
              value={addressForm.phone || ''}
              onChange={(e) => setAddressForm({ ...addressForm, phone: e.target.value.replace(/\D/g, '').slice(0, 13) })}
              placeholder="e.g. 0771234567"
              className="w-full px-3 py-2 rounded-lg border border-sand-300 bg-white text-ink-900 focus:ring-2 focus:ring-ink-900 focus:border-transparent outline-none font-mono"
            />
            <span className="text-[11px] text-ink-500 mt-1 block">
              Numbers only, 10–13 digits {addressForm.phone ? `(${addressForm.phone.length}/13)` : ''}
            </span>
          </div>
        </div>

        <div>
          <label className="block text-ink-700 font-semibold mb-1">
            Street Address *
          </label>
          <input
            type="text"
            required
            value={addressForm.line1}
            onChange={(e) => setAddressForm({ ...addressForm, line1: e.target.value })}
            placeholder="Road 11, House 45, Banani"
            className="w-full px-3 py-2 rounded-lg border border-sand-300 bg-white text-ink-900 focus:ring-2 focus:ring-ink-900 focus:border-transparent outline-none"
          />
        </div>

        <div>
          <label className="block text-ink-700 font-semibold mb-1">
            Apartment, Suite, Unit, Floor (Optional)
          </label>
          <input
            type="text"
            value={addressForm.line2 || ''}
            onChange={(e) => setAddressForm({ ...addressForm, line2: e.target.value })}
            placeholder="Apt 4B, Level 4"
            className="w-full px-3 py-2 rounded-lg border border-sand-300 bg-white text-ink-900 focus:ring-2 focus:ring-ink-900 focus:border-transparent outline-none"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-ink-700 font-semibold mb-1">
              City *
            </label>
            <input
              type="text"
              required
              value={addressForm.city}
              onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
              placeholder="Dhaka"
              className="w-full px-3 py-2 rounded-lg border border-sand-300 bg-white text-ink-900 focus:ring-2 focus:ring-ink-900 focus:border-transparent outline-none"
            />
          </div>

          <div>
            <label className="block text-ink-700 font-semibold mb-1">
              State / Province *
            </label>
            <input
              type="text"
              required
              value={addressForm.province}
              onChange={(e) => setAddressForm({ ...addressForm, province: e.target.value })}
              placeholder="Dhaka Division"
              className="w-full px-3 py-2 rounded-lg border border-sand-300 bg-white text-ink-900 focus:ring-2 focus:ring-ink-900 focus:border-transparent outline-none"
            />
          </div>

          <div>
            <label className="block text-ink-700 font-semibold mb-1">
              Postal Code *
            </label>
            <input
              type="text"
              required
              value={addressForm.postalCode}
              onChange={(e) => setAddressForm({ ...addressForm, postalCode: e.target.value })}
              placeholder="1213"
              className="w-full px-3 py-2 rounded-lg border border-sand-300 bg-white text-ink-900 focus:ring-2 focus:ring-ink-900 focus:border-transparent outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-ink-700 font-semibold mb-1">
            Country *
          </label>
          <input
            type="text"
            required
            value={addressForm.country}
            onChange={(e) => setAddressForm({ ...addressForm, country: e.target.value })}
            placeholder="Bangladesh"
            className="w-full px-3 py-2 rounded-lg border border-sand-300 bg-white text-ink-900 focus:ring-2 focus:ring-ink-900 focus:border-transparent outline-none"
          />
        </div>

        <div className="flex items-center gap-2 pt-1">
          <input
            type="checkbox"
            id="setAsDefaultAddress"
            checked={addressForm.isDefault || addressesCount === 0}
            disabled={addressesCount === 0}
            onChange={(e) => setAddressForm({ ...addressForm, isDefault: e.target.checked })}
            className="w-4 h-4 rounded text-ink-900 border-sand-300 focus:ring-ink-950"
          />
          <label htmlFor="setAsDefaultAddress" className="text-xs text-ink-700 font-medium cursor-pointer">
            Set as my default delivery address
          </label>
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-sand-200">
          {addressesCount > 0 && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                onCancel();
                setAddressForm(INITIAL_ADDRESS_FORM);
              }}
              disabled={addressLoading}
            >
              Cancel
            </Button>
          )}

          <Button
            type="submit"
            variant="primary"
            disabled={addressLoading}
            className="inline-flex items-center gap-2"
          >
            {addressLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
            <span>{addressLoading ? 'Saving Address...' : 'Save & Select Address'}</span>
          </Button>
        </div>
      </form>
    </div>
  );
};

import React from 'react';
import {
  MapPin,
  Plus,
  Star,
  Phone,
  CheckCircle2,
} from 'lucide-react';
import { Address } from '../../services/user.service';
import { Button } from '../../components/ui/Button';
import { AddAddressForm } from './AddAddressForm';

interface AddressStepProps {
  addresses: Address[];
  selectedAddressId: string | null;
  setSelectedAddressId: (id: string) => void;
  isAddingAddress: boolean;
  setIsAddingAddress: (isAdding: boolean) => void;
  addressLoading: boolean;
  addressForm: Omit<Address, '_id'>;
  setAddressForm: React.Dispatch<React.SetStateAction<Omit<Address, '_id'>>>;
  handleSaveAddress: (e: React.FormEvent) => Promise<void>;
}

export const AddressStep: React.FC<AddressStepProps> = ({
  addresses,
  selectedAddressId,
  setSelectedAddressId,
  isAddingAddress,
  setIsAddingAddress,
  addressLoading,
  addressForm,
  setAddressForm,
  handleSaveAddress,
}) => {
  return (
    <div className="bg-white rounded-2xl border border-sand-200 p-6 sm:p-8 shadow-sm space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-sand-200">
        <div>
          <h2 className="text-xl font-display font-bold text-ink-950 flex items-center gap-2">
            <span>2. Choose Delivery Address</span>
            <span className="text-xs font-sans font-normal text-ink-500 bg-sand-100 px-2.5 py-0.5 rounded-full">
              {addresses.length} saved {addresses.length === 1 ? 'address' : 'addresses'}
            </span>
          </h2>
          <p className="text-xs text-ink-600 mt-0.5">
            Select where your items should be delivered, or add a new delivery destination.
          </p>
        </div>

        {!isAddingAddress && addresses.length > 0 && (
          <button
            type="button"
            onClick={() => setIsAddingAddress(true)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-900 bg-sand-100 hover:bg-sand-200 px-3.5 py-2 rounded-lg transition-colors border border-sand-300 self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add New Address</span>
          </button>
        )}
      </div>

      {/* Zero Saved Addresses Notice */}
      {addresses.length === 0 && !isAddingAddress && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-center space-y-3">
          <MapPin className="w-8 h-8 text-amber-600 mx-auto" />
          <h3 className="text-sm font-bold text-amber-900">No Delivery Addresses Saved</h3>
          <p className="text-xs text-amber-800 max-w-md mx-auto">
            You have no saved delivery addresses. Please add a shipping destination to proceed with checkout.
          </p>
          <Button
            variant="primary"
            onClick={() => setIsAddingAddress(true)}
            className="text-xs inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Shipping Address</span>
          </Button>
        </div>
      )}

      {/* Saved Address Radio Cards */}
      {addresses.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {addresses.map((addr) => {
            const isSelected = addr._id === selectedAddressId;

            return (
              <div
                key={addr._id}
                onClick={() => addr._id && setSelectedAddressId(addr._id)}
                className={`relative rounded-xl p-5 border-2 transition-all cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'border-ink-950 bg-sand-50/80 shadow-md ring-2 ring-ink-950/10'
                    : 'border-sand-200 bg-white hover:border-sand-400 hover:bg-sand-50/30'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        id={`address-${addr._id}`}
                        name="deliveryAddress"
                        checked={isSelected}
                        onChange={() => addr._id && setSelectedAddressId(addr._id)}
                        className="w-4 h-4 text-ink-950 border-sand-300 focus:ring-ink-950 focus:ring-2"
                      />
                      <label
                        htmlFor={`address-${addr._id}`}
                        className="text-xs font-bold uppercase tracking-wider text-ink-900 cursor-pointer"
                      >
                        {addr.label}
                      </label>
                    </div>

                    {addr.isDefault && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300">
                        <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                        Default
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-ink-700 space-y-1 pl-6">
                    <p className="font-semibold text-ink-950 text-sm">{addr.line1}</p>
                    {addr.line2 && <p className="text-ink-600">{addr.line2}</p>}
                    <p>
                      {addr.city}, {addr.province} {addr.postalCode}
                    </p>
                    <p className="text-ink-500 font-medium">{addr.country}</p>
                    {addr.phone && (
                      <p className="flex items-center gap-1 text-ink-600 pt-1 text-[11px]">
                        <Phone className="w-3 h-3" />
                        <span>{addr.phone}</span>
                      </p>
                    )}
                  </div>
                </div>

                {isSelected && (
                  <div className="mt-4 pt-3 border-t border-sand-200/80 flex items-center justify-between text-xs text-emerald-700 font-semibold">
                    <span className="inline-flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Delivering to this address
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Inline Add Address Form */}
      {isAddingAddress && (
        <AddAddressForm
          addressesCount={addresses.length}
          addressForm={addressForm}
          setAddressForm={setAddressForm}
          addressLoading={addressLoading}
          onCancel={() => setIsAddingAddress(false)}
          onSubmit={handleSaveAddress}
        />
      )}
    </div>
  );
};

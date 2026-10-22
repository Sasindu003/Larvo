import { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import { userService, Address } from '../../services/user.service';
import { INITIAL_ADDRESS_FORM } from './constants';

export function useCheckoutAddress(
  userAddresses: Address[] | undefined,
  refreshUser: () => Promise<void>,
) {
  const addresses = useMemo(() => userAddresses || [], [userAddresses]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [isAddingAddress, setIsAddingAddress] = useState<boolean>(false);
  const [addressLoading, setAddressLoading] = useState<boolean>(false);
  const [addressForm, setAddressForm] = useState<Omit<Address, '_id'>>(INITIAL_ADDRESS_FORM);

  useEffect(() => {
    if (addresses.length > 0) {
      if (!selectedAddressId || !addresses.some((a) => a._id === selectedAddressId)) {
        const defaultAddr = addresses.find((a) => a.isDefault) || addresses[0];
        if (defaultAddr?._id) {
          setSelectedAddressId(defaultAddr._id);
        }
      }
    } else {
      setSelectedAddressId(null);
      setIsAddingAddress(true);
    }
  }, [addresses, selectedAddressId]);

  const selectedAddress = useMemo(() => {
    return addresses.find((a) => a._id === selectedAddressId) || null;
  }, [addresses, selectedAddressId]);

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !addressForm.line1.trim() ||
      !addressForm.city.trim() ||
      !addressForm.postalCode.trim() ||
      !addressForm.province.trim()
    ) {
      toast.error('Please fill in all required address fields');
      return;
    }

    if (addressForm.phone && !/^\d{10,13}$/.test(addressForm.phone.trim())) {
      toast.error('Phone number must contain only numbers and be 10 to 13 digits long');
      return;
    }

    setAddressLoading(true);
    try {
      const isFirst = addresses.length === 0;
      const updatedAddresses = await userService.addAddress({
        ...addressForm,
        isDefault: addressForm.isDefault || isFirst,
      });
      await refreshUser();
      if (Array.isArray(updatedAddresses) && updatedAddresses.length > 0) {
        const newlyAdded = updatedAddresses[updatedAddresses.length - 1];
        if (newlyAdded?._id) {
          setSelectedAddressId(newlyAdded._id);
        }
      }
      setAddressForm(INITIAL_ADDRESS_FORM);
      setIsAddingAddress(false);
      toast.success('Delivery address added and selected');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save address';
      toast.error(message);
    } finally {
      setAddressLoading(false);
    }
  };

  return {
    addresses,
    selectedAddressId,
    setSelectedAddressId,
    isAddingAddress,
    setIsAddingAddress,
    addressLoading,
    addressForm,
    setAddressForm,
    selectedAddress,
    handleSaveAddress,
  };
}

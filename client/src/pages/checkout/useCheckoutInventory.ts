import { useState, useEffect, useMemo, useCallback } from 'react';
import toast from 'react-hot-toast';
import { CartItem } from '../../context/CartContext';
import { inventoryService, InventoryValidationResponse } from '../../services/inventory.service';
import { UnavailableItem } from './types';

export function useCheckoutInventory(items: CartItem[]) {
  const [validating, setValidating] = useState<boolean>(false);
  const [validationResults, setValidationResults] = useState<Record<string, InventoryValidationResponse>>({});
  const [hasValidated, setHasValidated] = useState<boolean>(false);

  const runValidation = useCallback(async () => {
    if (items.length === 0) return;
    setValidating(true);
    try {
      const requests = items.map((item) => ({
        sku: item.variantSku,
        qty: item.quantity,
      }));
      const results = await inventoryService.validate(requests);
      const map: Record<string, InventoryValidationResponse> = {};
      results.forEach((r) => {
        map[r.sku] = r;
      });
      setValidationResults(map);
      setHasValidated(true);
    } catch (err: unknown) {
      console.error('Checkout inventory validation failed:', err);
      const message = err instanceof Error ? err.message : 'Failed to check real-time inventory availability';
      toast.error(message);
    } finally {
      setValidating(false);
    }
  }, [items]);

  useEffect(() => {
    runValidation();
  }, [runValidation]);

  const unavailableItems: UnavailableItem[] = useMemo(() => {
    return items
      .map((item) => {
        const val = validationResults[item.variantSku];
        if (!val) return null;
        const avail = val.available ?? 0;
        if (!val.ok || avail < item.quantity) {
          return {
            item,
            available: avail,
            shortfall: Math.max(1, item.quantity - avail),
          };
        }
        return null;
      })
      .filter((entry): entry is UnavailableItem => entry !== null);
  }, [items, validationResults]);

  return {
    validating,
    validationResults,
    hasValidated,
    unavailableItems,
    runValidation,
  };
}

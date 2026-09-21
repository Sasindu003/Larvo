import React, { createContext, useContext, useReducer, useEffect, useMemo, useRef } from 'react';
import toast from 'react-hot-toast';
import { inventoryService, InventoryValidationResponse } from '../services/inventory.service';
import { useAuth } from './AuthContext';

export interface CartItem {
  productId: string;
  slug: string;
  name: string;
  image: string;
  variantSku: string;
  size: string;
  color: string;
  unitPrice: number;
  quantity: number;
  stock?: number;
}

interface CartState {
  items: CartItem[];
  isDrawerOpen: boolean;
}

type CartAction =
  | { type: 'HYDRATE'; items: CartItem[] }
  | { type: 'ADD_ITEM'; item: Omit<CartItem, 'quantity'>; quantity?: number }
  | { type: 'REMOVE_ITEM'; variantSku: string }
  | { type: 'UPDATE_QUANTITY'; variantSku: string; quantity: number }
  | { type: 'CLEAR_CART' }
  | { type: 'SET_DRAWER_OPEN'; isOpen: boolean };

export const GUEST_CART_KEY = 'larvo_cart_guest';
export const ACTIVE_CART_STORAGE_KEY = 'larvo_active_cart_key';
const LEGACY_CART_KEY = 'larvo_cart_v1';

export function getCartStorageKey(userId?: string | null): string {
  return userId ? `larvo_cart_${userId}` : GUEST_CART_KEY;
}

export function loadCartFromStorage(key: string): CartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const saved = localStorage.getItem(key);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.error(`Failed to parse cart from ${key}:`, err);
  }
  return [];
}

export function saveCartToStorage(key: string, items: CartItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(items));
  } catch (err) {
    console.error(`Failed to save cart to ${key}:`, err);
  }
}

export function mergeCartItems(userItems: CartItem[], guestItems: CartItem[]): CartItem[] {
  const merged = [...userItems];

  for (const gItem of guestItems) {
    const existingIndex = merged.findIndex((item) => item.variantSku === gItem.variantSku);
    if (existingIndex > -1) {
      const existing = merged[existingIndex];
      const maxStock = existing.stock !== undefined ? existing.stock : (gItem.stock !== undefined ? gItem.stock : 99);
      const combinedQty = Math.min(existing.quantity + gItem.quantity, maxStock);
      merged[existingIndex] = {
        ...existing,
        quantity: combinedQty,
      };
    } else {
      merged.push(gItem);
    }
  }

  return merged;
}

function getInitialCart(): CartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    // Purge legacy global key to prevent lingering cart items across logout/accounts
    if (localStorage.getItem(LEGACY_CART_KEY)) {
      localStorage.removeItem(LEGACY_CART_KEY);
    }

    const activeKey = localStorage.getItem(ACTIVE_CART_STORAGE_KEY) || GUEST_CART_KEY;
    return loadCartFromStorage(activeKey);
  } catch (err) {
    console.error('Failed to initialize cart from storage:', err);
  }
  return [];
}

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'HYDRATE':
      return { ...state, items: action.items };

    case 'ADD_ITEM': {
      const qtyToAdd = action.quantity && action.quantity > 0 ? action.quantity : 1;
      const existingIndex = state.items.findIndex(
        (i) => i.variantSku === action.item.variantSku
      );

      // Check stock if available
      const maxStock = action.item.stock !== undefined ? action.item.stock : 99;
      if (maxStock <= 0) {
        toast.error('This item is currently out of stock.');
        return state;
      }

      if (existingIndex > -1) {
        const existing = state.items[existingIndex];
        const newQty = existing.quantity + qtyToAdd;
        if (newQty > maxStock) {
          toast.error(`Only ${maxStock} items available in stock.`);
          const updatedItems = [...state.items];
          updatedItems[existingIndex] = { ...existing, quantity: maxStock };
          return { ...state, items: updatedItems, isDrawerOpen: true };
        }

        const updatedItems = [...state.items];
        updatedItems[existingIndex] = { ...existing, quantity: newQty };
        toast.success(`Updated ${action.item.name} (${action.item.size}) quantity in cart`);
        return { ...state, items: updatedItems, isDrawerOpen: true };
      } else {
        if (qtyToAdd > maxStock) {
          toast.error(`Only ${maxStock} items available in stock.`);
          return {
            ...state,
            items: [...state.items, { ...action.item, quantity: maxStock }],
            isDrawerOpen: true,
          };
        }
        toast.success(`Added ${action.item.name} (${action.item.size}) to cart`);
        return {
          ...state,
          items: [...state.items, { ...action.item, quantity: qtyToAdd }],
          isDrawerOpen: true,
        };
      }
    }

    case 'REMOVE_ITEM': {
      const removed = state.items.find((i) => i.variantSku === action.variantSku);
      const filtered = state.items.filter((i) => i.variantSku !== action.variantSku);
      if (removed) {
        toast.success(`Removed ${removed.name} from cart`);
      }
      return { ...state, items: filtered };
    }

    case 'UPDATE_QUANTITY': {
      if (action.quantity <= 0) {
        return {
          ...state,
          items: state.items.filter((i) => i.variantSku !== action.variantSku),
        };
      }

      const updated = state.items.map((item) => {
        if (item.variantSku === action.variantSku) {
          const maxStock = item.stock !== undefined ? item.stock : 99;
          if (action.quantity > maxStock) {
            toast.error(`Only ${maxStock} items available in stock.`);
            return { ...item, quantity: maxStock };
          }
          return { ...item, quantity: action.quantity };
        }
        return item;
      });

      return { ...state, items: updated };
    }

    case 'CLEAR_CART':
      return { ...state, items: [] };

    case 'SET_DRAWER_OPEN':
      return { ...state, isDrawerOpen: action.isOpen };

    default:
      return state;
  }
}

interface CartContextValue {
  items: CartItem[];
  subtotal: number;
  totalItems: number;
  isDrawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  addItem: (item: Omit<CartItem, 'quantity'>, quantity?: number) => void;
  removeItem: (variantSku: string) => void;
  updateQuantity: (variantSku: string, quantity: number) => void;
  clearCart: () => void;
  validateCart: () => Promise<InventoryValidationResponse[]>;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, status } = useAuth();
  const [state, dispatch] = useReducer(cartReducer, {
    items: getInitialCart(),
    isDrawerOpen: false,
  });

  const prevUserIdRef = useRef<string | null | undefined>(undefined);
  const isInitializedRef = useRef(false);

  // Sync auth state with cart storage & isolate accounts
  useEffect(() => {
    // Wait until auth initialization completes
    if (status === 'loading' || status === 'idle') {
      return;
    }

    const currentUserId = user?._id || null;
    const targetKey = getCartStorageKey(currentUserId);

    if (!isInitializedRef.current) {
      isInitializedRef.current = true;
      prevUserIdRef.current = currentUserId;
      localStorage.setItem(ACTIVE_CART_STORAGE_KEY, targetKey);

      const storedItems = loadCartFromStorage(targetKey);
      dispatch({ type: 'HYDRATE', items: storedItems });
      return;
    }

    // No user transition
    if (prevUserIdRef.current === currentUserId) {
      return;
    }

    const previousUserId = prevUserIdRef.current;
    prevUserIdRef.current = currentUserId;
    localStorage.setItem(ACTIVE_CART_STORAGE_KEY, targetKey);

    // Scenario 1: Guest logged in (null -> userId)
    if (!previousUserId && currentUserId) {
      const guestItems = loadCartFromStorage(GUEST_CART_KEY);
      const userItems = loadCartFromStorage(targetKey);

      if (guestItems.length > 0) {
        const merged = mergeCartItems(userItems, guestItems);
        saveCartToStorage(targetKey, merged);
        localStorage.removeItem(GUEST_CART_KEY);
        dispatch({ type: 'HYDRATE', items: merged });
      } else {
        dispatch({ type: 'HYDRATE', items: userItems });
      }
    }
    // Scenario 2: User logged out (userId -> null)
    else if (previousUserId && !currentUserId) {
      // Current user cart is safely retained in larvo_cart_${previousUserId}
      // Reset active cart to clean guest cart
      const guestItems = loadCartFromStorage(GUEST_CART_KEY);
      dispatch({ type: 'HYDRATE', items: guestItems });
      dispatch({ type: 'SET_DRAWER_OPEN', isOpen: false });
    }
    // Scenario 3: Switched directly between user accounts (userIdA -> userIdB)
    else {
      const userItems = loadCartFromStorage(targetKey);
      dispatch({ type: 'HYDRATE', items: userItems });
      dispatch({ type: 'SET_DRAWER_OPEN', isOpen: false });
    }
  }, [status, user?._id]);

  // Sync with localStorage on every cart mutation
  useEffect(() => {
    if (!isInitializedRef.current) return;
    const targetKey = getCartStorageKey(user?._id);
    saveCartToStorage(targetKey, state.items);
  }, [state.items, user?._id]);

  const subtotal = useMemo(() => {
    return state.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  }, [state.items]);

  const totalItems = useMemo(() => {
    return state.items.reduce((sum, item) => sum + item.quantity, 0);
  }, [state.items]);

  const addItem = async (item: Omit<CartItem, 'quantity'>, quantity: number = 1) => {
    try {
      const existingIndex = state.items.findIndex((i) => i.variantSku === item.variantSku);
      const currentQty = existingIndex > -1 ? state.items[existingIndex].quantity : 0;
      const desiredQty = currentQty + quantity;

      const validations = await inventoryService.validate([{ sku: item.variantSku, qty: desiredQty }]);
      const validation = validations[0];

      if (validation) {
        dispatch({ type: 'ADD_ITEM', item: { ...item, stock: validation.available ?? item.stock }, quantity });
      } else {
        dispatch({ type: 'ADD_ITEM', item, quantity });
      }
    } catch (err) {
      console.error('Inventory validation failed:', err);
      dispatch({ type: 'ADD_ITEM', item, quantity });
    }
  };

  const removeItem = (variantSku: string) => {
    dispatch({ type: 'REMOVE_ITEM', variantSku });
  };

  const updateQuantity = async (variantSku: string, quantity: number) => {
    if (quantity <= 0) {
      dispatch({ type: 'UPDATE_QUANTITY', variantSku, quantity });
      return;
    }

    try {
      const validations = await inventoryService.validate([{ sku: variantSku, qty: quantity }]);
      const validation = validations[0];

      if (validation && !validation.ok) {
        if (validation.available !== undefined) {
          toast.error(`Only ${validation.available} items available in stock.`);
          dispatch({ type: 'UPDATE_QUANTITY', variantSku, quantity: validation.available });
        } else {
          toast.error('Requested quantity exceeds available stock.');
        }
      } else {
        dispatch({ type: 'UPDATE_QUANTITY', variantSku, quantity });
      }
    } catch (err) {
      console.error('Inventory validation failed:', err);
      dispatch({ type: 'UPDATE_QUANTITY', variantSku, quantity });
    }
  };

  const clearCart = () => {
    dispatch({ type: 'CLEAR_CART' });
  };

  const openDrawer = async () => {
    if (state.items.length > 0) {
      try {
        const requests = state.items.map((item) => ({ sku: item.variantSku, qty: item.quantity }));
        const validations = await inventoryService.validate(requests);
        let cartUpdated = false;

        validations.forEach((validation) => {
          if (!validation.ok) {
            cartUpdated = true;
            dispatch({
              type: 'UPDATE_QUANTITY',
              variantSku: validation.sku,
              quantity: validation.available ?? 0,
            });
          }
        });

        if (cartUpdated) {
          toast.error('Some items in your cart had insufficient stock and were adjusted.');
        }
      } catch (err) {
        console.error('Inventory validation failed on drawer open:', err);
      }
    }
    dispatch({ type: 'SET_DRAWER_OPEN', isOpen: true });
  };

  const closeDrawer = () => {
    dispatch({ type: 'SET_DRAWER_OPEN', isOpen: false });
  };

  const validateCart = async (): Promise<InventoryValidationResponse[]> => {
    if (state.items.length === 0) return [];
    try {
      const requests = state.items.map((item) => ({ sku: item.variantSku, qty: item.quantity }));
      const validations = await inventoryService.validate(requests);
      // Sync available stock into item.stock without force-reducing requested quantity,
      // enabling live stock shortfall detection
      dispatch({
        type: 'HYDRATE',
        items: state.items.map((item) => {
          const v = validations.find((val) => val.sku === item.variantSku);
          return v && v.available !== undefined ? { ...item, stock: v.available } : item;
        }),
      });
      return validations;
    } catch (err) {
      console.error('Inventory validation failed:', err);
      throw err;
    }
  };

  return (
    <CartContext.Provider
      value={{
        items: state.items,
        subtotal,
        totalItems,
        isDrawerOpen: state.isDrawerOpen,
        openDrawer,
        closeDrawer,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        validateCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = (): CartContextValue => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

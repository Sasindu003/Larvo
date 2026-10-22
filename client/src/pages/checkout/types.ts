import React from 'react';
import { Address } from '../../services/user.service';
import { Coupon } from '../../services/coupon.service';
import { InventoryValidationResponse } from '../../services/inventory.service';
import { Order, Payment } from '../../services/order.service';
import { CartItem } from '../../context/CartContext';

export type CheckoutStep = 1 | 2 | 3 | 4 | 5;

export interface StepConfig {
  id: CheckoutStep;
  name: string;
  icon: React.ElementType;
}

export type PaymentMethod = 'bank_transfer' | 'reward_points' | 'simulate';
export type UploadState = 'idle' | 'uploading' | 'success' | 'error';
export type SimulateState = 'idle' | 'processing' | 'approved' | 'declined' | 'error';

export interface AppliedCoupon {
  code: string;
  discountAmount: number;
  coupon?: Coupon;
  message?: string;
}

export interface UnavailableItem {
  item: CartItem;
  available: number;
  shortfall: number;
}

export interface ConversionRate {
  pointsPerRupee: number;
  pointValue: number;
}

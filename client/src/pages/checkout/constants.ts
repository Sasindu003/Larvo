import { ShoppingBag, MapPin, Tag, CreditCard, CheckCircle2 } from 'lucide-react';
import { StepConfig } from './types';
import { Address } from '../../services/user.service';

export const CHECKOUT_STEPS: StepConfig[] = [
  { id: 1, name: 'Bag Summary', icon: ShoppingBag },
  { id: 2, name: 'Delivery Address', icon: MapPin },
  { id: 3, name: 'Promo Code', icon: Tag },
  { id: 4, name: 'Payment', icon: CreditCard },
  { id: 5, name: 'Confirmation', icon: CheckCircle2 },
];

export const INITIAL_ADDRESS_FORM: Omit<Address, '_id'> = {
  label: 'Home',
  line1: '',
  line2: '',
  city: '',
  province: '',
  postalCode: '',
  country: 'Bangladesh',
  phone: '',
  isDefault: false,
};

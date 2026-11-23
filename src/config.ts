// Lists used across the app. Change them here after talking to the owner.

import type { OrderStatus } from './types';

export const CURRENCY = 'Rs';

export const ORDER_STATUSES: OrderStatus[] = ['Pending', 'Designing', 'In Production', 'Completed', 'Delivered', 'Cancelled'];

export const GARMENTS = ['Lehenga', 'Sari', 'Sharara', 'Gharara', 'Frock', 'Maxi / Gown', 'Kameez', 'Kurti', 'Dupatta', 'Other'];

export const INVENTORY_CATEGORIES = ['SEQ', 'ZARI', 'THREAD', 'FABRIC', 'PARTS'];

export const DESIGNATIONS = ['Designer', 'Operator', 'Helper', 'Supervisor', 'Finisher', 'Store Keeper', 'Accountant'];

export const EXPENSE_CATEGORIES = ['Rent', 'Electricity', 'Diesel / Generator', 'Machine Repair', 'Transport', 'Tea / Food', 'Other'];

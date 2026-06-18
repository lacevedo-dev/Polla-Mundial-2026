import { lazy } from 'react';

export const LazyPaymentModal = lazy(() => import('./PaymentModal'));
export const LazyHistoryModal = lazy(() => import('./HistoryModal'));
export const LazyQuickPayModal = lazy(() => import('./QuickPayModal'));
export const LazyBulkPayModal = lazy(() => import('./BulkPayModal'));
export const LazyReminderModal = lazy(() => import('./ReminderModal'));

import { create } from 'zustand';

export type PaymentStatus = 'paid' | 'pending' | 'review';

export interface PaymentConcept {
    id: string;
    label: string;
    type: 'general' | 'phase' | 'round' | 'match';
    amount: number;
    date: string;
}

export interface UserPaymentData {
    id: string;
    name: string;
    email: string;
    phone?: string;
    avatar: string;
    paymentStatus: Record<string, PaymentStatus>;
    lastUpdate: string;
}

export interface Transaction {
    id: string;
    userId: string;
    conceptIds: string[];
    amount: number;
    date: string;
    method: string;
    reference?: string;
    note?: string;
}

export const PAYMENT_CONCEPTS: PaymentConcept[] = [
    { id: 'general', label: 'Cuota General', type: 'general', amount: 50000, date: 'Inicio' },
    { id: 'phase-1', label: 'Fase de Grupos', type: 'phase', amount: 20000, date: '10 Jun' },
    { id: 'match-col-bra', label: 'Partido: COL vs BRA', type: 'match', amount: 5000, date: 'Hoy' },
    { id: 'round-16', label: 'Octavos de Final', type: 'round', amount: 10000, date: '25 Jun' },
];

export const PAYMENT_METHODS = [
    { id: 'Efectivo', label: 'Efectivo', color: 'text-lime-600' },
    { id: 'Nequi', label: 'Nequi', color: 'text-purple-600' },
    { id: 'Daviplata', label: 'Daviplata', color: 'text-rose-600' },
    { id: 'Bancolombia', label: 'Bancolombia', color: 'text-slate-900' },
];

const MOCK_USERS_DATA: UserPaymentData[] = [
    {
        id: '1', name: 'Luis Morales', email: 'luis.m@gmail.com', phone: '3001234567', avatar: 'https://picsum.photos/seed/luis/40/40', lastUpdate: 'Hoy',
        paymentStatus: { 'general': 'paid', 'phase-1': 'paid', 'match-col-bra': 'paid', 'round-16': 'paid' }
    },
    {
        id: '2', name: 'Leo Castiblanco', email: 'leo.c@hotmail.com', phone: '3109876543', avatar: 'https://picsum.photos/seed/leo/40/40', lastUpdate: 'Ayer',
        paymentStatus: { 'general': 'paid', 'phase-1': 'review', 'match-col-bra': 'pending', 'round-16': 'pending' }
    },
    {
        id: '3', name: 'Nubia Sarmiento', email: 'nubia.s@outlook.com', phone: '3205551234', avatar: 'https://picsum.photos/seed/nubia/40/40', lastUpdate: 'Hace 2h',
        paymentStatus: { 'general': 'pending', 'phase-1': 'pending', 'match-col-bra': 'pending', 'round-16': 'pending' }
    },
    {
        id: '4', name: 'Carlos Ruiz', email: 'carlos.r@gmail.com', phone: '3001112233', avatar: 'https://picsum.photos/seed/carlos/40/40', lastUpdate: 'Hoy',
        paymentStatus: { 'general': 'paid', 'phase-1': 'paid', 'match-col-bra': 'pending', 'round-16': 'pending' }
    },
    {
        id: '5', name: 'Andres Cepeda', email: 'andres.c@music.com', phone: '3159998877', avatar: 'https://picsum.photos/seed/andres/40/40', lastUpdate: '-',
        paymentStatus: { 'general': 'paid', 'phase-1': 'pending', 'match-col-bra': 'pending', 'round-16': 'pending' }
    },
    {
        id: '6', name: 'Maria Fernanda', email: 'mafe@gmail.com', phone: '3104445566', avatar: 'https://picsum.photos/seed/mafe/40/40', lastUpdate: 'Hoy',
        paymentStatus: { 'general': 'review', 'phase-1': 'pending', 'match-col-bra': 'pending', 'round-16': 'pending' }
    },
];

const MOCK_TRANSACTIONS: Transaction[] = [
    { id: 't1', userId: '1', conceptIds: ['general', 'phase-1', 'match-col-bra', 'round-16'], amount: 85000, date: '2026-06-01', method: 'Nequi', reference: 'M12345' },
    { id: 't2', userId: '2', conceptIds: ['general'], amount: 50000, date: '2026-06-02', method: 'Efectivo', note: 'Pago en oficina' },
    { id: 't3', userId: '4', conceptIds: ['general', 'phase-1'], amount: 70000, date: '2026-06-03', method: 'Bancolombia' },
];

export interface PaymentState {
    users: UserPaymentData[];
    transactions: Transaction[];
    setUsers: (updater: (prev: UserPaymentData[]) => UserPaymentData[]) => void;
    setTransactions: (updater: (prev: Transaction[]) => Transaction[]) => void;
}

export const usePaymentStore = create<PaymentState>((set) => ({
    users: MOCK_USERS_DATA,
    transactions: MOCK_TRANSACTIONS,
    setUsers: (updater) => set((state) => ({ users: updater(state.users) })),
    setTransactions: (updater) => set((state) => ({ transactions: updater(state.transactions) }))
}));

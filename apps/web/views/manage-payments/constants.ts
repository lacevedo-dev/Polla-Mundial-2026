import type React from 'react';
import {
    Banknote, Bell, Landmark, Mail, MessageCircle, MessageSquare, Smartphone, Users,
} from 'lucide-react';
import type { ReminderChannel } from './types';

export const ALL_REMINDER_CHANNELS: ReminderChannel[] = [
    'whatsapp_group', 'whatsapp_personal', 'email', 'sms', 'push',
];

export const PAYMENT_METHODS = [
    { id: 'Efectivo', label: 'Efectivo', Icon: Banknote, color: 'text-lime-600' },
    { id: 'Nequi', label: 'Nequi', Icon: Smartphone, color: 'text-purple-600' },
    { id: 'Daviplata', label: 'Daviplata', Icon: Smartphone, color: 'text-rose-600' },
    { id: 'Bancolombia', label: 'Bancolombia', Icon: Landmark, color: 'text-slate-900' },
    { id: 'B-BRE', label: 'B-BRE', Icon: Smartphone, color: 'text-amber-600' },
] as const;

export const CHANNEL_CONFIG: Record<
    ReminderChannel,
    { label: string; Icon: React.ElementType; color: string; bg: string; border: string; hint?: string }
> = {
    whatsapp_group: { label: 'WA Grupo', Icon: Users, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' },
    whatsapp_personal: { label: 'WA Personal', Icon: MessageCircle, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', hint: 'Misma sesión WhatsApp Web que WA Grupo' },
    email: { label: 'Email', Icon: Mail, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
    sms: { label: 'SMS', Icon: MessageSquare, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
    push: { label: 'Push', Icon: Bell, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200' },
};

export const REMINDER_TEMPLATES: Record<'friendly' | 'formal' | 'urgent', Record<ReminderChannel, string>> = {
    friendly: {
        whatsapp_group: '💳 *Recordatorio de pagos* | {liga}\nParticipantes con saldo pendiente:',
        whatsapp_personal: 'Hola {nombre} 👋! Te recuerdo que tienes un saldo pendiente de {deuda} en la polla {liga}. ¡Gracias!',
        email: 'Hola {nombre},\n\nTe escribimos para recordarte amablemente sobre tu saldo pendiente de {deuda} en {liga}.\n\n¡Gracias por participar!',
        sms: '{nombre}, recuerda tu pago de {deuda} en {liga}. ¡No te quedes fuera!',
        push: '👋 {nombre}, no olvides ponerte al día en {liga}.',
    },
    formal: {
        whatsapp_group: '📋 *Aviso de cobro* | {liga}\nSaldos pendientes por participante:',
        whatsapp_personal: 'Estimado(a) {nombre}. Le informamos un saldo vencido de {deuda} en la liga {liga}. Por favor regularizar su estado.',
        email: 'Estimado/a {nombre},\n\nLe notificamos que presenta un saldo pendiente de {deuda} en la liga {liga}.\n\nAtentamente,\nLa Administración.',
        sms: 'Aviso de Cobro: {nombre}, saldo pendiente {deuda} en {liga}. Regularice hoy.',
        push: 'Aviso: Saldo pendiente de {deuda} en {liga}.',
    },
    urgent: {
        whatsapp_group: '🚨 *ÚLTIMO AVISO* | {liga}\nPagos pendientes que requieren atención:',
        whatsapp_personal: '🚨 {nombre}, ÚLTIMO AVISO. Tu deuda de {deuda} en {liga} debe ser pagada hoy.',
        email: 'URGENTE: {nombre}, tu participación en {liga} está en riesgo.\n\nSaldo: {deuda}\n\nRealiza el pago inmediatamente.',
        sms: 'URGENTE {nombre}: Paga {deuda} hoy en {liga} para evitar bloqueo.',
        push: '🚨 {nombre}, tu pago de {deuda} en {liga} requiere atención inmediata.',
    },
};

import { create } from 'zustand';
import { request } from '../api';

export type WhatsappStatus = 'DISABLED' | 'INITIALIZING' | 'QR_READY' | 'CONNECTED' | 'DISCONNECTED' | 'AUTH_FAILURE';

export interface WhatsappSessionInfo {
  sessionPath: string;
  sessionExists: boolean;
  reconnectAttempts: number;
  lastDisconnectReason: string | null;
}

export interface WhatsappGroup {
  id: string;
  name: string;
  participants: number;
}

export type WhatsappJobStatus = 'PENDING' | 'SENDING' | 'SENT' | 'FAILED';

export type WhatsappGroupJobType =
  | 'RESULT_REPORT'
  | 'PREDICTION_REPORT'
  | 'MATCH_REMINDER'
  | 'PREDICTION_CLOSED'
  | 'RESULT_NOTIFICATION'
  | 'GOAL_SCORED'
  | 'PRE_MATCH_ESCALATION'
  | 'MATCH_START'
  | 'HALFTIME'
  | 'SECOND_HALF_START'
  | 'MATCH_LIVE_END'
  | 'GOAL_IMPACT'
  | 'RED_CARD'
  | 'YELLOW_CARD'
  | 'SUBSTITUTION'
  | 'GOAL_ANNULLED'
  | 'PAYMENT_REMINDER';

export interface WhatsappGroupJob {
  id: string;
  type: WhatsappGroupJobType;
  status: WhatsappJobStatus;
  matchId: string;
  leagueId: string;
  groupId: string;
  caption: string;
  attemptCount: number;
  lastError: string | null;
  sentAt: string | null;
  createdAt: string;
  league?: { name: string; code: string };
}

export type WhatsappPersonalSource = 'AUTOMATION' | 'PAYMENT_REMINDER' | 'LEAGUE_BROADCAST';
export type WhatsappPersonalVia = 'WHATSAPP_WEB' | 'TWILIO';

export interface WhatsappPersonalLog {
  id: string;
  status: WhatsappJobStatus;
  source: WhatsappPersonalSource;
  automationStep: string | null;
  notificationType: string | null;
  userId: string | null;
  userName: string | null;
  countryCode: string;
  phone: string;
  message: string;
  via: WhatsappPersonalVia | null;
  lastError: string | null;
  leagueId: string | null;
  matchId: string | null;
  sentAt: string | null;
  createdAt: string;
  user?: { id: string; name: string; username: string } | null;
  league?: { name: string; code: string } | null;
}

interface AdminWhatsappState {
  status: WhatsappStatus | null;
  session: WhatsappSessionInfo | null;
  qrDataUrl: string | null;
  groups: WhatsappGroup[];
  jobs: WhatsappGroupJob[];
  personalLogs: WhatsappPersonalLog[];
  isLoading: boolean;
  error: string | null;

  fetchStatus: () => Promise<void>;
  fetchQr: () => Promise<void>;
  disconnect: () => Promise<void>;
  reinitialize: () => Promise<void>;
  fetchGroups: () => Promise<void>;
  fetchJobs: () => Promise<void>;
  fetchPersonalLogs: () => Promise<void>;
  retryJob: (jobId: string) => Promise<void>;
  deleteJob: (jobId: string) => Promise<void>;
  deletePersonalLog: (logId: string) => Promise<void>;
  publishManual: (matchId: string, leagueId: string, type: 'results' | 'predictions') => Promise<void>;
  setLeagueGroup: (leagueId: string, groupId: string | null) => Promise<void>;
  getLeagueGroup: (leagueId: string) => Promise<{ whatsappGroupId: string | null }>;
}

export const useAdminWhatsappStore = create<AdminWhatsappState>((set) => ({
  status: null,
  session: null,
  qrDataUrl: null,
  groups: [],
  jobs: [],
  personalLogs: [],
  isLoading: false,
  error: null,

  fetchStatus: async () => {
    try {
      const data = await request<{ status: WhatsappStatus; session?: WhatsappSessionInfo }>('/admin/whatsapp/status');
      set({ status: data.status, session: data.session ?? null });
    } catch (e: any) {
      set({ error: e.message });
    }
  },

  fetchQr: async () => {
    try {
      const data = await request<{ qrDataUrl: string }>('/admin/whatsapp/qr');
      set({ qrDataUrl: data.qrDataUrl });
    } catch {
      set({ qrDataUrl: null });
    }
  },

  disconnect: async () => {
    set({ isLoading: true });
    try {
      await request('/admin/whatsapp/disconnect', { method: 'POST' });
      set({ status: 'DISCONNECTED', qrDataUrl: null });
    } finally {
      set({ isLoading: false });
    }
  },

  reinitialize: async () => {
    set({ isLoading: true });
    try {
      const data = await request<{ ok: boolean; status: WhatsappStatus }>('/admin/whatsapp/reinitialize', { method: 'POST' });
      set({ status: data.status, qrDataUrl: null });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchGroups: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await request<{ groups: WhatsappGroup[] }>('/admin/whatsapp/groups');
      set({ groups: data.groups });
    } catch (e: any) {
      set({ error: e.message });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchJobs: async () => {
    try {
      const data = await request<{ jobs: WhatsappGroupJob[] }>('/admin/whatsapp/jobs?limit=150');
      set({ jobs: data.jobs });
    } catch (e: any) {
      set({ error: e.message });
    }
  },

  fetchPersonalLogs: async () => {
    try {
      const data = await request<{ logs: WhatsappPersonalLog[] }>('/admin/whatsapp/personal-logs?limit=150');
      set({ personalLogs: data.logs });
    } catch (e: any) {
      set({ error: e.message });
    }
  },

  retryJob: async (jobId) => {
    await request(`/admin/whatsapp/jobs/${jobId}/retry`, { method: 'POST' });
  },

  deleteJob: async (jobId) => {
    await request(`/admin/whatsapp/jobs/${jobId}`, { method: 'DELETE' });
  },

  deletePersonalLog: async (logId) => {
    await request(`/admin/whatsapp/personal-logs/${logId}`, { method: 'DELETE' });
  },

  publishManual: async (matchId, leagueId, type) => {
    await request(`/admin/whatsapp/publish/${matchId}/${leagueId}/${type}`, { method: 'POST' });
  },

  setLeagueGroup: async (leagueId, groupId) => {
    await request(`/admin/whatsapp/league/${leagueId}/group`, {
      method: 'POST',
      body: JSON.stringify({ groupId }),
    });
  },

  getLeagueGroup: async (leagueId) => {
    return request<{ whatsappGroupId: string | null }>(`/admin/whatsapp/league/${leagueId}/group`);
  },
}));

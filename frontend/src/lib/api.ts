import axios, { AxiosError } from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api',
});

const TOKEN_KEY = 'appdash.token';

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable */
  }
}

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (error: AxiosError<{ error?: string }>) => {
    if (error.response?.status === 401 && getToken()) {
      setToken(null);
      window.dispatchEvent(new Event('appdash:logout'));
    }
    return Promise.reject(error);
  }
);

export function errorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    return (err.response?.data as { error?: string } | undefined)?.error || err.message;
  }
  return err instanceof Error ? err.message : 'Something went wrong';
}

/* ---------------- Types ---------------- */

export interface User {
  id: string;
  name: string;
  email: string;
}

export interface AppStats {
  devices: number;
  activeDevices: number;
  notifications: number;
  lastSentAt: string | null;
}

export interface AppItem {
  id: string;
  name: string;
  packageName: string;
  platform: 'android' | 'ios' | 'both';
  description: string;
  iconUrl: string;
  playStoreUrl: string;
  sdkApiKey: string;
  fcm: { configured: boolean; projectId: string; clientEmail: string; configuredAt: string | null };
  aiContext: { audience: string; tone: string; brandVoice: string };
  createdAt: string;
  updatedAt: string;
  stats: AppStats;
}

export interface Device {
  _id: string;
  token: string;
  platform: 'android' | 'ios' | 'web';
  deviceId: string;
  externalUserId: string;
  appVersion: string;
  osVersion: string;
  model: string;
  locale: string;
  timezone: string;
  tags: string[];
  active: boolean;
  lastSeenAt: string;
  createdAt: string;
}

export type TargetType = 'all' | 'tags' | 'platform' | 'tokens' | 'users';

export interface Target {
  type: TargetType;
  tags?: string[];
  platform?: 'android' | 'ios' | 'web' | '';
  tokens?: string[];
  externalUserIds?: string[];
}

export type NotificationStatus =
  | 'draft'
  | 'scheduled'
  | 'sending'
  | 'sent'
  | 'partial'
  | 'failed'
  | 'cancelled';

export interface Notification {
  _id: string;
  title: string;
  body: string;
  imageUrl: string;
  deepLink: string;
  data: Record<string, string>;
  target: Target;
  status: NotificationStatus;
  scheduledAt?: string;
  sentAt?: string;
  stats: { targeted: number; success: number; failure: number; invalidTokensRemoved: number };
  error: string;
  ai: { generated: boolean; prompt: string; model: string };
  createdAt: string;
}

export interface AiVariant {
  title: string;
  body: string;
  emoji: string;
  rationale: string;
  deepLink: string;
}

export interface AiGeneration {
  variants: AiVariant[];
  bestVariantIndex: number;
  sendTimeSuggestion: string;
  model: string;
}

export interface Overview {
  app: AppItem;
  devicesByPlatform: Record<string, number>;
  tags: { tag: string; count: number }[];
  recentNotifications: Notification[];
  totals: { sent: number; failed: number; campaigns: number };
  timeline: { date: string; success: number; failure: number }[];
}

export interface NotificationDraft {
  title: string;
  body: string;
  imageUrl?: string;
  deepLink?: string;
  data?: Record<string, string>;
  target: Target;
  ai?: { generated: boolean; prompt?: string; model?: string };
  mode?: 'draft' | 'send' | 'schedule';
  scheduledAt?: string | null;
}

/* ---------------- Calls ---------------- */

export const Auth = {
  login: (email: string, password: string) =>
    api.post<{ token: string; user: User }>('/auth/login', { email, password }).then((r) => r.data),
  register: (name: string, email: string, password: string) =>
    api.post<{ token: string; user: User }>('/auth/register', { name, email, password }).then((r) => r.data),
  me: () => api.get<{ user: User }>('/auth/me').then((r) => r.data.user),
};

export const Apps = {
  list: () => api.get<{ apps: AppItem[] }>('/apps').then((r) => r.data.apps),
  get: (id: string) => api.get<{ app: AppItem }>(`/apps/${id}`).then((r) => r.data.app),
  create: (data: Partial<AppItem>) => api.post<{ app: AppItem }>('/apps', data).then((r) => r.data.app),
  update: (id: string, data: Partial<AppItem>) =>
    api.patch<{ app: AppItem }>(`/apps/${id}`, data).then((r) => r.data.app),
  remove: (id: string) => api.delete(`/apps/${id}`),
  overview: (id: string) => api.get<Overview>(`/apps/${id}/overview`).then((r) => r.data),
  rotateKey: (id: string) =>
    api.post<{ sdkApiKey: string }>(`/apps/${id}/sdk-key/rotate`).then((r) => r.data.sdkApiKey),
  setFcm: (id: string, serviceAccountJson: string) =>
    api.put<{ app: AppItem }>(`/apps/${id}/fcm`, { serviceAccountJson }).then((r) => r.data.app),
  clearFcm: (id: string) => api.delete<{ app: AppItem }>(`/apps/${id}/fcm`).then((r) => r.data.app),
};

export const Devices = {
  list: (appId: string, params: Record<string, string | number | undefined>) =>
    api
      .get<{ devices: Device[]; total: number; page: number; pages: number }>(`/apps/${appId}/devices`, { params })
      .then((r) => r.data),
  add: (appId: string, data: { token: string; platform: string; tags: string[]; externalUserId: string }) =>
    api.post<{ device: Device }>(`/apps/${appId}/devices`, data).then((r) => r.data.device),
  remove: (appId: string, deviceId: string) => api.delete(`/apps/${appId}/devices/${deviceId}`),
};

export const Notifications = {
  list: (appId: string, params: Record<string, string | number | undefined>) =>
    api
      .get<{ notifications: Notification[]; total: number; page: number; pages: number }>(
        `/apps/${appId}/notifications`,
        { params }
      )
      .then((r) => r.data),
  get: (appId: string, id: string) =>
    api.get<{ notification: Notification }>(`/apps/${appId}/notifications/${id}`).then((r) => r.data.notification),
  create: (appId: string, draft: NotificationDraft) =>
    api.post<{ notification: Notification }>(`/apps/${appId}/notifications`, draft).then((r) => r.data.notification),
  update: (appId: string, id: string, draft: NotificationDraft) =>
    api
      .patch<{ notification: Notification }>(`/apps/${appId}/notifications/${id}`, draft)
      .then((r) => r.data.notification),
  sendNow: (appId: string, id: string) =>
    api.post<{ notification: Notification }>(`/apps/${appId}/notifications/${id}/send`).then((r) => r.data.notification),
  cancel: (appId: string, id: string) =>
    api.post<{ notification: Notification }>(`/apps/${appId}/notifications/${id}/cancel`).then((r) => r.data.notification),
  duplicate: (appId: string, id: string) =>
    api
      .post<{ notification: Notification }>(`/apps/${appId}/notifications/${id}/duplicate`)
      .then((r) => r.data.notification),
  remove: (appId: string, id: string) => api.delete(`/apps/${appId}/notifications/${id}`),
  estimate: (appId: string, target: Target) =>
    api.post<{ reach: number }>(`/apps/${appId}/notifications/estimate`, { target }).then((r) => r.data.reach),
  sendTest: (appId: string, payload: { title: string; body: string; imageUrl?: string; deepLink?: string; tokens: string[] }) =>
    api
      .post<{ success: number; failure: number; errors: Record<string, number> }>(`/apps/${appId}/notifications/test`, payload)
      .then((r) => r.data),
};

export const AI = {
  generate: (
    appId: string,
    payload: { prompt: string; tone?: string; audience?: string; count?: number; language?: string }
  ) => api.post<AiGeneration>(`/apps/${appId}/ai/generate`, payload).then((r) => r.data),
  refine: (appId: string, payload: { title: string; body: string; instruction: string }) =>
    api
      .post<{ title: string; body: string; changeSummary: string }>(`/apps/${appId}/ai/refine`, payload)
      .then((r) => r.data),
};

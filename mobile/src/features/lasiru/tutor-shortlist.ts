import { apiRequest } from '@/services/api';

export type Priority = 'high' | 'medium' | 'low';
export type ShortlistEntry = {
  _id: string;
  tutor: {
    _id: string;
    name: string;
    profile?: { subjects?: string[]; hourlyRate?: number };
    status: 'active' | 'suspended';
    isVerified: boolean;
  } | null;
  note: string;
  priority: Priority;
  createdAt: string;
  updatedAt: string;
};

const headers = (token: string) => ({ Authorization: `Bearer ${token}` });

export const tutorShortlistApi = {
  list: (token: string) => apiRequest<{ shortlist: ShortlistEntry[] }>('/tutor-shortlist', { headers: headers(token) }),
  add: (tutorId: string, token: string) => apiRequest<{ entry: ShortlistEntry }>('/tutor-shortlist', { method: 'POST', headers: headers(token), body: JSON.stringify({ tutorId }) }),
  update: (id: string, note: string, priority: Priority, token: string) => apiRequest<{ entry: ShortlistEntry }>(`/tutor-shortlist/${id}`, { method: 'PUT', headers: headers(token), body: JSON.stringify({ note, priority }) }),
  remove: (id: string, token: string) => apiRequest<{ message: string }>(`/tutor-shortlist/${id}`, { method: 'DELETE', headers: headers(token) }),
};

import { apiRequest } from '@/services/api';

export type SavedSearchPayload = {
  name: string;
  query: string;
  subject: string;
  sort: 'rating' | 'rate_low' | 'rate_high' | 'newest';
  filters: {
    minRate: number;
    maxRate: number;
    minRating: 0 | 3 | 4 | 4.5;
    availability: 'any' | 'today' | 'week';
    experience: 'any' | 'New tutor' | '1-2 years' | '3+ years';
  };
};

export type SavedSearch = SavedSearchPayload & {
  _id: string;
  createdAt: string;
  updatedAt: string;
};

type SavedSearchResponse = Omit<SavedSearch, 'filters'> & {
  filters?: Partial<SavedSearchPayload['filters']>;
};

const defaultFilters: SavedSearchPayload['filters'] = {
  minRate: 0,
  maxRate: 0,
  minRating: 0,
  availability: 'any',
  experience: 'any',
};

function normalizeSavedSearch(savedSearch: SavedSearchResponse): SavedSearch {
  return {
    ...savedSearch,
    filters: { ...defaultFilters, ...savedSearch.filters },
  };
}

const headers = (token: string) => ({ Authorization: `Bearer ${token}` });

export const savedSearchApi = {
  list: (token: string) => apiRequest<{ savedSearches: SavedSearchResponse[] }>('/saved-searches', { headers: headers(token) })
    .then(({ savedSearches }) => ({ savedSearches: savedSearches.map(normalizeSavedSearch) })),
  create: (payload: SavedSearchPayload, token: string) => apiRequest<{ savedSearch: SavedSearchResponse }>('/saved-searches', { method: 'POST', headers: headers(token), body: JSON.stringify(payload) })
    .then(({ savedSearch }) => ({ savedSearch: normalizeSavedSearch(savedSearch) })),
  update: (id: string, payload: SavedSearchPayload, token: string) => apiRequest<{ savedSearch: SavedSearchResponse }>(`/saved-searches/${id}`, { method: 'PUT', headers: headers(token), body: JSON.stringify(payload) })
    .then(({ savedSearch }) => ({ savedSearch: normalizeSavedSearch(savedSearch) })),
  remove: (id: string, token: string) => apiRequest<{ message: string }>(`/saved-searches/${id}`, { method: 'DELETE', headers: headers(token) }),
};

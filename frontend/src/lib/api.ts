const API_BASE_URL = 'http://localhost:5000/api';

// Helper to get token
const getHeaders = () => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

// API Fetch wrapper
const fetchAPI = async (endpoint: string, options: RequestInit = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      ...getHeaders(),
      ...(options.headers || {}),
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Something went wrong');
  }

  return data;
};

export const api = {
  // Auth
  signup: (body: any) => fetchAPI('/auth/signup', { method: 'POST', body: JSON.stringify(body) }),
  login: (body: any) => fetchAPI('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  getProfile: () => fetchAPI('/auth/profile'),

  // Gaalis / Slangs
  search: (params: { q?: string; region?: string; tag?: string; language?: string } = {}) => {
    const query = new URLSearchParams();
    if (params.q) query.append('q', params.q);
    if (params.region) query.append('region', params.region);
    if (params.tag) query.append('tag', params.tag);
    if (params.language) query.append('language', params.language);
    
    const queryString = query.toString();
    return fetchAPI(`/gaalis${queryString ? `?${queryString}` : ''}`);
  },
  getDetail: (slug: string) => fetchAPI(`/gaalis/${slug}`),
  getRandom: () => fetchAPI('/gaalis/random'),
  upload: (body: any) => fetchAPI('/gaalis/upload', { method: 'POST', body: JSON.stringify(body) }),
  like: (id: string) => fetchAPI(`/gaalis/${id}/like`, { method: 'POST' }),
  dislike: (id: string) => fetchAPI(`/gaalis/${id}/dislike`, { method: 'POST' }),
  comment: (id: string, content: string) => fetchAPI(`/gaalis/${id}/comment`, { method: 'POST', body: JSON.stringify({ content }) }),

  // Users
  getUserProfile: (username: string) => fetchAPI(`/users/${username}`),
  getLeaderboard: () => fetchAPI('/users/leaderboard'),

  // Admin / Moderation
  getQueue: () => fetchAPI('/admin/queue'),
  reviewUpload: (body: { gaaliId: string; action: 'APPROVE' | 'REJECT' | 'HIDE'; reason?: string }) => 
    fetchAPI('/admin/review', { method: 'POST', body: JSON.stringify(body) }),
  banUser: (body: { targetUserId: string; banType: 'PERMANENT_BAN' | 'SHADOW_BAN' | 'UNBAN' | 'TEMPORARY_SUSPEND'; reason?: string; durationDays?: number }) => 
    fetchAPI('/admin/users/ban', { method: 'POST', body: JSON.stringify(body) }),
  getAuditLogs: () => fetchAPI('/admin/logs'),
  getStats: () => fetchAPI('/admin/stats'),
  updateSlangFlags: (id: string, body: { isNsfw?: boolean; isVerified?: boolean; isFeatured?: boolean }) =>
    fetchAPI(`/admin/slang/${id}/flags`, { method: 'PUT', body: JSON.stringify(body) }),
};

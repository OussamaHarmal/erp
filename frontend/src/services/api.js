/**
 * API Service
 * Axios instance with JWT interceptors and auto-refresh
 */
import axios from 'axios';

const BASE_URL = `${import.meta.env.VITE_API_URL}/api/v1`;

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// ── Request interceptor: attach access token ──────────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Response interceptor: handle 401 with token refresh ──────────────────
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem('refresh_token');
      if (!refreshToken) {
        logout();
        return Promise.reject(error);
      }

      try {
        const { data } = await axios.post(`${BASE_URL}/auth/refresh`, {
          refresh_token: refreshToken
        });

        localStorage.setItem('access_token', data.access_token);
        localStorage.setItem('refresh_token', data.refresh_token);
        processQueue(null, data.access_token);
        originalRequest.headers.Authorization = `Bearer ${data.access_token}`;
        return api(originalRequest);
      } catch (err) {
        processQueue(err, null);
        logout();
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

const logout = () => {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user');
  window.location.href = '/login';
};

// ── Auth API ──────────────────────────────────────────────────────────────
export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  refresh: (token) => api.post('/auth/refresh', { refresh_token: token }),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
};

// ── Clients API ───────────────────────────────────────────────────────────
export const clientsAPI = {
  list: (params) => api.get('/clients', { params }),
  get: (id) => api.get(`/clients/${id}`),
  create: (data) => api.post('/clients', data),
  updateProfile: (id, data) => api.put(`/clients/${id}/profile`, data),
  delete: (id) => api.delete(`/clients/${id}`),
  toggleStatus: (id) => api.patch(`/clients/${id}/toggle-status`),
};

// ── Contracts API ─────────────────────────────────────────────────────────
export const contractsAPI = {
  list: (params) => api.get('/contracts', { params }),
  expiringSoon: (days = 30) => api.get('/contracts/alerts/expiring-soon', { params: { days } }),
  sendExpirationReminders: (days = 30) => api.post('/contracts/alerts/expiring-soon/send-reminders', null, { params: { days } }),
  get: (id) => api.get(`/contracts/${id}`),
  create: (data) => api.post('/contracts', data),
  request: (data) => api.post('/contracts/request', data),
  downloadPdf: (id) => api.get(`/contracts/${id}/download/pdf`, { responseType: 'blob' }),
  downloadWord: (id) => api.get(`/contracts/${id}/download/word`, { responseType: 'blob' }),
  sendEmail: (id) => api.post(`/contracts/${id}/send-email`),
  sendRenewalInvitation: (id) => api.post(`/contracts/${id}/send-renewal-invitation`),
  update: (id, data) => api.put(`/contracts/${id}`, data),
  approve: (id) => api.patch(`/contracts/${id}/approve`),
reject: (id, reason) =>api.patch(`/contracts/${id}/reject`, null, { params: { reason } }),
  renew: (id, data) => api.post(`/contracts/${id}/renew`, data),
  delete: (id) => api.delete(`/contracts/${id}`),
};

// ── Invoices API ──────────────────────────────────────────────────────────
export const invoicesAPI = {
  list: (params) => api.get('/invoices', { params }),
  get: (id) => api.get(`/invoices/${id}`),
  create: (data) => api.post('/invoices', data),
  update: (id, data) => api.put(`/invoices/${id}`, data),
  exportExcel: () => api.get('/invoices/export/excel', { responseType: 'blob' }),
  exportAccountingCanvas: () => api.get('/invoices/export/accounting-canvas', { responseType: 'blob' }),
  exportSageTxt: () => api.get('/invoices/export/sage-txt', { responseType: 'blob' }),
  exportSageRichTxt: () => api.get('/invoices/export/sage-rich-txt', { responseType: 'blob' }),
  downloadPdf: (id) => api.get(`/invoices/${id}/download/pdf`, { responseType: 'blob' }),
  sendEmail: (id) => api.post(`/invoices/${id}/send-email`),
};

// ── Documents API ─────────────────────────────────────────────────────────
export const documentsAPI = {
  list: () => api.get('/documents'),
  upload: (formData) => api.post('/documents/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  download: (id) => api.get(`/documents/${id}/download`, { responseType: 'blob' }),
  delete: (id) => api.delete(`/documents/${id}`),
};

// ── ERP / Sage API ───────────────────────────────────────────────────────
  export const erpAPI = {
    sageMapping: () => api.get("/erp/sage/mapping"),

    sagePreview: (params) =>
      api.get("/erp/sage/preview", { params }),

    exportSageTxt: (params) =>
      api.get("/erp/sage/export/txt", {
        params,
        responseType: "blob"
      }),

    exportSageZip: (params) =>
      api.get("/erp/sage/export/zip", {
        params,
        responseType: "blob"
      }),

    exportSageExcel: (params) =>
      api.get("/erp/sage/export/excel", {
        params,
        responseType: "blob"
      }),

    // NEW ✅
    prepareSageExport: (params) =>
      api.post("/erp/sage/prepare-export", null, { params }),

    sageHistory: () =>
      api.get("/erp/sage/history"),

    exportInvoiceSageTxt: (id) =>
      api.get(`/erp/sage/invoices/${id}/txt`, {
        responseType: "blob"
      }),
  };
export const chatbotAPI = {
  ask: (message, history = []) => api.post('/chatbot/ask', { message, history }),
};

export const analyticsAPI = {
  dashboard: () => api.get('/analytics/dashboard'),
  myStats: () => api.get('/analytics/my-stats'),
  notifications: () => api.get('/analytics/notifications'),
  generateNotifications: () => api.post('/analytics/notifications/generate'),
  auditLogs: () => api.get('/analytics/audit-logs'),
  activityTimeline: (params) => api.get('/analytics/activity-timeline', { params }),
  clientPortal: () => api.get('/analytics/client-portal'),
};

export const notificationsAPI = {
  list: (params) => api.get('/notifications', { params }),
  markRead: (id) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.patch('/notifications/read-all'),
  deleteAll: () => api.delete('/notifications/delete-all'),
};

export const renewalRequestsAPI = {
  create: (contractId, data) => api.post(`/contracts/${contractId}/renewal-request`, data),
  clientList: () => api.get('/client/renewal-requests'),
  directorList: () => api.get('/director/renewal-requests'),
  decide: (id, data) => api.patch(`/director/renewal-requests/${id}`, data),
};

export default api;

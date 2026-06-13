import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

const client = axios.create({
  baseURL: API_URL,
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authAPI = {
  login: (email, password) => client.post('/auth/login', { email, password }),
  register: (email, password, name, role) =>
    client.post('/auth/register', { email, password, name, role }),
};

export const sessionsAPI = {
  create: (title) => client.post('/sessions', { title }),
  getAll: () => client.get('/sessions'),
  getById: (id) => client.get(`/sessions/${id}`),
  end: (id) => client.post(`/sessions/${id}/end`),
  getChat: (id) => client.get(`/sessions/${id}/chat`),
  getRecordings: (id) => client.get(`/sessions/${id}/recordings`),
  getFiles: (id) => client.get(`/sessions/${id}/files`),
};

export const filesAPI = {
  upload: (sessionId, file, uploaderName) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('sessionId', sessionId);
    formData.append('uploaderName', uploaderName);
    return client.post('/files/upload', formData);
  },
  download: (id) => `${API_URL}/files/${id}`,
};

export const recordingsAPI = {
  download: (id) => `${API_URL}/recordings/${id}/download`,
};

export const inviteAPI = {
  validate: (token) => axios.get(`${API_URL}/invite/${token}`),
};

export const adminAPI = {
  getSessions: () => client.get('/admin/sessions'),
  endSession: (id) => client.delete(`/admin/sessions/${id}`),
};

export default client;

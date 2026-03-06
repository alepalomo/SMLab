import { create } from 'zustand';
import api from '../../lib/api';

const useAuthStore = create((set) => ({
  user: null,
  token: localStorage.getItem('token') || null,
  isAuthenticated: !!localStorage.getItem('token'),

  login: async (username, password) => {
    const { data } = await api.post('/auth/login', { username, password });
    localStorage.setItem('token', data.token);
    set({ token: data.token, user: data.user, isAuthenticated: true });
    return data.user;
  },

  logout: () => {
    localStorage.removeItem('token');
    set({ token: null, user: null, isAuthenticated: false });
  },

  loadMe: async () => {
    try {
      const { data } = await api.get('/auth/me');
      set({ user: data, isAuthenticated: true });
    } catch {
      localStorage.removeItem('token');
      set({ token: null, user: null, isAuthenticated: false });
    }
  },
}));

export default useAuthStore;

const API_BASE = 'https://spade-inbox-backend-production.up.railway.app/api';

const getAuthHeaders = (): Record<string, string> => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const api = {
  auth: {
    login: async (email: string, password: string) => {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (data.token) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
      }
      return data;
    },
    logout: () => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    },
    getUser: () => {
      const user = localStorage.getItem('user');
      return user ? JSON.parse(user) : null;
    },
  },

  messages: {
    list: async (params: { status?: string; priority?: string; source?: string; search?: string; page?: number; limit?: number } = {}) => {
      const query = new URLSearchParams();
      if (params.status) query.set('status', params.status);
      if (params.priority) query.set('priority', params.priority);
      if (params.source) query.set('source', params.source);
      if (params.search) query.set('search', params.search);
      if (params.page) query.set('page', String(params.page));
      if (params.limit) query.set('limit', String(params.limit));
      
      const res = await fetch(`${API_BASE}/messages?${query}`, {
        headers: getAuthHeaders(),
      });
      return res.json();
    },

    get: async (id: number) => {
      const res = await fetch(`${API_BASE}/messages/${id}`, {
        headers: getAuthHeaders(),
      });
      return res.json();
    },

    view: async (id: number) => {
      const res = await fetch(`${API_BASE}/messages/${id}/view`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      });
      return res.json();
    },

    reply: async (id: number, replyBody: string, sentVia: string = 'email') => {
      const res = await fetch(`${API_BASE}/messages/${id}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ reply_body: replyBody, sent_via: sentVia }),
      });
      return res.json();
    },

    updateStatus: async (id: number, status: string) => {
      const res = await fetch(`${API_BASE}/messages/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ status }),
      });
      return res.json();
    },

    updatePriority: async (id: number, priority: string) => {
      const res = await fetch(`${API_BASE}/messages/${id}/priority`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ priority }),
      });
      return res.json();
    },

    bulkTrash: async (ids: number[]) => {
      const res = await fetch(`${API_BASE}/messages/bulk/trash`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ ids }),
      });
      return res.json();
    },

    bulkDelete: async (ids: number[]) => {
      const res = await fetch(`${API_BASE}/messages/bulk/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ ids }),
      });
      return res.json();
    },

    emptyTrash: async () => {
      const res = await fetch(`${API_BASE}/messages/empty-trash`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      return res.json();
    },

    getStats: async () => {
      const res = await fetch(`${API_BASE}/messages/stats`, {
        headers: getAuthHeaders(),
      });
      return res.json();
    },
  },
};

export const socketService = {
  socket: null as any,
  
  connect: () => {
    const { io } = require('socket.io-client');
    const SOCKET_URL = 'https://spade-inbox-backend-production.up.railway.app';
    
    socketService.socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
    });

    socketService.socket.on('connect', () => {
      console.log('✅ Socket connected');
    });

    socketService.socket.on('disconnect', (reason: string) => {
      console.log('❌ Socket disconnected:', reason);
    });

    socketService.socket.on('connect_error', (error: any) => {
      console.error('❌ Socket error:', error);
    });

    return socketService.socket;
  },

  join: (userId: number) => {
    socketService.socket?.emit('join', userId);
  },

  onNewMessage: (callback: (message: any) => void) => {
    socketService.socket?.on('new-message', callback);
  },

  offNewMessage: (callback?: (message: any) => void) => {
    if (callback) {
      socketService.socket?.off('new-message', callback);
    } else {
      socketService.socket?.off('new-message');
    }
  },

  disconnect: () => {
    socketService.socket?.disconnect();
    socketService.socket = null;
  },
};

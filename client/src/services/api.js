import axios from 'axios'

// Create axios instance with default config
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
})

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const { response } = error
    
    if (response) {
      // Handle specific error status codes
      switch (response.status) {
        case 401:
          // Unauthorized - clear token and redirect to login
          localStorage.removeItem('token')
          localStorage.removeItem('user')
          window.location.href = '/login'
          break
        case 403:
          console.error('Access denied:', response.data?.message)
          break
        case 404:
          console.error('Resource not found:', response.data?.message)
          break
        case 500:
          console.error('Server error:', response.data?.message)
          break
        default:
          console.error('API Error:', response.data?.message || error.message)
      }
    }
    
    return Promise.reject(error)
  }
)

// Auth API
export const authAPI = {
  register: (userData) => api.post('/auth/register', userData),
  login: (credentials) => api.post('/auth/login', credentials),
  logout: () => api.post('/auth/logout'),
  getCurrentUser: () => api.get('/auth/me'),
  updateProfile: (data) => api.put('/auth/profile', data),
  changePassword: (data) => api.put('/auth/change-password', data),
}

// Document API
export const documentAPI = {
  getAll: () => api.get('/documents'),
  getById: (id) => api.get(`/documents/${id}`),
  create: (data) => api.post('/documents', data),
  update: (id, data) => api.put(`/documents/${id}`, data),
  delete: (id) => api.delete(`/documents/${id}`),
  getByShareId: (shareId) => api.get(`/documents/share/${shareId}`),
  regenerateShareId: (id) => api.post(`/documents/${id}/regenerate-share`),
  getVersions: (id) => api.get(`/documents/${id}/versions`),
}

// Collaborator API
export const collaboratorAPI = {
  getAll: (documentId) => api.get(`/documents/${documentId}/collaborators`),
  add: (documentId, data) => api.post(`/documents/${documentId}/collaborators`, data),
  updateRole: (documentId, userId, role) => 
    api.put(`/documents/${documentId}/collaborators/${userId}`, { role }),
  remove: (documentId, userId) => 
    api.delete(`/documents/${documentId}/collaborators/${userId}`),
  joinViaShare: (shareId) => api.post(`/documents/join/${shareId}`),
}

// Message API
export const messageAPI = {
  getByDocument: (documentId) => api.get(`/messages/${documentId}`),
  send: (data) => api.post('/messages', data),
  delete: (messageId) => api.delete(`/messages/${messageId}`),
}

export default api

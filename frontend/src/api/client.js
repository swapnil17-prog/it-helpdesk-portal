import axios from 'axios'

// The backend always serves its routes under /api. VITE_API_URL is only needed when the
// frontend and backend are two separate deployments (different origins) — set it at build
// time to the backend's bare origin, e.g. https://your-backend.onrender.com (no /api suffix,
// this file adds that). Leave it unset for local dev (Vite proxies /api to :8000) and for a
// combined single-container deploy (same origin, so a relative "/api" is correct).
const backendOrigin = import.meta.env.VITE_API_URL || ''
const api = axios.create({ baseURL: `${backendOrigin}/api` })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export default api

import axios from 'axios'

const baseURL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'

type NormalizedApiError = {
  status?: number
  message: string
}

export const http = axios.create({
  baseURL,
  timeout: 15000,
})

function normalizeError(error: any): NormalizedApiError {
  const status = error?.response?.status
  const message =
    error?.response?.data?.message ??
    error?.message ??
    'Unknown error'

  return { status, message }
}

http.interceptors.request.use((config) => {
  if (import.meta.env.DEV) {
    // lightweight debug logging for local troubleshooting
    console.debug('[http]', config.method?.toUpperCase(), config.url)
  }
  return config
})

http.interceptors.response.use(
  (response) => response,
  (error) => {
    if (import.meta.env.DEV) {
      console.warn('[http:error]', normalizeError(error))
    }
    error.normalized = normalizeError(error)
    return Promise.reject(error)
  },
)

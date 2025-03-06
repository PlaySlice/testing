import axios from 'axios';
import type { AxiosInstance, AxiosResponse, AxiosError, InternalAxiosRequestConfig } from 'axios';
import https from 'node:https';

// Create an axios instance with custom configuration
const axiosInstance: AxiosInstance = axios.create({
  timeout: 30000, // 30 seconds timeout
  headers: {
    'Content-Type': 'application/json',
  },
});

// Special handling for development environment
if (import.meta.env.DEV) {
  axiosInstance.defaults.httpsAgent = new https.Agent({ rejectUnauthorized: false });
}

// Request interceptor for adding authorization tokens, etc.
axiosInstance.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Add any common request handling here
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  },
);

// Response interceptor for global error handling
axiosInstance.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  (error: AxiosError) => {
    // Handle common error scenarios (like 401 Unauthorized)
    if (error.response?.status === 401) {
      // Handle unauthorized access
      console.error('Unauthorized access');
    }

    // Log all errors in development
    if (import.meta.env.DEV) {
      console.error('API Error:', error);
    }

    return Promise.reject(error);
  },
);

export default axiosInstance;

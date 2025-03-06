/**
 * This file provides direct axios methods as a replacement for fetch
 * Use these methods directly when you don't need the fetch API compatibility
 */

import axios from './axiosInstance';
import type { AxiosRequestConfig } from 'axios';

// GET request
export const get = async <T = any>(url: string, config?: AxiosRequestConfig): Promise<T> => {
  const response = await axios.get<T>(url, config);
  return response.data;
};

// POST request
export const post = async <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> => {
  const response = await axios.post<T>(url, data, config);
  return response.data;
};

// PUT request
export const put = async <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> => {
  const response = await axios.put<T>(url, data, config);
  return response.data;
};

// DELETE request
export const del = async <T = any>(url: string, config?: AxiosRequestConfig): Promise<T> => {
  const response = await axios.delete<T>(url, config);
  return response.data;
};

// PATCH request
export const patch = async <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> => {
  const response = await axios.patch<T>(url, data, config);
  return response.data;
};

// Export the instance itself for advanced usage
export { default } from './axiosInstance';

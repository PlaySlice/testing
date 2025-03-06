import type { AxiosRequestConfig } from 'axios';
import https from 'node:https';
import axiosInstance from './axiosInstance';

type CommonRequest = Omit<RequestInit, 'body'> & { body?: URLSearchParams | any };

// Create a more complete Response-like interface that axios will return
interface AxiosResponse extends Omit<Response, 'clone'> {
  ok: boolean;
  status: number;
  statusText: string;
  headers: Headers;
  json: () => Promise<any>;
  text: () => Promise<string>;
  blob: () => Promise<Blob>;
  arrayBuffer: () => Promise<any>;
  formData: () => Promise<never>;
  clone: () => AxiosResponse;
  // Add missing Response properties
  redirected: boolean;
  type: ResponseType;
  url: string;
  webSocket: null;
  bytes: () => Promise<Uint8Array>;
}

/**
 * A drop-in replacement for fetch using axios
 */
export async function request(url: string, init?: CommonRequest): Promise<Response> {
  try {
    // Convert fetch style options to axios format
    const axiosConfig: AxiosRequestConfig = {
      url,
      method: init?.method || 'GET',
      headers: init?.headers as Record<string, string>,
      // Handle different body formats
      data: init?.body,
      // For form data
      ...(init?.body instanceof URLSearchParams
        ? {
            headers: {
              ...(init?.headers as Record<string, string>),
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          }
        : {}),
    };

    // Use our axios instance
    const response = await axiosInstance(axiosConfig);

    // Convert axios response to fetch-like response
    const responseObj: Partial<AxiosResponse> = {
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      statusText: response.statusText,
      headers: new Headers(response.headers as Record<string, string>),
      json: () => Promise.resolve(response.data),
      text: () =>
        Promise.resolve(typeof response.data === 'object' ? JSON.stringify(response.data) : String(response.data)),
      blob: () => Promise.resolve(new Blob([response.data])),
      arrayBuffer: () => Promise.resolve(response.data),
      formData: () => {
        return Promise.reject(new Error('formData() is not implemented in axios adapter'));
      },
      // Add missing Response properties
      redirected: false,
      type: 'basic' as ResponseType,
      url: url,
      webSocket: null,
      bytes: () =>
        Promise.resolve(
          new Uint8Array(typeof response.data === 'string' ? new TextEncoder().encode(response.data) : []),
        ),
      // Add clone method for compatibility
      clone: function () {
        return { ...this } as AxiosResponse;
      },
      // Add these to satisfy TypeScript but they won't be used in most cases
      body: null,
      bodyUsed: false,
    };

    return responseObj as unknown as Response;
  } catch (error: any) {
    // Convert axios error to fetch-like error response
    if (error.response) {
      const errorResponse: Partial<AxiosResponse> = {
        ok: false,
        status: error.response.status,
        statusText: error.response.statusText,
        headers: new Headers(error.response.headers),
        json: () => Promise.resolve(error.response.data),
        text: () =>
          Promise.resolve(
            typeof error.response.data === 'object' ? JSON.stringify(error.response.data) : String(error.response.data),
          ),
        blob: () => Promise.resolve(new Blob([error.response.data])),
        arrayBuffer: () => Promise.resolve(error.response.data),
        formData: () => Promise.reject(new Error('formData() is not implemented in axios adapter')),
        // Add missing Response properties
        redirected: false,
        type: 'error' as ResponseType,
        url: url,
        webSocket: null,
        bytes: () =>
          Promise.resolve(
            new Uint8Array(
              typeof error.response.data === 'string' ? new TextEncoder().encode(error.response.data) : [],
            ),
          ),
        // Add clone method
        clone: function () {
          return { ...this } as AxiosResponse;
        },
        // Add these to satisfy TypeScript but they won't be used in most cases
        body: null,
        bodyUsed: false,
      };

      return errorResponse as unknown as Response;
    }

    // Network error or request canceled
    throw error;
  }
}

// For backward compatibility, we expose request as the default function
export default request;

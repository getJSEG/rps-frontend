// API Configuration - ensure base URL always ends with /api (backend mounts routes at /api)
function getApiBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api';
  const base = raw.trim().replace(/\/+$/, '');
  return base.endsWith('/api') ? base : `${base}/api`;
}
const API_BASE_URL = getApiBaseUrl();

const GUEST_SESSION_STORAGE_KEY = 'rps_guest_session_id';

export function getOrCreateGuestSessionId(): string {
  if (typeof window === 'undefined') return '';
  try {
    let id = localStorage.getItem(GUEST_SESSION_STORAGE_KEY)?.trim() || '';
    if (id.length >= 8 && id.length <= 128) return id;
    id =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
    if (id.length > 128) id = id.slice(0, 128);
    localStorage.setItem(GUEST_SESSION_STORAGE_KEY, id);
    return id;
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  }
}

function isCartApiEndpoint(endpoint: string): boolean {
  return endpoint === '/cart' || endpoint.startsWith('/cart/');
}

/** Guest checkout must send X-Guest-Session-Id so the server can clear the guest cart after order. */
function needsGuestSessionHeader(endpoint: string): boolean {
  return isCartApiEndpoint(endpoint) || endpoint === '/orders/create-payment-intent';
}

/** Get backend base URL (no /api) for image URLs - works in browser */
function getBackendBaseUrl(): string {
  const apiUrl = getApiBaseUrl();
  return apiUrl.replace(/\/api\/?$/, '') || 'http://localhost:8080';
}

/** Convert product/category image URL to full URL (for /uploads/ paths from backend) */
export function getProductImageUrl(url: string | null | undefined): string {
  if (!url || typeof url !== 'string') return '';
  let u = url.trim();
  if (!u) return '';
  // DB/API sometimes store "uploads/..." without leading slash
  if (u.startsWith('uploads/')) u = `/${u}`;
  if (u.startsWith('/uploads/')) {
    const base = getBackendBaseUrl();
    return base + u;
  }
  return u;
}

export type ShippingRates = { ground: number; express: number; overnight: number };
export type ShippingMethod = {
  id: number;
  name: string;
  price: number;
  is_active?: boolean;
  sort_order?: number;
};
export type StorePickupAddress = {
  id: number;
  label: string;
  street_address: string;
  address_line2?: string | null;
  city: string;
  state: string;
  postcode: string;
  country: string;
  is_active?: boolean;
};

const DEFAULT_SHIPPING_RATES: ShippingRates = { ground: 120.07, express: 0, overnight: 0 };

/** Match backend: Ground / Express / Overnight → admin-configured prices */
export function shippingAmountForService(
  rates: ShippingRates | null | undefined,
  serviceLabel: string | undefined
): number {
  const r = rates ?? DEFAULT_SHIPPING_RATES;
  const s = String(serviceLabel || "").trim().toLowerCase();
  if (s === "ground") return Number(r.ground) || 0;
  if (s === "express") return Number(r.express) || 0;
  if (s === "overnight") return Number(r.overnight) || 0;
  return 0;
}

export function shippingAmountForMethod(
  methods: ShippingMethod[] | null | undefined,
  serviceLabel: string | undefined,
  fallbackRates?: ShippingRates | null
): number {
  const label = String(serviceLabel || "").trim().toLowerCase();
  const list = Array.isArray(methods) ? methods : [];
  const matched = list.find((m) => String(m?.name || "").trim().toLowerCase() === label);
  if (matched) return Number(matched.price) || 0;
  return shippingAmountForService(fallbackRates, serviceLabel);
}

// Helper function for API calls
async function apiCall(endpoint: string, options: RequestInit = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const config: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  // Add auth token if available; guest cart uses X-Guest-Session-Id when not logged in
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  if (token) {
    config.headers = {
      ...config.headers,
      Authorization: `Bearer ${token}`,
    };
  } else if (typeof window !== 'undefined' && needsGuestSessionHeader(endpoint)) {
    const sid = getOrCreateGuestSessionId();
    if (sid) {
      config.headers = {
        ...config.headers,
        'X-Guest-Session-Id': sid,
      };
    }
  }

  try {
    const response = await fetch(url, config);
    
    // Handle non-JSON responses
    let data: any;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      try {
      data = await response.json();
      } catch (jsonError) {
        // If JSON parsing fails, try to get text
        const text = await response.text();
        throw new Error(text || `HTTP ${response.status}: ${response.statusText}`);
      }
    } else {
      const text = await response.text();
      throw new Error(text || `HTTP ${response.status}: ${response.statusText}`);
    }
    
    if (!response.ok) {
      // Safely access error message from response data (include server error detail when present)
      const dataObj = data && typeof data === 'object' ? data : {};
      const msg = dataObj.message || dataObj.error;
      const detail = dataObj.error && dataObj.message !== dataObj.error ? dataObj.error : '';
      const errorMessage = msg
        ? (detail ? `${msg}: ${detail}` : msg)
        : `API request failed: ${response.status} ${response.statusText}`;
      
      const isTokenBasedCall = !!token;
      const isAuthError = response.status === 401 || response.status === 403;
      const isAccessTokenRequired = /access\s*token|token\s*required|session\s*invalid|invalid\s*token|token\s*expired/i.test(errorMessage || '');

      if (isAuthError && (isTokenBasedCall || isAccessTokenRequired)) {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('token');
          localStorage.removeItem('isLoggedIn');
          localStorage.removeItem('user');
          localStorage.removeItem('userRole');
          window.location.href = '/';
        }
        throw new Error('Session invalid. Please log in again.');
      }
      throw new Error(errorMessage);
    }
    
    return data;
  } catch (error: any) {
    const isNetworkError =
      error?.message?.includes('Failed to fetch') ||
      error?.name === 'TypeError' ||
      (error?.message && typeof error.message === 'string' && error.message.toLowerCase().includes('network'));

    if (isNetworkError) {
      const baseUrl = API_BASE_URL.replace(/\/api\/?$/, '') || 'http://localhost:5000';
      console.error(
        'API unreachable. Is the backend running? Expected base URL:',
        baseUrl,
        '\nStart backend: cd backend && npm run dev'
      );
      throw new Error(
        `Cannot connect to the API. Start the backend: cd backend && npm run dev (expected: ${baseUrl})`
      );
    }

    console.error('API Error:', error);
    
    // If it's already an Error object, throw it as is
    if (error instanceof Error) {
      throw error;
    }
    
    // Otherwise wrap it
    throw new Error(error.message || 'Network error. Please check your connection.');
  }
}

// Auth API
export const authAPI = {
  login: async (email: string, password: string) => {
    return apiCall('/auth/', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },
  
  register: async (userData: any) => {
    return apiCall('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  },
  
  getProfile: async () => {
    return apiCall('/auth/profile');
  },
  /** Send 6-digit code to email for password reset */
  sendResetCode: async (email: string) => {
    return apiCall('/auth/send-reset-code', {
      method: 'POST',
      body: JSON.stringify({ email: email.trim() }),
    });
  },
  /** Reset password with email + code from email */
  resetPasswordWithCode: async (email: string, code: string, newPassword: string) => {
    return apiCall('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email: email.trim(), code: code.trim(), newPassword }),
    });
  },
};

// Users API (profile update for logged-in user / admin / employee)
export const usersAPI = {
  getAllAdmin: async () => {
    return apiCall('/users/admin/all');
  },
  updateProfile: async (data: { fullName?: string; telephone?: string; newsletter?: boolean }) => {
    return apiCall('/users/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
};

// Cards API (saved credit cards - requires login)
export const cardsAPI = {
  get: async () => apiCall('/cards'),
  add: async (data: { cardNumberLast4: string; cardholderName: string; expiryMonth: string | number; expiryYear: string | number; cardType?: string; isDefault?: boolean }) =>
    apiCall('/cards', { method: 'POST', body: JSON.stringify(data) }),
  update: async (id: string, data: { cardholderName?: string; expiryMonth?: string | number; expiryYear?: string | number; cardType?: string; isDefault?: boolean }) =>
    apiCall(`/cards/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: async (id: string) => apiCall(`/cards/${id}`, { method: 'DELETE' }),
};

// Products API
export const productsAPI = {
  getAll: async (params?: { category?: string; subcategory?: string; search?: string; page?: number; limit?: number }) => {
    const queryString = params ? '?' + new URLSearchParams(params as any).toString() : '';
    return apiCall(`/products${queryString}`);
  },
  
  getById: async (id: string) => {
    return apiCall(`/products/${id}`);
  },
  previewPrice: async (
    id: string,
    payload: {
      width?: number;
      height?: number;
      size_option_id?: number;
      sizeOptionId?: number;
    }
  ) => {
    return apiCall(`/products/${id}/price-preview`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  
  getCategories: async () => {
    return apiCall('/products/categories');
  },
  
  getRelated: async (productId: string, limit?: number) => {
    const params = new URLSearchParams({ productId });
    if (limit) params.append('limit', limit.toString());
    return apiCall(`/products/related?${params.toString()}`);
  },

  // Admin
  getAllAdmin: async (params?: { page?: number; limit?: number }) => {
    const queryString = params ? '?' + new URLSearchParams(params as any).toString() : '';
    return apiCall(`/products/admin/products${queryString}`);
  },
  create: async (data: Record<string, unknown>) => {
    return apiCall('/products/admin/products', { method: 'POST', body: JSON.stringify(data) });
  },
  update: async (id: string, data: Record<string, unknown>) => {
    return apiCall(`/products/admin/products/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  delete: async (id: string) => {
    return apiCall(`/products/admin/products/${id}`, { method: 'DELETE' });
  },
  createCategory: async (data: Record<string, unknown>) => {
    return apiCall('/products/admin/categories', { method: 'POST', body: JSON.stringify(data) });
  },
  updateCategory: async (id: string, data: Record<string, unknown>) => {
    return apiCall(`/products/admin/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  deleteCategory: async (id: string) => {
    return apiCall(`/products/admin/categories/${id}`, { method: 'DELETE' });
  },
  /** Upload product image file; returns { url: '/uploads/products/filename' } */
  uploadImage: async (file: File) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const formData = new FormData();
    formData.append('image', file);
    const res = await fetch(`${API_BASE_URL}/products/admin/upload-image`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || data.error || 'Upload failed');
    }
    return res.json();
  },
  /** Upload category/subcategory image file; returns { url: '/uploads/categories/filename' } */
  uploadCategoryImage: async (file: File) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const formData = new FormData();
    formData.append('image', file);
    const res = await fetch(`${API_BASE_URL}/products/admin/upload-category-image`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || data.error || 'Upload failed');
    }
    return res.json();
  },
};

// Cart API (role-based: user/employee = own cart, admin = all carts)
export const cartAPI = {
  get: async () => apiCall('/cart'),
  add: async (itemData: Record<string, unknown>) =>
    apiCall('/cart', { method: 'POST', body: JSON.stringify(itemData) }),
  remove: async (id: string) => apiCall(`/cart/${id}`, { method: 'DELETE' }),
  update: async (id: string, itemData: Record<string, unknown>) =>
    apiCall(`/cart/${id}`, { method: 'PUT', body: JSON.stringify(itemData) }),
  clear: async () => apiCall('/cart/clear', { method: 'DELETE' }),
};

export const shippingRatesAPI = {
  get: async (): Promise<{ rates: ShippingRates; methods?: ShippingMethod[] }> => apiCall('/shipping-rates'),
  update: async (rates: ShippingRates) =>
    apiCall('/shipping-rates', { method: 'PUT', body: JSON.stringify(rates) }),
  getAdminMethods: async (): Promise<{ methods: ShippingMethod[] }> => apiCall('/shipping-rates/admin'),
  createAdminMethod: async (data: { name: string; price: number; isActive?: boolean }) =>
    apiCall('/shipping-rates/admin', { method: 'POST', body: JSON.stringify(data) }),
  updateAdminMethod: async (
    id: number | string,
    data: { name?: string; price?: number; isActive?: boolean }
  ) => apiCall(`/shipping-rates/admin/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteAdminMethod: async (id: number | string) => apiCall(`/shipping-rates/admin/${id}`, { method: 'DELETE' }),
};

export const storePickupAddressesAPI = {
  getPublic: async (): Promise<{ addresses: StorePickupAddress[] }> => apiCall('/store-pickup-addresses'),
  getAdmin: async (): Promise<{ addresses: StorePickupAddress[] }> => apiCall('/store-pickup-addresses/admin'),
  createAdmin: async (data: Record<string, unknown>) =>
    apiCall('/store-pickup-addresses/admin', { method: 'POST', body: JSON.stringify(data) }),
  updateAdmin: async (id: number | string, data: Record<string, unknown>) =>
    apiCall(`/store-pickup-addresses/admin/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteAdmin: async (id: number | string) =>
    apiCall(`/store-pickup-addresses/admin/${id}`, { method: 'DELETE' }),
};

// Orders API
export const ordersAPI = {
  create: async (orderData: any) => {
    return apiCall('/orders', {
      method: 'POST',
      body: JSON.stringify(orderData),
    });
  },
  
  getAll: async (params?: { status?: string; page?: number; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set('status', params.status);
    if (params?.page != null) q.set('page', String(params.page));
    if (params?.limit != null) q.set('limit', String(params.limit));
    const qs = q.toString();
    return apiCall(qs ? `/orders?${qs}` : '/orders');
  },
  
  getAllAdmin: async (params?: { status?: string; page?: number; limit?: number }) => {
    const queryString = params ? '?' + new URLSearchParams(params as any).toString() : '';
    return apiCall(`/orders/admin/all${queryString}`);
  },
  
  getById: async (id: string) => {
    return apiCall(`/orders/${id}`);
  },
  
  getByIdAdmin: async (id: string) => {
    return apiCall(`/orders/admin/${id}`);
  },
  
  updateStatus: async (id: string, status: string) => {
    return apiCall(`/orders/admin/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  },

  updateOrderTrackingId: async (id: string, orderTrackingId: string | null) => {
    return apiCall(`/orders/admin/${id}/order-tracking`, {
      method: 'PUT',
      body: JSON.stringify({ orderTrackingId }),
    });
  },

  deleteAdmin: async (id: string) => {
    return apiCall(`/orders/admin/${id}`, { method: 'DELETE' });
  },

  /** Admin: create order from cart item with chosen status; returns { order } with order.id */
  createFromCartItem: async (cartItem: Record<string, unknown>, status: string) => {
    return apiCall('/orders/admin/from-cart', {
      method: 'POST',
      body: JSON.stringify({ cartItem, status }),
    });
  },

  /** Create order + Stripe PaymentIntent from cart; returns { orderId, orderNumber, clientSecret, stripePaymentSkipped? } */
  createPaymentIntent: async (
    cartItems: Record<string, unknown>[],
    guestCheckout?: Record<string, unknown>,
    addressIds?: { shippingAddressId?: number; billingAddressId?: number }
  ) => {
    const body: Record<string, unknown> = { cartItems };
    if (guestCheckout && typeof guestCheckout === 'object') {
      body.guestCheckout = guestCheckout;
    }
    if (addressIds?.shippingAddressId != null) {
      body.shippingAddressId = addressIds.shippingAddressId;
    }
    if (addressIds?.billingAddressId != null) {
      body.billingAddressId = addressIds.billingAddressId;
    }
    return apiCall('/orders/create-payment-intent', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
};

// Admin Employees API
export const employeesAPI = {
  getAll: async () => {
    return apiCall('/admin/employees');
  },
  getById: async (id: string) => {
    return apiCall(`/admin/employees/${id}`);
  },
  /** Upload profile image file; returns { url: string } (path like /uploads/employees/xxx.jpg) */
  uploadImage: async (file: File): Promise<{ url: string }> => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const formData = new FormData();
    formData.append('profile_image', file);
    const res = await fetch(`${API_BASE_URL}/admin/employees/upload`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || res.statusText || 'Upload failed');
    }
    return res.json();
  },
  create: async (data: {
    email: string;
    password: string;
    full_name: string;
    telephone?: string;
    role?: 'admin' | 'employee';
    profile_image?: string;
    hire_date?: string;
  }) => {
    return apiCall('/admin/employees', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  update: async (
    id: string,
    data: {
      full_name?: string;
      email?: string;
      telephone?: string;
      is_active?: boolean;
      is_approved?: boolean;
      password?: string;
      role?: 'admin' | 'employee';
      profile_image?: string;
      hire_date?: string;
    }
  ) => {
    return apiCall(`/admin/employees/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  delete: async (id: string) => {
    return apiCall(`/admin/employees/${id}`, {
      method: 'DELETE',
    });
  },
};

// Addresses API
export const addressesAPI = {
  getAll: async () => {
    return apiCall('/addresses');
  },
  
  create: async (addressData: any) => {
    return apiCall('/addresses', {
      method: 'POST',
      body: JSON.stringify(addressData),
    });
  },
  
  update: async (id: string, addressData: any) => {
    return apiCall(`/addresses/${id}`, {
      method: 'PUT',
      body: JSON.stringify(addressData),
    });
  },

  setDefault: async (
    id: string,
    addressSnapshot: {
      streetAddress: string;
      addressLine2?: string | null;
      city: string;
      state: string;
      postcode: string;
      country: string;
      addressType: string;
    }
  ) => {
    try {
      return await apiCall(`/addresses/${id}/set-default`, { method: 'POST' });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/route not found/i.test(msg)) {
        return apiCall(`/addresses/${id}`, {
          method: 'PUT',
          body: JSON.stringify({ ...addressSnapshot, isDefault: true }),
        });
      }
      throw e;
    }
  },

  delete: async (id: string) => {
    return apiCall(`/addresses/${id}`, {
      method: 'DELETE',
    });
  },
};

// Favorites API
export const favoritesAPI = {
  getAll: async () => {
    return apiCall('/favorites');
  },
  
  add: async (productId: string) => {
    return apiCall('/favorites', {
      method: 'POST',
      body: JSON.stringify({ productId }),
    });
  },
  
  remove: async (id: string) => {
    return apiCall(`/favorites/${id}`, {
      method: 'DELETE',
    });
  },
};

export default apiCall;


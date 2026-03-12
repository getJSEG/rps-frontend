// API Configuration - ensure base URL always ends with /api (backend mounts routes at /api)
function getApiBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api';
  const base = raw.trim().replace(/\/+$/, '');
  return base.endsWith('/api') ? base : `${base}/api`;
}
const API_BASE_URL = getApiBaseUrl();

/** Get backend base URL (no /api) for image URLs - works in browser */
function getBackendBaseUrl(): string {
  const apiUrl = getApiBaseUrl();
  return apiUrl.replace(/\/api\/?$/, '') || 'http://localhost:8080';
}

/** Convert product/category image URL to full URL (for /uploads/ paths from backend) */
export function getProductImageUrl(url: string | null | undefined): string {
  if (!url || typeof url !== 'string') return '';
  const u = url.trim();
  if (!u) return '';
  if (u.startsWith('/uploads/')) {
    const base = getBackendBaseUrl();
    return base + u;
  }
  return u;
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

  // Add auth token if available
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  if (token) {
    config.headers = {
      ...config.headers,
      Authorization: `Bearer ${token}`,
    };
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

// Orders API
export const ordersAPI = {
  create: async (orderData: any) => {
    return apiCall('/orders', {
      method: 'POST',
      body: JSON.stringify(orderData),
    });
  },
  
  getAll: async () => {
    return apiCall('/orders');
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

  /** Create order + Stripe PaymentIntent from cart; returns { orderId, orderNumber, clientSecret } */
  createPaymentIntent: async (cartItems: Record<string, unknown>[]) => {
    return apiCall('/orders/create-payment-intent', {
      method: 'POST',
      body: JSON.stringify({ cartItems }),
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


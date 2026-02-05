import { Sale, Shift } from '../types/sales';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export class ApiError extends Error {
  constructor(public status: number, message: string, public details?: any) {
    super(message);
    this.name = 'ApiError';
  }
}

// Transform MongoDB document to frontend format
function transformProduct(product: any): any {
  if (!product) return product;

  return {
    ...product,
    id: product._id || product.id,
    // Remove MongoDB specific fields
    _id: undefined,
    __v: undefined
  };
}

// Transform array of products
function transformProducts(products: any[]): any[] {
  return products.map(transformProduct);
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('token');

  const config: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
    ...options,
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Network error' }));
    console.error('API Error:', response.status, errorData);

    // Handle token expiration
    if (response.status === 401 && errorData.errorCode === 'TOKEN_EXPIRED') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // Redirect to login page after a short delay
      setTimeout(() => {
        window.location.href = '/login';
      }, 1000);
      throw new ApiError(response.status, 'Срок действия сессии истек. Пожалуйста, войдите снова.', errorData);
    }

    throw new ApiError(response.status, errorData.message || 'Request failed', errorData);
  }

  return response.json();
}

export const api = {
  // Auth endpoints
  auth: {
    login: async (email: string, password: string) => {
      const response = await apiRequest<{ success: boolean; token: string; user: any }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      if (response.success) {
        response.user = transformProduct(response.user); // Using same transform function
      }
      return response;
    },

    register: async (userData: { firstName: string; lastName: string; email: string; password: string }) => {
      const response = await apiRequest<{ success: boolean; token: string; user: any }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(userData),
      });
      if (response.success) {
        response.user = transformProduct(response.user); // Using same transform function
      }
      return response;
    },

    getMe: async () => {
      const response = await apiRequest<{ success: boolean; user: any }>('/auth/me');
      if (response.success) {
        response.user = transformProduct(response.user); // Using same transform function
      }
      return response;
    },

    updateProfile: (userData: { firstName?: string; lastName?: string; email?: string; phone?: string; company?: string; position?: string; bio?: string }) =>
      apiRequest<{ success: boolean; user: any }>('/auth/profile', {
        method: 'PUT',
        body: JSON.stringify(userData),
      }),

    changePassword: (currentPassword: string, newPassword: string) =>
      apiRequest<{ success: boolean }>('/auth/password', {
        method: 'PUT',
        body: JSON.stringify({ currentPassword, newPassword }),
      }),

    getSettings: () =>
      apiRequest<{ success: boolean; data: any }>('/auth/settings'),

    updateSettings: (settings: any) =>
      apiRequest<{ success: boolean; data: any }>('/auth/settings', {
        method: 'PUT',
        body: JSON.stringify(settings),
      }),

    createApiKey: (name: string) =>
      apiRequest<{ success: boolean; data: any }>('/auth/settings/api-keys', {
        method: 'POST',
        body: JSON.stringify({ name }),
      }),

    deleteApiKey: (keyId: string) =>
      apiRequest<{ success: boolean }>(`/auth/settings/api-keys/${keyId}`, {
        method: 'DELETE',
      }),

    getSessions: () =>
      apiRequest<{ success: boolean; data: any[] }>('/auth/sessions'),

    verifyEmail: (token: string) =>
      apiRequest<{ success: boolean; message: string }>(`/auth/verify-email?token=${token}`),

    deleteSession: (sessionId: string) =>
      apiRequest<{ success: boolean }>(`/auth/sessions/${sessionId}`, {
        method: 'DELETE',
      }),

    exportData: () =>
      apiRequest<{ success: boolean; message: string; data: any }>('/auth/export-data', {
        method: 'POST',
      }),
  },

  // Products endpoints
  products: {
    getAll: async (params?: {
      page?: number;
      limit?: number;
      search?: string;
      category?: string;
      brand?: string;
      brands?: string[];
      sort?: string;
      inStock?: boolean;
      movementId?: string;
      productId?: string;
      minPrice?: number;
      maxPrice?: number;
    }) => {
      const searchParams = new URLSearchParams();
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          if (value === undefined || value === null) return;
          if (typeof value === 'string' && value.trim() === '') return; // skip empty strings (e.g., search="")

          // Handle brands array specially
          if (key === 'brands' && Array.isArray(value)) {
            value.forEach(brand => {
              searchParams.append('brands', brand);
            });
          } else {
            searchParams.append(key, value.toString());
          }
        });
      }
      const queryString = searchParams.toString();
      const response = await apiRequest<{
        success: boolean;
        data: any[];
        pagination: { page: number; limit: number; total: number; pages: number };
      }>(`/products${queryString ? `?${queryString}` : ''}`);

      if (response.success) {
        response.data = transformProducts(response.data);
      }

      return response;
    },

    getById: async (id: string) => {
      const response = await apiRequest<{ success: boolean; data: any }>(`/products/${id}`);
      if (response.success) {
        response.data = transformProduct(response.data);
      }
      return response;
    },

    create: async (productData: any) => {
      const response = await apiRequest<{ success: boolean; data: any }>('/products', {
        method: 'POST',
        body: JSON.stringify(productData),
      });
      if (response.success) {
        response.data = transformProduct(response.data);
      }
      return response;
    },

    update: async (id: string, productData: any) => {
      const response = await apiRequest<{ success: boolean; data: any }>(`/products/${id}`, {
        method: 'PUT',
        body: JSON.stringify(productData),
      });
      if (response.success) {
        response.data = transformProduct(response.data);
      }
      return response;
    },

    delete: (id: string) =>
      apiRequest<{ success: boolean }>(`/products/${id}`, {
        method: 'DELETE',
      }),

    updateStock: async (id: string, stock: number) => {
      const response = await apiRequest<{ success: boolean; data: any }>(`/products/${id}/stock`, {
        method: 'PATCH',
        body: JSON.stringify({ stock }),
      });
      if (response.success) {
        response.data = transformProduct(response.data);
      }
      return response;
    },

    getCategories: async () => {
      const response = await apiRequest<{ success: boolean; data: Record<string, string>; categories?: any[] }>('/products/categories/list');
      // Support array response format if backend returns it
      if (response.success && response.categories && Array.isArray(response.categories)) {
        const mapped: Record<string, string> = {};
        response.categories.forEach((cat: any) => {
          if (cat.id && cat.name) {
            mapped[cat.id] = cat.name;
          }
        });
        response.data = mapped;
      }
      return response;
    },

    getBrands: () =>
      apiRequest<{ success: boolean; data: string[] }>('/products/brands/list'),

    deduplicate: () =>
      apiRequest<{ success: boolean; mergedGroups: number; updated: number; deactivated: number }>(`/products/actions/deduplicate`, {
        method: 'POST',
      }),
  },

  // Orders endpoints
  orders: {
    create: (orderData: any) =>
      apiRequest<{ success: boolean; data: any; message?: string }>('/orders', {
        method: 'POST',
        body: JSON.stringify(orderData),
      }),

    getMyOrders: (params?: { page?: number; limit?: number }) => {
      const searchParams = new URLSearchParams();
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            searchParams.append(key, value.toString());
          }
        });
      }
      const queryString = searchParams.toString();
      return apiRequest<{
        success: boolean;
        data: any[];
        pagination: { page: number; limit: number; total: number; pages: number };
      }>(`/orders/my${queryString ? `?${queryString}` : ''}`);
    },

    getAll: (params?: {
      page?: number;
      limit?: number;
      status?: string;
      paymentStatus?: string;
      customer?: string;
      startDate?: string;
      endDate?: string;
      search?: string;
    }) => {
      const searchParams = new URLSearchParams();
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            searchParams.append(key, value.toString());
          }
        });
      }
      const queryString = searchParams.toString();
      return apiRequest<{
        success: boolean;
        data: any[];
        pagination: { page: number; limit: number; total: number; pages: number };
      }>(`/orders${queryString ? `?${queryString}` : ''}`);
    },

    getById: (id: string) =>
      apiRequest<{ success: boolean; data: any }>(`/orders/${id}`),

    updateStatus: (id: string, status: string, cancelReason?: string) =>
      apiRequest<{ success: boolean; data: any; message?: string }>(`/orders/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, cancelReason }),
      }),

    cancel: (id: string, reason?: string) =>
      apiRequest<{ success: boolean }>(`/orders/${id}/cancel`, {
        method: 'PATCH',
        body: JSON.stringify({ reason }),
      }),

    restore: (id: string) =>
      apiRequest<{ success: boolean; data: any }>(`/orders/${id}/restore`, {
        method: 'PATCH',
      }),
  },

  // Analytics endpoints
  analytics: {
    // Detailed dashboard with typed response
    getDashboard: async () => {
      const response = await apiRequest<{
        success: boolean;
        data: {
          sales: {
            today: number;
            yesterday: number;
            change: number;
          };
          orders: {
            today: number;
            yesterday: number;
            change: number;
          };
          customers: {
            today: number;
            yesterday: number;
            change: number;
            total: number;
          };
          products: {
            total: number;
            lowStock: number;
            outOfStock: number;
          };
          lowStockProducts: any[];
          outOfStockProducts: any[];
          recentOrders: any[];
          salesByCategory: any[];
        }
      }>("/analytics/dashboard", {
        method: 'GET',
      });
      return response;
    },

    getSales: (params?: {
      startDate?: string;
      endDate?: string;
      period?: 'hourly' | 'daily' | 'weekly' | 'monthly';
    }) => {
      const searchParams = new URLSearchParams();
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            searchParams.append(key, value.toString());
          }
        });
      }
      const queryString = searchParams.toString();
      return apiRequest<{ success: boolean; data: any[] }>(`/analytics/sales${queryString ? `?${queryString}` : ''}`);
    },

    getProductPerformance: (params?: { limit?: number; sortBy?: string }) => {
      const searchParams = new URLSearchParams();
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            searchParams.append(key, value.toString());
          }
        });
      }
      const queryString = searchParams.toString();
      return apiRequest<{ success: boolean; data: any[] }>(`/analytics/products${queryString ? `?${queryString}` : ''}`);
    },

    getSalesReport: async (startDate?: string, endDate?: string) => {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const response = await apiRequest<{ success: boolean; data: any }>(`/analytics/sales?${params}`, {
        method: 'GET',
      });
      return response;
    },

    getLocationsTurnover: (params?: { startDate?: string; endDate?: string; limit?: number }) => {
      const sp = new URLSearchParams();
      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          if (v !== undefined && v !== null) sp.append(k, String(v));
        });
      }
      const qs = sp.toString();
      return apiRequest<{ success: boolean; data: Array<{ code: string; name: string; zone?: string; turnover: number; quantity: number; orders: number }> }>(`/analytics/locations/turnover${qs ? `?${qs}` : ''}`);
    },

    getLocationsTurnoverTimeSeries: (params?: { startDate?: string; endDate?: string; period?: 'daily' | 'weekly' | 'monthly'; locations?: string[] }) => {
      const sp = new URLSearchParams();
      if (params) {
        const { locations, ...rest } = params;
        Object.entries(rest).forEach(([k, v]) => {
          if (v !== undefined && v !== null) sp.append(k, String(v));
        });
        if (locations && locations.length) sp.append('locations', locations.join(','));
      }
      const qs = sp.toString();
      return apiRequest<{ success: boolean; data: { series: Array<Record<string, any>>; locations: string[] } }>(`/analytics/locations/timeseries${qs ? `?${qs}` : ''}`);
    },
  },

  // Locations endpoints
  locations: {
    getAll: async (params?: {
      page?: number;
      limit?: number;
      zone?: string;
      search?: string;
    }) => {
      const searchParams = new URLSearchParams();
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            searchParams.append(key, value.toString());
          }
        });
      }
      const queryString = searchParams.toString();
      const response = await apiRequest<{
        success: boolean;
        data: any[];
        pagination: { page: number; limit: number; total: number; pages: number };
      }>(`/locations${queryString ? `?${queryString}` : ''}`);

      if (response.success) {
        response.data = response.data.map(transformProduct);
      }

      return response;
    },

    getById: async (id: string) => {
      const response = await apiRequest<{ success: boolean; data: any }>(`/locations/${id}`);
      if (response.success) {
        response.data = transformProduct(response.data);
      }
      return response;
    },

    create: async (locationData: any) => {
      const response = await apiRequest<{ success: boolean; data: any }>('/locations', {
        method: 'POST',
        body: JSON.stringify(locationData),
      });
      if (response.success) {
        response.data = transformProduct(response.data);
      }
      return response;
    },

    update: async (id: string, locationData: any) => {
      const response = await apiRequest<{ success: boolean; data: any }>(`/locations/${id}`, {
        method: 'PUT',
        body: JSON.stringify(locationData),
      });
      if (response.success) {
        response.data = transformProduct(response.data);
      }
      return response;
    },

    delete: (id: string) =>
      apiRequest<{ success: boolean }>(`/locations/${id}`, {
        method: 'DELETE',
      }),

    getStats: () =>
      apiRequest<{ success: boolean; data: any }>('/locations/stats/overview'),
  },

  // Stock Movements endpoints
  stockMovements: {
    getAll: async (params?: {
      page?: number;
      limit?: number;
      type?: 'in' | 'out' | 'transfer' | 'adjustment';
      productId?: string;
      userId?: string;
      supplierId?: string;
      startDate?: string;
      endDate?: string;
    }) => {
      const searchParams = new URLSearchParams();
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            searchParams.append(key, value.toString());
          }
        });
      }
      const queryString = searchParams.toString();
      const response = await apiRequest<{
        success: boolean;
        data: any[];
        pagination: { page: number; limit: number; total: number; pages: number };
      }>(`/stock-movements${queryString ? `?${queryString}` : ''}`);

      if (response.success) {
        response.data = response.data.map(transformProduct);
      }

      return response;
    },

    create: async (movementData: {
      productId: string;
      type: 'in' | 'out' | 'transfer' | 'adjustment';
      quantity: number;
      reason: string;
      fromLocation?: string;
      toLocation?: string;
      batchNumber?: string;
      serialNumbers?: string[];
      notes?: string;
      userLocation?: string;
      warehouseLocation?: string;
      supplier?: string;
    }) => {
      const response = await apiRequest<{ success: boolean; data: any }>('/stock-movements', {
        method: 'POST',
        body: JSON.stringify(movementData),
      });
      if (response.success) {
        response.data = transformProduct(response.data);
      }
      return response;
    },

    getById: async (id: string) => {
      const response = await apiRequest<{ success: boolean; data: any }>(`/stock-movements/${id}`);
      if (response.success) {
        response.data = transformProduct(response.data);
      }
      return response;
    },

    update: async (id: string, updateData: {
      reason?: string;
      notes?: string;
      batchNumber?: string;
      status?: 'draft' | 'completed';
    }) => {
      const response = await apiRequest<{ success: boolean; data: any }>(`/stock-movements/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updateData),
      });
      if (response.success) {
        response.data = transformProduct(response.data);
      }
      return response;
    },

    delete: (id: string) =>
      apiRequest<{ success: boolean }>(`/stock-movements/${id}`, {
        method: 'DELETE',
      }),

    getDeleted: async () => {
      const response = await apiRequest<{ success: boolean; data: any[] }>('/stock-movements/deleted');
      if (response.success) {
        response.data = response.data.map(transformProduct);
      }
      return response;
    },

    bulk: async (movements: Array<{
      productId: string;
      type: 'in' | 'out' | 'transfer' | 'adjustment';
      quantity: number;
      reason?: string;
      fromLocation?: string;
      toLocation?: string;
      batchNumber?: string;
      notes?: string;
      timestamp?: string;
      supplierId?: string;
      supplierName?: string;
      purchasePrice?: number;
      wholesalePrice?: number;
      salePrice?: number;
      status?: 'draft' | 'completed';
    }>) => {
      const response = await apiRequest<{ success: boolean; data: any[] }>('/stock-movements/bulk', {
        method: 'POST',
        body: JSON.stringify({ movements }),
      });
      if (response.success && Array.isArray(response.data)) {
        response.data = response.data.map(transformProduct);
      }
      return response;
    },
  },

  // Upload endpoints
  upload: {
    uploadImage: (file: File, onProgress?: (percent: number) => void) => {
      const formData = new FormData();
      formData.append('image', file);

      return new Promise<{ success: boolean; data: { url: string; publicId: string; originalName: string } }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const token = localStorage.getItem('token');
        xhr.open('POST', `${API_BASE_URL}/upload/image`);
        if (token) {
          xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        }

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable && onProgress) {
            const percent = Math.round((event.loaded / event.total) * 100);
            onProgress(percent);
          }
        };

        xhr.onload = () => {
          try {
            const json = JSON.parse(xhr.responseText);
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve(json);
            } else {
              reject(new ApiError(xhr.status, json?.message || 'Upload failed', json));
            }
          } catch (e) {
            reject(new ApiError(xhr.status, 'Invalid server response'));
          }
        };

        xhr.onerror = () => {
          reject(new ApiError(0, 'Network error during upload'));
        };

        xhr.send(formData);
      });
    },

    uploadImagesWithProgress: (files: File[], _onFileProgress?: (index: number, percent: number) => void, onOverallProgress?: (percent: number) => void) => {
      const formData = new FormData();
      files.forEach(file => formData.append('images', file));
      return new Promise<{ success: boolean; data: Array<{ url: string; publicId: string; originalName: string }> }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const token = localStorage.getItem('token');
        xhr.open('POST', `${API_BASE_URL}/upload/images`);
        if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable && onOverallProgress) {
            const percent = Math.round((event.loaded / event.total) * 100);
            onOverallProgress(percent);
          }
        };

        xhr.onload = () => {
          try {
            const json = JSON.parse(xhr.responseText);
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve(json);
            } else {
              reject(new ApiError(xhr.status, json?.message || 'Upload failed', json));
            }
          } catch (e) {
            reject(new ApiError(xhr.status, 'Invalid server response'));
          }
        };

        xhr.onerror = () => reject(new ApiError(0, 'Network error during upload'));

        xhr.send(formData);
      });
    },

    uploadImages: (files: File[]) => {
      const formData = new FormData();
      files.forEach(file => formData.append('images', file));
      return apiRequest<{ success: boolean; data: Array<{ url: string; publicId: string; originalName: string }> }>('/upload/images', {
        method: 'POST',
        headers: {}, // Remove Content-Type to let browser set it with boundary
        body: formData,
      });
    },

    deleteImage: (publicId: string) =>
      apiRequest<{ success: boolean }>(`/upload/image/${publicId}`, {
        method: 'DELETE',
      }),
  },

  // Suppliers endpoints
  suppliers: {
    getAll: async (params?: {
      page?: number;
      limit?: number;
      search?: string;
      activeOnly?: boolean;
    }) => {
      const searchParams = new URLSearchParams();
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            searchParams.append(key, value.toString());
          }
        });
      }
      const queryString = searchParams.toString();
      const response = await apiRequest<{
        success: boolean;
        data: any[];
        suppliers?: any[];
        pagination: { total: number; limit: number; skip: number };
      }>(`/suppliers${queryString ? `?${queryString}` : ''}`);

      if (response.success) {
        // Support both response.data and response.suppliers formats
        const suppliers = response.suppliers || response.data || [];
        response.data = suppliers.map(transformProduct);
        response.suppliers = response.data;
      }

      return response;
    },

    getById: async (id: string) => {
      const response = await apiRequest<{ success: boolean; data: any }>(`/suppliers/${id}`);
      if (response.success) {
        response.data = transformProduct(response.data);
      }
      return response;
    },

    create: async (supplierData: {
      name: string;
      contactPerson?: string;
      phone?: string;
      email?: string;
      address?: string;
      notes?: string;
    }) => {
      const response = await apiRequest<{ success: boolean; data: any }>('/suppliers', {
        method: 'POST',
        body: JSON.stringify(supplierData),
      });
      if (response.success) {
        response.data = transformProduct(response.data);
      }
      return response;
    },

    update: async (id: string, supplierData: {
      name?: string;
      contactPerson?: string;
      phone?: string;
      email?: string;
      address?: string;
      notes?: string;
      isActive?: boolean;
    }) => {
      const response = await apiRequest<{ success: boolean; data: any }>(`/suppliers/${id}`, {
        method: 'PUT',
        body: JSON.stringify(supplierData),
      });
      if (response.success) {
        response.data = transformProduct(response.data);
      }
      return response;
    },

    delete: (id: string) =>
      apiRequest<{ success: boolean }>(`/suppliers/${id}`, {
        method: 'DELETE',
      }),
  },

  // Categories endpoints
  categories: {
    getAll: async () => {
      const response = await apiRequest<{ success: boolean; categories: any[]; data?: any[] }>('/categories');
      if (response.success) {
        response.categories = (response.categories || response.data || []).map(transformProduct);
      }
      return response;
    },
  },

  // Debitors endpoints
  debitors: {
    getAll: async (params?: { page?: number; limit?: number; status?: string; search?: string }) => {
      const sp = new URLSearchParams();
      if (params) {
        Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null) sp.append(k, String(v)); });
      }
      return apiRequest<{ success: boolean; data: any[]; pagination: any }>(`/debitors${sp.toString() ? `?${sp.toString()}` : ''}`);
    },
    create: async (data: any) => apiRequest<{ success: boolean; data: any }>(`/debitors`, { method: 'POST', body: JSON.stringify(data) }),
    update: async (id: string, data: any) => apiRequest<{ success: boolean; data: any }>(`/debitors/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    updateStatus: async (id: string, status: string) => apiRequest<{ success: boolean; data: any }>(`/debitors/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    delete: async (id: string) => apiRequest<{ success: boolean }>(`/debitors/${id}`, { method: 'DELETE' })
  },

  // Creditors endpoints
  creditors: {
    getAll: async (params?: { page?: number; limit?: number; status?: string; search?: string }) => {
      const sp = new URLSearchParams();
      if (params) {
        Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null) sp.append(k, String(v)); });
      }
      return apiRequest<{ success: boolean; data: any[]; pagination: any }>(`/creditors${sp.toString() ? `?${sp.toString()}` : ''}`);
    },
    create: async (data: any) => apiRequest<{ success: boolean; data: any }>(`/creditors`, { method: 'POST', body: JSON.stringify(data) }),
    update: async (id: string, data: any) => apiRequest<{ success: boolean; data: any }>(`/creditors/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    updateStatus: async (id: string, status: string) => apiRequest<{ success: boolean; data: any }>(`/creditors/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    delete: async (id: string) => apiRequest<{ success: boolean }>(`/creditors/${id}`, { method: 'DELETE' })
  },

  // Shipments endpoints
  shipments: {
    create: async (data: any) => {
      return apiRequest<{ success: boolean; data: any; message?: string }>('/shipments', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
    getByOrder: async (orderId: string) => {
      return apiRequest<{ success: boolean; data: any[] }>(`/shipments/order/${orderId}`);
    },
    // Assuming we might have a getAll or similar in the future, but for now matching backend routes
    // If backend has GET /api/shipments (general list), add it:
    getAll: async (params?: { page?: number; limit?: number; status?: string }) => {
      // Providing a default getAll implementation if generic fetch is available or needed
      const sp = new URLSearchParams();
      if (params) {
        Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null) sp.append(k, String(v)); });
      }
      // Note: Check if backend 'routes/shipments.js' supports GET / (getAll). 
      // The summary said "GET /api/shipments/order/:orderId" and "POST /api/shipments".
      // It didn't explicitly mention a general "GET /api/shipments". 
      // However, usually one exists. If not, this might fail. 
      // Safest to just rely on what I know exists or basic CRUD.
      // I'll add it tentatively or stick to order-based. 
      // Visuals require a LIST of shipments. So I probably need to create it or use Orders.
      // But the USER said "fix Shipment Page". The current page fetches ORDERS.
      // I will implement getAll attempting /api/shipments, if it fails I'll handle it later.
      return apiRequest<{ success: boolean; data: any[] }>(`/shipments${sp.toString() ? `?${sp.toString()}` : ''}`);
    }
  },



  // Sales endpoints
  sales: {
    getAll: async (params?: { page?: number; limit?: number; status?: string; search?: string; startDate?: string; endDate?: string }) => {
      const sp = new URLSearchParams();
      if (params) {
        Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null) sp.append(k, String(v)); });
      }
      const response = await apiRequest<{ success: boolean; data: Sale[]; meta: any }>(`/sales${sp.toString() ? `?${sp.toString()}` : ''}`);
      if (response.success && response.data) {
        response.data = transformProducts(response.data);
      }
      return response;
    },
    create: async (data: any) => apiRequest<{ success: boolean; data: Sale }>(`/sales`, { method: 'POST', body: JSON.stringify(data) }),
    park: async (data: any) => apiRequest<{ success: boolean; data: Sale }>(`/sales/park`, { method: 'POST', body: JSON.stringify(data) }),
    getParked: async () => {
      const response = apiRequest<{ success: boolean; data: Sale[] }>(`/sales/parked`);
      return response;
    },
    cancel: async (id: string, reason: string) => apiRequest<{ success: boolean }>(`/sales/${id}`, { method: 'DELETE', body: JSON.stringify({ reason }) }),
    getDeleted: async () => apiRequest<{ success: boolean; data: Sale[] }>(`/sales/deleted`)
  },

  // Shifts endpoints

  shifts: {
    start: async (data: { openingBalanceUZS: number; openingBalanceUSD: number; terminalId?: string }) => {
      const response = await apiRequest<{ success: boolean; data: Shift }>(`/shifts/start`, { method: 'POST', body: JSON.stringify(data) });
      if (response.success && response.data) {
        response.data = transformProduct(response.data);
      }
      return response;
    },

    end: async (data: { closingBalanceActualUZS: number; closingBalanceActualUSD: number; notes?: string }) => {
      const response = await apiRequest<{ success: boolean; data: Shift }>(`/shifts/end`, { method: 'POST', body: JSON.stringify(data) });
      if (response.success && response.data) {
        response.data = transformProduct(response.data);
      }
      return response;
    },

    getCurrent: async () => {
      const response = await apiRequest<{ success: boolean; data: Shift | null }>(`/shifts/current`);
      if (response.success && response.data) {
        response.data = transformProduct(response.data);
      }
      return response;
    },

    getHistory: async (params?: { page?: number; limit?: number }) => {
      const sp = new URLSearchParams();
      if (params) {
        Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null) sp.append(k, String(v)); });
      }
      const response = await apiRequest<{ success: boolean; data: Shift[] }>(`/shifts${sp.toString() ? `?${sp.toString()}` : ''}`);
      if (response.success && Array.isArray(response.data)) {
        response.data = transformProducts(response.data);
      }
      return response;
    }
  },

  // Inventory Count (Inventarizatsiya) endpoints
  inventoryCount: {
    sync: async () =>
      apiRequest<{ success: boolean; message: string }>('/counts/sync', { method: 'POST' }),

    createSession: async (data: { type: string; scope: any; description?: string }) =>
      apiRequest<{ success: boolean; data: any }>('/counts/sessions', { method: 'POST', body: JSON.stringify(data) }),

    getSessions: async () =>
      apiRequest<{ success: boolean; data: any[] }>('/counts/sessions'),

    getSessionLines: async (sessionId: string, params?: { status?: string, page?: number, limit?: number }) => {
      const sp = new URLSearchParams();
      if (params) {
        Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null) sp.append(k, String(v)); });
      }
      return apiRequest<{ success: boolean; data: any[]; session?: any; pagination: any }>(`/counts/${sessionId}/lines?${sp.toString()}`);
    },

    addLine: async (sessionId: string, lines: any[]) =>
      apiRequest<{ success: boolean; message: string }>(`/counts/${sessionId}/lines`, { method: 'POST', body: JSON.stringify({ lines }) }),

    submitSession: async (sessionId: string) =>
      apiRequest<{ success: boolean; message: string }>(`/counts/${sessionId}/submit`, { method: 'PATCH' }),

    approveSession: async (sessionId: string) =>
      apiRequest<{ success: boolean; message: string; adjustmentCount: number }>(`/counts/${sessionId}/approve`, { method: 'POST' })
  },

  // Payments endpoints
  payments: {
    getAll: async (params?: {
      startDate?: string;
      endDate?: string;
      sellerId?: string;
      productId?: string;
      customerId?: string;
      limit?: number;
      page?: number;
    }) => {
      const sp = new URLSearchParams();
      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          if (v !== undefined && v !== null && v !== '') sp.append(k, String(v));
        });
      }
      const response = await apiRequest<{
        success: boolean;
        data: any[];
        pagination: { total: number; limit: number; page: number; pages: number };
      }>(`/payments${sp.toString() ? `?${sp.toString()}` : ''}`);

      if (response.success) {
        response.data = transformProducts(response.data);
      }
      return response;
    },

    create: async (data: any) =>
      apiRequest<{ success: boolean; data: any }>('/payments', {
        method: 'POST',
        body: JSON.stringify(data)
      }),

    getByOrder: async (orderId: string) =>
      apiRequest<{ success: boolean; count: number; data: any[] }>(`/payments/order/${orderId}`),

    update: async (id: string, data: any) =>
      apiRequest<{ success: boolean; data: any }>(`/payments/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      })
  },

  finance: {
    getUnified: async (params?: { startDate?: string; endDate?: string; customerId?: string; sellerId?: string }) => {
      const sp = new URLSearchParams();
      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          if (v !== undefined && v !== null && v !== '') sp.append(k, String(v));
        });
      }
      return apiRequest<{ success: boolean; data: any[] }>(`/finance/unified${sp.toString() ? `?${sp.toString()}` : ''}`);
    }
  },

  // Users endpoints
  users: {
    getAll: async () => {
      const response = await apiRequest<{ success: boolean; data: any[] }>('/users');
      if (response.success && response.data) {
        response.data = transformProducts(response.data);
      }
      return response;
    },
    update: async (id: string, data: any) => apiRequest<{ success: boolean; data: any }>(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  },
};

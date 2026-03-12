// Role-based access control utilities

export type UserRole = 'admin' | 'employee' | 'user' | 'reseller';

/**
 * Get current user role from localStorage (case-insensitive match for admin/employee)
 */
export function getUserRole(): UserRole | null {
  if (typeof window === 'undefined') return null;

  const roleFromUser = (): string | null => {
    const userStr = localStorage.getItem('user');
    if (!userStr) return null;
    try {
      const user = JSON.parse(userStr);
      return user?.role ?? null;
    } catch {
      return null;
    }
  };

  const raw = roleFromUser() || localStorage.getItem('userRole');
  if (!raw) return null;

  const r = String(raw).toLowerCase();
  if (r === 'admin') return 'admin';
  if (r === 'employee') return 'employee';
  if (r === 'reseller' || r === 'user') return r as UserRole;
  return raw as UserRole;
}

/**
 * Check if user has a specific role
 */
export function hasRole(role: UserRole): boolean {
  const userRole = getUserRole();
  return userRole === role;
}

/**
 * Check if user is admin
 */
export function isAdmin(): boolean {
  return hasRole('admin');
}

/**
 * Check if user is employee
 */
export function isEmployee(): boolean {
  return hasRole('employee');
}

/**
 * Check if user is regular user/reseller
 */
export function isUser(): boolean {
  const role = getUserRole();
  return role === 'user' || role === 'reseller';
}

/**
 * Check if user has admin or employee access
 */
export function isAdminOrEmployee(): boolean {
  return isAdmin() || isEmployee();
}

/**
 * Check if user can access admin panel
 * Only admin can access admin panel
 */
export function canAccessAdminPanel(): boolean {
  return isAdmin();
}

/**
 * Check if user can view order details
 * Admin can view all orders, employee can view assigned orders
 */
export function canViewOrderDetails(): boolean {
  return isAdminOrEmployee();
}

/**
 * Check if user can manage orders (update status, etc.)
 * Only admin can manage orders
 */
export function canManageOrders(): boolean {
  return isAdmin();
}

/**
 * Get user info from localStorage
 */
export function getUserInfo(): { id?: string; email?: string; fullName?: string; role?: UserRole } | null {
  if (typeof window === 'undefined') return null;
  
  const userStr = localStorage.getItem('user');
  if (userStr) {
    try {
      return JSON.parse(userStr);
    } catch (_) {}
  }
  
  return null;
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  if (typeof window === 'undefined') return false;
  
  const token = localStorage.getItem('token');
  const isLoggedIn = localStorage.getItem('isLoggedIn');
  
  return !!(token && isLoggedIn === 'true');
}


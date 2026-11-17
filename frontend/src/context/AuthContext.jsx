import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '../api/authApi';
import { setAccessToken, registerAuthListeners } from '../api/axios';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessTokenState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Sync token into memory
  const updateAuth = useCallback((token, userData) => {
    setAccessToken(token);
    setAccessTokenState(token);
    setUser(userData);
  }, []);

  const clearAuth = useCallback(() => {
    setAccessToken(null);
    setAccessTokenState(null);
    setUser(null);
  }, []);

  // Register Axios interceptor callbacks for automatic synchronization
  useEffect(() => {
    registerAuthListeners({
      onTokenRefreshed: (newToken, newUser) => {
        setAccessTokenState(newToken);
        if (newUser) {
          setUser(newUser);
        }
      },
      onAuthExpired: () => {
        clearAuth();
      },
    });
  }, [clearAuth]);

  // Initial application startup: attempt silent session restore via refresh cookie
  useEffect(() => {
    let isMounted = true;

    const restoreSession = async () => {
      try {
        const data = await authApi.refresh();
        if (isMounted && data?.accessToken && data?.user) {
          updateAuth(data.accessToken, data.user);
        }
      } catch (err) {
        // No valid or active refresh cookie; user starts unauthenticated
        if (isMounted) {
          clearAuth();
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    restoreSession();

    return () => {
      isMounted = false;
    };
  }, [updateAuth, clearAuth]);

  const login = async (credentials) => {
    setError(null);
    try {
      const data = await authApi.login(credentials);
      updateAuth(data.accessToken, data.user);
      return data.user;
    } catch (err) {
      const message =
        err.response?.data?.message ||
        err.response?.data?.error ||
        'Login failed. Please check your credentials.';
      setError(message);
      throw new Error(message);
    }
  };

  const register = async (userData) => {
    setError(null);
    try {
      return await authApi.register(userData);
    } catch (err) {
      // Backend validation error map or single message
      const validationErrors = err.response?.data?.data;
      const message =
        err.response?.data?.message ||
        (validationErrors && typeof validationErrors === 'object'
          ? Object.values(validationErrors)[0]
          : 'Registration failed.');
      setError(message);
      throw new Error(message);
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch (err) {
      console.warn('Logout error occurred:', err);
    } finally {
      clearAuth();
    }
  };

  const isAgent = user?.role === 'AGENT';
  const isCustomer = user?.role === 'USER';
  const isAuthenticated = !!user && !!accessToken;

  const value = {
    user,
    accessToken,
    loading,
    error,
    isAuthenticated,
    isAgent,
    isCustomer,
    login,
    register,
    logout,
    clearError: () => setError(null),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;

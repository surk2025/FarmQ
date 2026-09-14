import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  loginWithGoogle: (credential: string) => Promise<void>;
  sendOtp: (phone: string) => Promise<{ success: boolean; message: string; phone: string }>;
  verifyOtp: (phone: string, otp: string) => Promise<void>;
  sendEmailOtp: (email: string) => Promise<{ success: boolean; message: string; email: string; demo_otp?: string }>;
  verifyEmailOtp: (email: string, otp: string, name?: string) => Promise<void>;
  register: (userData: any) => Promise<void>;
  registerFarmer: (formData: any) => Promise<User>;
  requestPasswordReset: (email: string) => Promise<{ success: boolean; message: string; dev_token?: string }>;
  resetPassword: (token: string, newPassword: string) => Promise<{ success: boolean; message: string }>;
  logout: () => void;
  updateUser: (updatedData: Partial<User>) => void;
  loginAsDemo: (role: 'farmer' | 'admin' | 'superadmin') => Promise<void>;
  loginWithToken: (token: string, user: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('farmq_user');
    try {
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('farmq_token'));
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const verifyAuth = async () => {
      if (token) {
        try {
          const res = await api.get('/auth/me');
          setUser(res.data);
          localStorage.setItem('farmq_user', JSON.stringify(res.data));
        } catch {
          // Token invalid or expired
          setUser(null);
          setToken(null);
          localStorage.removeItem('farmq_token');
          localStorage.removeItem('farmq_user');
        }
      }
      setLoading(false);
    };
    verifyAuth();
  }, [token]);

  const saveAuthSession = (access_token: string, userData: User) => {
    setToken(access_token);
    setUser(userData);
    localStorage.setItem('farmq_token', access_token);
    localStorage.setItem('farmq_user', JSON.stringify(userData));
    api.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
  };

  const login = async (identifier: string, password: string) => {
    const res = await api.post('/auth/login', { identifier, password });
    const { access_token, user: userData } = res.data;
    saveAuthSession(access_token, userData);
  };

  const loginWithEmail = async (email: string, password: string) => {
    const res = await api.post('/auth/login', { email, password });
    const { access_token, user: userData } = res.data;
    saveAuthSession(access_token, userData);
  };

  const loginWithGoogle = async (credential: string) => {
    const res = await api.post('/auth/google', { credential });
    const { access_token, user: userData } = res.data;
    saveAuthSession(access_token, userData);
  };

  const sendOtp = async (phone: string) => {
    const res = await api.post('/auth/send-otp', { phone });
    return res.data;
  };

  const verifyOtp = async (phone: string, otp: string) => {
    const res = await api.post('/auth/verify-otp', { phone, otp });
    const { access_token, user: userData } = res.data;
    saveAuthSession(access_token, userData);
  };

  const sendEmailOtp = async (email: string) => {
    const res = await api.post('/auth/send-email-otp', { email });
    return res.data;
  };

  const verifyEmailOtp = async (email: string, otp: string, name?: string) => {
    const res = await api.post('/auth/verify-email-otp', { email, otp, name });
    const { access_token, user: userData } = res.data;
    saveAuthSession(access_token, userData);
  };

  const register = async (userData: any) => {
    const res = await api.post('/auth/register', userData);
    const { access_token, user: newUserData } = res.data;
    saveAuthSession(access_token, newUserData);
  };

  const registerFarmer = async (formData: any) => {
    const res = await api.post('/auth/farmer/register', formData);
    const { access_token, user: newUserData } = res.data;
    saveAuthSession(access_token, newUserData);
    return newUserData;
  };

  const requestPasswordReset = async (email: string) => {
    const res = await api.post('/auth/forgot-password', { email });
    return res.data;
  };

  const resetPassword = async (tokenStr: string, newPassword: string) => {
    const res = await api.post('/auth/reset-password', { token: tokenStr, new_password: newPassword });
    return res.data;
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('farmq_token');
    localStorage.removeItem('farmq_user');
    delete api.defaults.headers.common['Authorization'];
  };

  const updateUser = (updatedData: Partial<User>) => {
    if (user) {
      const updated = { ...user, ...updatedData };
      setUser(updated);
      localStorage.setItem('farmq_user', JSON.stringify(updated));
    }
  };

  const loginAsDemo = async (role: 'farmer' | 'admin' | 'superadmin') => {
    if (role === 'farmer') {
      await login('farmer@farmq.demo', 'demo123');
    } else if (role === 'admin') {
      await login('admin@farmq.demo', 'admin123');
    } else if (role === 'superadmin') {
      await login('superadmin@farmq.demo', 'super123');
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      isAuthenticated: !!token && !!user,
      loading,
      login,
      loginWithEmail,
      loginWithGoogle,
      sendOtp,
      verifyOtp,
      sendEmailOtp,
      verifyEmailOtp,
      register,
      registerFarmer,
      requestPasswordReset,
      resetPassword,
      logout,
      updateUser,
      loginAsDemo,
      loginWithToken: saveAuthSession
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

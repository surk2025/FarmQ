import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Sprout,
  Mail,
  Lock,
  Phone,
  User,
  MapPin,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  RefreshCw,
  Edit2,
  Clock,
  Sparkles,
  Zap,
  Building,
  UserCheck,
  Eye,
  EyeOff,
  Check
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import api from '../../services/api';

interface LoginPageProps {
  initialTab?: 'login' | 'register';
}

export const LoginPage: React.FC<LoginPageProps> = ({ initialTab = 'login' }) => {
  const {
    user,
    isAuthenticated,
    sendOtp,
    verifyOtp,
    sendEmailOtp,
    verifyEmailOtp,
    loginWithGoogle,
    loginAsDemo,
    registerFarmer,
    loginWithToken
  } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  // Mobile/Tablet switcher tab: 'login' | 'register' (Desktop displays both side-by-side)
  const [activeMobileTab, setActiveMobileTab] = useState<'login' | 'register'>(initialTab);

  // ---------------------------------------------------------------------------
  // LEFT COLUMN: LOGIN STATES (Mobile OTP & Email OTP only)
  // ---------------------------------------------------------------------------
  const [loginMode, setLoginMode] = useState<'mobile_otp' | 'email_otp'>('mobile_otp');

  // Mobile OTP login states
  const [loginPhone, setLoginPhone] = useState('');
  const [phoneOtpStep, setPhoneOtpStep] = useState<'input' | 'verify'>('input');
  const [phoneOtp, setPhoneOtp] = useState<string[]>(['', '', '', '', '', '']);
  const [phoneCooldown, setPhoneCooldown] = useState(0);

  // Email OTP login states
  const [loginEmail, setLoginEmail] = useState('');
  const [loginEmailName, setLoginEmailName] = useState('');
  const [emailOtpStep, setEmailOtpStep] = useState<'input' | 'verify'>('input');
  const [emailOtp, setEmailOtp] = useState<string[]>(['', '', '', '', '', '']);
  const [emailCooldown, setEmailCooldown] = useState(0);

  // Status & Feedback for Login
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginSuccess, setLoginSuccess] = useState<string | null>(null);

  // Refs for OTP input boxes
  const phoneOtpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const emailOtpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // ---------------------------------------------------------------------------
  // RIGHT COLUMN: REGISTRATION STATES (Personal & Location only)
  // ---------------------------------------------------------------------------
  // Personal Information & Location Details
  const [regName, setRegName] = useState('');
  const [regMobile, setRegMobile] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);

  const [regState, setRegState] = useState('Haryana');
  const [regDistrict, setRegDistrict] = useState('Karnal');
  const [regVillage, setRegVillage] = useState('Taraori');

  // Status & Feedback for Registration
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // TIMERS & EFFECTS
  // ---------------------------------------------------------------------------

  // Login Cooldown countdown timers
  useEffect(() => {
    let t: any;
    if (phoneCooldown > 0) {
      t = setInterval(() => setPhoneCooldown((p) => p - 1), 1000);
    }
    return () => clearInterval(t);
  }, [phoneCooldown]);

  useEffect(() => {
    let t: any;
    if (emailCooldown > 0) {
      t = setInterval(() => setEmailCooldown((p) => p - 1), 1000);
    }
    return () => clearInterval(t);
  }, [emailCooldown]);

  // Auto focus first OTP input on login step activation
  useEffect(() => {
    if (phoneOtpStep === 'verify') {
      setTimeout(() => phoneOtpRefs.current[0]?.focus(), 120);
    }
  }, [phoneOtpStep]);

  useEffect(() => {
    if (emailOtpStep === 'verify') {
      setTimeout(() => emailOtpRefs.current[0]?.focus(), 120);
    }
  }, [emailOtpStep]);

  // Role Redirect Helper
  const handleRoleRedirect = () => {
    const saved = localStorage.getItem('farmq_user');
    const u = saved ? JSON.parse(saved) : null;
    if (u?.role === 'admin' || u?.role === 'superadmin') {
      navigate('/admin/dashboard', { replace: true });
    } else {
      navigate('/farmer/dashboard', { replace: true });
    }
  };

  // If already authenticated, automatically steer to respective dashboard
  useEffect(() => {
    if (isAuthenticated && user) {
      handleRoleRedirect();
    }
  }, [isAuthenticated, user]);

  // Helper for generic 6-box OTP updates
  const handleOtpBoxChange = (
    index: number,
    value: string,
    stateArr: string[],
    setArr: React.Dispatch<React.SetStateAction<string[]>>,
    refs: React.MutableRefObject<(HTMLInputElement | null)[]>
  ) => {
    const cleaned = value.replace(/\D/g, '');
    if (!cleaned) {
      const updated = [...stateArr];
      updated[index] = '';
      setArr(updated);
      return;
    }
    const digit = cleaned[cleaned.length - 1];
    const updated = [...stateArr];
    updated[index] = digit;
    setArr(updated);

    if (index < 5) {
      refs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>,
    stateArr: string[],
    refs: React.MutableRefObject<(HTMLInputElement | null)[]>
  ) => {
    if (e.key === 'Backspace' && !stateArr[index] && index > 0) {
      refs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      refs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      refs.current[index + 1]?.focus();
    }
  };

  const handleOtpPaste = (
    e: React.ClipboardEvent<HTMLInputElement>,
    setArr: React.Dispatch<React.SetStateAction<string[]>>,
    refs: React.MutableRefObject<(HTMLInputElement | null)[]>
  ) => {
    e.preventDefault();
    const paste = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (paste) {
      const updated = ['', '', '', '', '', ''];
      for (let i = 0; i < paste.length; i++) {
        updated[i] = paste[i];
      }
      setArr(updated);
      const nextIdx = Math.min(paste.length, 5);
      refs.current[nextIdx]?.focus();
    }
  };

  // ---------------------------------------------------------------------------
  // LOGIN ACTIONS (Mobile OTP, Email OTP, Google Login)
  // ---------------------------------------------------------------------------

  // 1. Mobile OTP Login
  const handleSendPhoneOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = loginPhone.replace(/\D/g, '');
    if (clean.length !== 10) {
      setLoginError('Please enter a valid 10-digit Indian mobile number.');
      return;
    }

    setLoginError(null);
    setLoginSuccess(null);
    setLoginLoading(true);
    try {
      const res = await sendOtp(clean);
      setPhoneOtpStep('verify');
      setPhoneCooldown(30);
      setPhoneOtp(['', '', '', '', '', '']);
      setLoginSuccess(res.message || `OTP dispatched to +91 ${clean.slice(0, 2)}******${clean.slice(-2)}`);
    } catch (err: any) {
      setLoginError(err?.response?.data?.detail || 'Failed to send OTP. Please check mobile number.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleVerifyPhoneOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const code = phoneOtp.join('');
    if (code.length !== 6) {
      setLoginError('Please enter all 6 digits of the OTP verification code.');
      return;
    }

    setLoginError(null);
    setLoginLoading(true);
    try {
      const clean = loginPhone.replace(/\D/g, '');
      await verifyOtp(clean, code);
      handleRoleRedirect();
    } catch (err: any) {
      setLoginError(err?.response?.data?.detail || 'Invalid or expired OTP. Please try again.');
    } finally {
      setLoginLoading(false);
    }
  };

  // 2. Email OTP Login
  const handleSendEmailOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanMail = loginEmail.trim().toLowerCase();
    if (!cleanMail || !cleanMail.includes('@') || !cleanMail.includes('.')) {
      setLoginError('Please enter a valid email address (e.g. name@example.com).');
      return;
    }

    setLoginError(null);
    setLoginSuccess(null);
    setLoginLoading(true);
    try {
      const res = await sendEmailOtp(cleanMail);
      setEmailOtpStep('verify');
      setEmailCooldown(30);
      setEmailOtp(['', '', '', '', '', '']);
      setLoginSuccess(res.message || `Verification code sent to ${cleanMail}`);
    } catch (err: any) {
      setLoginError(err?.response?.data?.detail || 'Failed to send code. Please try again.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleVerifyEmailOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const code = emailOtp.join('');
    if (code.length !== 6) {
      setLoginError('Please enter all 6 digits of the verification code.');
      return;
    }

    setLoginError(null);
    setLoginLoading(true);
    try {
      const cleanMail = loginEmail.trim().toLowerCase();
      await verifyEmailOtp(cleanMail, code, loginEmailName.trim() || undefined);
      handleRoleRedirect();
    } catch (err: any) {
      setLoginError(err?.response?.data?.detail || 'Invalid or expired verification code.');
    } finally {
      setLoginLoading(false);
    }
  };

  // 3. Google Login
  const handleGoogleLogin = async () => {
    setLoginError(null);
    setLoginLoading(true);
    try {
      const mockGoogleCredential = `mock_google_token_${Date.now()}`;
      await loginWithGoogle(mockGoogleCredential);
      handleRoleRedirect();
    } catch (err: any) {
      setLoginError(err?.response?.data?.detail || 'Google sign in encountered an issue. Please try again.');
    } finally {
      setLoginLoading(false);
    }
  };

  // 4. 1-Click Fast Demo Login
  const handleQuickDemoLogin = async (role: 'farmer' | 'admin' | 'superadmin') => {
    setLoginError(null);
    setLoginLoading(true);
    try {
      await loginAsDemo(role);
      handleRoleRedirect();
    } catch (err: any) {
      setLoginError(err?.response?.data?.detail || `Failed to sign in as ${role}`);
    } finally {
      setLoginLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // REGISTRATION ACTIONS (1. Personal & Location only)
  // ---------------------------------------------------------------------------

  const handleRegisterFarmer = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);

    if (!regName.trim()) {
      setRegError('Please enter your full name.');
      return;
    }
    const cleanPhone = regMobile.replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      setRegError('Please enter a valid 10-digit Indian mobile number.');
      return;
    }
    const cleanMail = regEmail.trim().toLowerCase();
    if (!cleanMail || !cleanMail.includes('@') || !cleanMail.includes('.')) {
      setRegError('Please enter a valid email address.');
      return;
    }
    if (regPassword.length < 4) {
      setRegError('Password must be at least 4 characters long.');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setRegError('Passwords do not match.');
      return;
    }
    if (!regState.trim()) {
      setRegError('Please select or enter your state.');
      return;
    }
    if (!regDistrict.trim()) {
      setRegError('Please enter your district.');
      return;
    }
    if (!regVillage.trim()) {
      setRegError('Please enter your village or city.');
      return;
    }

    setRegLoading(true);
    try {
      const payload = {
        name: regName.trim(),
        mobile: cleanPhone,
        email: cleanMail,
        password: regPassword,
        confirmPassword: regConfirmPassword,
        state: regState.trim(),
        district: regDistrict.trim(),
        village: regVillage.trim(),
        farmerType: 'Small',
        mainCrops: [],
        landArea: 1.0,
        landAreaUnit: 'acre',
        preferredLanguage: 'en'
      };

      // 1. Create and save the farmer account & 2. Authenticate the newly registered farmer
      await registerFarmer(payload);

      // 3. Redirect directly to the Farmer Dashboard
      navigate('/farmer/dashboard', { replace: true });
    } catch (err: any) {
      setRegError(err?.response?.data?.detail || 'Registration failed. Please verify your details and try again.');
    } finally {
      setRegLoading(false);
    }
  };

  return (
    <div className="min-h-[92vh] bg-gradient-to-br from-slate-50 via-emerald-50/20 to-teal-50/30 py-8 px-4 sm:px-6 lg:px-8 flex flex-col items-center justify-center">
      <div className="w-full max-w-7xl mx-auto space-y-6">

        {/* ================================================================= */}
        {/* BRAND PLATFORM HEADER                                             */}
        {/* ================================================================= */}
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-xl shadow-emerald-600/25 mb-1 hover:scale-105 transition-transform">
            <Sprout className="w-8 h-8" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 font-heading tracking-tight">
            Farm<span className="text-emerald-600">Q</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            Smart Procurement • Less Waiting • Better Farming
          </p>
        </div>

        {/* ================================================================= */}
        {/* MOBILE / TABLET RESPONSIVE SEGMENTED TAB SWITCHER (< lg)          */}
        {/* ================================================================= */}
        <div className="lg:hidden flex items-center justify-center p-1.5 bg-slate-200/80 rounded-2xl max-w-md mx-auto w-full shadow-inner">
          <button
            type="button"
            onClick={() => setActiveMobileTab('login')}
            className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeMobileTab === 'login'
                ? 'bg-white text-slate-900 shadow-md ring-1 ring-slate-900/5'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Lock className="w-3.5 h-3.5 text-emerald-600" />
            <span>🔐 Sign In / Login</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveMobileTab('register')}
            className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeMobileTab === 'register'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sprout className="w-3.5 h-3.5" />
            <span>🌾 Register as Farmer</span>
          </button>
        </div>

        {/* ================================================================= */}
        {/* MAIN TWO-COLUMN CONTAINER: SIDE-BY-SIDE ON DESKTOP                */}
        {/* ================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

          {/* =============================================================== */}
          {/* LEFT COLUMN: 🔐 WELCOME BACK (LOGIN CARD)                       */}
          {/* =============================================================== */}
          <div
            className={`lg:col-span-5 bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-xl space-y-6 relative transition-all ${
              activeMobileTab === 'login' ? 'block' : 'hidden lg:block'
            }`}
          >
            {/* Header with "Already have an account?" badge */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 mb-1.5">
                  <span>Already have an account?</span>
                </div>
                <h2 className="text-2xl font-black text-slate-900 font-heading tracking-tight flex items-center gap-2">
                  <span>Welcome Back</span>
                  <span className="text-xl">👋</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Login to your FarmQ account
                </p>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                <Lock className="w-5 h-5" />
              </div>
            </div>

            {/* Login Error Alert */}
            {loginError && (
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5 animate-fadeIn">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                <div className="flex-1 font-semibold">{loginError}</div>
              </div>
            )}

            {/* Login Success Alert */}
            {loginSuccess && !loginError && (
              <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 animate-fadeIn">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span className="font-semibold">{loginSuccess}</span>
              </div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* LOGIN METHOD SELECTOR TABS (Mobile OTP vs Email OTP)          */}
            {/* ------------------------------------------------------------- */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-100 rounded-2xl border border-slate-200 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setLoginMode('mobile_otp');
                    setLoginError(null);
                    setLoginSuccess(null);
                  }}
                  className={`py-2.5 px-3 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    loginMode === 'mobile_otp'
                      ? 'bg-white text-emerald-800 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>📱 Mobile OTP</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setLoginMode('email_otp');
                    setLoginError(null);
                    setLoginSuccess(null);
                  }}
                  className={`py-2.5 px-3 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    loginMode === 'email_otp'
                      ? 'bg-white text-emerald-800 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>📧 Email OTP</span>
                </button>
              </div>

              {/* 1. MOBILE OTP FORM */}
              {loginMode === 'mobile_otp' && (
                <div className="space-y-4 pt-1">
                  {phoneOtpStep === 'input' ? (
                    <form onSubmit={handleSendPhoneOtp} className="space-y-3.5">
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-slate-700">
                          Registered Mobile Number
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-xs font-bold text-slate-500">
                            +91
                          </div>
                          <input
                            type="tel"
                            value={loginPhone}
                            onChange={(e) => {
                              setLoginPhone(e.target.value);
                              if (loginError) setLoginError(null);
                            }}
                            placeholder="98765 43210"
                            maxLength={14}
                            autoFocus
                            required
                            className="w-full pl-12 pr-4 py-3 rounded-2xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-sm transition-all"
                          />
                        </div>
                        <p className="text-[11px] text-slate-400">
                          We will send a 6-digit secure login OTP to your mobile phone.
                        </p>
                      </div>

                      <button
                        type="submit"
                        disabled={loginLoading || !loginPhone.trim()}
                        className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-2xl font-bold text-sm shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        {loginLoading ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>Sending Secure OTP...</span>
                          </>
                        ) : (
                          <>
                            <span>Send Mobile OTP</span>
                            <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    </form>
                  ) : (
                    <div className="space-y-4">
                      <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-emerald-600" />
                          <div className="text-xs font-bold text-slate-800">
                            +91 {loginPhone.replace(/\D/g, '')}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setPhoneOtpStep('input');
                            setLoginError(null);
                          }}
                          className="text-xs text-emerald-700 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>Change</span>
                        </button>
                      </div>

                      <div className="space-y-2">
                        <label className="block text-center text-xs font-bold text-slate-700">
                          Enter the 6-digit code received on your phone
                        </label>
                        <div className="flex justify-between gap-1.5 sm:gap-2">
                          {phoneOtp.map((digit, idx) => (
                            <input
                              key={idx}
                              ref={(el) => {
                                phoneOtpRefs.current[idx] = el;
                              }}
                              type="text"
                              inputMode="numeric"
                              maxLength={1}
                              value={digit}
                              onChange={(e) =>
                                handleOtpBoxChange(
                                  idx,
                                  e.target.value,
                                  phoneOtp,
                                  setPhoneOtp,
                                  phoneOtpRefs
                                )
                              }
                              onKeyDown={(e) =>
                                handleOtpKeyDown(idx, e, phoneOtp, phoneOtpRefs)
                              }
                              onPaste={(e) =>
                                handleOtpPaste(e, setPhoneOtp, phoneOtpRefs)
                              }
                              className={`w-10 h-12 sm:w-11 sm:h-13 text-center text-xl font-black rounded-xl border transition-all ${
                                digit
                                  ? 'border-emerald-600 bg-emerald-50/40 text-emerald-950 ring-2 ring-emerald-500/20 shadow-xs'
                                  : 'border-slate-300 bg-white text-slate-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30'
                              }`}
                            />
                          ))}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleVerifyPhoneOtp()}
                        disabled={loginLoading || phoneOtp.join('').length !== 6}
                        className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-2xl font-bold text-sm shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        {loginLoading ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>Verifying OTP & Logging In...</span>
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="w-4 h-4" />
                            <span>Verify & Login</span>
                          </>
                        )}
                      </button>

                      <div className="text-center text-xs text-slate-500">
                        {phoneCooldown > 0 ? (
                          <div className="flex items-center justify-center gap-1.5 text-slate-400">
                            <Clock className="w-3.5 h-3.5" />
                            <span>Resend OTP in {phoneCooldown}s</span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleSendPhoneOtp()}
                            disabled={loginLoading}
                            className="text-emerald-600 hover:text-emerald-700 font-bold hover:underline cursor-pointer inline-flex items-center gap-1"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>Didn't receive code? Resend SMS</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 2. EMAIL OTP FORM */}
              {loginMode === 'email_otp' && (
                <div className="space-y-4 pt-1">
                  {emailOtpStep === 'input' ? (
                    <form onSubmit={handleSendEmailOtp} className="space-y-3.5">
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-slate-700">
                          Email Address
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                            <Mail className="w-4 h-4" />
                          </div>
                          <input
                            type="email"
                            value={loginEmail}
                            onChange={(e) => {
                              setLoginEmail(e.target.value);
                              if (loginError) setLoginError(null);
                            }}
                            placeholder="farmer@example.com"
                            autoFocus
                            required
                            className="w-full pl-10 pr-4 py-3 rounded-2xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-sm transition-all"
                          />
                        </div>
                        <p className="text-[11px] text-slate-400">
                          We'll send a 6-digit secure login code to your email.
                        </p>
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-slate-500">
                          Full Name <span className="text-[10px] text-slate-400">(Optional for new farmers)</span>
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                            <UserCheck className="w-4 h-4" />
                          </div>
                          <input
                            type="text"
                            value={loginEmailName}
                            onChange={(e) => setLoginEmailName(e.target.value)}
                            placeholder="e.g. Surjeet Kumar"
                            className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-slate-200 text-sm font-medium"
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={loginLoading || !loginEmail.trim()}
                        className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-2xl font-bold text-sm shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        {loginLoading ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>Sending Code to Email...</span>
                          </>
                        ) : (
                          <>
                            <span>Send Verification Code</span>
                            <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    </form>
                  ) : (
                    <div className="space-y-4">
                      <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-emerald-600" />
                          <div className="text-xs font-bold text-slate-800 truncate max-w-[200px]">
                            {loginEmail}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setEmailOtpStep('input');
                            setLoginError(null);
                          }}
                          className="text-xs text-emerald-700 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>Change</span>
                        </button>
                      </div>

                      <div className="space-y-2">
                        <label className="block text-center text-xs font-bold text-slate-700">
                          Enter the 6-digit code received on your email
                        </label>
                        <div className="flex justify-between gap-1.5 sm:gap-2">
                          {emailOtp.map((digit, idx) => (
                            <input
                              key={idx}
                              ref={(el) => {
                                emailOtpRefs.current[idx] = el;
                              }}
                              type="text"
                              inputMode="numeric"
                              maxLength={1}
                              value={digit}
                              onChange={(e) =>
                                handleOtpBoxChange(
                                  idx,
                                  e.target.value,
                                  emailOtp,
                                  setEmailOtp,
                                  emailOtpRefs
                                )
                              }
                              onKeyDown={(e) =>
                                handleOtpKeyDown(idx, e, emailOtp, emailOtpRefs)
                              }
                              onPaste={(e) =>
                                handleOtpPaste(e, setEmailOtp, emailOtpRefs)
                              }
                              className={`w-10 h-12 sm:w-11 sm:h-13 text-center text-xl font-black rounded-xl border transition-all ${
                                digit
                                  ? 'border-emerald-600 bg-emerald-50/40 text-emerald-950 ring-2 ring-emerald-500/20 shadow-xs'
                                  : 'border-slate-300 bg-white text-slate-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30'
                              }`}
                            />
                          ))}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleVerifyEmailOtp()}
                        disabled={loginLoading || emailOtp.join('').length !== 6}
                        className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-2xl font-bold text-sm shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        {loginLoading ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>Verifying Code & Logging In...</span>
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="w-4 h-4" />
                            <span>Verify & Login</span>
                          </>
                        )}
                      </button>

                      <div className="text-center text-xs text-slate-500">
                        {emailCooldown > 0 ? (
                          <div className="flex items-center justify-center gap-1.5 text-slate-400">
                            <Clock className="w-3.5 h-3.5" />
                            <span>Resend code in {emailCooldown}s</span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleSendEmailOtp()}
                            disabled={loginLoading}
                            className="text-emerald-600 hover:text-emerald-700 font-bold hover:underline cursor-pointer inline-flex items-center gap-1"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>Didn't receive code? Resend Email</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ----------------------------------------------------------- */}
              {/* GOOGLE LOGIN BUTTON                                         */}
              {/* ----------------------------------------------------------- */}
              <div className="pt-2">
                <div className="relative flex py-2 items-center">
                  <div className="flex-grow border-t border-slate-200"></div>
                  <span className="flex-shrink mx-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Or
                  </span>
                  <div className="flex-grow border-t border-slate-200"></div>
                </div>

                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={loginLoading}
                  className="w-full py-3 px-4 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-2xl border border-slate-300 shadow-xs transition-all flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Continue with Google</span>
                </button>
              </div>

              {/* ----------------------------------------------------------- */}
              {/* 1-CLICK FAST TEST ACCOUNTS HELPER                          */}
              {/* ----------------------------------------------------------- */}
              <div className="bg-emerald-50/60 rounded-2xl p-3.5 border border-emerald-200/80 space-y-2">
                <div className="flex items-center justify-between text-[11px] font-bold text-emerald-950 uppercase tracking-wider">
                  <div className="flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-emerald-600 fill-emerald-600" />
                    <span>1-Click Fast Testing Accounts:</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleQuickDemoLogin('farmer')}
                    disabled={loginLoading}
                    className="p-2 bg-white hover:bg-emerald-50 text-slate-800 hover:text-emerald-900 border border-slate-200 hover:border-emerald-300 rounded-xl text-xs font-bold shadow-xs transition-all flex flex-col items-center justify-center cursor-pointer disabled:opacity-50 text-center"
                  >
                    <span>🌾 Farmer Login</span>
                    <span className="text-[10px] text-slate-500 font-normal">farmer@farmq.demo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleQuickDemoLogin('admin')}
                    disabled={loginLoading}
                    className="p-2 bg-white hover:bg-slate-50 text-slate-800 hover:text-slate-900 border border-slate-200 hover:border-slate-300 rounded-xl text-xs font-bold shadow-xs transition-all flex flex-col items-center justify-center cursor-pointer disabled:opacity-50 text-center"
                  >
                    <span>🏢 Mandi Admin</span>
                    <span className="text-[10px] text-slate-500 font-normal">admin@farmq.demo</span>
                  </button>
                </div>

                <div className="text-center pt-0.5">
                  <button
                    type="button"
                    onClick={() => handleQuickDemoLogin('superadmin')}
                    disabled={loginLoading}
                    className="text-[11px] text-emerald-700 hover:text-emerald-900 hover:underline font-semibold cursor-pointer inline-flex items-center gap-1"
                  >
                    <Building className="w-3 h-3" />
                    <span>or test as Director Super Admin (superadmin@farmq.demo)</span>
                  </button>
                </div>
              </div>

              {/* Mobile switch hint */}
              <div className="lg:hidden text-center pt-2">
                <span className="text-xs text-slate-500">New to FarmQ? </span>
                <button
                  type="button"
                  onClick={() => setActiveMobileTab('register')}
                  className="text-xs text-emerald-700 font-bold hover:underline cursor-pointer"
                >
                  Register as New Farmer →
                </button>
              </div>
            </div>

            {/* Encryption & Security Note */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-center gap-1.5 text-[11px] text-slate-400 text-center">
              <Lock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Protected by SHA-256 OTP verification & 256-bit JWT session security</span>
            </div>
          </div>

          {/* =============================================================== */}
          {/* RIGHT COLUMN: 🌾 REGISTER AS NEW FARMER CARD                    */}
          {/* =============================================================== */}
          <div
            className={`lg:col-span-7 bg-white rounded-3xl p-6 sm:p-8 border border-emerald-200/90 shadow-xl space-y-6 relative transition-all ${
              activeMobileTab === 'register' ? 'block' : 'hidden lg:block'
            }`}
          >
            {/* Header with "New to FarmQ?" badge */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-teal-100 text-teal-900 mb-1.5">
                  <span>New to FarmQ?</span>
                </div>
                <h2 className="text-2xl font-black text-slate-900 font-heading tracking-tight flex items-center gap-2">
                  <span>🌾 Register as New Farmer</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Create your FarmQ farmer account for smart slot booking and MSP payouts
                </p>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
                <Sprout className="w-5 h-5" />
              </div>
            </div>

            {/* Flow Info Header */}
            <div className="bg-emerald-50/60 rounded-2xl p-3 border border-emerald-200/80 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-950">
                <UserCheck className="w-4 h-4 text-emerald-600" />
                <span>Personal Information & Location</span>
              </div>
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100/80 px-2.5 py-0.5 rounded-full">
                Quick Registration
              </span>
            </div>

            {/* Registration Error Alert */}
            {regError && (
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5 animate-fadeIn">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                <div className="flex-1 font-semibold">{regError}</div>
              </div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* 1. PERSONAL INFORMATION & LOCATION ONLY                       */}
            {/* ------------------------------------------------------------- */}
            <form onSubmit={handleRegisterFarmer} className="space-y-4">
              {/* 1. Personal Information */}
              <div className="space-y-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Personal Information</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-slate-700">
                      Full Name *
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <User className="w-3.5 h-3.5" />
                      </div>
                      <input
                        type="text"
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        placeholder="e.g. Balwant Singh"
                        required
                        className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-slate-700">
                      Mobile Number (+91) *
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-xs font-bold text-slate-500">
                        +91
                      </div>
                      <input
                        type="tel"
                        value={regMobile}
                        onChange={(e) => setRegMobile(e.target.value)}
                        placeholder="98765 43210"
                        maxLength={10}
                        required
                        className="w-full pl-11 pr-3 py-2.5 rounded-xl border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700">
                    Email Address *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Mail className="w-3.5 h-3.5" />
                    </div>
                    <input
                      type="email"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="balwant.farmer@example.com"
                      required
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-slate-700">
                      Create Password *
                    </label>
                    <div className="relative">
                      <input
                        type={showRegPassword ? 'text' : 'password'}
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        className="w-full px-3 py-2.5 pr-10 rounded-xl border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-emerald-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegPassword(!showRegPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 cursor-pointer"
                      >
                        {showRegPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-slate-700">
                      Confirm Password *
                    </label>
                    <input
                      type={showRegPassword ? 'text' : 'password'}
                      value={regConfirmPassword}
                      onChange={(e) => setRegConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* 2. Location */}
              <div className="space-y-3 pt-3 border-t border-slate-100">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Location</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-slate-700">
                      State *
                    </label>
                    <select
                      value={regState}
                      onChange={(e) => setRegState(e.target.value)}
                      className="w-full px-2.5 py-2.5 rounded-xl border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-emerald-500 bg-white"
                    >
                      <option value="Haryana">Haryana</option>
                      <option value="Punjab">Punjab</option>
                      <option value="Uttar Pradesh">Uttar Pradesh</option>
                      <option value="Rajasthan">Rajasthan</option>
                      <option value="Madhya Pradesh">Madhya Pradesh</option>
                      <option value="Gujarat">Gujarat</option>
                      <option value="Maharashtra">Maharashtra</option>
                      <option value="Bihar">Bihar</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-slate-700">
                      District *
                    </label>
                    <input
                      type="text"
                      value={regDistrict}
                      onChange={(e) => setRegDistrict(e.target.value)}
                      placeholder="e.g. Karnal"
                      required
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-slate-700">
                      Village / City *
                    </label>
                    <input
                      type="text"
                      value={regVillage}
                      onChange={(e) => setRegVillage(e.target.value)}
                      placeholder="e.g. Taraori"
                      required
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* Registration Submit CTA */}
              <button
                type="submit"
                disabled={regLoading}
                className="w-full mt-3 py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-2xl font-bold text-sm shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {regLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Registering Farmer Account...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Complete Farmer Registration</span>
                  </>
                )}
              </button>
            </form>

            {/* Privacy & Safety Note */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-center gap-1.5 text-[11px] text-slate-400 text-center">
              <ShieldCheck className="w-3.5 h-3.5 text-teal-600 shrink-0" />
              <span>Your farmer credentials & profile data are protected with 256-bit encryption</span>
            </div>
          </div>

        </div>

        {/* Back to Home Navigation Link */}
        <div className="text-center pt-2">
          <Link
            to="/"
            className="text-xs text-slate-500 hover:text-slate-800 font-semibold transition-colors inline-flex items-center gap-1"
          >
            ← Back to FarmQ Home
          </Link>
        </div>

      </div>
    </div>
  );
};

export default LoginPage;

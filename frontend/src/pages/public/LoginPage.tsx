import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Sprout,
  Mail,
  Lock,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  Edit2,
  Clock,
  Sparkles,
  Zap,
  Building,
  UserCheck
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

export const LoginPage: React.FC = () => {
  const { sendEmailOtp, verifyEmailOtp } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  // Multi-step flow: 'email' -> 'verify'
  const [step, setStep] = useState<'email' | 'verify'>('email');

  // Form states
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [otp, setOtp] = useState<string[]>(['', '', '', '', '', '']);
  const [cooldown, setCooldown] = useState(0);
  const [demoOtp, setDemoOtp] = useState<string | null>(null);

  // Status & Feedback
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Ref for OTP inputs
  const otpInputsRef = useRef<(HTMLInputElement | null)[]>([]);

  // Cooldown countdown timer
  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (cooldown > 0) {
      timer = setInterval(() => {
        setCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [cooldown]);

  // Focus first OTP input when moving to verify step
  useEffect(() => {
    if (step === 'verify') {
      setTimeout(() => {
        otpInputsRef.current[0]?.focus();
      }, 100);
    }
  }, [step]);

  // Redirect based on user role
  const handleRoleRedirect = () => {
    const saved = localStorage.getItem('farmq_user');
    const u = saved ? JSON.parse(saved) : null;
    if (u?.role === 'admin' || u?.role === 'superadmin') {
      navigate('/admin/dashboard');
    } else {
      navigate('/farmer/dashboard');
    }
  };

  // 1. Send OTP to Email
  const handleSendOtp = async (targetEmail?: string) => {
    const emailToUse = (targetEmail || email).trim().toLowerCase();
    if (!emailToUse || !emailToUse.includes('@') || !emailToUse.includes('.')) {
      setError('Please enter a valid email address (e.g. name@example.com).');
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const res = await sendEmailOtp(emailToUse);
      setEmail(emailToUse);
      setSuccessMsg(res.message || `Verification code sent to ${emailToUse}`);
      if (res.demo_otp) {
        setDemoOtp(res.demo_otp);
      }
      setCooldown(30);
      setOtp(['', '', '', '', '', '']);
      setStep('verify');
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setError(detail || 'Failed to send OTP. Please check your email and try again.');
    } finally {
      setLoading(false);
    }
  };

  // 2. Handle OTP input change
  const handleOtpBoxChange = (index: number, value: string) => {
    const cleaned = value.replace(/\D/g, '');
    if (!cleaned) {
      const updated = [...otp];
      updated[index] = '';
      setOtp(updated);
      return;
    }
    const digit = cleaned[cleaned.length - 1];
    const updated = [...otp];
    updated[index] = digit;
    setOtp(updated);
    if (error) setError(null);

    // Auto-focus next box
    if (index < 5) {
      otpInputsRef.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!otp[index] && index > 0) {
        otpInputsRef.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      otpInputsRef.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      otpInputsRef.current[index + 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasteData) {
      const updated = ['', '', '', '', '', ''];
      for (let i = 0; i < pasteData.length; i++) {
        updated[i] = pasteData[i];
      }
      setOtp(updated);
      const nextIndex = Math.min(pasteData.length, 5);
      otpInputsRef.current[nextIndex]?.focus();
    }
  };

  // 3. Verify OTP & Log In
  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const fullOtp = otp.join('');
    if (fullOtp.length !== 6) {
      setError('Please enter all 6 digits of the OTP verification code.');
      return;
    }

    setError(null);
    setLoading(true);
    try {
      await verifyEmailOtp(email.trim().toLowerCase(), fullOtp, fullName.trim() || undefined);
      handleRoleRedirect();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setError(detail || 'Invalid or expired OTP. Please verify the code or request a new one.');
    } finally {
      setLoading(false);
    }
  };

  // Quick auto-fill demo OTP
  const handleAutoFillDemoOtp = () => {
    if (demoOtp && demoOtp.length === 6) {
      setOtp(demoOtp.split(''));
      setError(null);
    }
  };

  // Quick Demo Account Selection
  const handleSelectDemoEmail = (demoEmail: string, demoName: string) => {
    setEmail(demoEmail);
    setFullName(demoName);
    setError(null);
    setSuccessMsg(null);
    handleSendOtp(demoEmail);
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6">
        {/* FarmQ Brand Header */}
        <div className="text-center">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-xl shadow-emerald-600/25">
            <Sprout className="w-8 h-8" />
          </div>
          <h2 className="mt-4 text-3xl font-black text-slate-900 font-heading tracking-tight">
            Sign In to Farm<span className="text-emerald-600">Q</span>
          </h2>
          <p className="mt-1.5 text-xs text-slate-500 max-w-xs mx-auto">
            Secure, password-free login via Email One-Time Password (OTP).
          </p>
        </div>

        {/* 1-Click Fast Demo Logins */}
        <div className="bg-gradient-to-r from-emerald-50 via-teal-50/50 to-slate-50 rounded-2xl p-4 border border-emerald-200/80 shadow-xs space-y-2.5">
          <div className="flex items-center justify-between text-xs font-bold text-emerald-950 uppercase tracking-wider">
            <div className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-emerald-600 fill-emerald-600" />
              <span>1-Click Fast Testing Accounts:</span>
            </div>
            <span className="text-[10px] text-emerald-700 font-medium normal-case">Demo Mode</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleSelectDemoEmail('farmer@farmq.demo', 'Surjeet Kumar')}
              disabled={loading}
              className="p-2.5 bg-white hover:bg-emerald-50 text-slate-800 hover:text-emerald-900 border border-slate-200 hover:border-emerald-300 rounded-xl text-xs font-bold shadow-xs transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer disabled:opacity-50 text-center"
            >
              <span className="flex items-center gap-1">🌾 Farmer Login</span>
              <span className="text-[10px] text-slate-500 font-normal">farmer@farmq.demo</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectDemoEmail('admin@farmq.demo', 'Vikram Singh')}
              disabled={loading}
              className="p-2.5 bg-white hover:bg-slate-50 text-slate-800 hover:text-slate-900 border border-slate-200 hover:border-slate-400 rounded-xl text-xs font-bold shadow-xs transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer disabled:opacity-50 text-center"
            >
              <span className="flex items-center gap-1">🏢 Mandi Admin</span>
              <span className="text-[10px] text-slate-500 font-normal">admin@farmq.demo</span>
            </button>
          </div>

          <div className="text-center pt-0.5">
            <button
              type="button"
              onClick={() => handleSelectDemoEmail('superadmin@farmq.demo', 'Director Admin')}
              disabled={loading}
              className="text-[11px] text-emerald-700 hover:text-emerald-900 hover:underline font-semibold cursor-pointer inline-flex items-center gap-1"
            >
              <Building className="w-3 h-3" />
              <span>or test as Super Admin (superadmin@farmq.demo)</span>
            </button>
          </div>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xl space-y-6">
          {/* Active Step Indicator */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${
                step === 'email' ? 'bg-emerald-600 text-white' : 'bg-emerald-100 text-emerald-800'
              }`}>
                1
              </div>
              <span className={`text-xs font-bold ${step === 'email' ? 'text-slate-900' : 'text-slate-400'}`}>
                Enter Email
              </span>
            </div>
            <div className="w-8 h-px bg-slate-200" />
            <div className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${
                step === 'verify' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-400'
              }`}>
                2
              </div>
              <span className={`text-xs font-bold ${step === 'verify' ? 'text-slate-900' : 'text-slate-400'}`}>
                Verify Code
              </span>
            </div>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5 animate-fadeIn">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              <div className="flex-1 font-semibold">{error}</div>
            </div>
          )}

          {/* Success Banner */}
          {successMsg && !error && (
            <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span className="font-medium">{successMsg}</span>
            </div>
          )}

          {/* ========================================================= */}
          {/* STEP 1: EMAIL ENTRY FORM                                  */}
          {/* ========================================================= */}
          {step === 'email' && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendOtp();
              }}
              className="space-y-4"
            >
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
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder="farmer@example.com"
                    autoFocus
                    required
                    className="w-full pl-10 pr-4 py-3 rounded-2xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm font-medium transition-all"
                  />
                </div>
                <p className="text-[11px] text-slate-400">
                  We'll send a 6-digit secure login code to this email. New users are automatically registered.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-500">
                  Full Name <span className="text-[10px] text-slate-400 font-normal">(Optional for new farmers)</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <UserCheck className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Surjeet Kumar"
                    className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm transition-all text-slate-800"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-2xl font-bold text-sm shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
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
          )}

          {/* ========================================================= */}
          {/* STEP 2: 6-DIGIT OTP VERIFICATION                          */}
          {/* ========================================================= */}
          {step === 'verify' && (
            <div className="space-y-5">
              {/* Recipient summary & Edit Email */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] text-slate-400">Code dispatched to:</div>
                    <div className="text-xs font-bold text-slate-800 truncate">{email}</div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setStep('email');
                    setError(null);
                    setSuccessMsg(null);
                  }}
                  className="px-2.5 py-1 text-xs text-emerald-700 hover:text-emerald-900 hover:bg-emerald-50 rounded-lg font-semibold flex items-center gap-1 transition-all cursor-pointer shrink-0"
                >
                  <Edit2 className="w-3 h-3" />
                  <span>Change</span>
                </button>
              </div>

              {/* Dev/Demo Mode helper banner with 1-click auto fill */}
              {demoOtp && (
                <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200/80 text-amber-900 flex items-center justify-between gap-2">
                  <div className="text-xs">
                    <span className="font-bold">🔑 Demo Mode Code: </span>
                    <span className="font-mono font-black text-amber-950 tracking-wider text-sm">{demoOtp}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleAutoFillDemoOtp}
                    className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Auto-fill OTP</span>
                  </button>
                </div>
              )}

              {/* 6 Individual Digit Inputs */}
              <div className="space-y-2">
                <label className="block text-center text-xs font-bold text-slate-700">
                  Enter the 6-digit code received on your email
                </label>
                <div className="flex justify-between gap-2 sm:gap-3">
                  {otp.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => {
                        otpInputsRef.current[idx] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpBoxChange(idx, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                      onPaste={handleOtpPaste}
                      className={`w-11 h-13 sm:w-12 sm:h-14 text-center text-xl sm:text-2xl font-black rounded-2xl border transition-all ${
                        digit
                          ? 'border-emerald-600 bg-emerald-50/40 text-emerald-950 ring-2 ring-emerald-500/20 shadow-sm'
                          : 'border-slate-300 bg-white text-slate-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Verify & Login Button */}
              <button
                type="button"
                onClick={() => handleVerifyOtp()}
                disabled={loading || otp.join('').length !== 6}
                className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-2xl font-bold text-sm shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Verifying Code & Logging In...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Verify OTP & Log In</span>
                  </>
                )}
              </button>

              {/* Resend OTP & Countdown */}
              <div className="text-center pt-1 text-xs text-slate-500">
                {cooldown > 0 ? (
                  <div className="flex items-center justify-center gap-1.5 text-slate-400 font-medium">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Resend code in {cooldown}s</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSendOtp()}
                    disabled={loading}
                    className="text-emerald-600 hover:text-emerald-700 font-bold hover:underline cursor-pointer inline-flex items-center gap-1"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Didn't receive code? Resend Email</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Security Assurance Footer */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
            <Lock className="w-3.5 h-3.5 text-emerald-600" />
            <span>Encrypted with SHA-256 OTP verification and JWT session tokens</span>
          </div>
        </div>

        {/* 🌾 Register as New Farmer Option */}
        <div className="bg-white rounded-3xl p-5 border border-emerald-200/90 shadow-lg text-center space-y-3">
          <div className="flex items-center justify-center gap-2 text-emerald-950 font-bold text-sm">
            <span>🌾 New to FarmQ? Register Your Farm</span>
          </div>
          <p className="text-xs text-slate-600">
            Join thousands of farmers accessing smart queue slot bookings, live mandi crop prices, and direct DBT bank payouts.
          </p>
          <Link
            to="/register"
            className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-sm shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer group"
          >
            <span className="text-lg">🌾</span>
            <span>Register as New Farmer</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        {/* Back to Home Link */}
        <div className="text-center">
          <Link
            to="/"
            className="text-xs text-slate-500 hover:text-slate-800 font-semibold transition-colors"
          >
            ← Back to FarmQ Home
          </Link>
        </div>
      </div>
    </div>
  );
};

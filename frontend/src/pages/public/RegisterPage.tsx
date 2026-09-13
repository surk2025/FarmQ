import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Sprout,
  User,
  Phone,
  Mail,
  Lock,
  Eye,
  EyeOff,
  MapPin,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  RefreshCw,
  Building,
  ShieldCheck,
  Wheat,
  Clock,
  Check
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import api from '../../services/api';

const CROPS_OPTIONS = [
  { id: 'Wheat', name: 'Wheat (गेहूं)', icon: '🌾' },
  { id: 'Rice', name: 'Paddy / Rice (धान / चावल)', icon: '🌾' },
  { id: 'Mustard', name: 'Mustard (सरसों)', icon: '🌱' },
  { id: 'Maize', name: 'Maize (मक्का)', icon: '🌽' },
  { id: 'Sugarcane', name: 'Sugarcane (गन्ना)', icon: '🎋' },
  { id: 'Potato', name: 'Potato (आलू)', icon: '🥔' },
  { id: 'Tomato', name: 'Tomato (टमाटर)', icon: '🍅' },
  { id: 'Cotton', name: 'Cotton (कपास)', icon: '☁️' }
];

export const RegisterPage: React.FC = () => {
  const { loginWithToken } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  // Multi-step: 1: Personal, 2: Farmer Details, 3: OTP Verification, 4: Bank Details, 5: Success
  const [currentStep, setCurrentStep] = useState<number>(1);

  // 1. Personal Details
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [state, setState] = useState('Haryana');
  const [district, setDistrict] = useState('Karnal');
  const [village, setVillage] = useState('Taraori');
  const [preferredLanguage, setPreferredLanguage] = useState<'en' | 'hi'>('en');

  // 2. Farmer Details
  const [farmerType, setFarmerType] = useState<string>('Small');
  const [selectedCrops, setSelectedCrops] = useState<string[]>(['Wheat', 'Rice']);
  const [landArea, setLandArea] = useState<string>('3.5');
  const [landAreaUnit, setLandAreaUnit] = useState<'acre' | 'hectare'>('acre');
  const [farmingExperience, setFarmingExperience] = useState<string>('8');
  const [farmLocation, setFarmLocation] = useState<string>('Near Taraori Mandi, Karnal');

  // 3. OTP Verification States
  const [mobileOtp, setMobileOtp] = useState('');
  const [mobileOtpSent, setMobileOtpSent] = useState(false);
  const [mobileVerified, setMobileVerified] = useState(false);
  const [mobileCooldown, setMobileCooldown] = useState(0);

  const [emailOtp, setEmailOtp] = useState('');
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [emailCooldown, setEmailCooldown] = useState(0);

  // 4. Bank Details
  const [accountHolderName, setAccountHolderName] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [confirmAccountNumber, setConfirmAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [branchName, setBranchName] = useState('');
  const [confirmedBank, setConfirmedBank] = useState(false);

  // 5. Success Registration Data
  const [registrationSuccessData, setRegistrationSuccessData] = useState<{
    name: string;
    maskedMobile: string;
    maskedEmail: string;
    maskedBank: string;
    token: string;
  } | null>(null);

  // Global UI states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  // Cooldown timers
  useEffect(() => {
    let t: any;
    if (mobileCooldown > 0) {
      t = setInterval(() => setMobileCooldown((prev) => prev - 1), 1000);
    }
    return () => clearInterval(t);
  }, [mobileCooldown]);

  useEffect(() => {
    let t: any;
    if (emailCooldown > 0) {
      t = setInterval(() => setEmailCooldown((prev) => prev - 1), 1000);
    }
    return () => clearInterval(t);
  }, [emailCooldown]);

  // Sync account holder name with farmer name automatically as a convenient default
  useEffect(() => {
    if (!accountHolderName && name) {
      setAccountHolderName(name);
    }
  }, [name]);

  // Toggle Crop Selection
  const toggleCrop = (cropId: string) => {
    setSelectedCrops((prev) =>
      prev.includes(cropId) ? prev.filter((c) => c !== cropId) : [...prev, cropId]
    );
  };

  // Step 1 Validation -> Move to Step 2
  const handleValidateStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError('Please enter your full name.');
      return;
    }
    const cleanMobile = mobile.replace(/\D/g, '');
    if (cleanMobile.length !== 10) {
      setError('Please enter a valid 10-digit Indian mobile number.');
      return;
    }
    if (!email.trim() || !email.includes('@') || !email.includes('.')) {
      setError('Please enter a valid email address.');
      return;
    }
    if (password.length < 4) {
      setError('Password must be at least 4 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setCurrentStep(2);
  };

  // Step 2 Validation -> Move to Step 3
  const handleValidateStep2 = () => {
    setError(null);
    if (selectedCrops.length === 0) {
      setError('Please select at least one main crop commodity.');
      return;
    }
    if (!landArea || parseFloat(landArea) <= 0) {
      setError('Please enter a valid farm land area.');
      return;
    }
    setCurrentStep(3);
  };

  // Mobile OTP Actions
  const handleSendMobileOtp = async () => {
    setError(null);
    setStatusNotice(null);
    const cleanMobile = mobile.replace(/\D/g, '');
    if (cleanMobile.length !== 10) {
      setError('Please enter a valid 10-digit Indian mobile number.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/auth/farmer/send-mobile-otp', {
        channel: 'mobile',
        target: cleanMobile
      });
      setMobileOtpSent(true);
      setMobileCooldown(30);
      setStatusNotice(res.data.message || 'OTP sent successfully to your mobile number.');
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to send mobile OTP. Please verify your number.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyMobileOtp = async () => {
    setError(null);
    if (!mobileOtp.trim() || mobileOtp.length !== 6) {
      setError('Please enter the 6-digit OTP received on your mobile.');
      return;
    }

    setLoading(true);
    try {
      const cleanMobile = mobile.replace(/\D/g, '');
      const res = await api.post('/auth/farmer/verify-mobile-otp', {
        channel: 'mobile',
        target: cleanMobile,
        otp: mobileOtp.trim()
      });
      setMobileVerified(true);
      setStatusNotice(res.data.message || 'Mobile number verified successfully! ✅');
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Invalid mobile OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Email OTP Actions
  const handleSendEmailOtp = async () => {
    setError(null);
    setStatusNotice(null);
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/auth/farmer/send-email-otp', {
        channel: 'email',
        target: cleanEmail
      });
      setEmailOtpSent(true);
      setEmailCooldown(30);
      setStatusNotice(res.data.message || 'Verification code sent to your email.');
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to send email OTP. Please verify your email.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyEmailOtp = async () => {
    setError(null);
    if (!emailOtp.trim() || emailOtp.length !== 6) {
      setError('Please enter the 6-digit verification code received on your email.');
      return;
    }

    setLoading(true);
    try {
      const cleanEmail = email.trim().toLowerCase();
      const res = await api.post('/auth/farmer/verify-email-otp', {
        channel: 'email',
        target: cleanEmail,
        otp: emailOtp.trim()
      });
      setEmailVerified(true);
      setStatusNotice(res.data.message || 'Email address verified successfully! ✅');
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Invalid email verification code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Step 3 Validation -> Move to Step 4
  const handleProceedToBank = () => {
    setError(null);
    if (!mobileVerified) {
      setError('Please verify your mobile number with OTP first.');
      return;
    }
    if (!emailVerified) {
      setError('Please verify your email address with OTP first.');
      return;
    }
    setCurrentStep(4);
  };

  // Step 4: Final Farmer Registration Submission
  const handleCompleteRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Bank Validations
    const cleanAcc = accountNumber.replace(/\s+/g, '');
    const cleanConfirm = confirmAccountNumber.replace(/\s+/g, '');

    if (!cleanAcc || !/^\d{6,30}$/.test(cleanAcc)) {
      setError('Please enter a valid numeric bank account number (6-30 digits).');
      return;
    }
    if (cleanAcc !== cleanConfirm) {
      setError('Bank Account Number and Confirm Account Number do not match.');
      return;
    }

    const cleanIfsc = ifscCode.trim().toUpperCase();
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(cleanIfsc)) {
      setError('Invalid Indian IFSC Code format. Example: SBIN0001234 (4 letters, 0, 6 characters).');
      return;
    }

    if (!bankName.trim()) {
      setError('Please enter your bank name.');
      return;
    }

    if (!branchName.trim()) {
      setError('Please enter your bank branch name.');
      return;
    }

    if (!confirmedBank) {
      setError('You must confirm that the bank details provided by you are correct.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name: name.trim(),
        mobile: mobile.replace(/\D/g, ''),
        email: email.trim().toLowerCase(),
        password,
        confirmPassword,
        state: state.trim(),
        district: district.trim(),
        village: village.trim(),
        preferredLanguage,
        farmerType,
        mainCrops: selectedCrops,
        landArea: parseFloat(landArea) || 1.0,
        landAreaUnit,
        farmingExperience: parseFloat(farmingExperience) || 0.0,
        farmLocation: farmLocation.trim() || undefined,
        bankDetails: {
          accountHolderName: accountHolderName.trim() || name.trim(),
          bankName: bankName.trim(),
          accountNumber: cleanAcc,
          confirmAccountNumber: cleanConfirm,
          ifscCode: cleanIfsc,
          branchName: branchName.trim(),
          confirmed: true
        }
      };

      const res = await api.post('/auth/farmer/register', payload);
      const token = res.data.access_token;
      const u = res.data.user;

      // Prepare masked success state
      const last4 = cleanAcc.slice(-4);
      const maskedBank = `XXXX XXXX ${last4}`;
      const maskedMobile = `+91 ${mobile.replace(/\D/g, '').slice(0, 2)}******${mobile.replace(/\D/g, '').slice(-2)}`;
      const cleanMail = email.trim().toLowerCase();
      const parts = cleanMail.split('@');
      const maskedEmail = parts[0].length > 2 ? `${parts[0][0]}***${parts[0].slice(-1)}@${parts[1]}` : cleanMail;

      // Save token to localStorage for immediate auto-login capability
      localStorage.setItem('farmq_token', token);
      localStorage.setItem('farmq_user', JSON.stringify(u));

      setRegistrationSuccessData({
        name: u.name,
        maskedMobile,
        maskedEmail,
        maskedBank,
        token
      });

      setCurrentStep(5);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Registration failed. Please check your details and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoToDashboard = () => {
    // Reload into dashboard with authenticated state
    window.location.href = '/farmer/dashboard';
  };

  return (
    <div className="min-h-[90vh] flex items-center justify-center py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl w-full space-y-6">
        {/* Step Progress Bar */}
        {currentStep < 5 && (
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-2">
              <span className={currentStep >= 1 ? 'text-emerald-700 font-extrabold' : ''}>1. Personal</span>
              <span className="text-slate-300">→</span>
              <span className={currentStep >= 2 ? 'text-emerald-700 font-extrabold' : ''}>2. Farm Details</span>
              <span className="text-slate-300">→</span>
              <span className={currentStep >= 3 ? 'text-emerald-700 font-extrabold' : ''}>3. OTP Verify</span>
              <span className="text-slate-300">→</span>
              <span className={currentStep >= 4 ? 'text-emerald-700 font-extrabold' : ''}>4. Bank Details</span>
            </div>
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div
                className="bg-emerald-600 h-full transition-all duration-300 rounded-full"
                style={{ width: `${(currentStep / 4) * 100}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Global Error Banner */}
        {error && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2 animate-fadeIn">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span className="font-semibold">{error}</span>
          </div>
        )}

        {/* Global Notice Banner */}
        {statusNotice && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span className="font-semibold">{statusNotice}</span>
          </div>
        )}

        {/* ================================================================= */}
        {/* STEP 1: PERSONAL DETAILS                                          */}
        {/* ================================================================= */}
        {currentStep === 1 && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xl space-y-6">
            <div className="text-center">
              <div className="mx-auto w-12 h-12 rounded-2xl bg-emerald-600 flex items-center justify-center text-white shadow-lg shadow-emerald-600/30">
                <Sprout className="w-7 h-7" />
              </div>
              <h2 className="mt-3 text-2xl font-black text-slate-900 font-heading tracking-tight">
                🌾 Register as New Farmer
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Step 1 of 4: Enter your personal contact details & account password
              </p>
            </div>

            <form onSubmit={handleValidateStep1} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Full Name *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh Kumar"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Mobile Number *
                  </label>
                  <div className="flex rounded-xl shadow-xs border border-slate-300 focus-within:ring-2 focus-within:ring-emerald-500 overflow-hidden">
                    <div className="inline-flex items-center px-3 bg-slate-50 border-r border-slate-300 text-slate-700 font-bold text-xs select-none">
                      +91
                    </div>
                    <input
                      type="tel"
                      required
                      placeholder="10-digit number"
                      maxLength={10}
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
                      className="flex-1 px-3 py-2.5 text-sm font-semibold text-slate-900 focus:outline-hidden"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Email Address *
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                    <input
                      type="email"
                      required
                      placeholder="e.g. ramesh@farmq.demo"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Create Password *
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-9 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Confirm Password *
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    State *
                  </label>
                  <input
                    type="text"
                    required
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    District *
                  </label>
                  <input
                    type="text"
                    required
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Village / City *
                  </label>
                  <input
                    type="text"
                    required
                    value={village}
                    onChange={(e) => setVillage(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Preferred Language
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPreferredLanguage('en')}
                    className={`py-2 text-xs font-bold rounded-xl border cursor-pointer transition-all ${
                      preferredLanguage === 'en'
                        ? 'bg-emerald-50 border-emerald-600 text-emerald-800 ring-1 ring-emerald-600'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    English
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreferredLanguage('hi')}
                    className={`py-2 text-xs font-bold rounded-xl border cursor-pointer transition-all ${
                      preferredLanguage === 'hi'
                        ? 'bg-emerald-50 border-emerald-600 text-emerald-800 ring-1 ring-emerald-600'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    हिन्दी (Hindi)
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full mt-3 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Continue to Farm Details</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            <div className="text-center pt-2 border-t border-slate-100 text-xs text-slate-500">
              Already registered?{' '}
              <Link to="/login" className="font-bold text-emerald-700 hover:underline">
                Sign In to FarmQ
              </Link>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* STEP 2: FARMER DETAILS                                            */}
        {/* ================================================================= */}
        {currentStep === 2 && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xl space-y-6 animate-fadeIn">
            <div>
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 font-semibold mb-3 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Personal Details</span>
              </button>
              <h2 className="text-2xl font-black text-slate-900 font-heading tracking-tight">
                🌾 Farm & Agricultural Details
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Step 2 of 4: Tell us about your farming scale and crop commodities
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Farmer Category
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {['Marginal (< 1 ha)', 'Small (1-2 ha)', 'Medium (2-10 ha)', 'Large (> 10 ha)'].map((t) => {
                    const cleanType = t.split(' ')[0];
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setFarmerType(cleanType)}
                        className={`p-2.5 rounded-xl border text-xs font-bold text-center cursor-pointer transition-all ${
                          farmerType === cleanType
                            ? 'bg-emerald-50 border-emerald-600 text-emerald-900 ring-1 ring-emerald-600'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Main Crop(s) Grown *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {CROPS_OPTIONS.map((c) => {
                    const isSelected = selectedCrops.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => toggleCrop(c.id)}
                        className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-between cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-emerald-50 border-emerald-600 text-emerald-900 ring-1 ring-emerald-600 shadow-xs'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <span className="truncate">{c.icon} {c.id}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Cultivated Land Area *
                  </label>
                  <div className="flex rounded-xl shadow-xs border border-slate-300 overflow-hidden">
                    <input
                      type="number"
                      step="0.1"
                      required
                      value={landArea}
                      onChange={(e) => setLandArea(e.target.value)}
                      className="flex-1 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:outline-hidden"
                    />
                    <div className="flex bg-slate-50 border-l border-slate-300">
                      <button
                        type="button"
                        onClick={() => setLandAreaUnit('acre')}
                        className={`px-3 py-2 text-xs font-bold cursor-pointer ${
                          landAreaUnit === 'acre' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        Acre
                      </button>
                      <button
                        type="button"
                        onClick={() => setLandAreaUnit('hectare')}
                        className={`px-3 py-2 text-xs font-bold cursor-pointer ${
                          landAreaUnit === 'hectare' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        Hectare
                      </button>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Farming Experience (Years)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={farmingExperience}
                    onChange={(e) => setFarmingExperience(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Farm Location / Landmark (Optional)
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    placeholder="e.g. Near Taraori Weighbridge / Khasra No. 142"
                    value={farmLocation}
                    onChange={(e) => setFarmLocation(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleValidateStep2}
                className="w-full mt-3 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Continue to OTP Verification</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* STEP 3: DUAL OTP VERIFICATION (MOBILE & EMAIL)                     */}
        {/* ================================================================= */}
        {currentStep === 3 && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xl space-y-6 animate-fadeIn">
            <div>
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 font-semibold mb-3 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Farm Details</span>
              </button>
              <h2 className="text-2xl font-black text-slate-900 font-heading tracking-tight">
                🔒 Security & OTP Verification
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Step 3 of 4: Verify your mobile number and email address. Codes are securely dispatched via SMS & Email.
              </p>
            </div>

            {/* Mobile OTP Card */}
            <div className={`p-5 rounded-2xl border transition-all ${mobileVerified ? 'bg-emerald-50/60 border-emerald-300' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${mobileVerified ? 'bg-emerald-600 text-white' : 'bg-emerald-100 text-emerald-700'}`}>
                    <Phone className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">Mobile Verification (+91 {mobile})</div>
                    <div className="text-[11px] text-slate-500">6-digit SMS verification code</div>
                  </div>
                </div>

                {mobileVerified ? (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Verified</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={loading || mobileCooldown > 0}
                    onClick={handleSendMobileOtp}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    {mobileOtpSent ? (mobileCooldown > 0 ? `Resend (${mobileCooldown}s)` : 'Resend SMS') : 'Send Mobile OTP'}
                  </button>
                )}
              </div>

              {!mobileVerified && mobileOtpSent && (
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-200">
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="Enter 6-digit Mobile OTP"
                    value={mobileOtp}
                    onChange={(e) => setMobileOtp(e.target.value.replace(/\D/g, ''))}
                    className="flex-1 px-3 py-2 bg-white rounded-xl border border-slate-300 text-sm font-bold tracking-widest text-center focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    disabled={loading || mobileOtp.length !== 6}
                    onClick={handleVerifyMobileOtp}
                    className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                  >
                    Verify Mobile
                  </button>
                </div>
              )}
            </div>

            {/* Email OTP Card */}
            <div className={`p-5 rounded-2xl border transition-all ${emailVerified ? 'bg-emerald-50/60 border-emerald-300' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${emailVerified ? 'bg-emerald-600 text-white' : 'bg-emerald-100 text-emerald-700'}`}>
                    <Mail className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">Email Verification ({email})</div>
                    <div className="text-[11px] text-slate-500">6-digit email confirmation code via SMTP</div>
                  </div>
                </div>

                {emailVerified ? (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Verified</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={loading || emailCooldown > 0}
                    onClick={handleSendEmailOtp}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    {emailOtpSent ? (emailCooldown > 0 ? `Resend (${emailCooldown}s)` : 'Resend Email') : 'Send Email OTP'}
                  </button>
                )}
              </div>

              {!emailVerified && emailOtpSent && (
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-200">
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="Enter 6-digit Email OTP"
                    value={emailOtp}
                    onChange={(e) => setEmailOtp(e.target.value.replace(/\D/g, ''))}
                    className="flex-1 px-3 py-2 bg-white rounded-xl border border-slate-300 text-sm font-bold tracking-widest text-center focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    disabled={loading || emailOtp.length !== 6}
                    onClick={handleVerifyEmailOtp}
                    className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                  >
                    Verify Email
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              disabled={!mobileVerified || !emailVerified}
              onClick={handleProceedToBank}
              className="w-full mt-3 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span>Continue to Bank Details</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ================================================================= */}
        {/* STEP 4: BANK DETAILS                                              */}
        {/* ================================================================= */}
        {currentStep === 4 && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xl space-y-6 animate-fadeIn">
            <div>
              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 font-semibold mb-3 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Verification</span>
              </button>
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                  🏦
                </div>
                <div>
                  <h2 className="text-2xl font-black text-slate-900 font-heading tracking-tight">
                    Bank Details for DBT Payouts
                  </h2>
                  <p className="text-xs text-slate-500">
                    Step 4 of 4: Direct procurement payouts will be disbursed to this bank account
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleCompleteRegistration} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Account Holder Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="As per bank passbook"
                    value={accountHolderName}
                    onChange={(e) => setAccountHolderName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Bank Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. State Bank of India"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Account Number *
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    required
                    placeholder="Numeric bank account"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Confirm Account Number *
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    placeholder="Re-enter bank account"
                    value={confirmAccountNumber}
                    onChange={(e) => setConfirmAccountNumber(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    IFSC Code *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={11}
                    placeholder="e.g. SBIN0001234"
                    value={ifscCode}
                    onChange={(e) => setIfscCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono uppercase focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">11-character code (SBIN0001234)</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Branch Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Taraori Mandi Branch"
                    value={branchName}
                    onChange={(e) => setBranchName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Mandatory Confirmation Checkbox */}
              <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 text-slate-800">
                <label className="flex items-start gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={confirmedBank}
                    onChange={(e) => setConfirmedBank(e.target.checked)}
                    className="mt-1 w-4 h-4 rounded-md border-amber-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                  <span className="text-xs font-semibold leading-relaxed">
                    ☑ I confirm that the bank details provided by me are correct. I understand that government MSP and procurement sale proceeds will be directly transferred to this account.
                  </span>
                </label>
              </div>

              <button
                type="submit"
                disabled={loading || !confirmedBank}
                className="w-full mt-3 py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-sm shadow-md shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Activating Farmer Account...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Complete Farmer Registration</span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* ================================================================= */}
        {/* STEP 5: REGISTRATION SUCCESS SCREEN                               */}
        {/* ================================================================= */}
        {currentStep === 5 && registrationSuccessData && (
          <div className="bg-white rounded-3xl p-8 border border-emerald-300 shadow-2xl space-y-6 text-center animate-fadeIn">
            <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-4xl shadow-xl shadow-emerald-600/30 animate-bounce">
              🎉
            </div>

            <div>
              <h2 className="text-3xl font-black text-slate-900 font-heading">
                Registration Successful!
              </h2>
              <p className="text-sm font-semibold text-emerald-700 mt-1">
                Welcome to FarmQ, {registrationSuccessData.name}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Your farmer account has been created and verified successfully.
              </p>
            </div>

            {/* Masked Summary Card */}
            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 text-left space-y-3 max-w-md mx-auto text-xs">
              <div className="flex justify-between py-1 border-b border-slate-200/80">
                <span className="text-slate-500">Email:</span>
                <span className="font-mono font-bold text-slate-800">{registrationSuccessData.maskedEmail}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200/80">
                <span className="text-slate-500">Mobile:</span>
                <span className="font-mono font-bold text-slate-800">{registrationSuccessData.maskedMobile}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Bank Account:</span>
                <span className="font-mono font-bold text-emerald-800">{registrationSuccessData.maskedBank}</span>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleGoToDashboard}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-base shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Go to Farmer Dashboard</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

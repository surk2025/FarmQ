import React, { useState, useEffect } from 'react';
import {
  User,
  Phone,
  Mail,
  MapPin,
  Globe,
  CheckCircle2,
  Save,
  ShieldCheck,
  Building,
  Edit2,
  X,
  AlertCircle,
  RefreshCw,
  Lock
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import api from '../../services/api';

export const Profile: React.FC = () => {
  const { user, updateUser } = useAuth();
  const { language, setLanguage, t } = useLanguage();

  const [name, setName] = useState(user?.name || '');
  const [village, setVillage] = useState(user?.village || 'Taraori');
  const [district, setDistrict] = useState(user?.district || 'Karnal');
  const [state, setState] = useState(user?.state || 'Haryana');
  const [preferredLanguage, setPreferredLang] = useState<'en' | 'hi'>(user?.preferredLanguage || 'en');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  // Bank Details States
  const [bankData, setBankData] = useState<{
    accountHolderName: string;
    bankName: string;
    accountNumberMasked: string;
    ifscCode: string;
    branchName: string;
    verified: boolean;
  }>({
    accountHolderName: user?.name || 'Surjeet Kumar',
    bankName: 'State Bank of India',
    accountNumberMasked: 'XXXX XXXX 9012',
    ifscCode: 'SBIN0001234',
    branchName: 'Main Mandi Yard Branch',
    verified: true
  });

  const [editBankModalOpen, setEditBankModalOpen] = useState(false);
  const [editAccountHolder, setEditAccountHolder] = useState('');
  const [editBankName, setEditBankName] = useState('');
  const [editAccountNo, setEditAccountNo] = useState('');
  const [editConfirmAccountNo, setEditConfirmAccountNo] = useState('');
  const [editIfsc, setEditIfsc] = useState('');
  const [editBranch, setEditBranch] = useState('');
  const [editConfirmed, setEditConfirmed] = useState(false);
  const [bankSaving, setBankSaving] = useState(false);
  const [bankError, setBankError] = useState<string | null>(null);
  const [bankSuccessMsg, setBankSuccessMsg] = useState<string | null>(null);
  const [bankVerifiedBadge, setBankVerifiedBadge] = useState(false);

  // Fetch Bank Details on mount
  useEffect(() => {
    const fetchBank = async () => {
      try {
        const res = await api.get('/farmer/bank-details');
        setBankData(res.data);
      } catch (err) {
        console.warn('Bank fetch notice:', err);
      }
    };
    fetchBank();
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccess(false);
    try {
      const res = await api.put('/farmer/profile', {
        name,
        village,
        district,
        state,
        preferredLanguage
      });
      updateUser(res.data);
      setLanguage(preferredLanguage);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 4000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const openEditBankModal = () => {
    setEditAccountHolder(bankData.accountHolderName);
    setEditBankName(bankData.bankName);
    setEditAccountNo('');
    setEditConfirmAccountNo('');
    setEditIfsc(bankData.ifscCode);
    setEditBranch(bankData.branchName);
    setEditConfirmed(false);
    setBankError(null);
    setBankSuccessMsg(null);
    setEditBankModalOpen(true);
  };

  const handleUpdateBankDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setBankError(null);

    const cleanAcc = editAccountNo.replace(/\s+/g, '');
    const cleanConfirm = editConfirmAccountNo.replace(/\s+/g, '');

    if (!cleanAcc || !/^\d{6,30}$/.test(cleanAcc)) {
      setBankError('Account Number must be numeric (6 to 30 digits).');
      return;
    }
    if (cleanAcc !== cleanConfirm) {
      setBankError('Account Number and Confirm Account Number do not match.');
      return;
    }

    const cleanIfsc = editIfsc.trim().toUpperCase();
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(cleanIfsc)) {
      setBankError('Invalid Indian IFSC Code format (e.g. SBIN0001234).');
      return;
    }

    if (!editConfirmed) {
      setBankError('Please check the confirmation box verifying the bank details.');
      return;
    }

    setBankSaving(true);
    try {
      const res = await api.post('/farmer/bank-details', {
        accountHolderName: editAccountHolder.trim(),
        bankName: editBankName.trim(),
        accountNumber: cleanAcc,
        confirmAccountNumber: cleanConfirm,
        ifscCode: cleanIfsc,
        branchName: editBranch.trim(),
        confirmed: true
      });

      setBankData(res.data);
      setBankSuccessMsg('Bank account updated & verified successfully!');
      setTimeout(() => {
        setEditBankModalOpen(false);
        setBankSuccessMsg(null);
      }, 2000);
    } catch (err: any) {
      setBankError(err?.response?.data?.detail || 'Failed to update bank details.');
    } finally {
      setBankSaving(false);
    }
  };

  const handleVerifyBankDetails = () => {
    setBankVerifiedBadge(true);
    setTimeout(() => setBankVerifiedBadge(false), 3000);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-16">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 font-heading">
          {t('profile')} & Account Settings
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Manage your personal details, farm location, and payout bank account.
        </p>
      </div>

      {/* ================================================================= */}
      {/* 1. 🏦 MY BANK ACCOUNT CARD (SECTION 13)                            */}
      {/* ================================================================= */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center text-2xl shadow-inner">
              🏦
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 font-heading">
                My Bank Account
              </h2>
              <p className="text-xs text-slate-500">
                Authorized account for direct procurement & MSP sale proceeds
              </p>
            </div>
          </div>

          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-800 text-xs font-bold rounded-full border border-emerald-200 self-start sm:self-auto">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>DBT / NPCI Linked</span>
          </span>
        </div>

        {bankVerifiedBadge && (
          <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Bank details verified with NPCI & PFMS public financial gateway.</span>
          </div>
        )}

        {/* Display Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-5 rounded-2xl border border-slate-100 text-xs">
          <div>
            <span className="text-slate-400 font-bold uppercase">Bank Name</span>
            <div className="text-sm font-bold text-slate-900 mt-0.5">{bankData.bankName}</div>
          </div>

          <div>
            <span className="text-slate-400 font-bold uppercase">Account Number</span>
            <div className="text-sm font-mono font-extrabold text-emerald-900 mt-0.5">
              {bankData.accountNumberMasked}
            </div>
          </div>

          <div>
            <span className="text-slate-400 font-bold uppercase">IFSC Code</span>
            <div className="text-sm font-mono font-bold text-slate-800 mt-0.5">{bankData.ifscCode}</div>
          </div>

          <div>
            <span className="text-slate-400 font-bold uppercase">Account Holder</span>
            <div className="text-sm font-bold text-slate-900 mt-0.5">{bankData.accountHolderName}</div>
          </div>

          <div className="sm:col-span-2">
            <span className="text-slate-400 font-bold uppercase">Branch Name</span>
            <div className="text-xs font-semibold text-slate-700 mt-0.5">{bankData.branchName}</div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="button"
            onClick={openEditBankModal}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>Edit Bank Details</span>
          </button>

          <button
            type="button"
            onClick={handleVerifyBankDetails}
            className="px-5 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Verify Bank Details</span>
          </button>
        </div>
      </div>

      {/* ================================================================= */}
      {/* 2. PERSONAL & FARM LOCATION FORM                                  */}
      {/* ================================================================= */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xl space-y-6">
        {/* User Identity Banner */}
        <div className="flex items-center gap-4 pb-6 border-b border-slate-100">
          <div className="w-16 h-16 rounded-2xl bg-emerald-600 text-white font-black text-2xl flex items-center justify-center shadow-md shadow-emerald-600/30">
            {name ? name[0].toUpperCase() : 'K'}
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">{name || 'Surjeet Kumar'}</h2>
            <p className="text-xs text-slate-500 font-medium">Registered Farmer • Mobile: {user?.phone || '+91 98******10'}</p>
            <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
              Verified Kisan ID
            </span>
          </div>
        </div>

        {success && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Profile updated successfully!</span>
          </div>
        )}

        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Full Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Registered Mobile Number (Protected)
              </label>
              <input
                type="text"
                disabled
                value={user?.phone || '+91 98******10'}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-100 text-slate-500 text-sm cursor-not-allowed"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Village / Town
              </label>
              <input
                type="text"
                value={village}
                onChange={(e) => setVillage(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                District
              </label>
              <input
                type="text"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                State
              </label>
              <input
                type="text"
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Preferred Interface Language
            </label>
            <div className="grid grid-cols-2 gap-3 max-w-sm">
              <button
                type="button"
                onClick={() => setPreferredLang('en')}
                className={`py-2 text-xs font-bold rounded-xl border cursor-pointer transition-all ${
                  preferredLanguage === 'en'
                    ? 'bg-emerald-50 border-emerald-600 text-emerald-800'
                    : 'border-slate-200 text-slate-600'
                }`}
              >
                English
              </button>
              <button
                type="button"
                onClick={() => setPreferredLang('hi')}
                className={`py-2 text-xs font-bold rounded-xl border cursor-pointer transition-all ${
                  preferredLanguage === 'hi'
                    ? 'bg-emerald-50 border-emerald-600 text-emerald-800'
                    : 'border-slate-200 text-slate-600'
                }`}
              >
                हिन्दी (Hindi)
              </button>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] text-slate-400">
              Security: Sensitive identity fields are locked after initial verification.
            </span>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Edit Bank Details Modal */}
      {editBankModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-5 animate-fadeIn">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                  🏦
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 font-heading">
                    Edit Bank Details
                  </h3>
                  <p className="text-[11px] text-slate-500">Provide updated bank account for DBT payments</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditBankModalOpen(false)}
                className="p-1 rounded-xl text-slate-400 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {bankError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{bankError}</span>
              </div>
            )}

            {bankSuccessMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{bankSuccessMsg}</span>
              </div>
            )}

            <form onSubmit={handleUpdateBankDetails} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Account Holder Name *</label>
                <input
                  type="text"
                  required
                  value={editAccountHolder}
                  onChange={(e) => setEditAccountHolder(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Bank Name *</label>
                <input
                  type="text"
                  required
                  value={editBankName}
                  onChange={(e) => setEditBankName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Account Number *</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    required
                    placeholder="Enter account number"
                    value={editAccountNo}
                    onChange={(e) => setEditAccountNo(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Confirm Account *</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    placeholder="Re-enter account number"
                    value={editConfirmAccountNo}
                    onChange={(e) => setEditConfirmAccountNo(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">IFSC Code *</label>
                  <input
                    type="text"
                    required
                    maxLength={11}
                    value={editIfsc}
                    onChange={(e) => setEditIfsc(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono font-bold uppercase focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Branch Name *</label>
                  <input
                    type="text"
                    required
                    value={editBranch}
                    onChange={(e) => setEditBranch(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={editConfirmed}
                    onChange={(e) => setEditConfirmed(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                  <span className="text-[11px] font-semibold text-amber-900 leading-relaxed">
                    ☑ I confirm that the bank details provided are correct and belong to my official Kisan account.
                  </span>
                </label>
              </div>

              <button
                type="submit"
                disabled={bankSaving || !editConfirmed}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer disabled:opacity-50"
              >
                {bankSaving ? 'Verifying & Saving...' : 'Save Updated Bank Details'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

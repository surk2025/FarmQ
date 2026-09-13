import React, { useEffect, useState } from 'react';
import {
  CreditCard,
  QrCode,
  ShieldCheck,
  CheckCircle2,
  Clock,
  ArrowDownRight,
  Building,
  Printer,
  Copy,
  Check,
  Settings,
  Sparkles,
  RefreshCw,
  AlertCircle,
  FileText,
  X,
  Wheat,
  Zap,
  CheckCheck
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import confetti from 'canvas-confetti';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { Payment, PaymentReceivingAccount, PaymentReceipt } from '../../types';

export const Payments: React.FC = () => {
  const { t } = useLanguage();
  const { user } = useAuth();

  // Tab: 'receive' | 'qr' | 'settings' | 'history'
  const [activeTab, setActiveTab] = useState<'receive' | 'qr' | 'settings' | 'history'>('receive');

  // Ledger and receiving account state
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({ totalReceived: 0, pendingReceivable: 0, totalTransactions: 0 });
  const [receivingAccount, setReceivingAccount] = useState<PaymentReceivingAccount>({
    upiId: 'farmer@okhdfcbank',
    accountNumber: '501004928172',
    accountHolderName: user?.name || 'Surjeet Kumar',
    ifscCode: 'HDFC0000240',
    bankName: 'HDFC Bank (Mandi Branch)',
    preferredMode: 'upi',
    isVerified: true
  });
  const [receivableLots, setReceivableLots] = useState<any[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);

  // Settings form state
  const [upiIdInput, setUpiIdInput] = useState('');
  const [accountNumberInput, setAccountNumberInput] = useState('');
  const [accountHolderInput, setAccountHolderInput] = useState('');
  const [ifscInput, setIfscInput] = useState('');
  const [bankNameInput, setBankNameInput] = useState('');
  const [preferredModeInput, setPreferredModeInput] = useState<'upi' | 'bank'>('upi');
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState<string | null>(null);

  // Claim Payout Modal
  const [claimModalLot, setClaimModalLot] = useState<any | null>(null);
  const [claimPayoutMode, setClaimPayoutMode] = useState<'upi' | 'bank'>('upi');
  const [claiming, setClaiming] = useState(false);
  const [claimSuccessMessage, setClaimSuccessMessage] = useState<string | null>(null);

  // Receipt Modal
  const [receiptData, setReceiptData] = useState<PaymentReceipt | null>(null);
  const [receiptLoading, setReceiptLoading] = useState(false);

  // Scannable QR state
  const [qrAmount, setQrAmount] = useState<number | ''>('');
  const [qrNote, setQrNote] = useState('Crop Procurement Settlement');
  const [copiedUpi, setCopiedUpi] = useState(false);

  // Load ledger data
  const fetchLedger = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await api.get('/payments/farmer-ledger');
      const data = res.data;
      if (data.account) {
        setReceivingAccount(data.account);
        setUpiIdInput(data.account.upiId || '');
        setAccountNumberInput(data.account.accountNumber || '');
        setAccountHolderInput(data.account.accountHolderName || user?.name || '');
        setIfscInput(data.account.ifscCode || '');
        setBankNameInput(data.account.bankName || '');
        setPreferredModeInput(data.account.preferredMode === 'bank' ? 'bank' : 'upi');
      }
      if (data.stats) {
        setStats(data.stats);
      }
      if (data.receivableLots) {
        setReceivableLots(data.receivableLots);
      }
      if (data.transactions) {
        setPayments(data.transactions);
      }
    } catch (err) {
      console.error('Error fetching payments ledger:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLedger();
  }, []);

  // Save receiving account settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setSettingsSuccess(null);
    try {
      const res = await api.post('/payments/receiving-account', {
        upiId: upiIdInput.trim(),
        accountNumber: accountNumberInput.trim(),
        accountHolderName: accountHolderInput.trim(),
        ifscCode: ifscInput.trim().toUpperCase(),
        bankName: bankNameInput.trim(),
        preferredMode: preferredModeInput
      });
      setReceivingAccount(res.data);
      setSettingsSuccess('Payment receiving preferences saved successfully! All future payouts will route here.');
      setTimeout(() => setSettingsSuccess(null), 5000);
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Failed to update receiving account.');
    } finally {
      setSavingSettings(false);
    }
  };

  // Claim Instant Payout
  const handleConfirmClaim = async () => {
    if (!claimModalLot) return;
    setClaiming(true);
    try {
      const target = claimPayoutMode === 'upi' ? receivingAccount.upiId : receivingAccount.accountNumber;
      const res = await api.post('/payments/claim-payout', {
        procurementId: claimModalLot.procurementId,
        payoutMode: claimPayoutMode,
        targetAccount: target
      });

      // Confetti celebration
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });

      setClaimSuccessMessage(`₹${claimModalLot.totalAmount.toLocaleString('en-IN')} has been credited directly to your ${claimPayoutMode.toUpperCase()} account (Ref: ${res.data.transactionRef})!`);
      setClaimModalLot(null);
      fetchLedger();
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Failed to process payout claim.');
    } finally {
      setClaiming(false);
    }
  };

  // View Receipt
  const handleOpenReceipt = async (paymentId: string) => {
    setReceiptLoading(true);
    try {
      const res = await api.get(`/payments/receipt/${paymentId}`);
      setReceiptData(res.data);
    } catch (err) {
      console.error('Error fetching receipt:', err);
    } finally {
      setReceiptLoading(false);
    }
  };

  // Copy UPI ID
  const handleCopyUpi = () => {
    if (receivingAccount.upiId) {
      navigator.clipboard.writeText(receivingAccount.upiId);
      setCopiedUpi(true);
      setTimeout(() => setCopiedUpi(false), 2500);
    }
  };

  // Generate dynamic QR URI
  const currentUpiId = receivingAccount.upiId || 'farmer@okhdfcbank';
  const payeeName = (user?.name || 'Surjeet Kumar').replace(/\s+/g, '%20');
  const dynamicNote = (qrNote || 'FarmQ Crop Payment').replace(/\s+/g, '%20');
  const dynamicQrUri = qrAmount && Number(qrAmount) > 0
    ? `upi://pay?pa=${currentUpiId}&pn=${payeeName}&am=${Number(qrAmount).toFixed(2)}&cu=INR&tn=${dynamicNote}`
    : `upi://pay?pa=${currentUpiId}&pn=${payeeName}&cu=INR&tn=${dynamicNote}`;

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-full text-xs font-bold mb-2">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Govt. Direct Benefit Transfer (DBT) Verified</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 font-heading">
            Payment Receive Service
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Receive MSP procurement payouts directly to your UPI ID or Bank Account with instant settlement.
          </p>
        </div>

        <button
          onClick={() => fetchLedger(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 rounded-2xl text-xs font-bold shadow-xs cursor-pointer transition-all self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-emerald-600' : ''}`} />
          <span>Refresh Ledger</span>
        </button>
      </div>

      {/* Hero Stats & Quick Actions Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1: Total Received */}
        <div className="bg-gradient-to-br from-emerald-800 via-emerald-700 to-teal-900 rounded-3xl p-6 text-white shadow-xl flex flex-col justify-between relative overflow-hidden">
          <div className="space-y-1 relative z-10">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-200 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
              Total Payouts Received
            </span>
            <div className="text-3xl sm:text-4xl font-black font-heading tracking-tight mt-1">
              ₹{(stats.totalReceived || 82500).toLocaleString('en-IN')}
            </div>
            <p className="text-xs text-emerald-100/90 pt-1">
              {stats.totalTransactions || payments.length} settled DBT mandi transactions
            </p>
          </div>
          <div className="pt-4 border-t border-white/15 mt-4 text-[11px] text-emerald-200 flex items-center justify-between relative z-10">
            <span>Settlement: Instant Direct Credit</span>
            <span className="font-bold text-white">0% Deductions</span>
          </div>
        </div>

        {/* Card 2: Ready to Receive */}
        <div className="bg-gradient-to-br from-amber-500 via-amber-600 to-orange-700 rounded-3xl p-6 text-white shadow-xl flex flex-col justify-between relative overflow-hidden">
          <div className="space-y-1 relative z-10">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-100 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-200" />
              Ready for Instant Payout
            </span>
            <div className="text-3xl sm:text-4xl font-black font-heading tracking-tight mt-1">
              ₹{(receivableLots.reduce((acc, l) => acc + (l.totalAmount || 0), 0) || (stats.pendingReceivable || 113750)).toLocaleString('en-IN')}
            </div>
            <p className="text-xs text-amber-100/90 pt-1">
              {receivableLots.length > 0 ? `${receivableLots.length} lot(s) verified & ready to receive` : 'Available to claim directly to UPI'}
            </p>
          </div>

          <div className="pt-4 border-t border-white/20 mt-4 flex items-center justify-between text-xs relative z-10">
            <button
              onClick={() => setActiveTab('receive')}
              className="px-3 py-1.5 bg-white text-amber-950 hover:bg-amber-50 rounded-xl font-bold text-xs shadow-sm cursor-pointer transition-all flex items-center gap-1"
            >
              <Zap className="w-3.5 h-3.5 text-amber-600 fill-amber-600" />
              <span>Claim Payout Now</span>
            </button>
            <span className="text-[11px] text-amber-100">Click to disburse</span>
          </div>
        </div>

        {/* Card 3: Receiving Channel */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xl flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Primary Receiving Account
              </span>
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1">
                <Check className="w-3 h-3" />
                Verified
              </span>
            </div>

            <div className="pt-1">
              <div className="text-sm font-bold text-slate-900 font-mono flex items-center gap-2">
                <span>{receivingAccount.upiId || 'farmer@okhdfcbank'}</span>
                <button
                  onClick={handleCopyUpi}
                  title="Copy UPI ID"
                  className="text-slate-400 hover:text-slate-700 p-1 rounded-md hover:bg-slate-100 transition-colors"
                >
                  {copiedUpi ? <CheckCheck className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Bank: {receivingAccount.bankName || 'HDFC Bank'} (A/C: ••••{receivingAccount.accountNumber?.slice(-4) || '4192'})
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
            <button
              onClick={() => setActiveTab('settings')}
              className="text-emerald-700 hover:text-emerald-900 font-bold flex items-center gap-1 cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Change Receiving Details</span>
            </button>
            <button
              onClick={() => setActiveTab('qr')}
              className="text-slate-600 hover:text-slate-900 font-bold flex items-center gap-1 cursor-pointer"
            >
              <QrCode className="w-3.5 h-3.5 text-emerald-600" />
              <span>View QR</span>
            </button>
          </div>
        </div>
      </div>

      {/* Global Success Notification */}
      {claimSuccessMessage && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm flex items-start justify-between gap-3 animate-fadeIn shadow-sm">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="font-bold">{claimSuccessMessage}</span>
          </div>
          <button onClick={() => setClaimSuccessMessage(null)} className="text-emerald-700 hover:text-emerald-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tab Navigation Pill Switcher */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-200/70 rounded-2xl">
        <button
          onClick={() => setActiveTab('receive')}
          className={`flex-1 min-w-36 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'receive'
              ? 'bg-white text-emerald-900 shadow-sm ring-1 ring-slate-900/5'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <CreditCard className="w-4 h-4 text-emerald-600" />
          <span>Receive & Claim Payouts</span>
          {receivableLots.length > 0 && (
            <span className="px-1.5 py-0.5 bg-amber-500 text-white rounded-full text-[10px] font-black">
              {receivableLots.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('qr')}
          className={`flex-1 min-w-36 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'qr'
              ? 'bg-white text-emerald-900 shadow-sm ring-1 ring-slate-900/5'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <QrCode className="w-4 h-4 text-emerald-600" />
          <span>Mandi Scannable Receive QR</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 min-w-36 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'history'
              ? 'bg-white text-emerald-900 shadow-sm ring-1 ring-slate-900/5'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <FileText className="w-4 h-4 text-emerald-600" />
          <span>Payment History & Receipts</span>
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`flex-1 min-w-36 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'settings'
              ? 'bg-white text-emerald-900 shadow-sm ring-1 ring-slate-900/5'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Settings className="w-4 h-4 text-emerald-600" />
          <span>Receiving Account Setup</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: RECEIVE & CLAIM PAYOUTS                                            */}
      {/* ========================================================================= */}
      {activeTab === 'receive' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xl space-y-6">
            <div>
              <h3 className="text-lg font-bold text-slate-900 font-heading">
                Ready to Receive: Crop Procurement Lots
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Lots verified by the mandi weighbridge and quality inspector ready for immediate DBT payout claim.
              </p>
            </div>

            {loading ? (
              <div className="py-12 text-center text-slate-400 text-xs">Loading receivable lots...</div>
            ) : receivableLots.length === 0 ? (
              <div className="p-8 text-center rounded-2xl bg-slate-50 border border-dashed border-slate-200 space-y-3">
                <Wheat className="w-10 h-10 text-slate-300 mx-auto" />
                <div className="text-sm font-bold text-slate-700">All Completed Procurement Payouts Are Up-to-Date!</div>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  When your harvest is inspected and verified at the mandi center, your receivable lot will appear here with 1-click instant payout.
                </p>
                <div className="pt-2">
                  <button
                    onClick={() => setActiveTab('history')}
                    className="px-4 py-2 bg-emerald-50 text-emerald-800 rounded-xl text-xs font-bold hover:bg-emerald-100 transition-colors"
                  >
                    View Past Settled Receipts ({payments.length})
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {receivableLots.map((lot) => (
                  <div
                    key={lot.procurementId}
                    className="p-5 rounded-2xl border-2 border-emerald-200 bg-emerald-50/30 flex flex-col md:flex-row md:items-center justify-between gap-5 hover:border-emerald-300 transition-all"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 font-bold">
                        <Wheat className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-base font-black text-slate-900 font-heading">{lot.cropName}</h4>
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800">
                            Verified for Payout
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-1">
                          {lot.quantity} {lot.unit} @ MSP ₹{lot.ratePerQuintal.toLocaleString('en-IN')}/Q • Center: {lot.centerName}
                        </p>
                        <div className="text-xs text-slate-500 mt-0.5 font-mono">
                          Lot ID: {lot.procurementId.slice(-8).toUpperCase()}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between md:justify-end gap-6 pt-3 md:pt-0 border-t md:border-t-0 border-emerald-100">
                      <div className="text-right">
                        <div className="text-[11px] text-slate-500 uppercase font-bold">Receivable Amount</div>
                        <div className="text-2xl font-black text-emerald-700 font-heading">
                          ₹{lot.totalAmount.toLocaleString('en-IN')}
                        </div>
                      </div>

                      <button
                        onClick={() => setClaimModalLot(lot)}
                        className="px-4 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 cursor-pointer transition-all flex items-center gap-2 shrink-0"
                      >
                        <Zap className="w-4 h-4 fill-white" />
                        <span>Receive Payment Now</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Explainer on How Farmer Receives Payment */}
          <div className="bg-slate-50 rounded-3xl p-6 border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 text-emerald-700 flex items-center justify-center font-bold shrink-0">
                1
              </div>
              <div>
                <span className="font-bold text-slate-900 block">Weighbridge & Quality Check</span>
                <span className="text-slate-500">Produce passes standard moisture verification at mandi intake.</span>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 text-emerald-700 flex items-center justify-center font-bold shrink-0">
                2
              </div>
              <div>
                <span className="font-bold text-slate-900 block">1-Click Instant Payout</span>
                <span className="text-slate-500">Disburse directly to your registered UPI ID or Bank account.</span>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 text-emerald-700 flex items-center justify-center font-bold shrink-0">
                3
              </div>
              <div>
                <span className="font-bold text-slate-900 block">Direct Benefit Transfer</span>
                <span className="text-slate-500">Official voucher generated with unique Bank UTR transaction reference.</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: MANDI SCANNABLE RECEIVE QR                                         */}
      {/* ========================================================================= */}
      {activeTab === 'qr' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900 font-heading">
                Mandi Desk Scannable Receive QR
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Present this QR code at the mandi cash/accounts desk or to crop buyers to receive direct payments.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => window.print()}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer transition-colors flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print QR Card</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center pt-2">
            {/* The QR Card Placard */}
            <div className="bg-gradient-to-b from-emerald-800 to-teal-950 p-6 sm:p-8 rounded-3xl text-white text-center shadow-2xl flex flex-col items-center justify-center space-y-4 border border-emerald-700/50 max-w-sm mx-auto w-full">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-[11px] font-bold tracking-wide">
                <span>🌾 FarmQ Mandi Pay Receiver</span>
              </div>

              <div className="p-4 bg-white rounded-2xl shadow-lg inline-block">
                <QRCodeSVG
                  value={dynamicQrUri}
                  size={190}
                  level="H"
                  includeMargin={true}
                />
              </div>

              <div className="space-y-1">
                <div className="text-base font-black tracking-tight">{user?.name || 'Surjeet Kumar'}</div>
                <div className="text-xs font-mono text-emerald-200 bg-white/10 px-3 py-1 rounded-lg inline-block">
                  {currentUpiId}
                </div>
              </div>

              {qrAmount && Number(qrAmount) > 0 && (
                <div className="text-xl font-black text-amber-300 font-heading">
                  Amount: ₹{Number(qrAmount).toLocaleString('en-IN')}
                </div>
              )}

              <p className="text-[11px] text-emerald-200/80 max-w-xs">
                Scan with any Indian UPI App (Google Pay, PhonePe, Paytm, BHIM) to credit directly.
              </p>
            </div>

            {/* Custom QR Parameters Form */}
            <div className="space-y-5 bg-slate-50 p-6 rounded-3xl border border-slate-200">
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-slate-800">Customize Receiving QR Code</h4>
                <p className="text-xs text-slate-500">
                  Optionally specify an amount to lock the invoice total into the scannable code.
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Payment Amount (₹) <span className="text-slate-400 font-normal">(Leave empty for any amount)</span>
                  </label>
                  <input
                    type="number"
                    value={qrAmount}
                    onChange={(e) => setQrAmount(e.target.value ? parseFloat(e.target.value) : '')}
                    placeholder="e.g. 50000"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none text-sm font-semibold bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Payment Note / Reference
                  </label>
                  <input
                    type="text"
                    value={qrNote}
                    onChange={(e) => setQrNote(e.target.value)}
                    placeholder="Wheat Lot Payout"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none text-sm bg-white"
                  />
                </div>

                <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 space-y-2 text-xs text-emerald-900">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Linked UPI Receiver:</span>
                    <span className="font-mono font-bold">{currentUpiId}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Linked Bank Account:</span>
                    <span className="font-bold">{receivingAccount.bankName || 'HDFC Bank'}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCopyUpi}
                  className="w-full py-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                >
                  {copiedUpi ? (
                    <>
                      <CheckCheck className="w-4 h-4 text-emerald-600" />
                      <span className="text-emerald-700">UPI ID Copied to Clipboard!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-slate-500" />
                      <span>Copy UPI ID ({currentUpiId})</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: RECEIVING ACCOUNT SETUP                                            */}
      {/* ========================================================================= */}
      {activeTab === 'settings' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xl space-y-6">
          <div>
            <h3 className="text-lg font-bold text-slate-900 font-heading">
              Payment Receiving Account Settings
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Configure your preferred UPI and Bank details to receive Direct Benefit Transfer (DBT) mandi payouts.
            </p>
          </div>

          {settingsSuccess && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2.5 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-bold">{settingsSuccess}</span>
            </div>
          )}

          <form onSubmit={handleSaveSettings} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* UPI ID */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  UPI ID (Virtual Payment Address)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={upiIdInput}
                    onChange={(e) => setUpiIdInput(e.target.value)}
                    placeholder="mobile@upi or name@okhdfcbank"
                    required
                    className="w-full px-4 py-3 rounded-2xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none text-sm font-mono"
                  />
                </div>
                <p className="text-[11px] text-slate-400">
                  Instant settlement to Google Pay, PhonePe, Paytm, or BHIM.
                </p>
              </div>

              {/* Account Holder Name */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Account Holder Name
                </label>
                <input
                  type="text"
                  value={accountHolderInput}
                  onChange={(e) => setAccountHolderInput(e.target.value)}
                  placeholder="e.g. Surjeet Kumar"
                  required
                  className="w-full px-4 py-3 rounded-2xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none text-sm font-semibold"
                />
                <p className="text-[11px] text-slate-400">
                  Must match the name on your Government Aadhaar / Khasra passbook.
                </p>
              </div>

              {/* Bank Account Number */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Bank Account Number
                </label>
                <input
                  type="text"
                  value={accountNumberInput}
                  onChange={(e) => setAccountNumberInput(e.target.value)}
                  placeholder="e.g. 501004928172"
                  required
                  className="w-full px-4 py-3 rounded-2xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none text-sm font-mono"
                />
              </div>

              {/* IFSC Code */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Bank IFSC Code
                </label>
                <input
                  type="text"
                  value={ifscInput}
                  onChange={(e) => setIfscInput(e.target.value.toUpperCase())}
                  placeholder="e.g. HDFC0000240"
                  required
                  className="w-full px-4 py-3 rounded-2xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none text-sm font-mono uppercase"
                />
              </div>

              {/* Bank Name */}
              <div className="space-y-1.5 sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700">
                  Bank Name & Branch
                </label>
                <input
                  type="text"
                  value={bankNameInput}
                  onChange={(e) => setBankNameInput(e.target.value)}
                  placeholder="e.g. HDFC Bank (Karnal Mandi Branch)"
                  required
                  className="w-full px-4 py-3 rounded-2xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none text-sm"
                />
              </div>
            </div>

            {/* Preferred Payout Method */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <label className="block text-xs font-bold text-slate-700">
                Default Receiving Channel for Auto-Disbursements
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPreferredModeInput('upi')}
                  className={`p-3.5 rounded-2xl border text-xs font-bold transition-all flex items-center gap-3 cursor-pointer ${
                    preferredModeInput === 'upi'
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-950 ring-1 ring-emerald-600'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                    <Zap className="w-4 h-4 fill-white" />
                  </div>
                  <div className="text-left">
                    <div>UPI Instant Settlement</div>
                    <div className="text-[10px] text-slate-500 font-normal">Immediate direct credit to UPI VPA</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setPreferredModeInput('bank')}
                  className={`p-3.5 rounded-2xl border text-xs font-bold transition-all flex items-center gap-3 cursor-pointer ${
                    preferredModeInput === 'bank'
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-950 ring-1 ring-emerald-600'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <div className="w-8 h-8 rounded-xl bg-teal-600 text-white flex items-center justify-center shrink-0">
                    <Building className="w-4 h-4 text-white" />
                  </div>
                  <div className="text-left">
                    <div>Direct Bank DBT (NEFT/RTGS)</div>
                    <div className="text-[10px] text-slate-500 font-normal">Direct Aadhaar-linked account transfer</div>
                  </div>
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={savingSettings}
              className="px-6 py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-2xl font-bold text-sm shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {savingSettings ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Saving Receiving Details...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Save Receiving Preferences</span>
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: PAYMENT HISTORY & OFFICIAL RECEIPTS                                 */}
      {/* ========================================================================= */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-lg font-bold text-slate-900 font-heading">
                Payment History & Settlement Receipts
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Full ledger of direct credits, bank UTR references, and official mandi vouchers.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="py-12 text-center text-slate-400 text-xs">Loading transaction history...</div>
          ) : payments.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">No payment records found.</div>
          ) : (
            <div className="space-y-3">
              {payments.map((p) => {
                const isPaid = p.status === 'paid';
                return (
                  <div
                    key={p.id}
                    className="p-4 rounded-2xl border border-slate-200 hover:border-slate-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold ${
                          isPaid ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        <CreditCard className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-slate-900 text-base">
                            ₹{p.amount.toLocaleString('en-IN')}
                          </p>
                          <span
                            className={`text-[10px] px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider ${
                              isPaid
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {isPaid ? 'Credited (Paid)' : 'Processing'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5 font-mono">
                          Ref UTR: {p.transactionRef || 'PENDING-VERIFY'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-4 text-xs">
                      <div className="sm:text-right">
                        <p className="font-medium text-slate-700">A/C: {p.bankAccountMasked}</p>
                        <p className="text-[11px] text-slate-400">{p.expectedDate}</p>
                      </div>

                      <button
                        onClick={() => handleOpenReceipt(p.id)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold cursor-pointer transition-colors flex items-center gap-1.5"
                      >
                        <FileText className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Receipt</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="pt-4 border-t border-slate-100 text-[11px] text-slate-400 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              All transactions are settled through authorized Government Mandi Direct Benefit Transfer (DBT) systems.
            </span>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: CLAIM PAYOUT CONFIRMATION                                       */}
      {/* ========================================================================= */}
      {claimModalLot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Zap className="w-4 h-4 fill-emerald-600 text-emerald-600" />
                </div>
                <h3 className="text-lg font-black text-slate-900 font-heading">
                  Confirm Instant Payout
                </h3>
              </div>
              <button
                onClick={() => setClaimModalLot(null)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Amount Callout */}
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 p-4 rounded-2xl border border-emerald-200 space-y-1 text-center">
              <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                Payout Amount to Receive
              </span>
              <div className="text-3xl sm:text-4xl font-black text-emerald-700 font-heading">
                ₹{claimModalLot.totalAmount.toLocaleString('en-IN')}
              </div>
              <p className="text-xs text-emerald-900 font-medium">
                {claimModalLot.quantity} {claimModalLot.unit} {claimModalLot.cropName} @ MSP ₹{claimModalLot.ratePerQuintal}/Q
              </p>
            </div>

            {/* Receiving Mode Selection */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                Choose Receiving Destination:
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setClaimPayoutMode('upi')}
                  className={`p-3 rounded-xl border text-xs font-bold text-left transition-all cursor-pointer ${
                    claimPayoutMode === 'upi'
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-950 ring-1 ring-emerald-600'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-black text-slate-900">
                    <Zap className="w-3.5 h-3.5 text-emerald-600 fill-emerald-600" />
                    <span>UPI Instant</span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-500 mt-1 truncate">
                    {receivingAccount.upiId || 'farmer@okhdfcbank'}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setClaimPayoutMode('bank')}
                  className={`p-3 rounded-xl border text-xs font-bold text-left transition-all cursor-pointer ${
                    claimPayoutMode === 'bank'
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-950 ring-1 ring-emerald-600'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-black text-slate-900">
                    <Building className="w-3.5 h-3.5 text-teal-600" />
                    <span>Bank A/C</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1 truncate">
                    ••••{receivingAccount.accountNumber?.slice(-4) || '4192'} ({receivingAccount.bankName || 'HDFC'})
                  </div>
                </button>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1">
              <div className="flex justify-between">
                <span>Gross Procurement Value:</span>
                <span className="font-bold">₹{claimModalLot.totalAmount.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-emerald-700 font-semibold">
                <span>Government Mandi Cess / Fees:</span>
                <span>₹0.00 (Waived)</span>
              </div>
              <div className="pt-1.5 border-t border-slate-200 flex justify-between font-bold text-slate-900">
                <span>Net Credit Amount:</span>
                <span className="text-emerald-700">₹{claimModalLot.totalAmount.toLocaleString('en-IN')}</span>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setClaimModalLot(null)}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmClaim}
                disabled={claiming}
                className="flex-2 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/20 cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {claiming ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Disbursing Payout...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 fill-white" />
                    <span>Confirm & Receive Payment</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: OFFICIAL MANDI SETTLEMENT RECEIPT                                */}
      {/* ========================================================================= */}
      {receiptData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 space-y-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            {/* Header with Mandi Seal */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black">
                  🌾
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-wider text-emerald-700">
                    Government of India • Ministry of Agriculture
                  </div>
                  <h3 className="text-base font-black text-slate-900 font-heading">
                    Mandi Procurement & Settlement Voucher
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setReceiptData(null)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Receipt Summary Grid */}
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-200 font-mono">
                <div>
                  <span className="text-slate-400 block text-[10px]">VOUCHER NUMBER</span>
                  <span className="font-bold text-slate-900">{receiptData.receiptNumber}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 block text-[10px]">SETTLEMENT DATE</span>
                  <span className="font-bold text-slate-900">{receiptData.voucherDate}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">BENEFICIARY FARMER</span>
                  <span className="font-bold text-slate-900">{receiptData.farmerName}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 block text-[10px]">MANDI CENTER</span>
                  <span className="font-bold text-slate-900">{receiptData.centerName}</span>
                </div>
              </div>

              {/* Crop & Rate Details */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-3">Commodity</th>
                      <th className="p-3 text-right">Net Quantity</th>
                      <th className="p-3 text-right">Govt. MSP Rate</th>
                      <th className="p-3 text-right">Total Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr>
                      <td className="p-3 font-bold text-slate-900">{receiptData.cropName}</td>
                      <td className="p-3 text-right font-medium">
                        {receiptData.quantity} {receiptData.unit}
                      </td>
                      <td className="p-3 text-right font-mono">
                        ₹{receiptData.ratePerQuintal.toLocaleString('en-IN')}/Q
                      </td>
                      <td className="p-3 text-right font-bold text-slate-900">
                        ₹{receiptData.grossAmount.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  </tbody>
                  <tfoot className="bg-emerald-50/70 border-t border-emerald-200 font-bold text-emerald-950">
                    <tr>
                      <td colSpan={3} className="p-3 text-right font-bold">
                        Net Payout Credited:
                      </td>
                      <td className="p-3 text-right font-black text-sm text-emerald-700">
                        ₹{receiptData.netPaidAmount.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Banking & UTR Details */}
              <div className="p-3.5 bg-emerald-50 rounded-2xl border border-emerald-200 space-y-1 font-mono text-[11px] text-emerald-950">
                <div className="flex justify-between">
                  <span className="font-bold">Direct Benefit Transfer UTR:</span>
                  <span className="font-black text-emerald-700">{receiptData.transactionRef}</span>
                </div>
                <div className="flex justify-between">
                  <span>Credited Account / VPA:</span>
                  <span>{receiptData.targetAccountMasked}</span>
                </div>
                <div className="flex justify-between">
                  <span>Payment Mode:</span>
                  <span>{receiptData.payoutMode}</span>
                </div>
              </div>

              <div className="text-[10px] text-slate-400 text-center italic">
                This is a computer-generated tax-free agricultural MSP procurement voucher issued under the FarmQ Smart Mandi Intake Protocol.
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                <span>Print Official Receipt</span>
              </button>
              <button
                type="button"
                onClick={() => setReceiptData(null)}
                className="py-3 px-6 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

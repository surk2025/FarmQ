import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ClipboardList,
  CheckCircle2,
  Clock,
  ArrowRight,
  AlertCircle,
  FileCheck,
  CreditCard,
  Building2,
  Scale
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import api from '../../services/api';
import { Procurement } from '../../types';

export const ProcurementStatus: React.FC = () => {
  const { t } = useLanguage();
  const [procurements, setProcurements] = useState<Procurement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/procurement/farmer')
      .then(res => setProcurements(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 font-heading">
          {t('procurementStatus')} & Quality Tracking
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Complete transparency across the 7-stage mandi intake, grading, and payment pipeline.
        </p>
      </div>

      {loading ? (
        <div className="py-20 text-center text-slate-400">Loading procurement status...</div>
      ) : procurements.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-xs max-w-md mx-auto space-y-4">
          <ClipboardList className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-lg font-bold text-slate-900">No active procurements yet</h3>
          <p className="text-xs text-slate-500">Book a slot to begin your procurement journey.</p>
          <Link to="/farmer/book" className="inline-block px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-xs shadow-xs">
            {t('bookSlot')}
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {procurements.map((proc) => (
            <div key={proc.id} className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xl space-y-8">
              {/* Card Top Info */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                      Token Pass
                    </span>
                    <h2 className="text-xl font-black text-slate-900 font-heading">
                      {proc.cropName} • {proc.quantity} {proc.unit.toUpperCase()}
                    </h2>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                    <span>{proc.centerName}</span>
                  </p>
                </div>

                <div className="bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100 text-right sm:text-right">
                  <span className="text-[11px] text-slate-400 uppercase font-semibold">Total MSP Amount</span>
                  <p className="text-xl font-black text-emerald-700 font-heading">₹{proc.totalAmount.toLocaleString('en-IN')}</p>
                  <p className="text-[10px] text-slate-500">@ ₹{proc.ratePerQuintal}/Q</p>
                </div>
              </div>

              {/* Section 19: 7-Stage Status Timeline */}
              <div className="relative pl-6 sm:pl-8 space-y-8 before:absolute before:left-3 sm:before:left-4 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
                {proc.timeline.map((step, idx) => {
                  const isCompleted = step.completed;
                  const isCurrent = step.current;
                  return (
                    <div key={idx} className="relative flex items-start gap-4">
                      {/* Step Circle Indicator */}
                      <span className={`absolute -left-6 sm:-left-8 top-0.5 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                        isCompleted
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : isCurrent
                          ? 'bg-amber-500 text-white ring-4 ring-amber-100 animate-pulse'
                          : 'bg-white border-2 border-slate-300 text-slate-400'
                      }`}>
                        {isCompleted ? '✓' : isCurrent ? '●' : '○'}
                      </span>

                      {/* Step Details */}
                      <div className="flex-1 bg-slate-50/60 p-4 rounded-2xl border border-slate-100">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                          <h4 className={`text-sm font-bold ${isCompleted ? 'text-slate-900' : isCurrent ? 'text-amber-800' : 'text-slate-400'}`}>
                            {step.label}
                          </h4>
                          {step.timestamp && (
                            <span className="text-[11px] font-semibold text-slate-500">
                              {step.timestamp}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {isCompleted ? 'Verified and recorded successfully.' : isCurrent ? 'Current active stage. Verification underway.' : 'Scheduled in pipeline.'}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Card Footer Actions */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <Link
                  to="/farmer/queue"
                  className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1.5"
                >
                  <span>View in Live Queue Monitor</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>

                <Link
                  to="/farmer/payments"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs"
                >
                  <span>Receive Payment / Ledger</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

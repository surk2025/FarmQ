import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  MapPin,
  Clock,
  Users,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ShieldCheck,
  TrendingDown
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import api from '../../services/api';
import { ProcurementCenter, SmartRecommendation } from '../../types';

export const FindCenter: React.FC = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [centers, setCenters] = useState<ProcurementCenter[]>([]);
  const [selectedCenterId, setSelectedCenterId] = useState<string | null>(null);
  const [recommendation, setRecommendation] = useState<SmartRecommendation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [centersRes, recRes] = await Promise.all([
          api.get('/centers'),
          api.get('/centers/recommendation')
        ]);
        setCenters(centersRes.data);
        if (centersRes.data.length > 0) {
          setSelectedCenterId(centersRes.data[0].id);
        }
        setRecommendation(recRes.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // When user clicks a center to compare
  const handleSelectCenter = async (centerId: string) => {
    setSelectedCenterId(centerId);
    try {
      const res = await api.get(`/centers/recommendation?selectedCenterId=${centerId}`);
      setRecommendation(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const getStatusBadge = (status: string, queueLength: number) => {
    if (status === 'closed') {
      return <span className="text-[11px] px-2.5 py-1 rounded-full font-bold bg-rose-100 text-rose-800">🔴 Closed</span>;
    }
    if (queueLength <= 8) {
      return <span className="text-[11px] px-2.5 py-1 rounded-full font-bold bg-emerald-100 text-emerald-800">🟢 Low Queue</span>;
    } else if (queueLength <= 20) {
      return <span className="text-[11px] px-2.5 py-1 rounded-full font-bold bg-amber-100 text-amber-800">🟡 Moderate Queue</span>;
    } else {
      return <span className="text-[11px] px-2.5 py-1 rounded-full font-bold bg-rose-100 text-rose-800">🔴 High Queue</span>;
    }
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 font-heading">
          {t('findCenter')} & Smart Recommendation
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Select a procurement center to see live queue congestion and AI recommendations.
        </p>
      </div>

      {/* Section 14: Smart Center Recommendation Card */}
      {recommendation?.hasRecommendation && recommendation.recommendedCenter && (
        <div className="rounded-3xl bg-gradient-to-r from-emerald-900 via-teal-900 to-emerald-950 p-6 md:p-8 text-white shadow-xl border border-emerald-700/50 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-emerald-800/80">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold font-heading text-white">{t('smartRecommendation')}</h3>
                <p className="text-xs text-emerald-200">
                  {recommendation.selectedCenter
                    ? `Your selected center has an estimated waiting time of ${recommendation.selectedCenter.formattedWaitTime}.`
                    : 'Optimal center based on real-time intake speed and capacity.'}
                </p>
              </div>
            </div>

            {recommendation.timeSavedMinutes && recommendation.timeSavedMinutes > 0 ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-xs font-bold self-start md:self-auto">
                <TrendingDown className="w-4 h-4" />
                Saves ~{recommendation.timeSavedMinutes} minutes waiting
              </span>
            ) : null}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            <div className="md:col-span-7 space-y-3">
              <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider">Recommended Alternative:</span>
              <h4 className="text-2xl font-black font-heading text-white">{recommendation.recommendedCenter.name}</h4>
              
              <div className="flex flex-wrap gap-4 text-xs text-emerald-100 py-1">
                <span>📍 Distance: <strong>{recommendation.recommendedCenter.distanceKm} km</strong></span>
                <span>👥 Queue: <strong>{recommendation.recommendedCenter.queueCount} farmers</strong></span>
                <span>⏱️ Estimated Wait: <strong>{recommendation.recommendedCenter.formattedWaitTime}</strong></span>
              </div>

              <div className="pt-2">
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-300 mb-1.5">{t('whyThisCenter')}</p>
                <ul className="space-y-1 text-xs text-emerald-100">
                  {recommendation.reasons?.map((reason, idx) => (
                    <li key={idx} className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>{reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="md:col-span-5 flex flex-col justify-center gap-3">
              <Link
                to={`/farmer/book?centerId=${recommendation.recommendedCenter.centerId}`}
                className="w-full py-3.5 px-6 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm text-center shadow-lg shadow-emerald-500/30 transition-all flex items-center justify-center gap-2"
              >
                <span>{t('selectThisCenter')}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Centers Grid */}
      {loading ? (
        <div className="py-20 text-center text-slate-400">Loading centers...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {centers.map((center) => {
            const isSelected = selectedCenterId === center.id;
            return (
              <div
                key={center.id}
                onClick={() => handleSelectCenter(center.id)}
                className={`bg-white rounded-3xl p-6 border transition-all cursor-pointer flex flex-col justify-between ${
                  isSelected ? 'border-emerald-500 shadow-md ring-2 ring-emerald-500/20' : 'border-slate-200 shadow-xs hover:border-slate-300'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    {getStatusBadge(center.status, center.queueLength)}
                    <span className="text-xs font-semibold text-slate-500">{center.distanceKm} km</span>
                  </div>

                  <h3 className="text-lg font-bold text-slate-900 font-heading mb-1">{center.name}</h3>
                  <p className="text-xs text-slate-500 flex items-center gap-1 mb-4">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{center.location.address}</span>
                  </p>

                  {/* Section 13 Metrics */}
                  <div className="space-y-2.5 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs mb-4">
                    <div className="flex justify-between">
                      <span className="text-slate-500">{t('currentQueue')}:</span>
                      <span className="font-bold text-slate-900">{center.queueLength} farmers</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">{t('estimatedWait')}:</span>
                      <span className="font-bold text-emerald-700">~{center.estimatedWaitMinutes} minutes</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">{t('todayCapacity')}:</span>
                      <span className="font-semibold text-slate-800">{center.capacityPerDay} Quintal</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">{t('booked')}:</span>
                      <span className="font-semibold text-slate-800">{center.bookedQuantity} Quintal</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => handleSelectCenter(center.id)}
                    className="flex-1 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 transition-colors"
                  >
                    {t('viewDetails')}
                  </button>
                  <Link
                    to={`/farmer/book?centerId=${center.id}`}
                    className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold text-center shadow-xs transition-colors"
                  >
                    {t('bookSlot')}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

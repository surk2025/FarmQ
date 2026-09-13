import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Hourglass,
  Clock,
  Users,
  Radio,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  TrendingDown,
  BrainCircuit
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useQueueSocket } from '../../context/QueueSocketContext';
import api from '../../services/api';
import { QueuePrediction } from '../../types';

export const LiveQueue: React.FC = () => {
  const { t } = useLanguage();
  const { subscribeToCenter, latestEvent, isConnected, lastUpdatedTime } = useQueueSocket();

  const [queueData, setQueueData] = useState<any>(null);
  const [prediction, setPrediction] = useState<QueuePrediction | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefreshedSec, setLastRefreshedSec] = useState(0);

  const fetchQueueState = async () => {
    try {
      // 1. Get farmer's active dashboard info to know their current token #
      const dashRes = await api.get('/farmer/dashboard');
      const tokenNum = dashRes.data.currentToken || 25;
      const centerId = dashRes.data.centerId;

      if (centerId) {
        subscribeToCenter(centerId);
      }

      // 2. Fetch specific token status & nearby queue
      const [queueRes, predRes] = await Promise.all([
        api.get(`/queue/${tokenNum}${centerId ? `?centerId=${centerId}` : ''}`),
        api.get(`/queue/${tokenNum}/prediction${centerId ? `?centerId=${centerId}` : ''}`)
      ]);

      setQueueData(queueRes.data);
      setPrediction(predRes.data);
      setLastRefreshedSec(0);
    } catch (err) {
      console.error('Error fetching live queue:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueueState();
  }, []);

  // Real-time auto update via WebSocket
  useEffect(() => {
    if (latestEvent) {
      fetchQueueState();
    }
  }, [latestEvent]);

  // Tick seconds counter
  useEffect(() => {
    const timer = setInterval(() => {
      setLastRefreshedSec(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  if (loading) {
    return (
      <div className="py-24 text-center space-y-3">
        <Hourglass className="w-10 h-10 text-emerald-600 animate-spin mx-auto" />
        <p className="text-sm font-semibold text-slate-500">Connecting to live mandi queue channel...</p>
      </div>
    );
  }

  const tokenNumber = queueData?.tokenNumber || 25;
  const farmersAhead = queueData?.farmersAhead ?? 12;
  const formattedWait = queueData?.formattedWaitTime || '1h 36m';
  const nearbyQueue = queueData?.nearbyQueue || [
    { tokenNumber: 23, status: 'processing', isYou: false, farmerName: 'Ramesh C.' },
    { tokenNumber: 24, status: 'waiting', isYou: false, farmerName: 'Suresh V.' },
    { tokenNumber: 25, status: 'waiting', isYou: true, farmerName: 'YOU' },
    { tokenNumber: 26, status: 'waiting', isYou: false, farmerName: 'Harpreet K.' },
    { tokenNumber: 27, status: 'waiting', isYou: false, farmerName: 'Kuldeep Y.' },
  ];

  // Calculate realistic queue progress (if 12 ahead out of initial ~15, ~25% completed)
  const progressPercent = Math.max(10, Math.min(100, Math.round((1 - (farmersAhead / 20)) * 100)));

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      {/* Live Status Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-2.5">
          <span className={`w-3 h-3 rounded-full ${isConnected ? 'bg-emerald-500 animate-ping' : 'bg-amber-400'}`}></span>
          <span className="text-xs font-bold text-slate-800">
            {isConnected ? 'Real-Time WebSocket Connected' : 'Synchronizing...'}
          </span>
          <span className="text-slate-300">|</span>
          <span className="text-xs text-slate-500">{queueData?.centerName || 'Greenfield Procurement Center'}</span>
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span>{t('lastUpdated')}: <strong>{lastRefreshedSec} {t('secondsAgo')}</strong> ({lastUpdatedTime})</span>
          <button
            onClick={fetchQueueState}
            className="p-1 text-slate-400 hover:text-emerald-700 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
            title="Manual refresh"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Section 16 Hero Display: Large YOUR TOKEN #25 */}
      <div className="bg-white rounded-3xl p-8 sm:p-12 border-2 border-emerald-500/30 shadow-2xl relative overflow-hidden text-center space-y-8">
        <div className="space-y-2">
          <span className="inline-block text-xs font-black tracking-widest text-emerald-800 uppercase bg-emerald-100 px-4 py-1.5 rounded-full">
            {t('yourToken')}
          </span>
          <div className="text-7xl sm:text-8xl font-black text-slate-950 font-heading tracking-tight">
            #{tokenNumber}
          </div>
          <p className="text-sm font-semibold text-slate-600">
            {queueData?.cropName} • {queueData?.quantity} Quintal
          </p>
        </div>

        {/* 2 Big Highlight Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-lg mx-auto">
          {/* Farmers Ahead */}
          <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200/80 text-center">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
              {t('farmersAhead')}
            </span>
            <div className="text-4xl font-black text-slate-900 font-heading">
              {farmersAhead}
            </div>
            <p className="text-xs text-slate-500 mt-1">In queue before your lot</p>
          </div>

          {/* Estimated Waiting Time */}
          <div className="bg-emerald-50/70 rounded-2xl p-5 border border-emerald-200/80 text-center">
            <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider block mb-1">
              {t('estimatedWait')}
            </span>
            <div className="text-4xl font-black text-emerald-700 font-heading">
              {formattedWait}
            </div>
            <p className="text-xs text-emerald-800/80 mt-1 font-medium">
              {t('approximateWaitNotice')}
            </p>
          </div>
        </div>

        {/* Queue Progress Bar */}
        <div className="max-w-xl mx-auto space-y-2">
          <div className="flex justify-between text-xs font-bold text-slate-600">
            <span>Gate Intake Entry</span>
            <span>Inspection Bay Turn</span>
          </div>
          <div className="w-full h-3.5 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-700"
              style={{ width: `${progressPercent}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Section 16 & 17 Queue Stream Visual List */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xl space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-bold text-slate-900 font-heading">Live Queue Stream</h3>
            <p className="text-xs text-slate-500">Live progression across intake weighing platforms</p>
          </div>
          <span className="text-xs text-slate-500 font-medium">Active Bay 1</span>
        </div>

        <div className="space-y-2.5">
          {nearbyQueue.map((item: any) => {
            const isYou = item.isYou || (item.tokenNumber === tokenNumber);
            const isProcessing = item.status === 'processing';
            const isNext = (item.tokenNumber === 24 && !isProcessing) || (item.position === 2 && !isProcessing);

            return (
              <div
                key={item.tokenNumber}
                className={`p-4 rounded-2xl border-2 transition-all flex items-center justify-between ${
                  isYou
                    ? 'border-emerald-600 bg-emerald-50/90 shadow-md ring-2 ring-emerald-500/20'
                    : isProcessing
                    ? 'border-blue-400 bg-blue-50/70'
                    : isNext
                    ? 'border-amber-400 bg-amber-50/70'
                    : 'border-slate-200 bg-white'
                }`}
              >
                <div className="flex items-center gap-4">
                  <span className={`text-xl font-black font-heading ${
                    isYou ? 'text-emerald-950' : 'text-slate-800'
                  }`}>
                    #{item.tokenNumber}
                  </span>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900">
                        {isYou ? 'YOU (Surjeet Kumar)' : item.farmerName}
                      </span>
                      {isYou && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-black uppercase">
                          Your Token
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">
                      {isProcessing ? 'Counter 1 (Weighing Platform)' : `In line (Queue Pos #${item.position || item.tokenNumber - 22})`}
                    </p>
                  </div>
                </div>

                {/* Status Badge */}
                <div>
                  {isProcessing ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-600 text-white font-bold text-xs shadow-xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
                      {t('processing')}
                    </span>
                  ) : isNext ? (
                    <span className="px-3 py-1 rounded-full bg-amber-500 text-white font-bold text-xs shadow-xs">
                      {t('nextInQueue')}
                    </span>
                  ) : isYou ? (
                    <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-xs">
                      Waiting Turn
                    </span>
                  ) : (
                    <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-600 font-medium text-xs">
                      {t('waiting')}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 18: AI Waiting-Time Prediction Module */}
      {prediction && (
        <div className="bg-gradient-to-r from-slate-900 to-slate-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-800 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                <BrainCircuit className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold font-heading">AI Waiting-Time Prediction Engine</h3>
                <p className="text-xs text-slate-400">Scikit-learn / Random Forest Queuing Model</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30 self-start sm:self-auto">
              <span>Confidence: <strong>{prediction.confidence}</strong></span>
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div className="bg-slate-800/60 p-3.5 rounded-xl border border-slate-700">
              <span className="text-slate-400">Model Used:</span>
              <p className="font-bold text-white mt-0.5">{prediction.modelUsed}</p>
            </div>
            <div className="bg-slate-800/60 p-3.5 rounded-xl border border-slate-700">
              <span className="text-slate-400">Active Counters:</span>
              <p className="font-bold text-emerald-400 mt-0.5">{prediction.activeCounters} Weighing Bays</p>
            </div>
            <div className="bg-slate-800/60 p-3.5 rounded-xl border border-slate-700">
              <span className="text-slate-400">Avg Time / Lot:</span>
              <p className="font-bold text-white mt-0.5">{prediction.factors?.avg_processing_time_min || 8} min</p>
            </div>
            <div className="bg-slate-800/60 p-3.5 rounded-xl border border-slate-700">
              <span className="text-slate-400">Peak Hour Factor:</span>
              <p className="font-bold text-amber-400 mt-0.5">{prediction.factors?.peak_hour ? '1.15x (Rush)' : '1.0x (Normal)'}</p>
            </div>
          </div>

          <div className="p-4 bg-emerald-950/60 rounded-2xl border border-emerald-800/60 text-xs text-emerald-200">
            <p className="font-bold text-emerald-300 uppercase tracking-wider mb-1">Recommended Action:</p>
            <p className="leading-relaxed">{prediction.advice}</p>
          </div>
        </div>
      )}
    </div>
  );
};

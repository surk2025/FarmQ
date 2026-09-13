import React, { useEffect, useState } from 'react';
import {
  Hourglass,
  Play,
  CheckCircle2,
  XCircle,
  UserX,
  FileCheck,
  RefreshCw,
  AlertCircle,
  Radio,
  Search
} from 'lucide-react';
import api from '../../services/api';

export const LiveQueueManagement: React.FC = () => {
  const [tokens, setTokens] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [filter, setFilter] = useState('all');
  const [centerFilter, setCenterFilter] = useState('all');

  const fetchQueue = async () => {
    try {
      const res = await api.get('/admin/queue');
      setTokens(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
    const interval = setInterval(fetchQueue, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleStartToken = async (tokenId: string, tokenNumber: number) => {
    setActionLoading(tokenId);
    // Optimistic immutable state update:
    // Target farmer -> processing; previous processing farmer -> completed
    setTokens((prev) =>
      prev.map((t) => {
        const tId = t._id || t.id;
        if (tId === tokenId) {
          return {
            ...t,
            status: 'processing',
            counterNumber: 1,
            farmersAhead: 0,
            estimatedWaitMinutes: 0,
          };
        }
        if (t.status === 'processing' || t.status === 'verification') {
          return {
            ...t,
            status: 'completed',
          };
        }
        return t;
      })
    );
    try {
      await api.put(`/admin/queue/${tokenId}/start?counter=1`);
      setMessage(`Token #${tokenNumber} called to Counter 1.`);
      await fetchQueue();
      setTimeout(() => setMessage(null), 4000);
    } catch (err) {
      console.error(err);
      await fetchQueue();
    } finally {
      setActionLoading(null);
    }
  };

  const handleCompleteToken = async (tokenId: string, tokenNumber: number) => {
    setActionLoading(tokenId);
    setTokens((prev) =>
      prev.map((t) => {
        const tId = t._id || t.id;
        if (tId === tokenId) {
          return {
            ...t,
            status: 'completed',
          };
        }
        return t;
      })
    );
    try {
      await api.put(`/admin/queue/${tokenId}/complete`);
      setMessage(`Token #${tokenNumber} completed. Next tokens updated.`);
      await fetchQueue();
      setTimeout(() => setMessage(null), 4000);
    } catch (err) {
      console.error(err);
      await fetchQueue();
    } finally {
      setActionLoading(null);
    }
  };

  const handleTokenAction = async (tokenId: string, tokenNumber: number, action: 'absent' | 'verify' | 'reject') => {
    setActionLoading(tokenId);
    const statusMap: Record<string, string> = {
      verify: 'verification',
      absent: 'absent',
      reject: 'rejected'
    };
    setTokens((prev) =>
      prev.map((t) => {
        const tId = t._id || t.id;
        if (tId === tokenId) {
          return {
            ...t,
            status: statusMap[action] || action,
          };
        }
        return t;
      })
    );
    try {
      await api.put(`/admin/queue/${tokenId}/action?action=${action}`);
      setMessage(`Token #${tokenNumber} marked as ${action}.`);
      await fetchQueue();
      setTimeout(() => setMessage(null), 4000);
    } catch (err) {
      console.error(err);
      await fetchQueue();
    } finally {
      setActionLoading(null);
    }
  };

  const handleSimulate = async () => {
    setSimulating(true);
    try {
      const query = centerFilter !== 'all' ? `?centerId=${centerFilter}` : '';
      const res = await api.post(`/admin/queue/simulate${query}`);
      setMessage(`Queue Advanced: Token #${res.data.completedToken || 'N/A'} Completed → Token #${res.data.nowProcessing || 'N/A'} Processing.`);
      await fetchQueue();
      setTimeout(() => setMessage(null), 6000);
    } catch (err) {
      console.error(err);
    } finally {
      setSimulating(false);
    }
  };

  const centerOptions = Array.from(new Set(tokens.map((t) => t.centerName).filter(Boolean)));

  const filteredTokens = tokens.filter((t) => {
    if (centerFilter !== 'all' && t.centerName !== centerFilter) return false;
    if (filter === 'all') return true;
    if (filter === 'active') return ['waiting', 'processing', 'arrived', 'verification'].includes(t.status);
    return t.status === filter;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header with simulation action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-950 p-6 rounded-3xl border border-slate-800">
        <div>
          <h1 className="text-2xl font-black text-white font-heading">
            Live Queue Management
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time counter controls. Changes broadcast immediately to farmer mobile screens.
          </p>
        </div>

        {/* Section 41: Simulate Queue Update button */}
        <button
          onClick={handleSimulate}
          disabled={simulating}
          className="px-5 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-2 cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${simulating ? 'animate-spin' : ''}`} />
          <span>{simulating ? 'Processing...' : '⚡ Simulate Queue Update'}</span>
        </button>
      </div>

      {message && (
        <div className="p-4 rounded-2xl bg-emerald-950 border border-emerald-800 text-emerald-300 text-xs font-bold flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {/* Filter Chips & Center Selector */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-1 text-xs">
        <div className="flex items-center gap-2 overflow-x-auto">
          {['all', 'active', 'processing', 'waiting', 'completed'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3.5 py-1.5 rounded-xl font-bold uppercase tracking-wider capitalize cursor-pointer transition-all ${
                filter === f ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/30' : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {centerOptions.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">Center:</span>
            <select
              value={centerFilter}
              onChange={(e) => setCenterFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-slate-950 text-xs font-bold text-slate-300 border border-slate-800 focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="all">All Centers ({tokens.length})</option>
              {centerOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Section 26: Queue Table */}
      <div className="bg-slate-950 rounded-3xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
              <tr>
                <th className="py-4 px-6">Token</th>
                <th className="py-4 px-6">Farmer Name</th>
                <th className="py-4 px-6">Crop</th>
                <th className="py-4 px-6">Quantity</th>
                <th className="py-4 px-6">Status</th>
                <th className="py-4 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">Loading queue...</td>
                </tr>
              ) : filteredTokens.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">No tokens found.</td>
                </tr>
              ) : (
                filteredTokens.map((token) => {
                  const isProc = token.status === 'processing';
                  const isWait = token.status === 'waiting';
                  const isDone = token.status === 'completed';
                  const isDemoFarmer = token.tokenNumber === 25;
                  const uniqueId = token._id || token.id;

                  return (
                    <tr
                      key={uniqueId}
                      className={`hover:bg-slate-900/40 transition-colors ${
                        isDemoFarmer ? 'bg-emerald-950/20' : ''
                      }`}
                    >
                      {/* Token */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-sm text-white font-heading">
                            #{token.tokenNumber}
                          </span>
                          {isDemoFarmer && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-900/80 text-emerald-300 border border-emerald-700/60">
                              Demo Kisan
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Farmer */}
                      <td className="py-4 px-6">
                        <p className="font-bold text-white">{token.farmerName}</p>
                        <p className="text-[11px] text-slate-500 flex items-center gap-1.5 flex-wrap">
                          <span>{token.farmerPhone}</span>
                          {token.centerName && (
                            <span className="text-slate-400 font-medium">
                              • {token.centerName}
                            </span>
                          )}
                        </p>
                      </td>

                      {/* Crop */}
                      <td className="py-4 px-6">
                        <span className="font-medium text-slate-300">{token.crop}</span>
                      </td>

                      {/* Quantity */}
                      <td className="py-4 px-6">
                        <span className="font-bold text-white">{token.quantity} {token.unit}</span>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-6">
                        {isProc ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[11px] font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping"></span>
                            Processing (C1)
                          </span>
                        ) : isWait ? (
                          <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-bold">
                            Waiting ({token.farmersAhead} ahead)
                          </span>
                        ) : isDone ? (
                          <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold">
                            Completed
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full bg-slate-800 text-slate-400 text-[11px] font-bold uppercase">
                            {token.status}
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-6 text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          {isProc && (
                            <button
                              onClick={() => handleCompleteToken(uniqueId, token.tokenNumber)}
                              disabled={actionLoading === uniqueId}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                            >
                              {actionLoading === uniqueId ? 'Completing...' : 'Complete'}
                            </button>
                          )}

                          {isWait && (
                            <button
                              onClick={() => handleStartToken(uniqueId, token.tokenNumber)}
                              disabled={actionLoading === uniqueId}
                              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                            >
                              {actionLoading === uniqueId ? 'Starting...' : 'Start'}
                            </button>
                          )}

                          {!isDone && (
                            <div className="flex items-center gap-1 pl-1">
                              <button
                                onClick={() => handleTokenAction(uniqueId, token.tokenNumber, 'verify')}
                                disabled={actionLoading === uniqueId}
                                title="Mark Verify"
                                className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded-md transition-colors cursor-pointer disabled:opacity-50"
                              >
                                <FileCheck className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleTokenAction(uniqueId, token.tokenNumber, 'absent')}
                                disabled={actionLoading === uniqueId}
                                title="Mark Absent"
                                className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-md transition-colors cursor-pointer disabled:opacity-50"
                              >
                                <UserX className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleTokenAction(uniqueId, token.tokenNumber, 'reject')}
                                disabled={actionLoading === uniqueId}
                                title="Reject"
                                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-md transition-colors cursor-pointer disabled:opacity-50"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

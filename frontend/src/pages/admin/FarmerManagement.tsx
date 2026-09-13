import React, { useEffect, useState } from 'react';
import { Search, Filter, ArrowUpDown, ExternalLink, Download } from 'lucide-react';
import api from '../../services/api';

export const FarmerManagement: React.FC = () => {
  const [farmers, setFarmers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [cropFilter, setCropFilter] = useState('all');
  const [sortField, setSortField] = useState<'tokenNumber' | 'farmerName' | 'quantity'>('tokenNumber');
  const [sortAsc, setSortAsc] = useState(true);

  const fetchFarmers = async () => {
    try {
      const res = await api.get(`/admin/farmers?search=${search}&status_filter=${statusFilter}&crop_filter=${cropFilter}`);
      setFarmers(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFarmers();
  }, [search, statusFilter, cropFilter]);

  const handleSort = (field: 'tokenNumber' | 'farmerName' | 'quantity') => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const sortedFarmers = [...farmers].sort((a, b) => {
    if (sortField === 'tokenNumber' || sortField === 'quantity') {
      return sortAsc ? (a[sortField] - b[sortField]) : (b[sortField] - a[sortField]);
    }
    return sortAsc
      ? String(a[sortField]).localeCompare(String(b[sortField]))
      : String(b[sortField]).localeCompare(String(a[sortField]));
  });

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white font-heading">
            Farmer Directory & Crop Intakes
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Search, sort, and inspect registered farmers and their allocated intake lots.
          </p>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-950 p-4 rounded-3xl border border-slate-800">
        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search by name, mobile, or token..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* Status Filter */}
        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">All Statuses</option>
            <option value="waiting">Waiting</option>
            <option value="processing">Processing</option>
            <option value="completed">Completed</option>
            <option value="absent">Absent</option>
          </select>
        </div>

        {/* Crop Filter */}
        <div>
          <select
            value={cropFilter}
            onChange={(e) => setCropFilter(e.target.value)}
            className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">All Crops</option>
            <option value="Wheat">Wheat</option>
            <option value="Rice">Rice</option>
            <option value="Mustard">Mustard</option>
            <option value="Maize">Maize</option>
            <option value="Sugarcane">Sugarcane</option>
          </select>
        </div>
      </div>

      {/* Section 27: Table */}
      <div className="bg-slate-950 rounded-3xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
              <tr>
                <th onClick={() => handleSort('tokenNumber')} className="py-4 px-6 cursor-pointer hover:text-white">
                  <div className="flex items-center gap-1.5">
                    <span>Token</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th onClick={() => handleSort('farmerName')} className="py-4 px-6 cursor-pointer hover:text-white">
                  <div className="flex items-center gap-1.5">
                    <span>Farmer Name</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-4 px-6">Mobile</th>
                <th className="py-4 px-6">Crop</th>
                <th onClick={() => handleSort('quantity')} className="py-4 px-6 cursor-pointer hover:text-white">
                  <div className="flex items-center gap-1.5">
                    <span>Quantity</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-4 px-6">Assigned Center</th>
                <th className="py-4 px-6">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">Loading farmers...</td>
                </tr>
              ) : sortedFarmers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">No matching farmers found.</td>
                </tr>
              ) : (
                sortedFarmers.map((f) => (
                  <tr key={f._id || f.id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="py-4 px-6 font-black text-white font-heading">
                      #{f.tokenNumber}
                    </td>
                    <td className="py-4 px-6 font-bold text-white">
                      {f.farmerName}
                    </td>
                    <td className="py-4 px-6 text-slate-400">
                      {f.farmerPhone}
                    </td>
                    <td className="py-4 px-6 font-medium text-slate-300">
                      {f.crop}
                    </td>
                    <td className="py-4 px-6 font-bold text-emerald-400">
                      {f.quantity} {f.unit}
                    </td>
                    <td className="py-4 px-6 text-slate-400">
                      {f.centerName}
                    </td>
                    <td className="py-4 px-6">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                        f.status === 'completed'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : f.status === 'processing'
                          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                          : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      }`}>
                        {f.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Phone, Clock, Users, ArrowRight, Search } from 'lucide-react';
import api from '../../services/api';
import { ProcurementCenter } from '../../types';

export const CentersPage: React.FC = () => {
  const [centers, setCenters] = useState<ProcurementCenter[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    api.get('/centers')
      .then(res => setCenters(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const filteredCenters = centers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.location.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.location.district.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 space-y-8 sm:space-y-12 overflow-x-hidden w-full">
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto space-y-4">
        <span className="text-xs font-bold text-emerald-700 uppercase tracking-widest bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
          Mandi Discovery
        </span>
        <h1 className="text-3xl sm:text-5xl font-black text-slate-900 font-heading">
          Procurement Centers & Live Availability
        </h1>
        <p className="text-sm sm:text-base text-slate-600">
          Compare real-time queue lengths, active counter capacity, and estimated waiting times across government mandis.
        </p>

        {/* Search Bar */}
        <div className="pt-2 sm:pt-4 max-w-md mx-auto w-full">
          <div className="relative">
            <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search by center name, district or address..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 bg-white text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 shadow-xs"
            >
            </input>
          </div>
        </div>
      </div>

      {/* Centers Grid */}
      {loading ? (
        <div className="text-center py-20 text-slate-400">Loading procurement centers...</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {filteredCenters.map((center) => {
            const utilPercent = Math.min(100, Math.round((center.bookedQuantity / center.capacityPerDay) * 100));
            return (
              <div key={center.id} className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <span className={`text-[11px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider ${
                      center.status === 'low_queue' || center.status === 'open' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {center.status === 'low_queue' ? '🟢 Low Queue' : center.status === 'moderate_queue' ? '🟡 Moderate Queue' : '🟢 Open'}
                    </span>
                    <span className="text-xs font-semibold text-slate-500">{center.distanceKm} km away</span>
                  </div>

                  <h3 className="text-base sm:text-lg font-bold text-slate-900 font-heading mb-1">{center.name}</h3>
                  <p className="text-xs text-slate-500 flex items-center gap-1 mb-4">
                    <MapPin className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                    <span className="truncate">{center.location.address}, {center.location.district}</span>
                  </p>

                  {/* Real-time stats */}
                  <div className="grid grid-cols-2 gap-3 my-4 bg-slate-50 p-3.5 rounded-2xl border border-slate-100 text-xs">
                    <div>
                      <p className="text-slate-500 text-[11px]">Current Queue:</p>
                      <p className="text-base font-bold text-slate-900">{center.queueLength} Farmers</p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-[11px]">Estimated Wait:</p>
                      <p className="text-base font-bold text-emerald-600">~{center.estimatedWaitMinutes} mins</p>
                    </div>
                    <div className="pt-2 border-t border-slate-200/60 col-span-2">
                      <div className="flex justify-between text-[11px] font-medium text-slate-600 mb-1">
                        <span>Intake: {center.bookedQuantity} / {center.capacityPerDay} Q</span>
                        <span>{utilPercent}% Booked</span>
                      </div>
                      <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${utilPercent > 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                          style={{ width: `${utilPercent}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-600 mb-6">
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>Hours: {center.operatingHours}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>Helpline: {center.contactPhone}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>Active Counters: {center.activeCounters} parallel bays</span>
                    </div>
                  </div>
                </div>

                <Link
                  to={`/farmer/book?centerId=${center.id}`}
                  className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs text-center shadow-xs transition-colors flex items-center justify-center gap-1.5"
                >
                  <span>Book Slot at this Center</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

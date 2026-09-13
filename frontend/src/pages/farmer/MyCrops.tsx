import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Wheat, Plus, Calendar, Trash2, ArrowRight, CheckCircle2, Clock } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import api from '../../services/api';
import { Crop } from '../../types';

export const MyCrops: React.FC = () => {
  const { t } = useLanguage();
  const [crops, setCrops] = useState<Crop[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  // Form State
  const [cropName, setCropName] = useState('Wheat');
  const [quantity, setQuantity] = useState('50');
  const [unit, setUnit] = useState('quintal');
  const [harvestDate, setHarvestDate] = useState(new Date().toISOString().split('T')[0]);
  const [preferredDate, setPreferredDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const supportedCrops = ['Wheat', 'Rice', 'Maize', 'Mustard', 'Sugarcane', 'Potato'];

  const fetchCrops = async () => {
    try {
      const res = await api.get('/farmer/crops');
      setCrops(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCrops();
  }, []);

  const handleAddCrop = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/farmer/crops', {
        cropName,
        quantity: parseFloat(quantity),
        unit,
        harvestDate,
        preferredDate: preferredDate || undefined
      });
      setShowAddModal(false);
      fetchCrops();
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Failed to add crop');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCrop = async (id: string) => {
    if (!confirm('Are you sure you want to remove this crop record?')) return;
    try {
      await api.delete(`/farmer/crops/${id}`);
      fetchCrops();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 font-heading">
            {t('myCrops')}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Manage your registered crops and prepare them for procurement slot booking.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/30 transition-all cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>{t('addNewCrop')}</span>
        </button>
      </div>

      {/* Crops List / Cards */}
      {loading ? (
        <div className="py-20 text-center text-slate-400">Loading crops...</div>
      ) : crops.length === 0 ? (
        /* Empty State */
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-xs max-w-lg mx-auto space-y-4">
          <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto text-3xl">
            🌾
          </div>
          <h3 className="text-lg font-bold text-slate-900 font-heading">{t('noCropsYet')}</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">{t('noCropsSubtitle')}</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-6 py-2.5 bg-emerald-600 text-white text-xs font-bold rounded-xl shadow-xs hover:bg-emerald-700 transition-colors cursor-pointer"
          >
            {t('addNewCrop')}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {crops.map((crop) => (
            <div
              key={crop.id}
              className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs hover:border-emerald-300 hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                      <Wheat className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 font-heading">{crop.cropName}</h3>
                      <p className="text-xs text-slate-500 font-medium">{crop.quantity} {crop.unit.toUpperCase()}</p>
                    </div>
                  </div>

                  <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider ${
                    crop.status === 'scheduled' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                  }`}>
                    {crop.status === 'scheduled' ? t('statusScheduled') : t('statusRegistered')}
                  </span>
                </div>

                <div className="space-y-1.5 py-3 border-y border-slate-100 my-3 text-xs text-slate-600">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Harvest Date:</span>
                    <span className="font-semibold text-slate-800">{crop.harvestDate}</span>
                  </div>
                  {crop.preferredDate && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Preferred Date:</span>
                      <span className="font-semibold text-emerald-700">{crop.preferredDate}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <Link
                  to={`/farmer/book?cropId=${crop.id}`}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold text-center shadow-xs transition-colors flex items-center justify-center gap-1.5"
                >
                  <span>{t('bookSlot')}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
                <button
                  onClick={() => handleDeleteCrop(crop.id)}
                  title="Remove crop"
                  className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Crop Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900 font-heading">Register New Harvested Crop</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-700 text-sm font-bold">✕</button>
            </div>

            <form onSubmit={handleAddCrop} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Select Crop
                </label>
                <select
                  value={cropName}
                  onChange={(e) => setCropName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 bg-white"
                >
                  {supportedCrops.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Quantity
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="0.5"
                    required
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Unit
                  </label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 bg-white"
                  >
                    <option value="quintal">Quintal (100 kg)</option>
                    <option value="ton">Ton</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Harvest Date
                </label>
                <input
                  type="date"
                  required
                  value={harvestDate}
                  onChange={(e) => setHarvestDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Preferred Procurement Date (Optional)
                </label>
                <input
                  type="date"
                  value={preferredDate}
                  onChange={(e) => setPreferredDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
                >
                  {submitting ? 'Saving...' : 'Save Crop'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

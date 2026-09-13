import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import confetti from 'canvas-confetti';
import {
  Wheat,
  MapPin,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Hourglass,
  Sparkles,
  Download,
  Share2
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import api from '../../services/api';
import { Crop, ProcurementCenter, Slot } from '../../types';

export const BookSlot: React.FC = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Multi-step Wizard Step: 1 to 6
  const [step, setStep] = useState<number>(1);

  // Data selections
  const [crops, setCrops] = useState<Crop[]>([]);
  const [centers, setCenters] = useState<ProcurementCenter[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);

  // Chosen fields
  const [selectedCropId, setSelectedCropId] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(50);
  const [selectedCenterId, setSelectedCenterId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedSlotId, setSelectedSlotId] = useState<string>('');

  // Confirmation result
  const [bookingResult, setBookingResult] = useState<any>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load initial crops & centers
  useEffect(() => {
    const loadInitial = async () => {
      try {
        const [cRes, mRes] = await Promise.all([
          api.get('/farmer/crops'),
          api.get('/centers')
        ]);
        setCrops(cRes.data);
        setCenters(mRes.data);

        // Pre-select if passed in query params
        const urlCropId = searchParams.get('cropId');
        const urlCenterId = searchParams.get('centerId');

        if (urlCropId && cRes.data.some((c: Crop) => c.id === urlCropId)) {
          setSelectedCropId(urlCropId);
          const found = cRes.data.find((c: Crop) => c.id === urlCropId);
          if (found) setQuantity(found.quantity);
        } else if (cRes.data.length > 0) {
          setSelectedCropId(cRes.data[0].id);
          setQuantity(cRes.data[0].quantity);
        }

        if (urlCenterId && mRes.data.some((m: ProcurementCenter) => m.id === urlCenterId)) {
          setSelectedCenterId(urlCenterId);
        } else if (mRes.data.length > 0) {
          setSelectedCenterId(mRes.data[0].id);
        }
      } catch (err) {
        console.error(err);
      }
    };
    loadInitial();
  }, [searchParams]);

  // Fetch slots whenever center or date changes
  useEffect(() => {
    if (selectedCenterId) {
      setLoadingSlots(true);
      api.get(`/slots?centerId=${selectedCenterId}&slotDate=${selectedDate}`)
        .then(res => {
          setSlots(res.data);
          const available = res.data.find((s: Slot) => !s.isFull);
          if (available) setSelectedSlotId(available.id);
        })
        .catch(err => console.error(err))
        .finally(() => setLoadingSlots(false));
    }
  }, [selectedCenterId, selectedDate]);

  const handleNextStep = () => {
    setError(null);
    if (step === 1 && !selectedCropId) {
      setError('Please select a crop first.');
      return;
    }
    if (step === 2 && (!quantity || quantity <= 0)) {
      setError('Please enter a valid quantity.');
      return;
    }
    if (step === 3 && !selectedCenterId) {
      setError('Please choose a procurement center.');
      return;
    }
    if (step === 4 && !selectedDate) {
      setError('Please pick a procurement date.');
      return;
    }
    if (step === 5 && !selectedSlotId) {
      setError('Please choose an available time slot.');
      return;
    }
    setStep(prev => prev + 1);
  };

  const handleConfirmBooking = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.post('/slots/book', {
        cropId: selectedCropId,
        centerId: selectedCenterId,
        slotId: selectedSlotId,
        quantity: parseFloat(String(quantity))
      });
      setBookingResult(res.data);
      setStep(6);
      // Trigger confetti celebration
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });
      } catch {}
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to book slot. Please try another time slot.');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedCrop = crops.find(c => c.id === selectedCropId);
  const selectedCenter = centers.find(c => c.id === selectedCenterId);
  const selectedSlot = slots.find(s => s.id === selectedSlotId);

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 font-heading">
          {t('bookSlot')}
        </h1>
        <p className="text-xs sm:text-sm text-slate-500">
          6-Step streamlined appointment process for waiting-free mandi entry.
        </p>
      </div>

      {/* Stepper Indicator */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex items-center justify-between overflow-x-auto text-xs font-bold gap-2">
        {['Crop', 'Quantity', 'Center', 'Date', 'Time Slot', 'Confirm'].map((label, i) => {
          const stepIdx = i + 1;
          const isDone = step > stepIdx;
          const isCurrent = step === stepIdx;
          return (
            <div key={label} className="flex items-center gap-2 whitespace-nowrap">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] ${
                isDone ? 'bg-emerald-600 text-white' : isCurrent ? 'bg-emerald-100 text-emerald-800 border-2 border-emerald-600' : 'bg-slate-100 text-slate-400'
              }`}>
                {isDone ? '✓' : stepIdx}
              </span>
              <span className={isCurrent ? 'text-emerald-800 font-bold' : isDone ? 'text-slate-700' : 'text-slate-400'}>
                {label}
              </span>
              {i < 5 && <span className="text-slate-300">›</span>}
            </div>
          );
        })}
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Wizard Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xl space-y-6">
        {/* STEP 1: Select Crop */}
        {step === 1 && (
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-slate-900 font-heading">{t('step1SelectCrop')}</h3>
            <p className="text-xs text-slate-500">Choose from your registered harvested crops:</p>

            {crops.length === 0 ? (
              <div className="p-6 text-center border-2 border-dashed border-slate-200 rounded-2xl space-y-3">
                <p className="text-xs text-slate-500">{t('noCropsYet')}</p>
                <Link to="/farmer/crops" className="inline-block px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl">
                  {t('addNewCrop')} First
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {crops.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => { setSelectedCropId(c.id); setQuantity(c.quantity); }}
                    className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between ${
                      selectedCropId === c.id ? 'border-emerald-600 bg-emerald-50/60' : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                        <Wheat className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 text-sm">{c.cropName}</p>
                        <p className="text-xs text-slate-500">{c.quantity} {c.unit}</p>
                      </div>
                    </div>
                    {selectedCropId === c.id && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* STEP 2: Enter Quantity */}
        {step === 2 && (
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-slate-900 font-heading">{t('step2EnterQuantity')}</h3>
            <p className="text-xs text-slate-500">Specify quintals you will bring for procurement:</p>

            <div className="max-w-xs">
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  step="0.5"
                  value={quantity}
                  onChange={(e) => setQuantity(parseFloat(e.target.value))}
                  className="w-full px-4 py-3 rounded-2xl border border-slate-300 text-xl font-bold focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
                <span className="absolute right-4 top-3.5 text-xs font-bold text-slate-400 uppercase">Quintal</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-2">1 Quintal = 100 Kilograms. Standard MSP weighing lot.</p>
            </div>
          </div>
        )}

        {/* STEP 3: Select Procurement Center */}
        {step === 3 && (
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-slate-900 font-heading">{t('step3SelectCenter')}</h3>
            <p className="text-xs text-slate-500">Pick the procurement mandi nearest to your farm:</p>

            <div className="space-y-3">
              {centers.map((c) => (
                <div
                  key={c.id}
                  onClick={() => setSelectedCenterId(c.id)}
                  className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    selectedCenterId === c.id ? 'border-emerald-600 bg-emerald-50/60' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-slate-900 text-sm">{c.name}</p>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold">{c.distanceKm} km</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{c.location.address}</p>
                  </div>

                  <div className="flex items-center gap-4 text-xs">
                    <div>
                      <span className="text-slate-400">Queue:</span>
                      <span className="font-bold text-slate-800 ml-1">{c.queueLength}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Est. Wait:</span>
                      <span className="font-bold text-emerald-700 ml-1">~{c.estimatedWaitMinutes}m</span>
                    </div>
                    {selectedCenterId === c.id && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 4: Select Date */}
        {step === 4 && (
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-slate-900 font-heading">{t('step4SelectDate')}</h3>
            <p className="text-xs text-slate-500">Pick date of mandi arrival:</p>

            <div className="max-w-xs">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border border-slate-300 text-base font-bold focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
        )}

        {/* STEP 5: Time Slots */}
        {step === 5 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900 font-heading">{t('step5SelectSlot')}</h3>
                <p className="text-xs text-slate-500">{selectedCenter?.name} on {selectedDate}</p>
              </div>
              <span className="text-xs text-emerald-700 font-bold bg-emerald-50 px-2.5 py-1 rounded-full">
                1-Hour Windows
              </span>
            </div>

            {loadingSlots ? (
              <div className="py-8 text-center text-slate-400 text-xs">Checking live slot availability...</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {slots.map((s) => {
                  const isFull = s.isFull;
                  const availableCount = Math.max(0, s.capacity - s.booked);
                  return (
                    <div
                      key={s.id}
                      onClick={() => !isFull && setSelectedSlotId(s.id)}
                      className={`p-4 rounded-2xl border-2 transition-all flex items-center justify-between ${
                        isFull
                          ? 'border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed'
                          : selectedSlotId === s.id
                          ? 'border-emerald-600 bg-emerald-50/70 cursor-pointer'
                          : 'border-slate-200 hover:border-emerald-300 cursor-pointer'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Clock className={`w-4 h-4 ${selectedSlotId === s.id ? 'text-emerald-600' : 'text-slate-400'}`} />
                        <div>
                          <p className="font-bold text-slate-900 text-sm">{s.startTime} – {s.endTime}</p>
                          <p className="text-[11px] text-slate-500">
                            {isFull ? (
                              <span className="text-rose-600 font-bold">FULL</span>
                            ) : (
                              <span>Available slots: <strong className="text-emerald-700">{availableCount}</strong></span>
                            )}
                          </p>
                        </div>
                      </div>
                      {selectedSlotId === s.id && !isFull && (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* STEP 6: Confirmation Screen with QR Code */}
        {step === 6 && bookingResult && (
          <div className="text-center space-y-6 py-4">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto text-2xl font-bold">
              ✓
            </div>

            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                {t('bookingConfirmed')}
              </span>
              <h2 className="text-3xl font-black text-slate-900 font-heading mt-3">
                Token #{bookingResult.tokenNumber}
              </h2>
              <p className="text-xs text-slate-500 mt-1">{t('showAtGate')}</p>
            </div>

            {/* QR Code Container */}
            <div className="p-6 bg-slate-50 rounded-3xl border border-slate-200 inline-block mx-auto shadow-inner">
              <QRCodeSVG
                value={bookingResult.qrData}
                size={180}
                level="H"
                includeMargin={true}
              />
              <p className="text-[11px] font-mono text-slate-500 mt-3">TOKEN PASS: #{bookingResult.tokenNumber}</p>
            </div>

            {/* Confirmation details table matching Section 15 */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 text-xs text-left max-w-md mx-auto space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Center:</span>
                <span className="font-bold text-slate-900">{bookingResult.centerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Crop Lot:</span>
                <span className="font-semibold text-slate-800">{bookingResult.cropName} ({bookingResult.quantity} Quintal)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Date:</span>
                <span className="font-semibold text-slate-800">{bookingResult.slotDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Slot Window:</span>
                <span className="font-bold text-emerald-700">{bookingResult.slotTime}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-200">
                <span className="text-slate-500">Estimated Waiting:</span>
                <span className="font-bold text-emerald-600">~{bookingResult.estimatedWaitMinutes} minutes</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <Link
                to="/farmer/queue"
                className="py-3.5 px-8 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm shadow-md shadow-emerald-600/30 transition-all flex items-center justify-center gap-2"
              >
                <span>{t('viewLiveQueue')}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/farmer/dashboard"
                className="py-3.5 px-6 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-sm transition-colors"
              >
                Return to Dashboard
              </Link>
            </div>
          </div>
        )}

        {/* Wizard Controls */}
        {step < 6 && (
          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep(prev => prev - 1)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
            ) : <div />}

            {step < 5 ? (
              <button
                type="button"
                onClick={handleNextStep}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <span>Next Step</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                disabled={submitting}
                onClick={handleConfirmBooking}
                className="px-8 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md shadow-emerald-600/30 transition-colors flex items-center gap-2 cursor-pointer"
              >
                <span>{submitting ? 'Confirming...' : 'Confirm & Generate Token'}</span>
                <CheckCircle2 className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

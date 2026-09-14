import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarCheck,
  Hourglass,
  BrainCircuit,
  MapPin,
  ClipboardList,
  Bell,
  Languages,
  BarChart3,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Clock,
  TrendingDown,
  ShieldCheck,
  Users,
  Wheat,
  Sparkles,
  ChevronRight,
  Building2
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { ProcurementCenter } from '../../types';

export const LandingPage: React.FC = () => {
  const { t } = useLanguage();
  const { isAuthenticated } = useAuth();
  const [centers, setCenters] = useState<ProcurementCenter[]>([]);

  useEffect(() => {
    api.get('/centers')
      .then(res => setCenters(res.data))
      .catch(() => {});
  }, []);

  const features = [
    {
      icon: CalendarCheck,
      title: "Smart Slot Booking",
      description: "Book verified procurement time slots from your mobile phone. Eliminate guessing and chaotic mandi rush."
    },
    {
      icon: Hourglass,
      title: "Live Queue Tracking",
      description: "Real-time token progression powered by WebSockets. See exactly how many farmers are ahead without standing in lines."
    },
    {
      icon: BrainCircuit,
      title: "AI Waiting-Time Prediction",
      description: "Machine-learning waiting time estimates based on counter processing rates, crop lots, and peak congestion patterns."
    },
    {
      icon: MapPin,
      title: "Smart Center Recommendation",
      description: "FarmQ automatically identifies nearby mandis with shorter waiting queues and remaining daily procurement capacity."
    },
    {
      icon: ClipboardList,
      title: "7-Stage Procurement Tracking",
      description: "Track your harvest from Gate Arrival and Quality Inspection to Weight Verification and Payment Processing."
    },
    {
      icon: Bell,
      title: "Proactive Notifications",
      description: "Receive timely mobile alerts when your turn is approaching so you know exactly when to arrive at the mandi gate."
    },
    {
      icon: Languages,
      title: "Multilingual Interface",
      description: "Built for every farmer. Easily switch between English and Hindi (हिन्दी) for an effortless digital experience."
    },
    {
      icon: BarChart3,
      title: "Admin Analytics & Capacity",
      description: "Comprehensive dashboard for mandi officials to balance daily intake, counters, and prevent procurement bottlenecks."
    }
  ];

  const workflowSteps = [
    { num: "01", title: "Register", desc: "Quick mobile signup with village & district" },
    { num: "02", title: "Add Crop", desc: "Input crop type (Wheat, Rice, etc.) & quantity" },
    { num: "03", title: "Select Center", desc: "Compare mandi wait times and capacity" },
    { num: "04", title: "Book Slot", desc: "Pick your preferred date and 1-hour time window" },
    { num: "05", title: "Get Token", desc: "Receive digital token # with verified QR pass" },
    { num: "06", title: "Track Queue", desc: "Follow live queue position and AI countdown" },
    { num: "07", title: "Crop Verification", desc: "Direct counter inspection without gate chaos" },
    { num: "08", title: "Procurement", desc: "Electronic weighing and instant receipt" },
    { num: "09", title: "Direct Payment", desc: "Track DBT transfer status directly to bank" }
  ];

  return (
    <div className="space-y-16 sm:space-y-24 pb-20 overflow-x-hidden w-full">
      {/* 1. Hero Section */}
      <section className="relative overflow-hidden pt-8 pb-16 md:pt-20 md:pb-28 bg-gradient-to-b from-emerald-50/50 via-white to-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            {/* Left Copy */}
            <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-100/80 border border-emerald-200 text-emerald-800 text-xs font-bold uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Smart Agricultural Procurement & Queue Management</span>
              </div>

              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-[1.15] font-heading">
                Smart Procurement. <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600">
                  Less Waiting.
                </span> Better Farming.
              </h1>

              <p className="text-base sm:text-xl text-slate-600 max-w-2xl mx-auto lg:mx-0 leading-relaxed">
                FarmQ helps farmers book procurement slots, track their live queue in real time, estimate exact waiting times with AI, and monitor payments from one simple platform.
              </p>

              {/* Core question callout */}
              <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200/80 max-w-xl text-left mx-auto lg:mx-0">
                <p className="text-xs font-bold text-amber-900 uppercase tracking-wider mb-1">Core Innovation Answered:</p>
                <p className="text-sm font-semibold text-amber-950 italic">
                  "Farmer ko procurement center par exactly kab pahunchna chahiye?"
                </p>
                <p className="text-xs text-amber-800 mt-1">
                  → FarmQ calculates dynamic queue speed so farmers arrive 20 minutes before their turn, not 6 hours early.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center lg:justify-start gap-3 sm:gap-4 pt-2">
                <Link
                  to={isAuthenticated ? "/farmer/book" : "/login"}
                  className="w-full sm:w-auto px-8 py-3.5 sm:py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-base shadow-lg shadow-emerald-600/30 hover:shadow-emerald-600/40 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
                >
                  <span>{t('getStarted')}</span>
                  <ArrowRight className="w-5 h-5" />
                </Link>
                <a
                  href="#how-it-works"
                  className="w-full sm:w-auto px-7 py-3.5 sm:py-4 rounded-2xl bg-white hover:bg-slate-100 text-slate-700 font-bold text-base border border-slate-200 shadow-xs transition-colors flex items-center justify-center"
                >
                  {t('howItWorks')}
                </a>
              </div>

              {/* Trust Badges */}
              <div className="pt-4 sm:pt-6 flex flex-wrap items-center justify-center lg:justify-start gap-3 sm:gap-6 text-xs text-slate-500 font-medium">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Real-time WebSockets</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>AI ML Wait Predictor</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>English & हिन्दी</span>
                </div>
              </div>
            </div>

            {/* Right Dashboard Mockup Card */}
            <div className="lg:col-span-5 w-full">
              <div className="relative mx-auto max-w-md w-full bg-white rounded-3xl p-4 sm:p-6 shadow-2xl border border-slate-200/80 transform hover:-translate-y-1 transition-transform">
                {/* Mock Card Header */}
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-emerald-500 animate-ping"></span>
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">Live Queue Monitor</span>
                  </div>
                  <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full font-semibold">Greenfield Center</span>
                </div>

                {/* Main Hero Token Highlight */}
                <div className="my-6 text-center bg-gradient-to-b from-emerald-50 to-white p-6 rounded-2xl border border-emerald-100">
                  <span className="text-xs font-bold uppercase tracking-widest text-emerald-700">YOUR TOKEN</span>
                  <div className="text-6xl font-black text-slate-900 font-heading my-1 tracking-tight">#25</div>
                  <span className="inline-block px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                    Wheat • 50 Quintal
                  </span>
                </div>

                {/* 2-column metrics */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                    <p className="text-[11px] font-semibold text-slate-500 uppercase">Farmers Ahead</p>
                    <p className="text-2xl font-black text-slate-900">12</p>
                    <p className="text-[10px] text-emerald-600 font-medium">Moving steadily</p>
                  </div>
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                    <p className="text-[11px] font-semibold text-slate-500 uppercase">AI Estimated Wait</p>
                    <p className="text-2xl font-black text-emerald-600">1h 36m</p>
                    <p className="text-[10px] text-slate-500 font-medium">Confidence: High</p>
                  </div>
                </div>

                {/* Queue Stream Preview */}
                <div className="space-y-2 border-t border-slate-100 pt-3 text-xs">
                  <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-50/70 border border-emerald-100">
                    <span className="font-bold text-slate-800">Token #23 (Ramesh C.)</span>
                    <span className="px-2 py-0.5 rounded bg-emerald-600 text-white font-bold text-[10px]">Processing (Counter 1)</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-amber-50/70 border border-amber-100">
                    <span className="font-bold text-slate-800">Token #24 (Suresh V.)</span>
                    <span className="px-2 py-0.5 rounded bg-amber-500 text-white font-bold text-[10px]">Next in Queue</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-100 border border-emerald-300 font-bold">
                    <span className="text-emerald-900">Token #25 (Surjeet K. - YOU)</span>
                    <span className="px-2 py-0.5 rounded bg-emerald-700 text-white text-[10px]">Slot Confirmed</span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                  <span>WebSocket Connected</span>
                  <span>Auto-syncs live</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Problem vs Solution Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
          {/* Problem Card */}
          <div className="bg-rose-50/70 rounded-3xl p-6 sm:p-8 border border-rose-100 relative overflow-hidden">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mb-6">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-rose-950 font-heading mb-3">{t('problemTitle')}</h3>
            <p className="text-xs sm:text-sm text-rose-900/80 mb-6 leading-relaxed">{t('problemSubtitle')}</p>
            <ul className="space-y-3 text-xs sm:text-sm text-rose-900 font-medium">
              <li className="flex items-start gap-2.5">
                <span className="text-rose-500 font-bold">✕</span>
                <span><strong>Uncertain Schedules:</strong> Farmers wait 6 to 14 hours in harsh weather without knowing when their crop will be weighed.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-rose-500 font-bold">✕</span>
                <span><strong>Lack of Real-time Info:</strong> No way to know if a mandi is currently overwhelmed, full, or operating with broken counters.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-rose-500 font-bold">✕</span>
                <span><strong>Unnecessary Travel:</strong> Trapped in long tractor lines with perishable produce leading to spoilage and fuel waste.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-rose-500 font-bold">✕</span>
                <span><strong>Payment Confusion:</strong> Zero visibility into quality grading stages and whether payment processing has been initiated.</span>
              </li>
            </ul>
          </div>

          {/* Solution Card */}
          <div className="bg-emerald-50/70 rounded-3xl p-6 sm:p-8 border border-emerald-100 relative overflow-hidden">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-6">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-emerald-950 font-heading mb-3">{t('solutionTitle')}</h3>
            <p className="text-xs sm:text-sm text-emerald-900/80 mb-6 leading-relaxed">{t('solutionSubtitle')}</p>
            <ul className="space-y-3 text-xs sm:text-sm text-emerald-900 font-medium">
              <li className="flex items-start gap-2.5">
                <span className="text-emerald-600 font-bold">✓</span>
                <span><strong>Guaranteed Digital Slot:</strong> Select an exact 1-hour window. Get an instant verified token with QR code.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-emerald-600 font-bold">✓</span>
                <span><strong>AI-Assisted Waiting Time:</strong> Machine-learning estimates tell you exactly when to start your tractor.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-emerald-600 font-bold">✓</span>
                <span><strong>Smart Center Recommendation:</strong> Reroutes you to nearby centers with faster lines and intake headroom.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-emerald-600 font-bold">✓</span>
                <span><strong>7-Stage Transparency:</strong> Live status tracking from crop verification to direct bank transfer credit.</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* 3. Demo Statistics */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-slate-900 rounded-3xl p-6 sm:p-8 md:p-12 text-white shadow-xl">
          <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-10">
            <h3 className="text-2xl sm:text-3xl font-bold font-heading">Measured Impact on Mandi Operations</h3>
            <p className="text-xs text-slate-400 mt-1 uppercase tracking-wider">{t('demoStatsNotice')}</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6 text-center">
            <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-800/60 border border-slate-700">
              <Users className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400 mx-auto mb-2" />
              <p className="text-2xl sm:text-3xl font-black font-heading text-white">{t('statFarmers')}</p>
              <p className="text-[11px] sm:text-xs text-slate-400 mt-1">Registered & Active</p>
            </div>
            <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-800/60 border border-slate-700">
              <Building2 className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400 mx-auto mb-2" />
              <p className="text-2xl sm:text-3xl font-black font-heading text-white">{t('statCenters')}</p>
              <p className="text-[11px] sm:text-xs text-slate-400 mt-1">Smart Mandi Centers</p>
            </div>
            <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-800/60 border border-slate-700">
              <CalendarCheck className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400 mx-auto mb-2" />
              <p className="text-2xl sm:text-3xl font-black font-heading text-white">{t('statSlots')}</p>
              <p className="text-[11px] sm:text-xs text-slate-400 mt-1">Digital Appointments</p>
            </div>
            <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-800/60 border border-slate-700">
              <TrendingDown className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400 mx-auto mb-2" />
              <p className="text-2xl sm:text-3xl font-black font-heading text-emerald-400">{t('statWaitReduction')}</p>
              <p className="text-[11px] sm:text-xs text-slate-400 mt-1">Verified Time Saved</p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Core Features */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-16 space-y-3">
          <span className="text-xs font-bold text-emerald-700 uppercase tracking-widest bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
            System Features
          </span>
          <h2 className="text-2xl sm:text-4xl font-black text-slate-900 font-heading">
            Built for Farmers. Designed for Speed.
          </h2>
          <p className="text-sm sm:text-base text-slate-600">
            Every feature in FarmQ is engineered to respect farmers' valuable time and streamline procurement operations.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {features.map((f, i) => {
            const Icon = f.icon;
            return (
              <div key={i} className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs hover:shadow-md hover:border-emerald-300 transition-all group">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                  <Icon className="w-6 h-6" />
                </div>
                <h4 className="text-base font-bold text-slate-900 font-heading mb-2">{f.title}</h4>
                <p className="text-xs text-slate-600 leading-relaxed">{f.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* 5. How It Works (Step by Step Workflow) */}
      <section id="how-it-works" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-16 space-y-3">
          <span className="text-xs font-bold text-emerald-700 uppercase tracking-widest bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
            {t('howItWorks')}
          </span>
          <h2 className="text-2xl sm:text-4xl font-black text-slate-900 font-heading">
            The Complete Farmer Journey
          </h2>
          <p className="text-sm sm:text-base text-slate-600">
            From registration in your village to direct bank payment in 9 transparent steps.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {workflowSteps.map((step, idx) => (
            <div key={idx} className="relative bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs hover:border-emerald-300 transition-colors">
              <div className="flex items-center justify-between mb-3">
                <span className="text-2xl font-black text-emerald-600 font-heading">{step.num}</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              </div>
              <h4 className="text-base font-bold text-slate-900 mb-1 font-heading">{step.title}</h4>
              <p className="text-xs text-slate-600 leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 6. Procurement Centers Preview */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between mb-10 gap-4">
          <div>
            <span className="text-xs font-bold text-emerald-700 uppercase tracking-widest bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
              Live Mandis
            </span>
            <h2 className="text-3xl font-black text-slate-900 font-heading mt-2">Active Procurement Centers</h2>
          </div>
          <Link to="/centers" className="text-sm font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1">
            <span>View all 18 centers</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {centers.slice(0, 3).map((center) => (
            <div key={center.id} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-2 mb-4">
                <div>
                  <h3 className="font-bold text-slate-900 text-base">{center.name}</h3>
                  <p className="text-xs text-slate-500">{center.location.address}</p>
                </div>
                <span className={`text-[11px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider ${
                  center.status === 'low_queue' || center.status === 'open' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                }`}>
                  {center.status === 'low_queue' ? '🟢 Low Queue' : center.status === 'moderate_queue' ? '🟡 Moderate' : '🟢 OPEN'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 my-4 text-xs bg-slate-50 p-3 rounded-xl">
                <div>
                  <span className="text-slate-500">Queue Length:</span>
                  <p className="font-bold text-slate-900 text-sm">{center.queueLength} Farmers</p>
                </div>
                <div>
                  <span className="text-slate-500">Est. Wait Time:</span>
                  <p className="font-bold text-emerald-600 text-sm">~{center.estimatedWaitMinutes} mins</p>
                </div>
                <div className="mt-1">
                  <span className="text-slate-500">Today's Capacity:</span>
                  <p className="font-semibold text-slate-800">{center.capacityPerDay} Q</p>
                </div>
                <div className="mt-1">
                  <span className="text-slate-500">Remaining:</span>
                  <p className="font-semibold text-emerald-700">{center.remainingCapacity} Q</p>
                </div>
              </div>

              <Link
                to={`/farmer/book?centerId=${center.id}`}
                className="w-full text-center py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors block"
              >
                Book Slot at this Center
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* 7. Call To Action Footer Banner */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-700 p-6 sm:p-10 md:p-14 text-white text-center shadow-2xl relative overflow-hidden">
          <div className="max-w-2xl mx-auto space-y-6">
            <h2 className="text-2xl sm:text-4xl font-black font-heading">
              Ready to experience queue-free procurement?
            </h2>
            <p className="text-emerald-100 text-sm sm:text-base">
              Join over 1,250 farmers saving hours at the mandi. Register your harvest lot and get your priority token today.
            </p>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 sm:gap-4 pt-2">
              <Link
                to="/register"
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-white text-emerald-900 hover:bg-slate-100 font-bold text-sm shadow-md transition-colors text-center"
              >
                Register as Farmer
              </Link>
              <Link
                to="/login"
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-emerald-800/80 hover:bg-emerald-800 text-white font-bold text-sm border border-emerald-500/40 transition-colors text-center"
              >
                Login to Dashboard
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

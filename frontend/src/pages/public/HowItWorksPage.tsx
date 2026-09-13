import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, ShieldCheck, Smartphone, Clock, Cpu, Sparkles } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

export const HowItWorksPage: React.FC = () => {
  const { t } = useLanguage();

  const steps = [
    {
      num: "Step 01",
      title: "Farmer Registration & Profile",
      desc: "Farmers register in 30 seconds using their mobile number. Add basic village and district details. No sensitive financial documents required during sign-up.",
      icon: Smartphone
    },
    {
      num: "Step 02",
      title: "Add Crop Inventory",
      desc: "Register your harvested crops (Wheat, Rice, Mustard, Maize, Sugarcane, Potato). Enter estimated quintals and preferred date of mandi arrival.",
      icon: CheckCircle2
    },
    {
      num: "Step 03",
      title: "Smart Center Selection",
      desc: "Compare procurement centers by distance, live queue length, and available intake capacity. FarmQ Smart Recommendation highlights the mandi with the least waiting time.",
      icon: Sparkles
    },
    {
      num: "Step 04",
      title: "Choose Time Slot & Book",
      desc: "Select a 1-hour appointment window (e.g., 10:00 AM - 11:00 AM). The booking engine ensures counter capacity is not overbooked.",
      icon: Clock
    },
    {
      num: "Step 05",
      title: "Receive Live Token & QR Pass",
      desc: "Instantly receive a digital token number with an scannable QR code. Keep this pass ready on your phone or printed paper.",
      icon: ShieldCheck
    },
    {
      num: "Step 06",
      title: "AI Live Queue Tracking",
      desc: "Track your queue position from your village. Watch active tokens move in real time via WebSockets. The AI model predicts exact wait time and tells you when to travel.",
      icon: Cpu
    }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-16">
      <div className="text-center max-w-3xl mx-auto space-y-4">
        <span className="text-xs font-bold text-emerald-700 uppercase tracking-widest bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
          Step-by-Step Architecture
        </span>
        <h1 className="text-4xl sm:text-5xl font-black text-slate-900 font-heading">
          How FarmQ Eliminates Mandi Lines
        </h1>
        <p className="text-base text-slate-600">
          A seamless digital pipeline designed for Indian agricultural procurement centers and cooperatives.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {steps.map((step, idx) => {
          const Icon = step.icon;
          return (
            <div key={idx} className="bg-white rounded-3xl p-8 border border-slate-200 shadow-xs hover:border-emerald-300 hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-6">
                <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">{step.num}</span>
                <div className="w-10 h-10 rounded-xl bg-emerald-100/70 text-emerald-700 flex items-center justify-center">
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2 font-heading">{step.title}</h3>
              <p className="text-xs text-slate-600 leading-relaxed">{step.desc}</p>
            </div>
          );
        })}
      </div>

      {/* Presentation Callout */}
      <div className="bg-emerald-900 text-white rounded-3xl p-8 md:p-12 shadow-xl flex flex-col md:flex-row items-center justify-between gap-8">
        <div className="space-y-2 max-w-2xl">
          <h3 className="text-2xl font-bold font-heading">Want to test the full live queue workflow?</h3>
          <p className="text-emerald-200 text-sm">
            Login with the demo farmer account (<code className="bg-emerald-800 px-2 py-0.5 rounded text-white font-mono">demo-farmer</code>) to view Token #25 and see the live queue in action!
          </p>
        </div>
        <Link
          to="/login"
          className="px-6 py-3 rounded-xl bg-white text-emerald-950 font-bold text-sm shadow-md hover:bg-slate-100 transition-colors whitespace-nowrap"
        >
          Open Demo Login →
        </Link>
      </div>
    </div>
  );
};

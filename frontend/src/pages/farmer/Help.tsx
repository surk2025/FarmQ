import React from 'react';
import { Phone, Mail, HelpCircle, MessageSquare, ShieldCheck, ExternalLink } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

export const Help: React.FC = () => {
  const { t } = useLanguage();

  const faqs = [
    {
      q: "How does FarmQ determine when I should reach the procurement center?",
      a: "FarmQ tracks active queue velocity (farmers processed per hour) across operational weighing bays and uses our AI prediction model to calculate your turn. We recommend arriving ~20 minutes before your slot to avoid standing in multi-hour lines."
    },
    {
      q: "What happens if I arrive late for my booked slot?",
      a: "Your token will be marked as waiting in the standby queue. The center admin can resume your intake once the current active weighing batch is completed."
    },
    {
      q: "How is my crop payment processed?",
      a: "Once your crop passes physical moisture & quality verification and electronic weighbridge measurement, the mandi officer generates an official procurement receipt. Payment is credited directly to your bank account via Direct Benefit Transfer (DBT)."
    },
    {
      q: "Can I cancel or reschedule my booked procurement appointment?",
      a: "Yes, you can cancel an unfulfilled slot through your dashboard and choose another available date or procurement center."
    }
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-12">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 font-heading">
          {t('help')}
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Frequently asked questions, toll-free mandi helplines, and grievance redressal.
        </p>
      </div>

      {/* Emergency Helpline Callout */}
      <div className="bg-emerald-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="space-y-1">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">National Kisan Helpline</span>
          <h3 className="text-3xl font-black font-heading">1800-180-1551</h3>
          <p className="text-xs text-emerald-200">Toll-free 24x7 support in Hindi & regional languages</p>
        </div>
        <a
          href="tel:18001801551"
          className="px-6 py-3 bg-white text-emerald-950 font-bold text-xs rounded-xl shadow-xs hover:bg-slate-100 transition-colors whitespace-nowrap"
        >
          Call Helpline Now
        </a>
      </div>

      {/* FAQ Accordion List */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xl space-y-6">
        <h3 className="text-lg font-bold text-slate-900 font-heading">Frequently Asked Questions</h3>
        <div className="space-y-4">
          {faqs.map((faq, i) => (
            <div key={i} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1.5">
              <h4 className="text-sm font-bold text-slate-900 flex items-start gap-2">
                <span className="text-emerald-600 font-black">Q:</span>
                <span>{faq.q}</span>
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed pl-5">{faq.a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

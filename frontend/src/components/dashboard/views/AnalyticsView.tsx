import React, { useState } from 'react';
import {
  History,
  RotateCcw,
  CheckCircle2,
  Info,
  Calendar,
} from 'lucide-react';
import { HISTORICAL_CASE_STUDY } from '../../../data/dashboardData';
import { ResetDemoConfirmModal } from '../ResetDemoConfirmModal';

interface AnalyticsViewProps {
  onResetDemo: () => void;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ onResetDemo }) => {
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [showConfirmReset, setShowConfirmReset] = useState(false);

  const steps = HISTORICAL_CASE_STUDY.timeline_steps;

  const handleNextStep = () => {
    setActiveStepIndex((prev) => (prev + 1) % steps.length);
  };

  const handlePrevStep = () => {
    setActiveStepIndex((prev) => (prev - 1 + steps.length) % steps.length);
  };

  return (
    <div className="space-y-6 select-none">
      {/* View Header */}
      <div className="bg-white p-5 rounded-xl border border-[#DCE6EF] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-[#1769C2]" />
            <h2 className="font-serif text-[22px] font-normal text-[#10243B] leading-none">
              {HISTORICAL_CASE_STUDY.title}
            </h2>
          </div>
          <p className="text-[12px] text-[#526984] mt-1 max-w-2xl">
            {HISTORICAL_CASE_STUDY.citation}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowConfirmReset(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F5F8FC] hover:bg-slate-200 text-[#10243B] rounded-lg text-[12px] font-semibold border border-[#CADDF0] transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Demo State</span>
          </button>
        </div>

        <ResetDemoConfirmModal
          isOpen={showConfirmReset}
          onClose={() => setShowConfirmReset(false)}
          onConfirm={onResetDemo}
        />
      </div>

      {/* Limitation Notice */}
      <div className="p-4 bg-amber-50/80 border border-amber-300 rounded-xl flex items-start gap-3">
        <Info className="w-5 h-5 text-amber-800 shrink-0 mt-0.5" />
        <div className="text-[12px] text-amber-950 leading-relaxed">
          <strong className="font-semibold text-amber-900">CASE STUDY EVALUATION SCOPE:</strong>{' '}
          {HISTORICAL_CASE_STUDY.limitation_notice}
        </div>
      </div>

      {/* Case Study High-Level Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-[#DCE6EF] shadow-xs">
          <div className="text-[11px] font-bold text-[#526984] uppercase tracking-wider">
            Total Rain Surge
          </div>
          <div className="text-[24px] font-bold text-[#10243B] mt-1">
            {HISTORICAL_CASE_STUDY.total_rainfall_mm}{' '}
            <span className="text-[13px] font-normal text-[#526984]">mm</span>
          </div>
          <div className="text-[11px] text-[#526984] mt-0.5">48-hour convective monsoon</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#DCE6EF] shadow-xs">
          <div className="text-[11px] font-bold text-[#526984] uppercase tracking-wider">
            Peak Intensity
          </div>
          <div className="text-[24px] font-bold text-[#10243B] mt-1">
            {HISTORICAL_CASE_STUDY.peak_intensity_mm_hr}{' '}
            <span className="text-[13px] font-normal text-[#526984]">mm/hr</span>
          </div>
          <div className="text-[11px] text-red-700 font-semibold mt-0.5">Thane Creek Basin Spike</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#DCE6EF] shadow-xs">
          <div className="text-[11px] font-bold text-[#526984] uppercase tracking-wider">
            Citizen Reports Corroborated
          </div>
          <div className="text-[24px] font-bold text-[#10243B] mt-1">
            {HISTORICAL_CASE_STUDY.reports_logged}
          </div>
          <div className="text-[11px] text-[#526984] mt-0.5">Cross-referenced with ward logs</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#DCE6EF] shadow-xs">
          <div className="text-[11px] font-bold text-[#526984] uppercase tracking-wider">
            Model Precision
          </div>
          <div className="text-[24px] font-bold text-emerald-700 mt-1">
            85.7%
          </div>
          <div className="text-[11px] text-[#526984] mt-0.5">6 of 7 hotspots matched ground truth</div>
        </div>
      </div>

      {/* Interactive Step-by-Step Timeline Scrubber */}
      <div className="bg-white p-6 rounded-xl border border-[#DCE6EF] shadow-xs space-y-5">
        <div className="flex items-center justify-between border-b border-[#DCE6EF] pb-3">
          <div>
            <h3 className="font-serif text-[19px] font-normal text-[#10243B]">
              Event Sequence Playback
            </h3>
            <span className="text-[12px] text-[#526984]">
              Step {activeStepIndex + 1} of {steps.length}: {steps[activeStepIndex].hour}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrevStep}
              className="px-3 py-1 bg-[#F5F8FC] hover:bg-slate-200 text-[#10243B] rounded-lg text-[12px] font-semibold border border-[#CADDF0]"
            >
              &larr; Previous
            </button>
            <button
              type="button"
              onClick={handleNextStep}
              className="px-3 py-1 bg-[#1769C2] hover:bg-[#1257A2] text-white rounded-lg text-[12px] font-bold"
            >
              Next Step &rarr;
            </button>
          </div>
        </div>

        {/* Stepper Dots */}
        <div className="grid grid-cols-4 gap-3">
          {steps.map((st, idx) => (
            <button
              key={st.hour}
              type="button"
              onClick={() => setActiveStepIndex(idx)}
              className={`p-3 rounded-lg border text-left transition-all ${
                idx === activeStepIndex
                  ? 'border-[#1769C2] bg-blue-50/60 shadow-xs'
                  : 'border-[#DCE6EF] bg-[#F5F8FC]/50 hover:bg-[#F5F8FC]'
              }`}
            >
              <div className="text-[11px] font-bold text-[#526984]">{st.hour}</div>
              <div className="text-[12.5px] font-bold text-[#10243B] mt-1 truncate">
                {st.description.slice(0, 32)}...
              </div>
            </button>
          ))}
        </div>

        {/* Active Step Spotlight Card */}
        <div className="p-5 bg-[#F5F8FC] rounded-xl border border-[#DCE6EF] space-y-3">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#1769C2] text-white">
              <Calendar className="w-3.5 h-3.5" />
              {steps[activeStepIndex].hour}
            </span>

            <span className="text-[12px] font-semibold text-[#10243B]">
              Radar Band: <strong className="text-amber-800">{steps[activeStepIndex].radar_intensity}</strong>
            </span>
          </div>

          <p className="text-[14px] text-[#10243B] leading-relaxed">
            {steps[activeStepIndex].description}
          </p>

          <div className="pt-3 border-t border-[#DCE6EF] flex items-center justify-between text-[12px] text-[#526984]">
            <span>
              Active Inundation Reports: <strong>{steps[activeStepIndex].active_incidents}</strong>
            </span>
            <span className="text-emerald-700 font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Verified in TOI Regional Report
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

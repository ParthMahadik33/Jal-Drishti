import React, { useState } from 'react';
import { Settings, RotateCcw, Check, Sparkles } from 'lucide-react';
import { ResetDemoConfirmModal } from '../ResetDemoConfirmModal';

interface SettingsViewProps {
  onResetDemo: () => void;
  onTriggerRecurrenceSim: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  onResetDemo,
  onTriggerRecurrenceSim,
}) => {
  const [recurrenceWindowHours, setRecurrenceWindowHours] = useState('72');
  const [rainThreshold, setRainThreshold] = useState('20');
  const [autoFlagRecurrence, setAutoFlagRecurrence] = useState(true);
  const [savedNotice, setSavedNotice] = useState(false);
  const [showConfirmReset, setShowConfirmReset] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
  };

  return (
    <div className="space-y-6 select-none max-w-4xl">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-[#DCE6EF] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-[#1769C2]" />
            <h2 className="font-serif text-[22px] font-normal text-[#10243B] leading-none">
              Control Room Configuration
            </h2>
          </div>
          <p className="text-[12px] text-[#526984] mt-1">
            Operational thresholds for recurrence evaluation, notification routing, and demo fixtures.
          </p>
        </div>
      </div>

      {/* Form Settings */}
      <form onSubmit={handleSave} className="space-y-6">
        {/* Recurrence Rule Settings */}
        <div className="bg-white p-5 rounded-xl border border-[#DCE6EF] shadow-xs space-y-4">
          <div className="border-b border-[#DCE6EF] pb-3">
            <h3 className="font-serif text-[18px] font-normal text-[#10243B]">
              Recurrence Detection Rule Engine
            </h3>
            <p className="text-[12px] text-[#526984]">
              Configure temporal windows and threshold criteria that trigger the post-maintenance recurrence flag.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[13px]">
            <div>
              <label className="block text-[11.5px] font-bold text-[#10243B] uppercase tracking-wider mb-1">
                Post-Action Window (Hours)
              </label>
              <input
                type="number"
                value={recurrenceWindowHours}
                onChange={(e) => setRecurrenceWindowHours(e.target.value)}
                className="w-full px-3 py-2 bg-[#F5F8FC] border border-[#CADDF0] rounded-lg text-[#10243B] font-medium focus:outline-none focus:border-[#1769C2]"
              />
              <span className="text-[10.5px] text-[#526984] mt-0.5 block">
                Reports within this duration after recorded maintenance trigger a flag.
              </span>
            </div>

            <div>
              <label className="block text-[11.5px] font-bold text-[#10243B] uppercase tracking-wider mb-1">
                Trigger Rainfall Intensity (mm/hr)
              </label>
              <input
                type="number"
                value={rainThreshold}
                onChange={(e) => setRainThreshold(e.target.value)}
                className="w-full px-3 py-2 bg-[#F5F8FC] border border-[#CADDF0] rounded-lg text-[#10243B] font-medium focus:outline-none focus:border-[#1769C2]"
              />
              <span className="text-[10.5px] text-[#526984] mt-0.5 block">
                Minimum precipitation required to evaluate culvert drainage backwater.
              </span>
            </div>
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer pt-2">
            <input
              type="checkbox"
              checked={autoFlagRecurrence}
              onChange={(e) => setAutoFlagRecurrence(e.target.checked)}
              className="rounded text-[#1769C2] focus:ring-0"
            />
            <span className="text-[12.5px] text-[#10243B] font-medium">
              Elevate recurring hotspots to Rank 1 in Priority Action Queue automatically
            </span>
          </label>
        </div>

        {/* Demo Simulation Management */}
        <div className="bg-white p-5 rounded-xl border border-[#DCE6EF] shadow-xs space-y-4">
          <div className="border-b border-[#DCE6EF] pb-3">
            <h3 className="font-serif text-[18px] font-normal text-[#10243B]">
              Demo Simulation & Reset Controls
            </h3>
            <p className="text-[12px] text-[#526984]">
              Exercise the live recurrence workflow or restore deterministic fixtures for presentation.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onTriggerRecurrenceSim}
              className="flex items-center gap-2 px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-300 rounded-lg text-[12.5px] font-bold shadow-xs transition-colors"
            >
              <Sparkles className="w-4 h-4 text-amber-600" />
              <span>Simulate Follow-up Report (Triggers Recurrence)</span>
            </button>

            <button
              type="button"
              onClick={() => setShowConfirmReset(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[#F5F8FC] hover:bg-slate-200 text-[#10243B] border border-[#CADDF0] rounded-lg text-[12.5px] font-semibold transition-colors"
            >
              <RotateCcw className="w-4 h-4 text-[#526984]" />
              <span>Reset Demo State to Initial Fixtures</span>
            </button>
          </div>
        </div>

        {/* Confirmation Modal */}
        <ResetDemoConfirmModal
          isOpen={showConfirmReset}
          onClose={() => setShowConfirmReset(false)}
          onConfirm={onResetDemo}
        />

        {/* Save CTA */}
        <div className="flex items-center justify-between pt-2">
          {savedNotice ? (
            <span className="text-[12px] font-bold text-emerald-700 flex items-center gap-1.5 animate-fadeIn">
              <Check className="w-4 h-4" />
              Configuration updated successfully
            </span>
          ) : (
            <span className="text-[11.5px] text-[#526984]">
              Active Officer Session: P. Deshmukh (Zone 4 NMMC)
            </span>
          )}

          <button
            type="submit"
            className="px-5 py-2.5 bg-[#1769C2] hover:bg-[#1257A2] text-white rounded-lg text-[12.5px] font-bold shadow-xs transition-all"
          >
            Save Configuration
          </button>
        </div>
      </form>
    </div>
  );
};

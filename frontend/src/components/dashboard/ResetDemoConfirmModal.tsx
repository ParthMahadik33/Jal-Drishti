import React from 'react';
import { AlertTriangle, ShieldCheck, X } from 'lucide-react';

interface ResetDemoConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isResetting?: boolean;
}

export const ResetDemoConfirmModal: React.FC<ResetDemoConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  isResetting = false,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#10243B]/40 backdrop-blur-xs animate-fadeIn select-none">
      <div className="bg-white rounded-2xl border border-[#DCE6EF] shadow-xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-[#DCE6EF] flex items-center justify-between bg-amber-50/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-100 border border-amber-300 rounded-lg text-amber-800">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-[16px] text-[#10243B]">
                Reset Demonstration Fixtures
              </h3>
              <p className="text-[11.5px] text-[#526984]">
                Development & Sandbox Environment Control
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isResetting}
            className="text-[#526984] hover:text-[#10243B] p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <p className="text-[12.5px] text-[#10243B] leading-relaxed">
            You are requesting a demonstration reset. This re-synchronizes sample incidents and demonstration actions to the initial test baseline.
          </p>

          <div className="p-3.5 bg-emerald-50/80 border border-emerald-200 rounded-xl space-y-2 text-[12px] text-emerald-950">
            <div className="font-bold flex items-center gap-1.5 text-emerald-900">
              <ShieldCheck className="w-4 h-4 text-emerald-700" />
              <span>Operational Records Protection</span>
            </div>
            <ul className="space-y-1 text-[#2c5240] pl-5 list-disc text-[11.5px]">
              <li>Operational maintenance records (e.g. MNT-2026-048) are <strong>preserved</strong>.</li>
              <li>Autonomous collector observations and heartbeats are <strong>preserved</strong>.</li>
              <li>Ingested geographic features remain <strong>untouched</strong>.</li>
            </ul>
          </div>

          <p className="text-[11.5px] text-[#526984]">
            To prevent accidental loss during normal operations, destructive resets require deliberate confirmation.
          </p>
        </div>

        {/* Actions */}
        <div className="p-4 bg-[#F5F8FC] border-t border-[#DCE6EF] flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isResetting}
            className="px-4 py-2 bg-white hover:bg-slate-100 border border-[#CADDF0] text-[#10243B] rounded-lg text-[12.5px] font-semibold transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            disabled={isResetting}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[12.5px] font-bold shadow-xs transition-colors flex items-center gap-1.5"
          >
            {isResetting ? 'Resetting...' : 'Confirm Reset Demonstration State'}
          </button>
        </div>
      </div>
    </div>
  );
};

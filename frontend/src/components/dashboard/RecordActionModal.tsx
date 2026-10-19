import React, { useState } from 'react';
import { Wrench, X, Check } from 'lucide-react';
import type { PilotZone, MaintenanceAction } from '../../data/dashboardData';

interface RecordActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  zones: PilotZone[];
  defaultZoneId: string;
  isSaving?: boolean;
  onSaveAction: (actionData: {

    zone_id: string;
    action_type: MaintenanceAction['action_type'];
    actor: string;
    notes: string;
    verification_status: boolean;
  }) => void;
}

const ACTION_TYPES: MaintenanceAction['action_type'][] = [
  'Clean / Desilt',
  'Culvert Clearing',
  'Inspect',
  'Pump Deployment',
  'Engineering Assessment',
  'Monitor',
];

export const RecordActionModal: React.FC<RecordActionModalProps> = ({
  isOpen,
  onClose,
  zones,
  defaultZoneId,
  isSaving = false,
  onSaveAction,
}) => {
  const [zoneId, setZoneId] = useState(defaultZoneId);
  const [actionType, setActionType] = useState<MaintenanceAction['action_type']>('Clean / Desilt');
  const [actor, setActor] = useState('Officer P. Deshmukh (Zone 4 NMMC)');
  const [notes, setNotes] = useState('');
  const [verified, setVerified] = useState(true);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!notes.trim()) return;

    onSaveAction({
      zone_id: zoneId,
      action_type: actionType,
      actor: actor.trim(),
      notes: notes.trim(),
      verification_status: verified,
    });
    setNotes('');
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs select-none"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl max-w-lg w-full p-6 shadow-2xl border border-[#DCE6EF] space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#DCE6EF]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 text-[#1769C2] rounded-lg">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif text-[20px] font-normal text-[#10243B] leading-none">
                Record Maintenance Action
              </h3>
              <p className="text-[11.5px] text-[#526984] mt-0.5">
                Log completed municipal work into the permanent audit trail.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-[#526984] hover:text-[#10243B] rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-[13px]">
          {/* Target Pilot Zone */}
          <div>
            <label className="block text-[11.5px] font-bold text-[#10243B] uppercase tracking-wider mb-1">
              Location / Pilot Zone
            </label>
            <select
              value={zoneId}
              onChange={(e) => setZoneId(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-[#CADDF0] rounded-lg text-[#10243B] font-medium focus:outline-none focus:border-[#1769C2]"
            >
              {zones.map((z) => (
                <option key={z.zone_id} value={z.zone_id}>
                  {z.name} ({z.zone_id})
                </option>
              ))}
            </select>
          </div>

          {/* Action Type */}
          <div>
            <label className="block text-[11.5px] font-bold text-[#10243B] uppercase tracking-wider mb-1">
              Action Category
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {ACTION_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setActionType(type)}
                  className={`p-2 rounded-lg border text-left text-[11.5px] font-semibold transition-all ${
                    actionType === type
                      ? 'bg-[#1769C2] text-white border-[#1769C2] shadow-xs'
                      : 'bg-[#F5F8FC] text-[#10243B] border-[#DCE6EF] hover:bg-white'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Logged By / Crew */}
          <div>
            <label className="block text-[11.5px] font-bold text-[#10243B] uppercase tracking-wider mb-1">
              Assigned Supervisor / Crew
            </label>
            <input
              type="text"
              value={actor}
              onChange={(e) => setActor(e.target.value)}
              required
              className="w-full px-3 py-2 bg-white border border-[#CADDF0] rounded-lg text-[#10243B] font-medium focus:outline-none focus:border-[#1769C2]"
            />
          </div>

          {/* Action Notes / Evidence */}
          <div>
            <label className="block text-[11.5px] font-bold text-[#10243B] uppercase tracking-wider mb-1">
              Work Description & Field Observations
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Desilted 1.5t silt and debris from culvert grates. Gravity drainage outflow tested clear."
              required
              className="w-full px-3 py-2 bg-white border border-[#CADDF0] rounded-lg text-[#10243B] focus:outline-none focus:border-[#1769C2] placeholder:text-[#526984]/60"
            />
          </div>

          {/* Verification Checkbox */}
          <label className="flex items-center gap-2 cursor-pointer bg-[#F5F8FC] p-2.5 rounded-lg border border-[#DCE6EF]">
            <input
              type="checkbox"
              checked={verified}
              onChange={(e) => setVerified(e.target.checked)}
              className="rounded text-[#1769C2] focus:ring-0"
            />
            <div className="flex-1 text-[12px]">
              <strong className="text-[#10243B]">Field Completion Verified:</strong> Work inspected by zonal supervisor on-site.
            </div>
          </label>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-[#DCE6EF] flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-[#F5F8FC] hover:bg-slate-200 text-[#10243B] rounded-lg font-semibold text-[12px] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className={`px-5 py-2 bg-[#1769C2] hover:bg-[#1257A2] text-white rounded-lg font-bold text-[12px] shadow-xs transition-colors flex items-center gap-1.5 ${
                isSaving ? 'opacity-70 cursor-not-allowed' : ''
              }`}
            >
              <Check className="w-4 h-4" />
              <span>{isSaving ? 'Saving to Database...' : 'Record & Log Action'}</span>
            </button>

          </div>
        </form>
      </div>
    </div>
  );
};

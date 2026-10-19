import React from 'react';
import { Bell, X, ShieldAlert, Info, ArrowRight } from 'lucide-react';
import type { AlertNotification } from '../../data/dashboardData';

interface NotificationsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  alerts: AlertNotification[];
  onSelectZone: (zoneId: string) => void;
  onMarkAllRead: () => void;
}

export const NotificationsDrawer: React.FC<NotificationsDrawerProps> = ({
  isOpen,
  onClose,
  alerts,
  onSelectZone,
  onMarkAllRead,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex justify-end backdrop-blur-xs select-none"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white h-full shadow-2xl border-l border-[#DCE6EF] flex flex-col animate-slideLeft"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="p-4 border-b border-[#DCE6EF] flex items-center justify-between bg-[#F5F8FC]">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-[#1769C2]" />
            <h3 className="font-serif text-[18px] font-normal text-[#10243B] leading-none">
              Control Room Alerts
            </h3>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#1769C2] text-white">
              {alerts.filter((a) => !a.read).length} new
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onMarkAllRead}
              className="text-[11.5px] font-semibold text-[#1769C2] hover:underline"
            >
              Mark all read
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1 text-[#526984] hover:text-[#10243B] rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Alerts List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              onClick={() => {
                onSelectZone(alert.zone_id);
                onClose();
              }}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                alert.level === 'high'
                  ? 'bg-red-50/70 border-red-200 hover:border-red-400'
                  : alert.level === 'warning'
                  ? 'bg-amber-50/70 border-amber-200 hover:border-amber-400'
                  : 'bg-[#F5F8FC] border-[#DCE6EF] hover:border-[#CADDF0]'
              }`}
            >
              <div className="flex items-start gap-2.5">
                {alert.level === 'high' ? (
                  <ShieldAlert className="w-4 h-4 text-[#D94C55] shrink-0 mt-0.5" />
                ) : alert.level === 'warning' ? (
                  <ShieldAlert className="w-4 h-4 text-[#D9952C] shrink-0 mt-0.5" />
                ) : (
                  <Info className="w-4 h-4 text-[#1769C2] shrink-0 mt-0.5" />
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[12.5px] font-bold text-[#10243B] truncate">
                      {alert.title}
                    </span>
                    <span className="text-[10px] text-[#526984] whitespace-nowrap ml-2">
                      {alert.timestamp}
                    </span>
                  </div>
                  <p className="text-[11.5px] text-[#526984] leading-relaxed">
                    {alert.message}
                  </p>
                  <div className="mt-2 flex items-center gap-1 text-[11px] font-bold text-[#1769C2]">
                    <span>Inspect Zone</span>
                    <ArrowRight className="w-3 h-3" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Drawer Footer */}
        <div className="p-3 border-t border-[#DCE6EF] bg-[#F5F8FC] text-center text-[11px] text-[#526984]">
          Navi Mumbai Disaster Management &middot; Automated Rule Triggers
        </div>
      </div>
    </div>
  );
};

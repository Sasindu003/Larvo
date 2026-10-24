import React, { useState } from 'react';
import { Truck, MapPin, Calendar, Clock, Copy, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { ReturnPickupDTO } from './orderDetail.types';
import { formatDateTime } from './deriveReturnTimeline';

interface ReturnPickupInfoProps {
  pickup?: ReturnPickupDTO | null;
  status: string;
}

const PICKUP_SHOWN_STATUSES = new Set([
  'pickup_scheduled',
  'picked_up',
  'received',
  'refund_processing',
  'refunded',
]);

export const ReturnPickupInfo: React.FC<ReturnPickupInfoProps> = ({ pickup, status }) => {
  const [copied, setCopied] = useState(false);

  if (!PICKUP_SHOWN_STATUSES.has(status)) {
    return null;
  }

  const courierName = pickup?.courier?.trim() || 'Courier to be assigned';
  const waybill = pickup?.waybill?.trim();
  const address = pickup?.address?.trim() || 'Customer pickup destination';
  const scheduledDate = pickup?.scheduledDate
    ? formatDateTime(pickup.scheduledDate)
    : null;
  const timeWindow = pickup?.timeWindow?.trim() || null;

  const handleCopyWaybill = () => {
    if (!waybill) return;
    navigator.clipboard.writeText(waybill);
    setCopied(true);
    toast.success('Pickup waybill copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-[#FAF7F2] rounded-2xl p-4 sm:p-5 border border-[#EAE4D9] space-y-3.5 mt-5">
      <div className="flex items-center justify-between gap-3 border-b border-[#EAE4D9] pb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#EFEAE2] flex items-center justify-center text-[#141414]">
            <Truck className="w-4 h-4 text-[#141414]" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-[#8C867D] block">
              Pickup Logistics
            </span>
            <span className="text-xs font-semibold text-[#141414]">
              {courierName}
            </span>
          </div>
        </div>

        {waybill && (
          <div className="flex items-center gap-1.5 bg-white border border-[#E2DBD0] px-2.5 py-1 rounded-lg">
            <span className="text-[11px] font-mono text-[#141414]">
              {waybill}
            </span>
            <button
              type="button"
              onClick={handleCopyWaybill}
              className="p-1 rounded text-[#6B655D] hover:text-[#141414] hover:bg-[#F2ECE1] transition-colors cursor-pointer"
              title="Copy pickup waybill"
              aria-label="Copy pickup waybill"
            >
              {copied ? (
                <Check className="w-3 h-3 text-emerald-600" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        {(scheduledDate || timeWindow) && (
          <div className="flex items-start gap-2.5">
            <Calendar className="w-3.5 h-3.5 text-[#8C867D] mt-0.5 shrink-0" />
            <div>
              <span className="text-[10px] uppercase font-semibold text-[#8C867D] block">
                Scheduled Slot
              </span>
              <span className="text-xs text-[#2B2927]">
                {scheduledDate || 'Date pending'}
                {timeWindow && ` (${timeWindow})`}
              </span>
            </div>
          </div>
        )}

        <div className="flex items-start gap-2.5 sm:col-span-1">
          <MapPin className="w-3.5 h-3.5 text-[#8C867D] mt-0.5 shrink-0" />
          <div>
            <span className="text-[10px] uppercase font-semibold text-[#8C867D] block">
              Pickup Location
            </span>
            <span className="text-xs text-[#2B2927] leading-relaxed line-clamp-2" title={address}>
              {address}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReturnPickupInfo;

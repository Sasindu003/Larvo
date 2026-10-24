import React, { useEffect, useRef, useId } from 'react';
import { OrderDTO } from '../../../types/order';
import { deriveInvoiceNumber } from './orderTimeline';
import { formatDateTime, formatLKR } from '../../../utils/format';

export const InvoiceModal: React.FC<{ isOpen: boolean; onClose: () => void; order: OrderDTO }> = ({
  isOpen,
  onClose,
  order,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      closeButtonRef.current?.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const invoiceNumber = deriveInvoiceNumber(order.id, order.createdAt);
  const hasDiscount = typeof order.discount === 'number' && order.discount > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs print:p-0 print:bg-transparent"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-[#EAE4D9] space-y-5 print:shadow-none print:border-none print:p-0 print:max-w-none"
      >
        <div className="flex items-center justify-between pb-4 border-b border-[#F0EBE2] print:border-black">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-full bg-black text-white flex items-center justify-center font-bold text-xs">
              L
            </div>
            <h2 id={titleId} className="font-serif font-bold text-base tracking-widest text-[#141414]">
              LARVO INVOICE
            </h2>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#FAF7F2] hover:bg-neutral-200 flex items-center justify-center text-slate-600 transition-colors print:hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-black cursor-pointer"
            aria-label="Close invoice dialog"
          >
            &times;
          </button>
        </div>

        <div className="space-y-4 text-xs">
          <div className="flex justify-between">
            <div>
              <span className="text-[#8C867D] block">Invoice No:</span>
              <span className="font-mono font-bold text-[#141414]">{invoiceNumber}</span>
            </div>
            <div className="text-right">
              <span className="text-[#8C867D] block">Issue Date:</span>
              <span className="font-bold text-[#141414]">{formatDateTime(order.createdAt)}</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#FAF7F2] border border-[#EAE4D9] space-y-1 print:bg-white print:border-black">
            <div className="font-bold text-[#141414]">Billed To:</div>
            <div>{order.shippingAddress.line1}</div>
            <div>
              {order.shippingAddress.city}, {order.shippingAddress.province}{' '}
              {order.shippingAddress.postalCode}
            </div>
            <div>{order.shippingAddress.country}</div>
          </div>

          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#EAE4D9] text-[#8C867D] print:border-black">
                <th className="py-2 font-semibold">Item</th>
                <th className="py-2 text-center font-semibold">Qty</th>
                <th className="py-2 text-right font-semibold">Price</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0EBE2] print:divide-neutral-300">
              {order.items.map((item, i) => (
                <tr key={`${item.sku}-${i}`}>
                  <td className="py-2 font-medium text-[#141414]">
                    {item.productName} ({item.color}, {item.size})
                  </td>
                  <td className="py-2 text-center text-[#524D46]">{item.qty}</td>
                  <td className="py-2 text-right text-[#141414]">
                    {formatLKR(item.unitPrice * item.qty)}
                  </td>
                </tr>
              ))}
              <tr>
                <td className="py-2 text-[#7A756D]">Standard Express Shipping</td>
                <td className="py-2 text-center text-[#524D46]">1</td>
                <td className="py-2 text-right text-[#141414]">
                  {formatLKR(order.shippingFee)}
                </td>
              </tr>
              {hasDiscount && (
                <tr className="text-emerald-700">
                  <td className="py-2">Discount Applied</td>
                  <td className="py-2 text-center">1</td>
                  <td className="py-2 text-right">-{formatLKR(order.discount!)}</td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="pt-2 border-t border-[#EAE4D9] flex justify-between font-bold text-sm text-[#141414] print:border-black">
            <span>Total Paid ({order.payment.method})</span>
            <span className="font-serif">{formatLKR(order.total)}</span>
          </div>
        </div>

        <div className="pt-2 flex gap-2.5 print:hidden">
          <button
            type="button"
            onClick={() => window.print()}
            className="flex-1 py-2.5 rounded-xl bg-black hover:bg-neutral-800 text-white text-xs font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-black cursor-pointer"
          >
            Print / Save as PDF
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-[#FAF7F2] hover:bg-neutral-100 text-xs font-semibold text-[#141414] border border-[#EAE4D9] focus:outline-none focus-visible:ring-2 focus-visible:ring-black cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

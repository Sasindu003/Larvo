import React from 'react';
import {
  Building2,
  UploadCloud,
  FileText,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { UploadState } from './types';

interface BankTransferPaymentProps {
  grandTotal: number;
  slipFile: File | null;
  setSlipFile: (file: File | null) => void;
  slipPreviewUrl: string | null;
  setSlipPreviewUrl: (url: string | null) => void;
  uploadProgress: number;
  uploadState: UploadState;
  setUploadState: (state: UploadState) => void;
  uploadError: string | null;
  createdOrderId: string | null;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleUploadSlip: () => Promise<void>;
}

export const BankTransferPayment: React.FC<BankTransferPaymentProps> = ({
  grandTotal,
  slipFile,
  setSlipFile,
  slipPreviewUrl,
  setSlipPreviewUrl,
  uploadProgress,
  uploadState,
  setUploadState,
  uploadError,
  createdOrderId,
  handleFileChange,
  handleUploadSlip,
}) => {
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="mt-5 pt-5 border-t border-sand-200 space-y-5"
    >
      {/* Beneficiary Details Card */}
      <div className="bg-white rounded-xl border border-sand-200 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-bold uppercase tracking-wider text-ink-500">
            Beneficiary Bank Details
          </div>
          <div className="text-xs font-bold text-ink-900">City Bank Ltd.</div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div>
            <span className="text-ink-500">Account Name:</span>{' '}
            <strong className="text-ink-900">Shop Online Ltd.</strong>
          </div>
          <div>
            <span className="text-ink-500">Account Number:</span>{' '}
            <strong className="text-ink-900 font-mono">1102938475001</strong>
          </div>
          <div>
            <span className="text-ink-500">Branch:</span>{' '}
            <strong className="text-ink-900">Gulshan-2, Dhaka</strong>
          </div>
          <div>
            <span className="text-ink-500">Amount Due:</span>{' '}
            <strong className="text-ink-900 font-bold text-sm">
              Rs. {grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </strong>
          </div>
        </div>
      </div>

      {/* File Upload Section */}
      <div className="space-y-3">
        <label className="block text-xs font-bold uppercase tracking-wider text-ink-700">
          Upload Deposit Slip / Transaction Screenshot
        </label>

        <div className="relative border-2 border-dashed border-sand-300 hover:border-ink-400 rounded-xl p-6 text-center transition-colors bg-white">
          <input
            id="slip-file-input"
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            onChange={handleFileChange}
            disabled={uploadState === 'uploading' || uploadState === 'success'}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
          />

          {!slipFile ? (
            <div className="space-y-2 pointer-events-none">
              <div className="w-10 h-10 rounded-full bg-sand-100 flex items-center justify-center mx-auto text-ink-600">
                <UploadCloud className="w-5 h-5" />
              </div>
              <div className="text-xs font-semibold text-ink-900">
                Click to select or drag and drop your slip
              </div>
              <div className="text-[11px] text-ink-500">
                JPEG, PNG, WebP, or PDF (Max 5MB)
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3 text-left">
                {slipPreviewUrl ? (
                  <img
                    src={slipPreviewUrl}
                    alt="Slip Preview"
                    className="w-14 h-14 object-cover rounded-lg border border-sand-200"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-sand-100 flex items-center justify-center text-ink-700">
                    <FileText className="w-6 h-6" />
                  </div>
                )}
                <div>
                  <p className="text-xs font-bold text-ink-900 truncate max-w-xs">
                    {slipFile.name}
                  </p>
                  <p className="text-[11px] text-ink-500">
                    {(slipFile.size / 1024).toFixed(1)} KB • {slipFile.type || 'Document'}
                  </p>
                </div>
              </div>

              {uploadState !== 'uploading' && uploadState !== 'success' && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSlipFile(null);
                    setSlipPreviewUrl(null);
                    setUploadState('idle');
                  }}
                >
                  Change File
                </Button>
              )}
            </div>
          )}
        </div>

        {uploadError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{uploadError}</span>
          </div>
        )}

        {uploadState === 'uploading' && (
          <div className="space-y-1.5 pt-1">
            <div className="flex justify-between text-xs text-ink-600 font-medium">
              <span>Uploading slip...</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="w-full h-2 bg-sand-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-ink-950 transition-all duration-200 rounded-full"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {uploadState === 'success' && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3 text-xs text-emerald-800">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-bold text-sm">Payment Slip Submitted!</div>
              <p>
                Your slip has been uploaded and your order is now <strong>Under Review</strong>. Click &quot;Complete Order&quot; below to proceed.
              </p>
            </div>
          </div>
        )}

        {uploadState !== 'success' && (
          <div className="pt-2 flex justify-end">
            <Button
              id="btn-upload-slip"
              type="button"
              variant="primary"
              onClick={handleUploadSlip}
              disabled={!slipFile || uploadState === 'uploading' || !createdOrderId}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2"
            >
              {uploadState === 'uploading' ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Submitting Slip...</span>
                </>
              ) : (
                <>
                  <UploadCloud className="w-4 h-4" />
                  <span>Upload Slip & Submit</span>
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

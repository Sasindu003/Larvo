import { useState } from 'react';
import toast from 'react-hot-toast';
import { orderService, Order, Payment } from '../../services/order.service';
import { UploadState } from './types';

export function useSlipUpload(
  createdOrderId: string | null,
  onSuccess: (order: Order, payment: Payment) => void,
) {
  const [slipFile, setSlipFile] = useState<File | null>(null);
  const [slipPreviewUrl, setSlipPreviewUrl] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('File size exceeds the 5MB limit. Please upload a smaller file.');
      return;
    }

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      setUploadError('Only image (JPEG, PNG, WebP, GIF) or PDF files are accepted.');
      return;
    }

    setSlipFile(file);
    if (file.type.startsWith('image/')) {
      setSlipPreviewUrl(URL.createObjectURL(file));
    } else {
      setSlipPreviewUrl(null);
    }
    setUploadState('idle');
    setUploadProgress(0);
  };

  const handleUploadSlip = async () => {
    if (!slipFile) {
      setUploadError('Please select a file to upload');
      return;
    }
    if (!createdOrderId) {
      setUploadError('Order not initialized. Please retry.');
      return;
    }

    setUploadState('uploading');
    setUploadProgress(0);
    setUploadError(null);

    try {
      const res = await orderService.uploadPaymentSlip(
        createdOrderId,
        slipFile,
        (percent) => setUploadProgress(percent),
      );
      onSuccess(res.order, res.payment);
      setUploadState('success');
      toast.success('Payment slip uploaded successfully! Under review.');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to upload payment slip';
      setUploadState('error');
      setUploadError(message);
      toast.error(message);
    }
  };

  return {
    slipFile,
    setSlipFile,
    slipPreviewUrl,
    setSlipPreviewUrl,
    uploadProgress,
    uploadState,
    setUploadState,
    uploadError,
    handleFileChange,
    handleUploadSlip,
  };
}

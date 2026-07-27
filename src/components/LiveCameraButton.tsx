import React, { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Camera } from 'lucide-react';
import { useLiveCamera } from '@/hooks/useLiveCamera';
import { useUser } from '@/firebase';
import { v4 as uuidv4 } from 'uuid';

/**
 * LiveCameraButton – opens the device camera, shows a preview, and uploads the image.
 * Props:
 *   fieldName – identifier for the uploaded image (e.g., 'marksheet' or 'aadhar').
 *   onUpload – optional callback receiving the download URL after upload.
 */
export function LiveCameraButton({ fieldName, onUpload }: { fieldName: string; onUpload?: (url: string) => void }) {
  const { preview, capture, upload, uploading } = useLiveCamera();
  const { user } = useUser();

  const handleCapture = useCallback(async () => {
    const dataUrl = await capture();
    if (!dataUrl) return;
    // generate a storage path – include uid if available
    const uid = user?.uid ?? 'anonymous';
    const path = `capturedPhotos/${uid}/${fieldName}_${uuidv4()}.jpg`;
    const downloadUrl = await upload(dataUrl, path);
    if (onUpload) onUpload(downloadUrl);
    // show preview automatically
    // preview is already set by capture hook
  }, [capture, upload, fieldName, user, onUpload]);

  return (
    <div className="flex flex-col items-center gap-2">
      <Button
        type="button"
        variant="secondary"
        size="icon"
        className="h-12 w-12 rounded-xl shadow-lg hover:scale-105 transition-transform"
        onClick={handleCapture}
        disabled={uploading}
        aria-label="Capture photo"
      >
        <Camera className="h-6 w-6" />
      </Button>
      {preview && (
        <div className="mt-2 w-32 h-32 rounded-xl overflow-hidden bg-white/10 backdrop-blur-md border border-white/20">
          <img src={preview} alt="preview" className="object-cover w-full h-full" />
        </div>
      )}
    </div>
  );
}

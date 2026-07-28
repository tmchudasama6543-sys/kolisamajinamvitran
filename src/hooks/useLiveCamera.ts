import { useState, useCallback } from 'react';
import { getDownloadURL, ref, uploadString } from 'firebase/storage';
import { initializeFirebase } from '@/firebase'; // existing firebase config

/**
 * Hook to capture a photo from the device camera, preview it, and upload to Firebase Storage.
 * Returns:
 *   - preview: Data URL of the captured image (or null).
 *   - capture: async function to invoke the camera and set preview.
 *   - upload: async function (dataUrl, path) => download URL.
 *   - uploading: boolean flag while upload is in progress.
 */
export function useLiveCamera() {
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const capture = useCallback(async (): Promise<string | undefined> => {
    if (!navigator.mediaDevices?.getUserMedia) {
      alert('Camera not supported on this device');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      const video = document.createElement('video');
      video.srcObject = stream;
      await video.play();

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // stop camera
      stream.getTracks().forEach((track) => track.stop());

      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      setPreview(dataUrl);
      return dataUrl;
    } catch (e) {
      console.error('Camera capture failed', e);
      alert('Unable to access camera');
    }
  }, []);

  const upload = useCallback(async (dataUrl: string, path: string): Promise<string> => {
    setUploading(true);
    const { storage } = initializeFirebase();
    const storageRef = ref(storage, path);
    await uploadString(storageRef, dataUrl, 'data_url');
    const url = await getDownloadURL(storageRef);
    setUploading(false);
    return url;
  }, []);

  return { preview, capture, upload, uploading };
}

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { X, Camera, RefreshCw, Check, SwitchCamera } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { compressImageToBase64 } from '@/lib/image';

interface CameraModalProps {
  open: boolean;
  onClose: () => void;
  /** Called with base64 data-URL of the captured+compressed image */
  onCapture: (dataUrl: string) => void;
}

export function CameraModal({ open, onClose, onCapture }: CameraModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [captured, setCaptured] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [compressing, setCompressing] = useState(false);

  // Start camera
  const startCamera = useCallback(async (facing: 'environment' | 'user') => {
    // Stop existing stream first
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setError(null);
    setLoading(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (e: any) {
      setError('કૅમેરો ખોલી શકાયો નહીં. કૅમેરા પરવાનગી આપો.');
      console.error('Camera error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  useEffect(() => {
    if (open) {
      setCaptured(null);
      setError(null);
      startCamera(facingMode);
    } else {
      stopCamera();
      setCaptured(null);
      setError(null);
    }
    return () => { stopCamera(); };
  }, [open]); // eslint-disable-line

  const switchCamera = useCallback(async () => {
    const next = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(next);
    setCaptured(null);
    await startCamera(next);
  }, [facingMode, startCamera]);

  const handleCapture = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setCaptured(dataUrl);
    // Pause live feed while showing preview
    video.pause();
  }, []);

  const handleRetake = useCallback(() => {
    setCaptured(null);
    if (videoRef.current) videoRef.current.play();
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!captured) return;
    setCompressing(true);
    try {
      // Convert dataUrl to File for compression
      const res = await fetch(captured);
      const blob = await res.blob();
      const file = new File([blob], 'camera.jpg', { type: 'image/jpeg' });
      const compressed = await compressImageToBase64(file);
      onCapture(compressed);
      onClose();
    } catch {
      // If compression fails, use original
      onCapture(captured);
      onClose();
    } finally {
      setCompressing(false);
    }
  }, [captured, onCapture, onClose]);

  const handleClose = useCallback(() => {
    stopCamera();
    setCaptured(null);
    onClose();
  }, [stopCamera, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="camera-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] bg-black flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 z-10">
            <button
              onClick={handleClose}
              className="h-11 w-11 rounded-full bg-white/10 text-white flex items-center justify-center active:scale-95 transition-transform"
            >
              <X className="h-6 w-6" />
            </button>
            <span className="text-white font-black text-sm uppercase tracking-widest">
              {captured ? 'ફોટો ચકાસો' : 'કૅમેરો'}
            </span>
            {!captured && (
              <button
                onClick={switchCamera}
                className="h-11 w-11 rounded-full bg-white/10 text-white flex items-center justify-center active:scale-95 transition-transform"
              >
                <SwitchCamera className="h-5 w-5" />
              </button>
            )}
            {captured && <div className="w-11" />}
          </div>

          {/* Camera / Preview area */}
          <div className="flex-1 relative overflow-hidden flex items-center justify-center bg-black">
            {error ? (
              <div className="text-center px-8 space-y-4">
                <div className="w-20 h-20 bg-rose-500/20 rounded-full flex items-center justify-center mx-auto">
                  <Camera className="h-10 w-10 text-rose-400" />
                </div>
                <p className="text-white font-bold text-base">{error}</p>
                <button
                  onClick={() => startCamera(facingMode)}
                  className="mt-2 px-6 py-3 bg-white text-black font-black rounded-xl active:scale-95 transition-transform"
                >
                  ફરી પ્રયાસ કરો
                </button>
              </div>
            ) : captured ? (
              <img
                src={captured}
                alt="captured"
                className="w-full h-full object-contain"
              />
            ) : (
              <>
                {loading && (
                  <div className="absolute inset-0 flex items-center justify-center z-10">
                    <div className="w-16 h-16 rounded-full border-4 border-white/20 border-t-white animate-spin" />
                  </div>
                )}
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                  style={{ opacity: loading ? 0.3 : 1, transition: 'opacity 0.3s' }}
                />
                {/* Viewfinder corners */}
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute top-8 left-8 w-10 h-10 border-l-4 border-t-4 border-white/70 rounded-tl-lg" />
                  <div className="absolute top-8 right-8 w-10 h-10 border-r-4 border-t-4 border-white/70 rounded-tr-lg" />
                  <div className="absolute bottom-8 left-8 w-10 h-10 border-l-4 border-b-4 border-white/70 rounded-bl-lg" />
                  <div className="absolute bottom-8 right-8 w-10 h-10 border-r-4 border-b-4 border-white/70 rounded-br-lg" />
                </div>
              </>
            )}
            <canvas ref={canvasRef} className="hidden" />
          </div>

          {/* Bottom controls */}
          <div className="flex items-center justify-center gap-8 py-8 bg-black">
            {captured ? (
              <>
                {/* Retake */}
                <button
                  onClick={handleRetake}
                  className="flex flex-col items-center gap-1 active:scale-95 transition-transform"
                >
                  <div className="h-14 w-14 rounded-full bg-white/10 border-2 border-white/30 flex items-center justify-center">
                    <RefreshCw className="h-6 w-6 text-white" />
                  </div>
                  <span className="text-white/70 text-xs font-bold">ફરી પાડો</span>
                </button>

                {/* Confirm */}
                <button
                  onClick={handleConfirm}
                  disabled={compressing}
                  className="flex flex-col items-center gap-1 active:scale-95 transition-transform"
                >
                  <div className="h-20 w-20 rounded-full bg-emerald-500 border-4 border-emerald-300 flex items-center justify-center shadow-lg shadow-emerald-500/40">
                    {compressing
                      ? <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                      : <Check className="h-9 w-9 text-white" strokeWidth={3} />
                    }
                  </div>
                  <span className="text-white text-xs font-black">ઉપયોગ કરો</span>
                </button>
              </>
            ) : (
              /* Capture button */
              <button
                onClick={handleCapture}
                disabled={loading || !!error}
                className="active:scale-95 transition-transform disabled:opacity-40"
              >
                <div className="h-20 w-20 rounded-full bg-white border-4 border-white/50 shadow-lg flex items-center justify-center">
                  <div className="h-16 w-16 rounded-full bg-white border-4 border-black/10" />
                </div>
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

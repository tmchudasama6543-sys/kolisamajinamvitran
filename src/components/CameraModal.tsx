'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { X, Camera, RefreshCw, Check, FlipHorizontal2 } from 'lucide-react';

interface CameraModalProps {
  open: boolean;
  onClose: () => void;
  onCapture: (dataUrl: string) => void;
}

export function CameraModal({ open, onClose, onCapture }: CameraModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [captured, setCaptured] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const stopStream = useCallback(() => {
    const stream = streamRef.current;
    if (stream) {
      stream.getTracks().forEach((t) => { try { t.stop(); } catch (_) {} });
      streamRef.current = null;
    }
    const v = videoRef.current;
    if (v) {
      v.srcObject = null;
    }
  }, []);

  const startStream = useCallback(async (facing: 'environment' | 'user') => {
    stopStream();
    setErrorMsg(null);
    setLoading(true);

    // Check if getUserMedia supported
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== 'function'
    ) {
      setErrorMsg('આ browser / device Camera API ને support કરતો નથી.');
      setLoading(false);
      return;
    }

    try {
      const constraints: MediaStreamConstraints = {
        audio: false,
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      const v = videoRef.current;
      if (!v) { stopStream(); return; }

      v.srcObject = stream;
      v.setAttribute('autoplay', '');
      v.setAttribute('muted', '');
      v.setAttribute('playsinline', '');

      // Use oncanplay event to play (more reliable on mobile)
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('timeout')), 8000);
        v.oncanplay = () => {
          clearTimeout(timeout);
          v.play().then(resolve).catch(reject);
        };
        // If already ready
        if (v.readyState >= 3) {
          clearTimeout(timeout);
          v.play().then(resolve).catch(reject);
        }
      });

    } catch (e: any) {
      console.error('Camera error:', e);
      let msg = 'કૅમેરો ખોલી શકાયો નહીં.';
      if (e?.name === 'NotAllowedError' || e?.name === 'PermissionDeniedError') {
        msg = 'Camera permission denied. Browser settings માં Camera permission enable કરો.';
      } else if (e?.name === 'NotFoundError') {
        msg = 'Device પર Camera મળ્યો નહીં.';
      } else if (e?.name === 'NotReadableError') {
        msg = 'Camera બીજા app વડે ઉપયોગ થઈ રહ્યો છે. ફરી પ્રયાસ કરો.';
      }
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  }, [stopStream]);

  // Open/close lifecycle
  useEffect(() => {
    if (open) {
      setCaptured(null);
      setErrorMsg(null);
      startStream(facingMode);
    } else {
      stopStream();
      setCaptured(null);
      setErrorMsg(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleCapture = useCallback(() => {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c) return;

    const w = v.videoWidth || v.clientWidth || 1280;
    const h = v.videoHeight || v.clientHeight || 720;
    c.width = w;
    c.height = h;

    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(v, 0, 0, w, h);
    const dataUrl = c.toDataURL('image/jpeg', 0.9);
    setCaptured(dataUrl);
    try { v.pause(); } catch (_) {}
  }, []);

  const handleRetake = useCallback(() => {
    setCaptured(null);
    try { videoRef.current?.play(); } catch (_) {}
  }, []);

  const handleConfirm = useCallback(() => {
    if (!captured) return;
    onCapture(captured);
    stopStream();
    onClose();
  }, [captured, onCapture, onClose, stopStream]);

  const handleFlip = useCallback(async () => {
    const next = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(next);
    setCaptured(null);
    await startStream(next);
  }, [facingMode, startStream]);

  const handleClose = useCallback(() => {
    stopStream();
    setCaptured(null);
    onClose();
  }, [stopStream, onClose]);

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: '#000',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' }}>
        <button
          onClick={handleClose}
          style={{
            width: 44, height: 44, borderRadius: '50%',
            background: 'rgba(255,255,255,0.15)', border: 'none',
            color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <X size={22} />
        </button>

        <span style={{ color: '#fff', fontWeight: 900, fontSize: 13, letterSpacing: 2, textTransform: 'uppercase' }}>
          {captured ? 'ફોટો ચકાસો' : 'લાઈવ કૅમેરો'}
        </span>

        {!captured ? (
          <button
            onClick={handleFlip}
            style={{
              width: 44, height: 44, borderRadius: '50%',
              background: 'rgba(255,255,255,0.15)', border: 'none',
              color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <FlipHorizontal2 size={20} />
          </button>
        ) : <div style={{ width: 44 }} />}
      </div>

      {/* Main area */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {errorMsg ? (
          <div style={{ textAlign: 'center', padding: '0 32px' }}>
            <div style={{
              width: 80, height: 80, borderRadius: '50%',
              background: 'rgba(239,68,68,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px',
            }}>
              <Camera size={36} color="#f87171" />
            </div>
            <p style={{ color: '#fff', fontWeight: 700, fontSize: 15, lineHeight: 1.5, marginBottom: 16 }}>{errorMsg}</p>
            <button
              onClick={() => startStream(facingMode)}
              style={{
                padding: '12px 28px', borderRadius: 12,
                background: '#fff', color: '#000',
                border: 'none', fontWeight: 900, fontSize: 14, cursor: 'pointer',
              }}
            >
              ફરી પ્રયાસ કરો
            </button>
          </div>
        ) : captured ? (
          <img
            src={captured}
            alt="captured"
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        ) : (
          <>
            {loading && (
              <div style={{
                position: 'absolute', inset: 0, zIndex: 10,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(0,0,0,0.5)',
              }}>
                <div style={{
                  width: 60, height: 60, borderRadius: '50%',
                  border: '4px solid rgba(255,255,255,0.2)',
                  borderTopColor: '#fff',
                  animation: 'spin 0.8s linear infinite',
                }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </div>
            )}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                opacity: loading ? 0.3 : 1,
                transition: 'opacity 0.3s',
                display: 'block',
              }}
            />
            {/* Corner guides */}
            {!loading && (
              <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                {[
                  { top: 32, left: 32, borderTop: '4px solid rgba(255,255,255,0.7)', borderLeft: '4px solid rgba(255,255,255,0.7)', borderRadius: '8px 0 0 0' },
                  { top: 32, right: 32, borderTop: '4px solid rgba(255,255,255,0.7)', borderRight: '4px solid rgba(255,255,255,0.7)', borderRadius: '0 8px 0 0' },
                  { bottom: 32, left: 32, borderBottom: '4px solid rgba(255,255,255,0.7)', borderLeft: '4px solid rgba(255,255,255,0.7)', borderRadius: '0 0 0 8px' },
                  { bottom: 32, right: 32, borderBottom: '4px solid rgba(255,255,255,0.7)', borderRight: '4px solid rgba(255,255,255,0.7)', borderRadius: '0 0 8px 0' },
                ].map((s, i) => (
                  <div key={i} style={{ position: 'absolute', width: 36, height: 36, ...s }} />
                ))}
              </div>
            )}
          </>
        )}
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>

      {/* Bottom controls */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 40, padding: '28px 0', background: '#000',
      }}>
        {captured ? (
          <>
            {/* Retake */}
            <button
              onClick={handleRetake}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                background: 'none', border: 'none', cursor: 'pointer',
              }}
            >
              <div style={{
                width: 56, height: 56, borderRadius: '50%',
                background: 'rgba(255,255,255,0.12)', border: '2px solid rgba(255,255,255,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <RefreshCw size={22} color="#fff" />
              </div>
              <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: 700 }}>ફરી પાડો</span>
            </button>

            {/* Confirm */}
            <button
              onClick={handleConfirm}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                background: 'none', border: 'none', cursor: 'pointer',
              }}
            >
              <div style={{
                width: 76, height: 76, borderRadius: '50%',
                background: '#22c55e', border: '4px solid #86efac',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 0 24px rgba(34,197,94,0.4)',
              }}>
                <Check size={34} color="#fff" strokeWidth={3} />
              </div>
              <span style={{ color: '#fff', fontSize: 12, fontWeight: 900 }}>ઉપયોગ કરો</span>
            </button>
          </>
        ) : (
          /* Shutter button */
          <button
            onClick={handleCapture}
            disabled={loading || !!errorMsg}
            style={{
              width: 76, height: 76, borderRadius: '50%',
              background: '#fff', border: '5px solid rgba(255,255,255,0.4)',
              cursor: loading || errorMsg ? 'not-allowed' : 'pointer',
              opacity: loading || errorMsg ? 0.4 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 0 3px rgba(255,255,255,0.2)',
              padding: 0,
            }}
          >
            <div style={{
              width: 62, height: 62, borderRadius: '50%',
              background: '#fff', border: '3px solid rgba(0,0,0,0.08)',
            }} />
          </button>
        )}
      </div>
    </div>
  );
}

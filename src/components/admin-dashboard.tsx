'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Users, MapPin, BarChart3, Plus, Loader2, Camera, CheckSquare,
  Save, ArrowLeft, Image, Trash2, Eye, X, ZoomIn, ZoomOut, Download, RefreshCw,
  Award, TrendingUp, Sparkles, PieChart, Star, CheckCircle2
} from 'lucide-react';
import { useCollection, useMemoFirebase, useFirestore, useUser, saveStudentWithPhotosNonBlocking } from '@/firebase';
import { collection, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { useMemo, useState, useEffect, useCallback, useId, useRef } from 'react';
import { Skeleton } from './ui/skeleton';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { palitanaVillages } from '@/lib/palitana-villages';
import { academicStandards } from '@/lib/standards';
import { compressImageToBase64 } from '@/lib/image';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { SearchableSelect } from '@/components/ui/searchable-select';

const gujaratiRegex = /^[\u0A80-\u0AFF\s\.\(\)\-]+$/;

const formSchema = z.object({
  studentName: z.string().min(1, 'નામ જરૂરી').regex(gujaratiRegex, 'ગુજરાતી અક્ષરો'),
  villageName: z.string().min(1, 'ગામ પસંદ કરો'),
  standard: z.string().min(1, 'ધોરણ પસંદ કરો'),
  mobileNumber: z.string().length(10, '૧૦ આંકડો'),
  totalMarks: z.coerce.number().min(1).or(z.literal('')),
  obtainedMarks: z.coerce.number().min(0).or(z.literal('')),
}).refine(d => {
  if (d.totalMarks !== '' && d.obtainedMarks !== '') return Number(d.obtainedMarks) <= Number(d.totalMarks);
  return true;
}, { message: 'મેળ. ગુણ > કુલ ગુણ ન હોય', path: ['obtainedMarks'] });

type FormValues = z.infer<typeof formSchema>;

type StudentData = {
  id: string; name: string; standard: string; villageName: string;
  percentage: number; mobileNumber: string; totalMarks: number;
  obtainedMarks: number; submissionDateTime: any;
};

function normalizeBase64(d: string) {
  if (!d) return d;
  return d.startsWith('data:') ? d : `data:image/jpeg;base64,${d}`;
}

export default function AdminPanel() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const uid = useId();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photos, setPhotos] = useState<{ marksheet: string | null; aadhar: string | null }>({ marksheet: null, aadhar: null });
  const [compressing, setCompressing] = useState<{ marksheet: boolean; aadhar: boolean }>({ marksheet: false, aadhar: false });
  const [percentage, setPercentage] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  // Preview states
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  const [dragging, setDragging] = useState(false);
  const dragOrigin = useRef({ x: 0, y: 0 });

  const openPreview = (src: string) => { 
    setPreviewSrc(src); 
    setZoom(1); 
    setPan({ x: 0, y: 0 }); 
    window.location.hash = window.location.hash.includes('add') ? 'add&preview' : 'preview';
  };
  const closePreview = () => {
    setPreviewSrc(null);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    if (window.location.hash.includes('preview')) {
      if (window.location.hash.includes('add')) window.location.hash = 'add';
      else window.location.hash = '';
    }
  };

  // ── Panning Logic ─────────────────────────────────────────────────────────
  const onMove = useCallback((e: any) => {
    if (!dragging) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    setPan({ x: clientX - dragOrigin.current.x, y: clientY - dragOrigin.current.y });
  }, [dragging]);

  const onStart = useCallback((e: any) => {
    setDragging(true);
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    dragOrigin.current.x = clientX - pan.x;
    dragOrigin.current.y = clientY - pan.y;
  }, [pan]);

  const onEnd = useCallback(() => setDragging(false), []);

  useEffect(() => {
    if (dragging) {
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onEnd);
      window.addEventListener('touchmove', onMove, { passive: false });
      window.addEventListener('touchend', onEnd);
    }
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
    };
  }, [dragging, onMove, onEnd]);

  // ── Explicit Triggers for Camera/Gallery ──────────────────────────────────
  const triggerCamera = useCallback((field: 'marksheet' | 'aadhar') => {
    if (typeof window !== 'undefined' && (window as any).AppInventor) {
      try { (window as any).AppInventor.setWebViewString(`camera_${field}`); } catch (_) {}
    }
    document.getElementById(`${uid}-${field}-cam`)?.click();
  }, [uid]);

  const triggerGallery = useCallback((field: 'marksheet' | 'aadhar') => {
    if (typeof window !== 'undefined' && (window as any).AppInventor) {
      try { (window as any).AppInventor.setWebViewString(`gallery_${field}`); } catch (_) {}
    }
    document.getElementById(`${uid}-${field}-gal`)?.click();
  }, [uid]);
  const handleDownload = () => {
    if (!previewSrc) return;
    const a = document.createElement('a'); a.href = previewSrc;
    a.download = `doc_${Date.now()}.jpg`; a.click();
  };

  // Register App Inventor callback
  useEffect(() => {
    if (typeof window === 'undefined') return;
    (window as any).handleNativeImage = (field: 'marksheet' | 'aadhar', base64: string) => {
      if (!base64) return;
      setCompressing(p => ({ ...p, [field]: false }));
      setPhotos(p => ({ ...p, [field]: normalizeBase64(base64) }));
    };
    return () => { delete (window as any).handleNativeImage; };
  }, []);

  // Hash-based back navigation
  useEffect(() => {
    const fn = () => { 
      if (!window.location.hash.includes('add')) setIsDialogOpen(false); 
      if (!window.location.hash.includes('preview')) {
        setPreviewSrc(null);
        setZoom(1);
        setPan({ x: 0, y: 0 });
      }
    };
    window.addEventListener('hashchange', fn);
    return () => window.removeEventListener('hashchange', fn);
  }, []);

  const openAdd = () => { setIsDialogOpen(true); window.location.hash = 'add'; };
  const closeAdd = () => {
    setIsDialogOpen(false);
    if (window.location.hash.includes('add')) window.location.hash = '';
  };

  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>, field: 'marksheet' | 'aadhar') => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setCompressing(p => ({ ...p, [field]: true }));
    try {
      const b64 = await compressImageToBase64(file);
      setPhotos(p => ({ ...p, [field]: b64 }));
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'ભૂલ', description: err.message });
    } finally {
      setCompressing(p => ({ ...p, [field]: false }));
    }
  }, [toast]);

  const studentsQuery = useMemoFirebase(
    () => query(collection(firestore, 'students'), orderBy('submissionDateTime', 'desc')),
    [firestore]
  );
  const { data: students, isLoading } = useCollection<StudentData>(studentsQuery);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { studentName: '', villageName: '', standard: '', mobileNumber: '', totalMarks: '' as any, obtainedMarks: '' as any },
  });
  const { watch, handleSubmit, reset } = form;
  const watched = watch();

  useEffect(() => {
    const t = Number(watched.totalMarks), o = Number(watched.obtainedMarks);
    setPercentage(t > 0 && watched.obtainedMarks !== '' ? ((o / t) * 100).toFixed(2) : '');
  }, [watched.totalMarks, watched.obtainedMarks]);

  const stats = useMemo(() => {
    if (!students || students.length === 0) return {
      total: 0,
      totalVillages: 0,
      avgPercentage: '0.00',
      highScorers: 0,
      gradeBreakdown: [
        { label: '90%+ (A1 શ્રેણી)', count: 0, barColor: 'bg-emerald-500' },
        { label: '80% - 89% (A2 શ્રેણી)', count: 0, barColor: 'bg-teal-500' },
        { label: '70% - 79% (B1 શ્રેણી)', count: 0, barColor: 'bg-indigo-500' },
        { label: '60% - 69% (B2 શ્રેણી)', count: 0, barColor: 'bg-amber-500' },
        { label: '60% થી ઓછા', count: 0, barColor: 'bg-slate-400' },
      ],
      villageDist: [],
      standardDist: [],
    };

    const vMap = new Map<string, number>();
    const sMap = new Map<string, number>();
    let sumPct = 0;
    let highCount = 0;
    let g90 = 0, g80 = 0, g70 = 0, g60 = 0, gLess = 0;

    for (const s of students) {
      if (s.villageName) vMap.set(s.villageName, (vMap.get(s.villageName) || 0) + 1);
      if (s.standard) sMap.set(s.standard, (sMap.get(s.standard) || 0) + 1);

      const pct = typeof s.percentage === 'number' ? s.percentage : parseFloat(s.percentage || '0');
      sumPct += pct;

      if (pct >= 80) highCount++;
      if (pct >= 90) g90++;
      else if (pct >= 80) g80++;
      else if (pct >= 70) g70++;
      else if (pct >= 60) g60++;
      else gLess++;
    }

    const total = students.length;
    const avgPct = total > 0 ? (sumPct / total).toFixed(2) : '0.00';

    return {
      total,
      totalVillages: vMap.size,
      avgPercentage: avgPct,
      highScorers: highCount,
      gradeBreakdown: [
        { label: '90%+ (A1 શ્રેણી)', count: g90, barColor: 'bg-emerald-500' },
        { label: '80% - 89% (A2 શ્રેણી)', count: g80, barColor: 'bg-teal-500' },
        { label: '70% - 79% (B1 શ્રેણી)', count: g70, barColor: 'bg-indigo-500' },
        { label: '60% - 69% (B2 શ્રેણી)', count: g60, barColor: 'bg-amber-500' },
        { label: '60% થી ઓછા', count: gLess, barColor: 'bg-slate-400' },
      ],
      villageDist: Array.from(vMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 15),
      standardDist: Array.from(sMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 15),
    };
  }, [students]);

  const onSubmit = useCallback(async (values: FormValues) => {
    if (isSubmitting || !user?.uid) return;
    setIsSubmitting(true);
    try {
      saveStudentWithPhotosNonBlocking(firestore, {
        name: values.studentName.trim(), villageName: values.villageName,
        standard: values.standard, mobileNumber: values.mobileNumber,
        totalMarks: Number(values.totalMarks), obtainedMarks: Number(values.obtainedMarks),
        percentage: parseFloat(percentage || '0'), enteredByUserId: user.uid,
        submissionDateTime: serverTimestamp(),
      }, {
        marksheetPhotoBase64: photos.marksheet || '',
        aadhaarPhotoBase64: photos.aadhar || '',
      }).catch(err => toast({ variant: 'destructive', title: 'ભૂલ', description: err.message }));
      reset(); setPhotos({ marksheet: null, aadhar: null }); setShowConfirm(false); closeAdd();
      toast({ title: 'સફળ!', description: 'ડેટા સફળ રીતે સેવ થઈ ગઈ!' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'ભૂલ', description: err.message || 'ભૂલ' });
    } finally { setIsSubmitting(false); }
  }, [user, photos, firestore, percentage, reset, toast, isSubmitting]);

  if (isLoading) return <div className="p-6"><Skeleton className="h-60 w-full rounded-3xl" /></div>;

  // ── Shared Photo Preview Modal ────────────────────────────────────────────
  const PreviewModal = previewSrc ? (
    <div className="fixed inset-0 z-[9999] bg-black/96 flex flex-col animate-in fade-in duration-200 touch-none overflow-hidden">
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[10000] flex items-center gap-1.5 bg-white/10 backdrop-blur-md px-3 py-2 rounded-full border border-white/20">
        <button onClick={() => setZoom(z => Math.max(z - 0.4, 0.5))} className="h-9 w-9 rounded-full text-white hover:bg-white/20 flex items-center justify-center active:scale-90 transition-transform">
          <ZoomOut className="h-4 w-4" />
        </button>
        <span className="text-white font-black text-xs font-mono px-2 min-w-[3rem] text-center select-none">{Math.round(zoom * 100)}%</span>
        <button onClick={() => setZoom(z => Math.min(z + 0.4, 5))} className="h-9 w-9 rounded-full text-white hover:bg-white/20 flex items-center justify-center active:scale-90 transition-transform">
          <ZoomIn className="h-4 w-4" />
        </button>
        <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} className="h-9 w-9 rounded-full text-white hover:bg-white/20 flex items-center justify-center active:scale-90 transition-transform">
          <RefreshCw className="h-4 w-4" />
        </button>
        <div className="w-px h-5 bg-white/20 mx-1" />
        <button onClick={handleDownload} className="h-9 w-9 rounded-full text-white hover:bg-white/20 flex items-center justify-center active:scale-90 transition-transform">
          <Download className="h-4 w-4" />
        </button>
      </div>
      <div className="absolute top-4 right-4 z-[10000]">
        <button onClick={closePreview} className="h-11 w-11 rounded-full bg-white/15 text-white border border-white/20 hover:bg-white/25 active:scale-95 flex items-center justify-center transition-all">
          <X className="h-6 w-6" />
        </button>
      </div>
      <div className="w-full h-full flex items-center justify-center p-14 overflow-hidden" onClick={closePreview}>
        <div onClick={e => e.stopPropagation()}>
          <img
            src={previewSrc} alt="Preview"
            onMouseDown={onStart}
            onTouchStart={onStart}
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              maxHeight: '82vh', maxWidth: '94vw', objectFit: 'contain',
              transition: dragging ? 'none' : 'transform 0.15s ease-out',
              userSelect: 'none', pointerEvents: dragging ? 'none' : 'auto',
              cursor: dragging ? 'grabbing' : 'grab',
            }}
            className="shadow-2xl rounded-xl"
            onDragStart={e => e.preventDefault()}
          />
        </div>
      </div>
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/40 text-xs font-semibold select-none">
        બંધ કરવા ↑ ઉપર ટૅપ કરો
      </div>
    </div>
  ) : null;

  // ── Reusable Photo Upload Block (JSX, not inner component) ────────────────
  const renderPhotoBlock = (f: 'marksheet' | 'aadhar') => {
    const label = f === 'marksheet' ? '📄 માર્કશીટ' : '🪪 આધાર કાર્ડ';
    const camId = `${uid}-${f}-cam`;
    const galId = `${uid}-${f}-gal`;
    const photo = photos[f];
    const loading = compressing[f];
    return (
      <div key={f} className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black uppercase text-slate-600 tracking-wider">{label}</span>
          <span className="text-[10px] font-semibold text-slate-400">(ઐચ્છિક)</span>
        </div>
        <div className={cn("w-full rounded-2xl border-2 border-dashed transition-all overflow-hidden",
          photo ? "border-emerald-400 bg-emerald-50/30" : "border-slate-200 bg-slate-50")}>
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-2 py-6">
              <Loader2 className="h-7 w-7 animate-spin text-emerald-500" />
              <span className="text-[10px] font-bold text-emerald-600">ફોટો સંકુચિત...</span>
            </div>
          ) : photo ? (
            <div className="p-3">
              <img src={photo} className="w-full max-h-36 object-contain rounded-xl shadow-sm cursor-zoom-in hover:opacity-90 transition-opacity"
                alt="preview" onClick={() => openPreview(photo)} style={{ pointerEvents: 'auto' }} />
              <div className="flex flex-wrap gap-1.5 mt-2.5 justify-center">
                <button type="button" onClick={() => openPreview(photo)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 active:scale-95 transition-all shadow-sm">
                  <Eye className="h-3 w-3" /> જુઓ
                </button>
                <button type="button" onClick={() => triggerCamera(f)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 active:scale-95 transition-all shadow-sm cursor-pointer">
                  <Camera className="h-3 w-3" /> કૅમ
                </button>
                <button type="button" onClick={() => triggerGallery(f)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200 active:scale-95 transition-all shadow-sm cursor-pointer">
                  <Image className="h-3 w-3" /> ગેલ
                </button>
                <button type="button" onClick={() => setPhotos(p => ({ ...p, [f]: null }))}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 active:scale-95 transition-all shadow-sm">
                  <Trash2 className="h-3 w-3" /> ડિલ
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2.5 p-5 text-center">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ફોટો ઉમેરો</p>
              <div className="grid grid-cols-2 gap-2 w-full max-w-[200px]">
                <button type="button" onClick={() => triggerCamera(f)}
                  className="flex flex-col items-center justify-center gap-1 h-12 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-black shadow-sm active:scale-95 transition-transform cursor-pointer">
                  <Camera className="h-4 w-4" />
                  <span className="text-[9px] font-black">કૅમેરો</span>
                </button>
                <button type="button" onClick={() => triggerGallery(f)}
                  className="flex flex-col items-center justify-center gap-1 h-12 rounded-xl bg-slate-700 hover:bg-slate-800 text-white font-black shadow-sm active:scale-95 transition-transform cursor-pointer">
                  <Image className="h-4 w-4" />
                  <span className="text-[9px] font-black">ગેલેરી</span>
                </button>
              </div>
            </div>
          )}
          <input id={camId} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => handleFile(e, f)} />
          <input id={galId} type="file" accept="image/*" className="hidden" onChange={e => handleFile(e, f)} />
        </div>
      </div>
    );
  };

  // ── Add Entry Full Page ───────────────────────────────────────────────────
  if (isDialogOpen) {
    return (
      <>
        <div className="w-full flex flex-col gap-6 animate-in fade-in duration-300 pb-32">
          {/* Back nav */}
          <div className="pb-5 border-b-4 border-slate-50 flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={closeAdd}
              className="h-11 w-11 rounded-full border-2 border-slate-200 hover:border-primary hover:bg-primary/5 transition-all active:scale-95 shadow-sm shrink-0">
              <ArrowLeft className="h-5 w-5 text-slate-700" />
            </Button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-primary tracking-tight leading-tight">
                📋 નવી એન્ટ્રી ઉમેરો
              </h1>
              <p className="text-muted-foreground font-semibold uppercase tracking-widest text-[10px]">
                સચોટ માહિતી ભરો
              </p>
            </div>
          </div>

          <div className="max-w-2xl mx-auto w-full p-4 sm:p-10 space-y-5 sm:space-y-7 bg-white rounded-2xl sm:rounded-[2rem] shadow-2xl border border-slate-100">
            <Form {...form}>
              <form id="admin-entry-form" onSubmit={handleSubmit(() => setShowConfirm(true))} className="space-y-5 sm:space-y-7">
                {/* 1 & 2. Photos */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                  {renderPhotoBlock('marksheet')}
                  {renderPhotoBlock('aadhar')}
                </div>

                {/* 3. Name */}
                <FormField control={form.control} name="studentName" render={({ field }) => (
                  <FormItem className="space-y-2">
                    <FormLabel className="font-black text-xs uppercase text-slate-500 tracking-widest px-1">👤 વિદ્યાર્થીનું નામ (ગુજરાતીમાં)</FormLabel>
                    <FormControl><Input placeholder="નામ લખો" {...field} className="h-14 font-black text-lg text-slate-900 rounded-2xl border-2 px-5 bg-slate-50/30" /></FormControl>
                    <FormMessage className="font-bold text-rose-500" />
                  </FormItem>
                )} />

                {/* 4. Standard */}
                <FormField control={form.control} name="standard" render={({ field }) => (
                  <FormItem className="space-y-2">
                    <FormLabel className="font-black text-xs uppercase text-slate-500 tracking-widest px-1">🎓 ધોરણ</FormLabel>
                    <SearchableSelect options={academicStandards} value={field.value} onSelect={field.onChange} placeholder="ધોરણ પસંદ કરો..." label="ધોરણ" />
                    <FormMessage className="font-bold text-rose-500" />
                  </FormItem>
                )} />

                {/* 5. Village */}
                <FormField control={form.control} name="villageName" render={({ field }) => (
                  <FormItem className="space-y-2">
                    <FormLabel className="font-black text-xs uppercase text-slate-500 tracking-widest px-1">📍 ગામનું નામ</FormLabel>
                    <SearchableSelect options={palitanaVillages} value={field.value} onSelect={field.onChange} placeholder="ગામ પસંદ કરો..." label="ગામ" />
                    <FormMessage className="font-bold text-rose-500" />
                  </FormItem>
                )} />

                {/* 6. Mobile Number */}
                <FormField control={form.control} name="mobileNumber" render={({ field }) => (
                  <FormItem className="space-y-2">
                    <FormLabel className="font-black text-xs uppercase text-emerald-600 tracking-widest px-1">📱 મોબાઈલ નંબર</FormLabel>
                    <FormControl>
                      <Input type="tel" {...field}
                        onChange={e => { const v = e.target.value.replace(/\D/g, ''); if (v.length <= 10) field.onChange(v); }}
                        className="h-14 font-black text-lg text-slate-900 rounded-2xl border-2 px-5 bg-emerald-50/10" />
                    </FormControl>
                    <FormMessage className="font-bold text-rose-500" />
                  </FormItem>
                )} />

                {/* 7. Obtained Marks */}
                <FormField control={form.control} name="obtainedMarks" render={({ field }) => (
                  <FormItem className="space-y-2">
                    <FormLabel className="font-black text-xs uppercase text-emerald-600 tracking-widest px-1 block text-center">✅ મેળવેલ ગુણ</FormLabel>
                    <FormControl><Input type="number" {...field} className="h-14 font-black text-lg text-slate-900 text-center rounded-2xl border-2 bg-slate-50/30" /></FormControl>
                    <FormMessage className="font-bold text-rose-500 text-center" />
                  </FormItem>
                )} />

                {/* 8. Total Marks */}
                <FormField control={form.control} name="totalMarks" render={({ field }) => (
                  <FormItem className="space-y-2">
                    <FormLabel className="font-black text-xs uppercase text-emerald-600 tracking-widest px-1 block text-center">📊 કુલ ગુણ</FormLabel>
                    <FormControl><Input type="number" {...field} className="h-14 font-black text-lg text-slate-900 text-center rounded-2xl border-2 bg-slate-50/30" /></FormControl>
                    <FormMessage className="font-bold text-rose-500 text-center" />
                  </FormItem>
                )} />

                {/* 9. Percentage */}
                <div className="space-y-2 pt-1">
                  <span className="font-black text-xs uppercase text-emerald-600 tracking-widest px-1 block text-center">% ટકાવારી (ઓટોમેટિક)</span>
                  <div className={cn("h-16 rounded-2xl flex items-center justify-center font-black text-2xl font-mono border-2 transition-all shadow-md", percentage ? "bg-emerald-500 text-white border-emerald-600" : "bg-slate-50 text-slate-300 border-slate-200")}>
                    {percentage ? `${percentage}%` : '—'}
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button type="button" variant="outline" onClick={closeAdd} className="h-14 rounded-xl font-black border-2 text-lg flex-1">
                    રદ
                  </Button>
                  <Button type="submit" disabled={isSubmitting} className="h-14 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-xl shadow-lg text-lg flex items-center justify-center gap-2 flex-1">
                    {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />} સાચવો
                  </Button>
                </div>
              </form>
            </Form>
          </div>

          {/* Confirmation overlay */}
          {showConfirm && (
            <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowConfirm(false)} />
              <div className="relative bg-white rounded-[2rem] shadow-2xl border border-slate-100 max-w-xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200 z-10 flex flex-col">
                <div className="p-5 border-b bg-slate-50 flex items-center justify-center gap-2 text-emerald-600 text-lg font-black uppercase">
                  <CheckSquare className="h-5 w-5" /> માહિતી ચકાસો
                </div>
                <div className="p-6 space-y-4">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">નામ</p>
                  <p className="text-2xl font-black text-slate-900 uppercase">{watched.studentName}</p>
                  <div className="grid grid-cols-2 gap-3">
                    {[['ગામ', watched.villageName], ['ધોરણ', watched.standard], ['મોબાઈલ', watched.mobileNumber], ['ટકા', percentage ? `${percentage}%` : '—']].map(([k, v]) => (
                      <div key={k} className="p-3 bg-slate-50 rounded-xl">
                        <p className="text-[9px] font-black text-slate-400 uppercase mb-0.5">{k}</p>
                        <p className="text-base font-black text-slate-900">{v}</p>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-3 border-t pt-3">
                    {[['કુલ ગુણ', String(watched.totalMarks)], ['મેળ. ગુણ', String(watched.obtainedMarks)]].map(([k, v]) => (
                      <div key={k} className="text-center">
                        <p className="text-[9px] font-black text-slate-400 uppercase">{k}</p>
                        <p className="text-lg font-black text-slate-900">{v}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="p-5 border-t bg-slate-50 flex gap-3">
                  <Button variant="outline" onClick={() => setShowConfirm(false)} className="h-12 rounded-xl font-black border-2 flex-1">સુધારો</Button>
                  <Button disabled={isSubmitting} onClick={handleSubmit(onSubmit)} className="bg-emerald-500 hover:bg-emerald-600 text-white h-12 rounded-xl font-black flex-1 shadow-lg flex items-center justify-center">
                    {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : 'હા, સેવ કરો'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
        {PreviewModal}
      </>
    );
  }

  // ── Dashboard Overview ────────────────────────────────────────────────────
  return (
    <>
      <div className="w-full flex flex-col gap-6 animate-in fade-in duration-500 pb-20">
        {/* Hero card */}
        <Card className="rounded-[2rem] border-none shadow-2xl bg-gradient-to-br from-primary via-accent to-primary overflow-hidden">
          <CardContent className="p-6 sm:p-10 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="bg-white/15 p-4 rounded-[1.5rem] backdrop-blur-md border border-white/20">
                <Users className="h-8 w-8 text-white" />
              </div>
              <div>
                <h2 className="text-4xl sm:text-6xl font-black tracking-tighter text-white leading-tight">{stats.total}</h2>
                <p className="text-xs sm:text-sm font-bold uppercase text-white/80 tracking-widest">કુલ નોંધાયેલ વિદ્યાર્થીઓ</p>
              </div>
            </div>
            <Button onClick={openAdd}
              className="h-14 px-8 rounded-2xl bg-white text-primary font-black text-lg hover:bg-slate-50 shadow-xl transition-transform active:scale-95">
              <Plus className="mr-2 h-6 w-6" /> નવી એન્ટ્રી
            </Button>
          </CardContent>
        </Card>

        {/* Smart KPI Summary Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="rounded-2xl border-none shadow-md bg-white p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-wider">કુલ નોંધાયેલ ગામો</p>
              <h3 className="text-3xl font-black text-slate-900 mt-1">{stats.totalVillages}</h3>
            </div>
            <div className="p-3 bg-teal-50 text-teal-600 rounded-2xl">
              <MapPin className="h-7 w-7" />
            </div>
          </Card>

          <Card className="rounded-2xl border-none shadow-md bg-white p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-wider">સરેરાશ ટકાવારી</p>
              <h3 className="text-3xl font-black text-slate-900 mt-1">{stats.avgPercentage}%</h3>
            </div>
            <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
              <Award className="h-7 w-7" />
            </div>
          </Card>

          <Card className="rounded-2xl border-none shadow-md bg-white p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-wider">૮૦% થી વધુ ટકા વાળા</p>
              <h3 className="text-3xl font-black text-slate-900 mt-1">{stats.highScorers} <span className="text-xs font-bold text-slate-400">વિદ્યાર્થી</span></h3>
            </div>
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
              <TrendingUp className="h-7 w-7" />
            </div>
          </Card>
        </div>

        {/* Grade Breakdown Analysis */}
        <Card className="rounded-[1.5rem] sm:rounded-[2rem] border-none shadow-xl bg-white overflow-hidden">
          <CardHeader className="p-5 border-b bg-slate-50/50 flex flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-xl shadow-sm">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-black uppercase tracking-tight text-slate-900">ટકાવારી શ્રેણી વિશ્લેષણ (Grade Breakdown)</h3>
                <p className="text-xs font-bold text-slate-400">વિદ્યાર્થીઓના પરિણામનું શ્રેણી વાઈઝ વિભાજન</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            {stats.gradeBreakdown.map(gb => {
              const pctOfTotal = stats.total > 0 ? ((gb.count / stats.total) * 100).toFixed(1) : '0';
              return (
                <div key={gb.label} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm font-black">
                    <span className="text-slate-800">{gb.label}</span>
                    <span className="text-slate-600 font-mono">{gb.count} વિદ્યાર્થી ({pctOfTotal}%)</span>
                  </div>
                  <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all duration-500", gb.barColor)} style={{ width: `${pctOfTotal}%` }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Stats cards for Village and Standard distribution */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {[
            { title: '📍 ગામ મુજબ વિતરણ', data: stats.villageDist, icon: MapPin, color: 'bg-teal-50 text-teal-700', barBg: 'bg-teal-500' },
            { title: '📊 ધોરણ મુજબ વિતરણ', data: stats.standardDist, icon: BarChart3, color: 'bg-indigo-50 text-indigo-700', barBg: 'bg-indigo-500' },
          ].map(sec => (
            <Card key={sec.title} className="rounded-[1.5rem] sm:rounded-[2rem] border-none shadow-xl bg-white overflow-hidden">
              <CardHeader className="p-5 border-b bg-slate-50/50 flex flex-row items-center gap-3">
                <div className={cn('p-2.5 rounded-xl shadow-sm', sec.color)}><sec.icon className="h-5 w-5" /></div>
                <h3 className="text-base font-black uppercase tracking-tight text-slate-900">{sec.title}</h3>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                {sec.data.length === 0 ? (
                  <p className="text-xs font-bold text-slate-400 text-center py-4">કોઈ ડેટા ઉપલબ્ધ નથી</p>
                ) : (
                  sec.data.map(([label, count]) => {
                    const share = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
                    return (
                      <div key={label} className="space-y-1">
                        <div className="flex items-center justify-between text-sm font-black">
                          <span className="text-slate-800">{label}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-400">{share}%</span>
                            <Badge className={cn('h-7 px-3 rounded-lg font-black border-none text-xs', sec.color)}>{count}</Badge>
                          </div>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className={cn("h-full rounded-full transition-all duration-300", sec.barBg)} style={{ width: `${share}%` }} />
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
      {PreviewModal}
    </>
  );
}

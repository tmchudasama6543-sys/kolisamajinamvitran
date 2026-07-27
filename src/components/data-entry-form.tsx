'use client';

import { useState, useEffect, useCallback, useMemo, useId, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2, RefreshCw, Camera, Lock, CheckCircle2, Save, Image, Trash2, Eye, X, ZoomIn, ZoomOut, Download } from 'lucide-react';
import { CameraModal } from '@/components/CameraModal';
import { useUser, useFirebase, saveStudentWithPhotosNonBlocking } from '@/firebase';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { serverTimestamp } from 'firebase/firestore';
import { palitanaVillages } from '@/lib/palitana-villages';
import { academicStandards } from '@/lib/standards';
import { cn } from '@/lib/utils';
import { compressImageToBase64 } from '@/lib/image';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { useToast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'motion/react';

const gujaratiRegex = /^[\u0A80-\u0AFF\s\.\(\)\-]+$/;

const formSchema = z.object({
  studentName: z.string().min(1, 'વિદ્યાર્થીનું નામ જરૂરી છે.').regex(gujaratiRegex, 'નામ માત્ર ગુજરાતી અક્ષરોમાં જ લખો.'),
  villageName: z.string().min(1, 'ગામ પસંદ કરો.'),
  standard: z.string().min(1, 'ધોરણ પસંદ કરો.'),
  mobileNumber: z.string().length(10, 'મોબાઈલ નંબર ૧૦ આંકડાનો હોવો જોઈએ.'),
  totalMarks: z.coerce.number().min(1, 'કુલ ગુણ ૧ થી વધુ હોવા જોઈએ.').or(z.literal('')),
  obtainedMarks: z.coerce.number().min(0, 'મેળવેલ ગુણ ૦ થી વધુ હોવા જોઈએ.').or(z.literal('')),
}).refine(data => {
  if (data.totalMarks !== '' && data.obtainedMarks !== '') {
    return Number(data.obtainedMarks) <= Number(data.totalMarks);
  }
  return true;
}, { message: "મેળવેલ ગુણ કુલ ગુણ કરતા વધારે ના હોઈ શકે.", path: ["obtainedMarks"] });

type FormValues = z.infer<typeof formSchema>;

function normalizeBase64(data: string): string {
  if (!data) return data;
  return data.startsWith('data:') ? data : `data:image/jpeg;base64,${data}`;
}

export default function CenterPanel() {
  const { user } = useUser();
  const { firestore, auth } = useFirebase();
  const { toast } = useToast();
  const router = useRouter();
  const uid = useId();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [photos, setPhotos] = useState<{ marksheet: string | null; aadhar: string | null }>({ marksheet: null, aadhar: null });
  const [compressing, setCompressing] = useState<{ marksheet: boolean; aadhar: boolean }>({ marksheet: false, aadhar: false });
  const [percentage, setPercentage] = useState<string>('');
  const [cameraTarget, setCameraTarget] = useState<'marksheet' | 'aadhar' | null>(null);

  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragOrigin = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    (window as any).handleNativeImage = (field: 'marksheet' | 'aadhar', base64: string) => {
      if (!base64) return;
      setCompressing(p => ({ ...p, [field]: false }));
      setPhotos(p => ({ ...p, [field]: normalizeBase64(base64) }));
    };
    return () => { delete (window as any).handleNativeImage; };
  }, []);

  const triggerCamera = useCallback((field: 'marksheet' | 'aadhar') => {
    setCameraTarget(field);
  }, []);

  const triggerGallery = useCallback((field: 'marksheet' | 'aadhar') => {
    if (typeof window !== 'undefined' && (window as any).AppInventor) {
      try { (window as any).AppInventor.setWebViewString(`gallery_${field}`); } catch (_) {}
    }
    document.getElementById(`${uid}-${field}-gal`)?.click();
  }, [uid]);

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

  const openPreview = (src: string) => { 
    setPreviewSrc(src); 
    setZoom(1); 
    setPan({ x: 0, y: 0 }); 
    window.location.hash = 'preview';
  };

  const closePreview = () => { 
    setPreviewSrc(null); 
    setZoom(1); 
    setPan({ x: 0, y: 0 }); 
    if (window.location.hash.includes('preview')) window.location.hash = '';
  };

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

  useEffect(() => {
    const handleHashChange = () => {
      if (!window.location.hash.includes('preview')) {
        setPreviewSrc(null);
        setZoom(1);
        setPan({ x: 0, y: 0 });
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleDownload = () => {
    if (!previewSrc) return;
    const a = document.createElement('a');
    a.href = previewSrc;
    a.download = `photo_${Date.now()}.jpg`;
    a.click();
  };

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

  const isApproved = useMemo(() => user?.accessApproved === true || user?.role === 'admin', [user]);

  const onSubmit = useCallback(async (values: FormValues) => {
    if (isSubmitting || !user?.uid) return;
    setIsSubmitting(true);
    try {
      const studentData = {
        name: values.studentName.trim(),
        villageName: values.villageName,
        standard: values.standard,
        mobileNumber: values.mobileNumber,
        totalMarks: Number(values.totalMarks),
        obtainedMarks: Number(values.obtainedMarks),
        percentage: parseFloat(percentage || '0'),
        enteredByUserId: user.uid,
        submissionDateTime: serverTimestamp(),
      };
      const photoData = {
        marksheetPhotoBase64: photos.marksheet || '',
        aadhaarPhotoBase64: photos.aadhar || '',
      };
      saveStudentWithPhotosNonBlocking(firestore, studentData, photoData).catch(err => {
        toast({ variant: 'destructive', title: 'ભૂલ', description: 'સેવ ભૂલ: ' + err.message });
      });
      setIsSuccess(true);
      reset();
      setPhotos({ marksheet: null, aadhar: null });
      toast({ title: 'સફળ!', description: 'માહિતી સફળતાપૂર્વક સેવ થઈ ગઈ છે.' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'ભૂલ', description: err.message || 'નેટવર્ક સમસ્યા.' });
    } finally {
      setIsSubmitting(false);
    }
  }, [user, photos, firestore, percentage, reset, toast, isSubmitting]);

  if (!isApproved) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center justify-center min-h-[80vh] p-4 w-full">
        <div className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl border-2 border-rose-100 p-10 text-center">
          <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-rose-100">
            <Lock className="h-10 w-10 text-rose-500" />
          </div>
          <h2 className="text-3xl font-black text-rose-700 mb-3 tracking-tight">ઍક્સેસ બંધ છે</h2>
          <p className="text-base font-semibold text-rose-400 mb-8 leading-relaxed">એડમિન દ્વારા મંજૂરી ન મળે ત્યાં સુધી ડેટા એન્ટ્રી કરી શકાશે નહીં.</p>
          <Button onClick={async () => { await signOut(auth); router.push('/'); }} className="h-14 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-2xl shadow-lg px-8 text-lg w-full active:scale-95 transition-transform">લૉગ આઉટ કરો</Button>
        </div>
      </motion.div>
    );
  }

  if (isSuccess) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center justify-center min-h-[80vh] p-4 w-full">
        <div className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl border-4 border-emerald-200 p-12 text-center">
          <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-emerald-200 animate-pulse-glow"><CheckCircle2 className="h-12 w-12 text-emerald-500" /></div>
          <h2 className="text-4xl font-black text-emerald-600 mb-4 tracking-tight">સફળ!</h2>
          <p className="text-base text-emerald-500 font-semibold mb-10">ડેટા સફળતાપૂર્વક સેવ થઈ ગયો.</p>
          <Button onClick={() => setIsSuccess(false)} className="h-16 px-10 text-xl font-black rounded-2xl bg-emerald-500 hover:bg-emerald-600 w-full shadow-xl active:scale-[0.98] transition-transform"><RefreshCw className="mr-3 h-6 w-6" /> બીજી એન્ટ્રી ઉમેરો</Button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl mx-auto px-2 sm:px-4 py-4 sm:py-8 w-full">
      <Card className="rounded-[1.5rem] sm:rounded-[2.5rem] border-none shadow-2xl bg-white overflow-hidden border-t-[6px] sm:border-t-[10px] border-emerald-500 w-full">
        <CardHeader className="p-6 sm:p-10 bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-emerald-100">
          <CardTitle className="text-2xl sm:text-4xl font-black text-emerald-800 tracking-tight leading-tight">📋 નવી વિદ્યાર્થી એન્ટ્રી</CardTitle>
          <CardDescription className="text-sm font-semibold text-emerald-600 mt-1">સચોટ અને સંપૂર્ણ માહિતી ભરો</CardDescription>
        </CardHeader>

        <CardContent className="p-6 sm:p-12">
          <Form {...form}>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 sm:space-y-12">

              {/* 1. Marksheet Photo */}
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-black uppercase text-slate-600 tracking-widest">📄 માર્કશીટ ફોટો</span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">(ઐચ્છિક)</span>
                </div>
                <div className={cn("rounded-2xl border-2 border-dashed overflow-hidden bg-slate-50 flex items-center justify-center transition-all", photos.marksheet ? 'aspect-video p-3 border-emerald-300 bg-emerald-50/20' : 'min-h-[160px] p-6')}>
                   {compressing.marksheet ? (
                     <div className="flex flex-col items-center justify-center gap-3 py-10 w-full"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /><span className="text-[11px] font-black text-emerald-600 uppercase tracking-widest">ફોટો સંકુચિત...</span></div>
                   ) : photos.marksheet ? (
                     <div className="relative w-full h-full group">
                       <img src={photos.marksheet} className="w-full h-full object-contain cursor-zoom-in rounded-xl shadow-sm" alt="preview" onClick={() => openPreview(photos.marksheet!)} />
                       <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-3 rounded-xl">
                         <Button type="button" variant="secondary" size="icon" className="h-12 w-12 rounded-xl shadow-lg" onClick={() => openPreview(photos.marksheet!)}><Eye className="h-6 w-6" /></Button>
                         <Button type="button" variant="secondary" size="icon" className="h-12 w-12 rounded-xl shadow-lg" onClick={() => triggerCamera('marksheet')}><Camera className="h-6 w-6" /></Button>
                         <Button type="button" variant="secondary" size="icon" className="h-12 w-12 rounded-xl shadow-lg" onClick={() => triggerGallery('marksheet')}><Image className="h-6 w-6" /></Button>
                         <Button type="button" variant="destructive" size="icon" className="h-12 w-12 rounded-xl shadow-lg" onClick={() => setPhotos(p => ({ ...p, marksheet: null }))}><Trash2 className="h-6 w-6" /></Button>
                       </div>
                     </div>
                   ) : (
                     <div className="flex flex-col items-center justify-center gap-4 w-full text-center">
                       <span className="text-xs font-black text-slate-400 uppercase tracking-widest">ફોટો ઉમેરો</span>
                       <div className="flex flex-col gap-3 w-full max-w-xs">
                         <button type="button" className="h-14 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-black flex items-center justify-center gap-2 text-sm shadow-md active:scale-95 transition-transform" onClick={() => triggerCamera('marksheet')}><Camera className="h-5 w-5" /><span>લાઈવ કૅમેરો</span></button>
                         <button type="button" className="h-14 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-black flex items-center justify-center gap-2 text-sm shadow-md active:scale-95 transition-transform" onClick={() => triggerGallery('marksheet')}><Image className="h-5 w-5" /><span>ગેલેરી</span></button>
                       </div>
                       <span className="text-[10px] font-bold text-slate-400">ના ઉમેરો તો પણ સેવ થશે</span>
                     </div>
                   )}
                   <input id={`${uid}-marksheet-gal`} type="file" className="hidden" accept="image/*" onChange={ev => handleFile(ev, 'marksheet')} />
                </div>
              </div>

              {/* 2. Aadhaar Photo */}
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-black uppercase text-slate-600 tracking-widest">🪪 આધાર કાર્ડ ફોટો</span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">(ઐચ્છિક)</span>
                </div>
                <div className={cn("rounded-2xl border-2 border-dashed overflow-hidden bg-slate-50 flex items-center justify-center transition-all", photos.aadhar ? 'aspect-video p-3 border-emerald-300 bg-emerald-50/20' : 'min-h-[160px] p-6')}>
                   {compressing.aadhar ? (
                     <div className="flex flex-col items-center justify-center gap-3 py-10 w-full"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /><span className="text-[11px] font-black text-emerald-600 uppercase tracking-widest">ફોટો સંકુચિત...</span></div>
                   ) : photos.aadhar ? (
                     <div className="relative w-full h-full group">
                       <img src={photos.aadhar} className="w-full h-full object-contain cursor-zoom-in rounded-xl shadow-sm" alt="preview" onClick={() => openPreview(photos.aadhar!)} />
                       <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-3 rounded-xl">
                         <Button type="button" variant="secondary" size="icon" className="h-12 w-12 rounded-xl shadow-lg" onClick={() => openPreview(photos.aadhar!)}><Eye className="h-6 w-6" /></Button>
                         <Button type="button" variant="secondary" size="icon" className="h-12 w-12 rounded-xl shadow-lg" onClick={() => triggerCamera('aadhar')}><Camera className="h-6 w-6" /></Button>
                         <Button type="button" variant="secondary" size="icon" className="h-12 w-12 rounded-xl shadow-lg" onClick={() => triggerGallery('aadhar')}><Image className="h-6 w-6" /></Button>
                         <Button type="button" variant="destructive" size="icon" className="h-12 w-12 rounded-xl shadow-lg" onClick={() => setPhotos(p => ({ ...p, aadhar: null }))}><Trash2 className="h-6 w-6" /></Button>
                       </div>
                     </div>
                   ) : (
                     <div className="flex flex-col items-center justify-center gap-4 w-full text-center">
                       <span className="text-xs font-black text-slate-400 uppercase tracking-widest">ફોટો ઉમેરો</span>
                       <div className="flex flex-col gap-3 w-full max-w-xs">
                         <button type="button" className="h-14 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-black flex items-center justify-center gap-2 text-sm shadow-md active:scale-95 transition-transform" onClick={() => triggerCamera('aadhar')}><Camera className="h-5 w-5" /><span>લાઈવ કૅમેરો</span></button>
                         <button type="button" className="h-14 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-black flex items-center justify-center gap-2 text-sm shadow-md active:scale-95 transition-transform" onClick={() => triggerGallery('aadhar')}><Image className="h-5 w-5" /><span>ગેલેરી</span></button>
                       </div>
                       <span className="text-[10px] font-bold text-slate-400">ના ઉમેરો તો પણ સેવ થશે</span>
                     </div>
                   )}
                   <input id={`${uid}-aadhar-gal`} type="file" className="hidden" accept="image/*" onChange={ev => handleFile(ev, 'aadhar')} />
                </div>
              </div>

              {/* 3. Name */}
              <FormField control={form.control} name="studentName" render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel className="text-[11px] font-black uppercase text-slate-500 tracking-widest px-1">👤 વિદ્યાર્થીનું નામ (ગુજરાતીમાં)</FormLabel>
                  <FormControl><Input placeholder="નામ લખો" {...field} className="h-16 font-black text-xl sm:text-2xl text-slate-900 rounded-2xl border-2 px-6 bg-slate-50/30 shadow-inner" /></FormControl>
                  <FormMessage className="font-bold text-rose-500" />
                </FormItem>
              )} />

              {/* 4. Standard */}
              <FormField control={form.control} name="standard" render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel className="text-[11px] font-black uppercase text-slate-500 tracking-widest px-1">🎓 ધોરણ</FormLabel>
                  <SearchableSelect options={academicStandards} value={field.value} onSelect={field.onChange} placeholder="ધોરણ પસંદ કરો..." label="ધોરણ" />
                  <FormMessage className="font-bold text-rose-500" />
                </FormItem>
              )} />

              {/* 5. Village */}
              <FormField control={form.control} name="villageName" render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel className="text-[11px] font-black uppercase text-slate-500 tracking-widest px-1">📍 ગામનું નામ</FormLabel>
                  <SearchableSelect options={palitanaVillages} value={field.value} onSelect={field.onChange} placeholder="ગામ પસંદ કરો..." label="ગામ" />
                  <FormMessage className="font-bold text-rose-500" />
                </FormItem>
              )} />

              {/* Mobile Number */}
              <FormField control={form.control} name="mobileNumber" render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel className="text-[11px] font-black uppercase text-emerald-600 tracking-widest px-1">📱 મોબાઈલ નંબર</FormLabel>
                  <FormControl><Input type="tel" {...field} onChange={e => { const v = e.target.value.replace(/\D/g, ''); if (v.length <= 10) field.onChange(v); }} className="h-16 font-black text-xl sm:text-2xl text-slate-900 rounded-2xl border-2 px-6 bg-emerald-50/10 shadow-inner" /></FormControl>
                  <FormMessage className="font-bold text-rose-500" />
                </FormItem>
              )} />

              {/* 6. Obtained Marks */}
              <FormField control={form.control} name="obtainedMarks" render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel className="text-[11px] font-black text-emerald-600 tracking-widest px-1 block text-center">✅ મેળવેલ ગુણ</FormLabel>
                  <FormControl><Input type="number" {...field} className="h-16 font-black text-xl sm:text-2xl text-slate-900 text-center rounded-2xl border-2 bg-slate-50/30 shadow-inner" /></FormControl>
                  <FormMessage className="font-bold text-rose-500 text-center" />
                </FormItem>
              )} />

              {/* 7. Total Marks */}
              <FormField control={form.control} name="totalMarks" render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel className="text-[11px] font-black text-emerald-600 tracking-widest px-1 block text-center">📊 કુલ ગુણ</FormLabel>
                  <FormControl><Input type="number" {...field} className="h-16 font-black text-xl sm:text-2xl text-slate-900 text-center rounded-2xl border-2 bg-slate-50/30 shadow-inner" /></FormControl>
                  <FormMessage className="font-bold text-rose-500 text-center" />
                </FormItem>
              )} />

              {/* 8. Percentage */}
              <div className="space-y-4 pt-2">
                <span className="text-[11px] font-black text-emerald-600 tracking-widest px-1 block text-center">% ટકાવારી (ઓટોમેટિક)</span>
                <div className={cn("h-20 sm:h-24 rounded-2xl flex items-center justify-center font-black text-4xl sm:text-5xl font-mono border-2 transition-all shadow-xl", percentage ? "bg-emerald-500 text-white border-emerald-600 shadow-emerald-100" : "bg-slate-50 text-slate-300 border-slate-200")}>{percentage ? `${percentage}%` : '—'}</div>
              </div>

              {/* 9. Save Button */}
              <Button type="submit" disabled={isSubmitting} className="w-full h-20 sm:h-24 rounded-2xl sm:rounded-[2.5rem] text-xl sm:text-3xl font-black bg-emerald-500 hover:bg-emerald-600 shadow-2xl transition-all mt-6 active:scale-95 group">
                {isSubmitting ? <Loader2 className="h-10 w-10 animate-spin" /> : <><Save className="mr-4 h-8 w-8 group-hover:scale-110 transition-transform" /> માહિતી સેવ કરો</>}
              </Button>

            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Preview Modal */}
      <AnimatePresence>
        {previewSrc && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[9999] bg-black/98 flex flex-col animate-in fade-in duration-200 touch-none overflow-hidden">
            <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[10000] flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-full border border-white/20">
               <button onClick={() => setZoom(z => Math.max(z - 0.4, 0.5))} className="h-10 w-10 rounded-full text-white hover:bg-white/20 flex items-center justify-center active:scale-90 transition-transform"><ZoomOut className="h-5 w-5" /></button>
               <span className="text-white font-black text-sm font-mono px-2 min-w-[3rem] text-center select-none">{Math.round(zoom * 100)}%</span>
               <button onClick={() => setZoom(z => Math.min(z + 0.4, 5))} className="h-10 w-10 rounded-full text-white hover:bg-white/20 flex items-center justify-center active:scale-90 transition-transform"><ZoomIn className="h-5 w-5" /></button>
               <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} className="h-10 w-10 rounded-full text-white hover:bg-white/20 flex items-center justify-center active:scale-90 transition-transform"><RefreshCw className="h-4 w-4" /></button>
               <div className="w-px h-6 bg-white/20 mx-1" />
               <button onClick={handleDownload} className="h-10 w-10 rounded-full text-white hover:bg-white/20 flex items-center justify-center active:scale-90 transition-transform"><Download className="h-5 w-5" /></button>
            </div>
            <div className="absolute top-6 right-6 z-[10000]"><button onClick={closePreview} className="h-14 w-14 rounded-full bg-white/15 text-white border border-white/20 hover:bg-white/25 active:scale-95 flex items-center justify-center transition-all"><X className="h-8 w-8" /></button></div>
            <div className="w-full h-full flex items-center justify-center p-12 overflow-hidden" onClick={closePreview}>
              <div onClick={e => e.stopPropagation()}>
                <img src={previewSrc} alt="Preview" onMouseDown={onStart} onTouchStart={onStart} style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, maxHeight: '85vh', maxWidth: '95vw', objectFit: 'contain', transition: dragging ? 'none' : 'transform 0.15s ease-out', userSelect: 'none', pointerEvents: dragging ? 'none' : 'auto', cursor: dragging ? 'grabbing' : 'grab' }} className="shadow-2xl rounded-xl border border-white/10" onDragStart={e => e.preventDefault()} />
              </div>
            </div>
            <div className="absolute bottom-10 left-1/2 -translate-x-1/2 text-white/50 text-xs font-black uppercase tracking-widest select-none bg-white/5 px-6 py-2 rounded-full border border-white/5">બંધ કરવા બહાર ટૅપ કરો</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* In-App Camera Modal */}
      <CameraModal
        open={cameraTarget !== null}
        onClose={() => setCameraTarget(null)}
        onCapture={(dataUrl) => {
          if (cameraTarget) {
            setPhotos(p => ({ ...p, [cameraTarget]: dataUrl }));
          }
          setCameraTarget(null);
        }}
      />
    </motion.div>
  );
}

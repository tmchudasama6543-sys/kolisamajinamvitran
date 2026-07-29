'use client';

import { useState, useEffect, useCallback, useMemo, useId, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, Camera, Lock, CheckCircle2, Save, Image, Trash2, Eye, X, ZoomIn, ZoomOut, Download } from 'lucide-react';
import { CameraModal } from '@/components/CameraModal';
import { useUser, useFirebase, saveStudentWithPhotosNonBlocking } from '@/firebase';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { serverTimestamp } from 'firebase/firestore';
import { palitanaVillages } from '@/lib/palitana-villages';
import { academicStandards } from '@/lib/standards';
import { cn } from '@/lib/utils';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { useToast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'motion/react';
import { compressImageToBase64, compressDataUrl } from '@/lib/image';

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
  const cleanData = data.replace(/[\r\n\s]+/g, '');
  return cleanData.startsWith('data:') ? cleanData : `data:image/jpeg;base64,${cleanData}`;
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

  const triggerCamera = useCallback(async (field: 'marksheet' | 'aadhar') => {
    if (typeof window !== 'undefined' && (window as any).AppInventor) {
      setCompressing(p => ({ ...p, [field]: true }));
      try { (window as any).AppInventor.setWebViewString(`camera_${field}`); } catch (_) {}
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      toast({ variant: 'destructive', title: 'Camera ઉપલબ્ધ નથી', description: 'આ device પર camera support નથી.' });
      return;
    }
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasCamera = devices.some(d => d.kind === 'videoinput');
      if (!hasCamera) {
        toast({ variant: 'destructive', title: 'Camera મળ્યો નહીં', description: 'Device સાથે camera જોડાયેલ નથી.' });
        return;
      }
    } catch (_) {
    }
    setCameraTarget(field);
  }, [toast]);

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
      const base64data = await compressImageToBase64(file, { maxWidth: 800, quality: 0.5 });
      setPhotos(p => ({ ...p, [field]: base64data }));
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'ભૂલ', description: 'ફોટો લોડ કરવામાં ભૂલ: ' + (err?.message || '') });
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
    if (window.location.hash.includes('preview')) window.history.back();
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
  const watchedTotal = watch('totalMarks');
  const watchedObtained = watch('obtainedMarks');

  useEffect(() => {
    const t = Number(watchedTotal), o = Number(watchedObtained);
    setPercentage(t > 0 && watchedObtained !== '' ? ((o / t) * 100).toFixed(2) : '');
  }, [watchedTotal, watchedObtained]);

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
        submissionDateTime: new Date().toISOString(),
      };
      const photoData = {
        marksheetPhotoBase64: photos.marksheet || '',
        aadhaarPhotoBase64: photos.aadhar || '',
      };
      saveStudentWithPhotosNonBlocking(firestore, studentData, photoData).catch(err => {
        toast({ variant: 'destructive', title: 'ભૂલ', description: 'સેવ ભૂલ: ' + err.message });
      });
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
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="p-4 sm:p-8 max-w-4xl mx-auto space-y-8">
      <Card className="shadow-2xl border-none rounded-[2rem] overflow-hidden bg-white">
        <div className="h-3 bg-gradient-to-r from-primary via-indigo-500 to-accent" />
        <CardHeader className="p-6 sm:p-10 pb-4">
          <CardTitle className="text-2xl sm:text-3xl font-black text-primary flex items-center gap-3">
            <CheckCircle2 className="h-8 w-8 text-primary" /> નવા વિદ્યાર્થીની માહિતી દાખલ કરો
          </CardTitle>
          <CardDescription className="text-base font-bold text-muted-foreground mt-2">
            કૃપા કરીને વિદ્યાર્થીના પરિણામ પત્રક મુજબ સાચી માહિતી ભરો
          </CardDescription>
        </CardHeader>

        <CardContent className="p-6 sm:p-10 pt-2">
          <Form {...form}>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              
              <FormField control={form.control} name="studentName" render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-black text-sm uppercase tracking-wider text-slate-700">વિદ્યાર્થીનું પૂરું નામ (માત્ર ગુજરાતીમાં)</FormLabel>
                  <FormControl>
                    <Input placeholder="સરનામું નામ પિતાનું નામ (ઉદા. ચૌહાણ અજયકુમાર સુરેશભાઈ)" {...field} className="h-14 rounded-2xl text-base font-bold border-2 focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all" />
                  </FormControl>
                  <FormMessage className="font-bold text-rose-500" />
                </FormItem>
              )} />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="villageName" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-black text-sm uppercase tracking-wider text-slate-700">ગામનું નામ</FormLabel>
                    <FormControl>
                      <SearchableSelect options={palitanaVillages} value={field.value} onSelect={field.onChange} placeholder="ગામ પસંદ કરો..." label="ગામ" />
                    </FormControl>
                    <FormMessage className="font-bold text-rose-500" />
                  </FormItem>
                )} />

                <FormField control={form.control} name="standard" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-black text-sm uppercase tracking-wider text-slate-700">ધોરણ (Standard)</FormLabel>
                    <FormControl>
                      <SearchableSelect options={academicStandards} value={field.value} onSelect={field.onChange} placeholder="ધોરણ પસંદ કરો..." label="ધોરણ" />
                    </FormControl>
                    <FormMessage className="font-bold text-rose-500" />
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="mobileNumber" render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-black text-sm uppercase tracking-wider text-slate-700">મોબાઈલ નંબર (૧૦ આંકડા)</FormLabel>
                  <FormControl>
                    <Input type="tel" maxLength={10} placeholder="૯૮૭૬૫૪૩૨૧૦" {...field} className="h-14 rounded-2xl text-base font-bold border-2 focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all" />
                  </FormControl>
                  <FormMessage className="font-bold text-rose-500" />
                </FormItem>
              )} />

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 p-6 bg-slate-50/80 rounded-3xl border-2 border-slate-100">
                <FormField control={form.control} name="totalMarks" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-black text-xs uppercase tracking-wider text-slate-500">કુલ ગુણ (Total Marks)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="ઉદા. ૬૦૦" {...field} className="h-12 rounded-xl text-base font-black border-2 bg-white" />
                    </FormControl>
                    <FormMessage className="font-bold text-rose-500 text-xs" />
                  </FormItem>
                )} />

                <FormField control={form.control} name="obtainedMarks" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-black text-xs uppercase tracking-wider text-slate-500">મેળવેલ ગુણ (Obtained)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="ઉદા. ૫૨૫" {...field} className="h-12 rounded-xl text-base font-black border-2 bg-white" />
                    </FormControl>
                    <FormMessage className="font-bold text-rose-500 text-xs" />
                  </FormItem>
                )} />

                <FormItem>
                  <FormLabel className="font-black text-xs uppercase tracking-wider text-slate-500">ટકાવારી (Percentage)</FormLabel>
                  <div className="h-12 rounded-xl border-2 border-primary/20 bg-primary/5 flex items-center px-4 font-black text-xl text-primary">
                    {percentage ? `${percentage}%` : '૦%'}
                  </div>
                </FormItem>
              </div>

              {/* Photo Upload Section */}
              <div className="space-y-6 pt-4 border-t-2 border-slate-100">
                <div className="flex items-center gap-2">
                  <Camera className="h-6 w-6 text-primary" />
                  <h3 className="text-lg font-black text-slate-800 tracking-tight uppercase">દસ્તાવેજ ફોટા અપલોડ કરો (ઓપ્શનલ)</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {/* Marksheet Card */}
                  <div className="p-5 rounded-3xl border-2 border-slate-200 bg-slate-50/50 space-y-4 hover:border-primary/40 transition-all">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-sm uppercase text-slate-700">૧. રિઝલ્ટ / માર્કશીટ</span>
                      {photos.marksheet && <Badge className="bg-emerald-500 font-bold">અપલોડ થયો</Badge>}
                    </div>

                    <input id={`${uid}-marksheet-gal`} type="file" accept="image/*" className="hidden" onChange={e => handleFile(e, 'marksheet')} />

                    {photos.marksheet ? (
                      <div className="relative group rounded-2xl overflow-hidden border-2 border-primary/20 aspect-video bg-black">
                        <img src={photos.marksheet} alt="Marksheet" className="w-full h-full object-contain" />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                          <Button type="button" size="icon" variant="secondary" onClick={() => openPreview(photos.marksheet!)} className="h-10 w-10 rounded-full"><Eye className="h-5 w-5" /></Button>
                          <Button type="button" size="icon" variant="destructive" onClick={() => setPhotos(p => ({ ...p, marksheet: null }))} className="h-10 w-10 rounded-full"><Trash2 className="h-5 w-5" /></Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3">
                        <Button type="button" variant="outline" onClick={() => triggerCamera('marksheet')} disabled={compressing.marksheet} className="h-14 rounded-2xl border-2 font-black gap-2 hover:bg-primary/5 hover:border-primary hover:text-primary">
                          {compressing.marksheet ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : <Camera className="h-5 w-5 text-primary" />}
                          કૅમેરાથી પાડો
                        </Button>
                        <Button type="button" variant="secondary" onClick={() => triggerGallery('marksheet')} disabled={compressing.marksheet} className="h-14 rounded-2xl font-black gap-2">
                          <Image className="h-5 w-5 text-slate-600" /> ગૅલેરીમાંથી પસંદ કરો
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Aadhaar Card */}
                  <div className="p-5 rounded-3xl border-2 border-slate-200 bg-slate-50/50 space-y-4 hover:border-primary/40 transition-all">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-sm uppercase text-slate-700">૨. આધારકાર્ડ</span>
                      {photos.aadhar && <Badge className="bg-emerald-500 font-bold">અપલોડ થયો</Badge>}
                    </div>

                    <input id={`${uid}-aadhar-gal`} type="file" accept="image/*" className="hidden" onChange={e => handleFile(e, 'aadhar')} />

                    {photos.aadhar ? (
                      <div className="relative group rounded-2xl overflow-hidden border-2 border-primary/20 aspect-video bg-black">
                        <img src={photos.aadhar} alt="Aadhaar" className="w-full h-full object-contain" />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                          <Button type="button" size="icon" variant="secondary" onClick={() => openPreview(photos.aadhar!)} className="h-10 w-10 rounded-full"><Eye className="h-5 w-5" /></Button>
                          <Button type="button" size="icon" variant="destructive" onClick={() => setPhotos(p => ({ ...p, aadhar: null }))} className="h-10 w-10 rounded-full"><Trash2 className="h-5 w-5" /></Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3">
                        <Button type="button" variant="outline" onClick={() => triggerCamera('aadhar')} disabled={compressing.aadhar} className="h-14 rounded-2xl border-2 font-black gap-2 hover:bg-primary/5 hover:border-primary hover:text-primary">
                          {compressing.aadhar ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : <Camera className="h-5 w-5 text-primary" />}
                          કૅમેરાથી પાડો
                        </Button>
                        <Button type="button" variant="secondary" onClick={() => triggerGallery('aadhar')} disabled={compressing.aadhar} className="h-14 rounded-2xl font-black gap-2">
                          <Image className="h-5 w-5 text-slate-600" /> ગૅલેરીમાંથી પસંદ કરો
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <Button type="submit" disabled={isSubmitting} className="w-full h-16 rounded-2xl font-black text-xl shadow-xl bg-primary hover:bg-primary/90 text-primary-foreground hover:scale-[1.01] active:scale-[0.99] transition-all gap-3">
                {isSubmitting ? <Loader2 className="h-6 w-6 animate-spin" /> : <Save className="h-6 w-6" />}
                માહિતી સેવ કરો
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Fullscreen Photo Preview Modal */}
      <AnimatePresence>
        {previewSrc && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4">
            <div className="absolute top-6 right-6 flex gap-3 z-10">
              <Button size="icon" variant="secondary" onClick={handleDownload} className="h-12 w-12 rounded-full"><Download className="h-6 w-6" /></Button>
              <Button size="icon" variant="secondary" onClick={() => setZoom(z => Math.min(z + 0.5, 4))} className="h-12 w-12 rounded-full"><ZoomIn className="h-6 w-6" /></Button>
              <Button size="icon" variant="secondary" onClick={() => setZoom(z => Math.max(z - 0.5, 1))} className="h-12 w-12 rounded-full"><ZoomOut className="h-6 w-6" /></Button>
              <Button size="icon" variant="destructive" onClick={closePreview} className="h-12 w-12 rounded-full"><X className="h-6 w-6" /></Button>
            </div>
            <div className="relative w-full h-full flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing" onMouseDown={onStart} onTouchStart={onStart}>
              <motion.img src={previewSrc} alt="Preview" style={{ scale: zoom, x: pan.x, y: pan.y }} className="max-w-full max-h-full object-contain pointer-events-none select-none transition-transform duration-75" />
            </div>
            <div className="absolute bottom-10 left-1/2 -translate-x-1/2 text-white/50 text-xs font-black uppercase tracking-widest select-none bg-white/5 px-6 py-2 rounded-full border border-white/5">બંધ કરવા બહાર ટૅપ કરો</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* In-App Camera Modal */}
      <CameraModal
        open={cameraTarget !== null}
        onClose={() => setCameraTarget(null)}
        onCapture={async (dataUrl) => {
          const target = cameraTarget;
          setCameraTarget(null);
          if (target) {
            setCompressing(p => ({ ...p, [target]: true }));
            try {
              const compressed = await compressDataUrl(dataUrl, { quality: 0.5, maxWidth: 800 });
              setPhotos(p => ({ ...p, [target]: compressed }));
            } catch (e) {
              setPhotos(p => ({ ...p, [target]: dataUrl }));
            } finally {
              setCompressing(p => ({ ...p, [target]: false }));
            }
          }
        }}
      />
    </motion.div>
  );
}

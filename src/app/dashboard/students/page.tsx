'use client';

import { useUser, useFirestore, useCollection, useMemoFirebase, updateStudentWithPhotosNonBlocking, moveDocumentToTrash, deleteDocumentNonBlocking } from '@/firebase';
import { collection, query, orderBy, doc, limit, writeBatch, getDoc } from 'firebase/firestore';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, Users, Trash2, MapPin, Edit3, Save, Loader2, Camera, X, Phone, Copy, Eye, FileDown, CheckSquare, AlertTriangle, ZoomIn, ZoomOut, RefreshCw, Download, ArrowLeft, Image } from 'lucide-react';
import { useState, useMemo, useEffect, useCallback, useRef, useId } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { palitanaVillages } from '@/lib/palitana-villages';
import { academicStandards } from '@/lib/standards';
import { compressImageToBase64, compressDataUrl } from '@/lib/image';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { cn } from '@/lib/utils';
import { CameraModal } from '@/components/CameraModal';

type StudentData = {
  id: string;
  name: string;
  standard: string;
  villageName: string;
  percentage: number;
  mobileNumber: string;
  totalMarks: number;
  obtainedMarks: number;
  marksheetPhotoBase64?: string;
  aadhaarPhotoBase64?: string;
  submissionDateTime: any;
};

const gujaratiRegex = /^[\u0A80-\u0AFF\s\.\(\)\-]+$/;

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

export default function StudentsListPage() {
  const { user, loading: userLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  
  useEffect(() => {
    if (!userLoading && user?.role !== 'admin') {
      router.replace('/dashboard');
    }
  }, [user, userLoading, router]);

  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 300);

  const [villageFilter, setVillageFilter] = useState('all');
  const [standardFilter, setStandardFilter] = useState('all');

  const [editingStudent, setEditingStudent] = useState<StudentData | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newStudent, setNewStudent] = useState({
    name: '',
    standard: '',
    villageName: '',
    mobileNumber: '',
    obtainedMarks: 0,
    totalMarks: 0,
    marksheetPhotoBase64: '',
    aadhaarPhotoBase64: ''
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  const [studentToDelete, setStudentToDelete] = useState<StudentData | null>(null);
  const [showBulkTrashConfirm, setShowBulkTrashConfirm] = useState(false);

  const uid = useId();
  const [cameraTarget, setCameraTarget] = useState<{ field: 'marksheetPhotoBase64' | 'aadhaarPhotoBase64'; context: 'new' | 'edit' } | null>(null);

  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const touchStartDist = useRef<number>(0);
  const [photoLoading, setPhotoLoading] = useState<{ marksheetPhotoBase64: boolean; aadhaarPhotoBase64: boolean }>({ marksheetPhotoBase64: false, aadhaarPhotoBase64: false });
  const [isFetchingPhotos, setIsFetchingPhotos] = useState<string | null>(null);

  const [viewPhotosModal, setViewPhotosModal] = useState<{
    isOpen: boolean;
    studentName: string;
    marksheet: string | null;
    aadhar: string | null;
  }>({ isOpen: false, studentName: '', marksheet: null, aadhar: null });
  const [isFetchingPhotosForView, setIsFetchingPhotosForView] = useState<string | null>(null);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (!hash.includes('edit')) setEditingStudent(null);
      if (!hash.includes('new')) setIsAddingNew(false);
      if (!hash.includes('preview')) {
        setPreviewImage(null);
        setZoomLevel(1);
        setPosition({ x: 0, y: 0 });
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const openNew = () => {
    setNewStudent({
      name: '',
      standard: '',
      villageName: '',
      mobileNumber: '',
      obtainedMarks: 0,
      totalMarks: 0,
      marksheetPhotoBase64: '',
      aadhaarPhotoBase64: ''
    });
    setIsAddingNew(true);
    window.location.hash = 'new';
  };

  const closeNew = () => {
    setIsAddingNew(false);
    if (window.location.hash.includes('new')) window.location.hash = '';
  };

  const openPreview = (imgSrc: string) => {
    setPreviewImage(imgSrc);
    window.location.hash = window.location.hash.includes('edit') ? 'edit&preview' : 'preview';
  };

  const closePreview = () => {
    setPreviewImage(null);
    setZoomLevel(1);
    setPosition({ x: 0, y: 0 });
    if (window.location.hash.includes('preview')) {
      if (window.location.hash.includes('edit')) window.location.hash = 'edit';
      else if (window.location.hash.includes('new')) window.location.hash = 'new';
      else window.location.hash = '';
    }
  };

  const closeEdit = () => {
    setEditingStudent(null);
    if (window.location.hash.includes('edit')) window.location.hash = '';
  };

  const ensureBase64Prefix = (data: string) => {
    if (!data) return data;
    if (data.startsWith('data:')) return data;
    return `data:image/jpeg;base64,${data}`;
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const callback = (field: 'marksheet' | 'aadhar', base64Data: string) => {
        if (!base64Data) return;
        const fKey = field === 'marksheet' ? 'marksheetPhotoBase64' : 'aadhaarPhotoBase64';
        const processedData = ensureBase64Prefix(base64Data);
        setPhotoLoading(prev => ({ ...prev, [fKey]: false }));
        
        // Check editingStudent state directly (not just hash) for reliability
        setEditingStudent(prev => {
          if (prev) {
            return { ...prev, [fKey]: processedData };
          }
          // No editing student open — set to newStudent
          setNewStudent(p => ({ ...p, [fKey]: processedData }));
          return prev;
        });
      };
      (window as any).handleNativeEditImage = callback;
      (window as any).handleNativeImage = callback;
    }
    return () => {
      if (typeof window !== 'undefined') {
        delete (window as any).handleNativeEditImage;
        delete (window as any).handleNativeImage;
      }
    };
  }, []);

  const triggerEditCamera = (field: 'marksheetPhotoBase64' | 'aadhaarPhotoBase64') => {
    const fKey = field === 'marksheetPhotoBase64' ? 'marksheet' : 'aadhar';
    // Kodular/Android WebViewer ma native camera use karo
    if (typeof window !== 'undefined' && (window as any).AppInventor) {
      try { (window as any).AppInventor.setWebViewString(`camera_${fKey}`); } catch (_) {}
      return; // Native camera handle karse
    }
    // Regular browser ma in-app CameraModal kholo
    const context = window.location.hash.includes('edit') ? 'edit' : 'new';
    setCameraTarget({ field, context });
  };

  const triggerEditGallery = (field: 'marksheetPhotoBase64' | 'aadhaarPhotoBase64') => {
    const fKey = field === 'marksheetPhotoBase64' ? 'marksheet' : 'aadhar';
    if (typeof window !== 'undefined' && (window as any).AppInventor) {
      try { (window as any).AppInventor.setWebViewString(`gallery_${fKey}`); } catch (_) {}
    }
    const prefix = window.location.hash.includes('edit') ? 'edit' : 'new';
    document.getElementById(`${uid}-${prefix}-${fKey}-gal`)?.click();
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      const touch = e.touches[0];
      dragStart.current = { x: touch.clientX - position.x, y: touch.clientY - position.y };
    } else if (e.touches.length === 2) {
      setIsDragging(false);
      touchStartDist.current = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && isDragging) {
      const touch = e.touches[0];
      setPosition({ x: touch.clientX - dragStart.current.x, y: touch.clientY - dragStart.current.y });
    } else if (e.touches.length === 2 && touchStartDist.current) {
      const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      setZoomLevel(prev => Math.min(Math.max(prev * (dist / touchStartDist.current), 1), 5));
      touchStartDist.current = dist;
    }
  };

  const handleTouchEnd = () => { setIsDragging(false); touchStartDist.current = 0; };

  const handleDownload = useCallback(() => {
    if (!previewImage) return;
    const link = document.createElement('a');
    link.href = previewImage;
    link.download = `koli_samaj_document_${Date.now()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: 'ડાઉનલોડ શરૂ થયું!', description: 'ફોટો તમારા ડિવાઇસમાં સેવ થઈ રહ્યો છે.' });
  }, [previewImage, toast]);

  const studentsQuery = useMemoFirebase(
    () => (user?.role === 'admin' ? query(collection(firestore, 'students'), orderBy('submissionDateTime', 'desc'), limit(5000)) : null),
    [user, firestore]
  );

  const { data: students, isLoading } = useCollection<StudentData>(studentsQuery);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const filteredStudents = useMemo(() => {
    if (!students) return [];
    return students.filter(s => {
      const matchesSearch = s.name?.toLowerCase().includes(debouncedSearch.toLowerCase()) || s.mobileNumber?.includes(debouncedSearch);
      const matchesVillage = villageFilter === 'all' || s.villageName === villageFilter;
      const matchesStandard = standardFilter === 'all' || s.standard === standardFilter;
      return matchesSearch && matchesVillage && matchesStandard;
    });
  }, [students, debouncedSearch, villageFilter, standardFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, villageFilter, standardFilter, pageSize]);

  const totalPages = Math.ceil(filteredStudents.length / pageSize) || 1;
  const paginatedStudents = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredStudents.slice(start, start + pageSize);
  }, [filteredStudents, currentPage, pageSize]);

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredStudents.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredStudents.map(s => s.id)));
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedIds(newSelected);
  };

  const handleBulkTrash = async () => {
    if (selectedIds.size === 0 || !user) return;
    setIsBulkProcessing(true);
    try {
      const batch = writeBatch(firestore);
      const selectedStudents = students?.filter(s => selectedIds.has(s.id)) || [];
      for (const s of selectedStudents) {
        const sourceRef = doc(firestore, 'students', s.id);
        const trashRef = doc(firestore, 'trash_students', s.id);
        const { marksheetPhotoBase64, aadhaarPhotoBase64, ...cleanData } = s;
        batch.set(trashRef, { ...cleanData, deletedAt: new Date().toISOString(), deletedBy: user.uid, originalId: s.id });
        batch.delete(sourceRef);
        deleteDocumentNonBlocking(doc(firestore, 'student_photos', s.id)).catch(() => {});
      }
      await batch.commit();
      toast({ title: 'બલ્ક ટ્રેશ સફળ!', description: `${selectedIds.size} વિદ્યાર્થીઓને ટ્રેશમાં ખસેડવામાં આવ્યા છે.` });
      setSelectedIds(new Set());
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'ભૂલ', description: 'બલ્ક ઓપરેશન નિષ્ફળ: ' + error.message });
    } finally { setIsBulkProcessing(false); }
  };

  const handleEditClick = async (student: StudentData) => {
    window.location.hash = 'edit';
    if (student.marksheetPhotoBase64 || student.aadhaarPhotoBase64) {
      setEditingStudent(student);
      return;
    }
    setEditingStudent({ ...student, marksheetPhotoBase64: '', aadhaarPhotoBase64: '' });
    setIsFetchingPhotos(student.id);
    try {
      const photosSnap = await getDoc(doc(firestore, 'student_photos', student.id));
      if (photosSnap.exists()) {
        const photoData = photosSnap.data();
        setEditingStudent(prev => prev && prev.id === student.id ? {
          ...prev,
          marksheetPhotoBase64: photoData.marksheetPhotoBase64 || "",
          aadhaarPhotoBase64: photoData.aadhaarPhotoBase64 || ""
        } : prev);
      }
    } catch (e) {
      toast({ variant: 'destructive', title: 'ભૂલ', description: 'દસ્તાવેજો લોડ કરવામાં સમસ્યા.' });
    } finally { setIsFetchingPhotos(null); }
  };

  const handleViewPhotosClick = async (student: StudentData) => {
    setIsFetchingPhotosForView(student.id);
    try {
      const photosSnap = await getDoc(doc(firestore, 'student_photos', student.id));
      if (photosSnap.exists()) {
        const photoData = photosSnap.data();
        if (!photoData.marksheetPhotoBase64 && !photoData.aadhaarPhotoBase64) {
           toast({ title: 'ફોટો નથી', description: 'આ વિદ્યાર્થીનો કોઈ ફોટો અપલોડ થયેલ નથી.' });
        } else {
           const ensureBase64Prefix = (data: string) => {
             if (!data) return data;
             return data.startsWith('data:') ? data : `data:image/jpeg;base64,${data}`;
           };
           setViewPhotosModal({
             isOpen: true,
             studentName: student.name,
             marksheet: photoData.marksheetPhotoBase64 ? ensureBase64Prefix(photoData.marksheetPhotoBase64) : null,
             aadhar: photoData.aadhaarPhotoBase64 ? ensureBase64Prefix(photoData.aadhaarPhotoBase64) : null
           });
        }
      } else {
        toast({ title: 'ફોટો નથી', description: 'આ વિદ્યાર્થીનો કોઈ ફોટો અપલોડ થયેલ નથી.' });
      }
    } catch (e) {
      toast({ variant: 'destructive', title: 'ભૂલ', description: 'ફોટો લોડ કરવામાં સમસ્યા આવી.' });
    } finally {
      setIsFetchingPhotosForView(null);
    }
  };

  const handleSaveNew = async () => {
    if (isSaving || !newStudent.name) {
       if (!newStudent.name) toast({ variant: 'destructive', title: 'ભૂલ', description: 'વિદ્યાર્થીનું નામ જરૂરી છે.' });
       return;
    }
    if (!gujaratiRegex.test(newStudent.name)) {
      toast({ variant: 'destructive', title: 'ભૂલ', description: 'નામ માત્ર ગુજરાતીમાં લખો.' });
      return;
    }
    setIsSaving(true);
    try {
      const percentage = newStudent.totalMarks > 0 ? parseFloat(((newStudent.obtainedMarks / newStudent.totalMarks) * 100).toFixed(2)) : 0;
      const { marksheetPhotoBase64, aadhaarPhotoBase64, ...textData } = newStudent;
      
      const studentData = {
        ...textData,
        percentage,
        enteredByUserId: user?.uid || 'admin',
        submissionDateTime: new Date()
      };
      
      const photoData = {
        marksheetPhotoBase64: marksheetPhotoBase64 || "",
        aadhaarPhotoBase64: aadhaarPhotoBase64 || ""
      };

      // Import from index.ts
      const { saveStudentWithPhotosNonBlocking } = await import('@/firebase');
      saveStudentWithPhotosNonBlocking(firestore, studentData, photoData).catch(err => {
        toast({ variant: 'destructive', title: 'ભૂલ', description: 'સેવ ભૂલ: ' + err.message });
      });
      
      toast({ title: 'સફળ!', description: 'નવી એન્ટ્રી સેવ થઈ ગઈ છે.' });
      closeNew();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'ભૂલ', description: e.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (isUpdating || !editingStudent) return;
    if (!gujaratiRegex.test(editingStudent.name)) {
      toast({ variant: 'destructive', title: 'ભૂલ', description: 'નામ માત્ર ગુજરાતીમાં લખો.' });
      return;
    }
    setIsUpdating(true);
    try {
      const updatedPercentage = parseFloat(((editingStudent.obtainedMarks / editingStudent.totalMarks) * 100).toFixed(2));
      const { marksheetPhotoBase64, aadhaarPhotoBase64, ...studentTextData } = editingStudent;
      const studentData = { ...studentTextData, percentage: updatedPercentage };
      const photoData = { marksheetPhotoBase64: marksheetPhotoBase64 || "", aadhaarPhotoBase64: aadhaarPhotoBase64 || "" };
      updateStudentWithPhotosNonBlocking(firestore, editingStudent.id, studentData, photoData).catch(err => {
        toast({ variant: 'destructive', title: 'ભૂલ', description: 'ડેટાબેઝ અપડેટ નિષ્ફળ: ' + err.message });
      });
      toast({ title: "સફળ!", description: "માહિતી અપડેટ થઈ ગઈ." });
      closeEdit();
    } catch (e: any) { toast({ variant: 'destructive', title: 'ભૂલ', description: e.message }); }
    finally { setIsUpdating(false); }
  };

  const handleImageReplace = useCallback(async (e: React.ChangeEvent<HTMLInputElement>, field: 'marksheetPhotoBase64' | 'aadhaarPhotoBase64') => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) {
      setPhotoLoading(prev => ({ ...prev, [field]: true }));
      try {
        const base64 = await compressImageToBase64(file);
        if (window.location.hash.includes('edit')) {
          setEditingStudent(prev => prev ? { ...prev, [field]: base64 } : null);
        } else {
          setNewStudent(prev => ({ ...prev, [field]: base64 }));
        }
      } catch (error: any) { toast({ variant: 'destructive', title: 'ભૂલ', description: error.message }); }
      finally { setPhotoLoading(prev => ({ ...prev, [field]: false })); }
    }
  }, [toast]);

  const handleExportToExcel = useCallback(() => {
    if (!filteredStudents || filteredStudents.length === 0) {
      toast({ variant: 'destructive', title: 'ભૂલ', description: 'ડાઉનલોડ કરવા માટે કોઈ ડેટા નથી.' });
      return;
    }
    const headers = [
      'ક્રમ (Rank)',
      'વિદ્યાર્થીનું નામ (Student Name)',
      'ધોરણ (Standard)',
      'ગામનું નામ (Village Name)',
      'મોબાઈલ નંબર (Mobile Number)',
      'મેળવેલ ગુણ (Obtained Marks)',
      'કુલ ગુણ (Total Marks)',
      'ટકાવારી (Percentage)'
    ];
    const rows = filteredStudents.map((s, index) => {
      const pct = typeof s.percentage === 'number' ? s.percentage : parseFloat(s.percentage || '0');
      return [
        index + 1,
        s.name ? `"${s.name.replace(/"/g, '""')}"` : '""',
        s.standard ? `"${s.standard.replace(/"/g, '""')}"` : '""',
        s.villageName ? `"${s.villageName.replace(/"/g, '""')}"` : '""',
        s.mobileNumber ? `"${s.mobileNumber}"` : '""',
        s.obtainedMarks || 0,
        s.totalMarks || 0,
        `"${pct.toFixed(2)}%"`
      ];
    });
    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Koli_Samaj_Merit_List_${new Date().toLocaleDateString('en-IN').replace(/\//g, '-')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: 'સફળ!', description: 'એક્સેલ ફાઇલ ડાઉનલોડ થઈ ગઈ છે.' });
  }, [filteredStudents, toast]);

  if (userLoading) return <div className="p-10"><Skeleton className="h-[70vh] w-full rounded-3xl" /></div>;
  if (!user || user.role !== 'admin') return null;

  if (isAddingNew) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="p-4 sm:p-12 max-w-4xl mx-auto space-y-12 pb-32">
        <div className="pb-10 border-b-8 border-slate-50 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={closeNew} className="h-12 w-12 rounded-full border-2 border-slate-200 hover:border-emerald-500 hover:bg-emerald-50 shadow-md flex items-center justify-center shrink-0 transition-all"><ArrowLeft className="h-6 w-6 text-slate-700" /></Button>
            <div>
              <h1 className="text-2xl sm:text-4xl font-black text-emerald-600 tracking-tighter flex items-center gap-2 py-1 leading-tight">નવી વિદ્યાર્થી એન્ટ્રી</h1>
              <p className="text-muted-foreground font-bold uppercase tracking-widest text-[10px]">બધી વિગતો ભરો</p>
            </div>
          </div>
        </div>

        <div className="max-w-2xl mx-auto p-4 sm:p-12 space-y-10 sm:space-y-14 bg-white rounded-[1.5rem] sm:rounded-[2.5rem] shadow-2xl border border-slate-100">
          <div className="space-y-8 sm:space-y-10">
             {(['marksheetPhotoBase64', 'aadhaarPhotoBase64'] as const).map(f => {
               const fKey = f === 'marksheetPhotoBase64' ? 'marksheet' : 'aadhar';
               const label = f === 'marksheetPhotoBase64' ? '📄 માર્કશીટ ફોટો' : '🪪 આધાર કાર્ડ ફોટો';
               const photo = newStudent[f];
               const loading = photoLoading[f];
               return (
               <div key={f} className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <label className="text-xs font-black uppercase text-slate-600 tracking-widest">{label}</label>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">(ઐચ્છિક)</span>
                  </div>
                  <div className={cn("rounded-2xl border-2 border-dashed overflow-hidden bg-slate-50 flex items-center justify-center transition-all", photo ? 'aspect-video p-3 border-emerald-300 bg-emerald-50/20' : 'min-h-[160px] p-6')}>
                     {loading ? (
                       <div className="flex flex-col items-center justify-center gap-3 py-10 w-full"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /><span className="text-[11px] font-black text-emerald-600 uppercase tracking-widest">ફોટો સંકુચિત...</span></div>
                     ) : photo ? (
                       <div className="relative w-full h-full group">
                         <img src={photo} className="w-full h-full object-contain cursor-zoom-in rounded-xl shadow-sm" alt="preview" onClick={() => openPreview(photo)} />
                         <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-3 rounded-xl">
                           <Button type="button" variant="secondary" size="icon" className="h-12 w-12 rounded-xl shadow-lg" onClick={() => openPreview(photo)}><Eye className="h-6 w-6" /></Button>
                           <Button type="button" variant="secondary" size="icon" className="h-12 w-12 rounded-xl shadow-lg" onClick={() => triggerEditCamera(f)}><Camera className="h-6 w-6" /></Button>
                           <Button type="button" variant="secondary" size="icon" className="h-12 w-12 rounded-xl shadow-lg" onClick={() => triggerEditGallery(f)}><Image className="h-6 w-6" /></Button>
                           <Button type="button" variant="destructive" size="icon" className="h-12 w-12 rounded-xl shadow-lg" onClick={() => setNewStudent(prev => ({ ...prev, [f]: '' }))}><Trash2 className="h-6 w-6" /></Button>
                         </div>
                       </div>
                     ) : (
                       <div className="flex flex-col items-center justify-center gap-4 w-full text-center p-4">
                         <span className="text-xs font-black text-slate-400 uppercase tracking-widest">ફોટો ઉમેરો</span>
                         <div className="flex flex-col gap-3 w-full max-w-xs">
                           <button type="button" className="h-14 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-black flex items-center justify-center gap-2 text-sm shadow-md active:scale-95 transition-transform" onClick={() => triggerEditCamera(f)}><Camera className="h-5 w-5" /><span>લાઈવ કૅમેરો</span></button>
                           <button type="button" className="h-14 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-black flex items-center justify-center gap-2 text-sm shadow-md active:scale-95 transition-transform" onClick={() => triggerEditGallery(f)}><Image className="h-5 w-5" /><span>ગેલેરી</span></button>
                         </div>
                         <span className="text-[10px] font-bold text-slate-400">ના ઉમેરો તો પણ સેવ થશે</span>
                       </div>
                     )}
                     <input id={`${uid}-new-${fKey}-gal`} type="file" className="hidden" accept="image/*" onChange={ev => handleImageReplace(ev, f)} />
                  </div>
               </div>
               );
             })}
          </div>

          <div className="space-y-8 pt-4">
            <div className="space-y-2">
               <label className="text-[11px] font-black uppercase text-slate-500 tracking-widest px-1">👤 વિદ્યાર્થીનું નામ</label>
               <Input placeholder="નામ લખો..." value={newStudent.name} onChange={e => setNewStudent(prev => ({...prev, name: e.target.value}))} className="h-16 font-black text-xl sm:text-2xl text-slate-900 rounded-2xl border-2 px-6 bg-slate-50/30" />
            </div>
            <div className="space-y-2">
               <label className="text-[11px] font-black uppercase text-slate-500 tracking-widest px-1">🎓 ધોરણ</label>
               <SearchableSelect options={academicStandards} value={newStudent.standard} onSelect={val => setNewStudent(prev => ({...prev, standard: val}))} placeholder="ધોરણ પસંદ કરો..." label="ધોરણ" />
            </div>
            <div className="space-y-2">
               <label className="text-[11px] font-black uppercase text-slate-500 tracking-widest px-1">📍 ગામનું નામ</label>
               <SearchableSelect options={palitanaVillages} value={newStudent.villageName} onSelect={val => setNewStudent(prev => ({...prev, villageName: val}))} placeholder="ગામ પસંદ કરો..." label="ગામ" />
            </div>
            <div className="space-y-2">
               <label className="text-[11px] font-black uppercase text-emerald-600 tracking-widest px-1">📱 મોબાઈલ નંબર</label>
               <Input placeholder="૧૦ આંકડાનો નંબર" value={newStudent.mobileNumber} onChange={(e) => { const val = e.target.value.replace(/\D/g, ''); if (val.length <= 10) setNewStudent(prev => ({...prev, mobileNumber: val})); }} className="h-16 font-black text-xl sm:text-2xl text-slate-900 rounded-2xl border-2 px-6 bg-emerald-50/10" />
            </div>
            <div className="space-y-2">
               <label className="text-[11px] font-black text-emerald-600 tracking-widest px-1 block">✅ મેળવેલ ગુણ</label>
               <Input type="number" value={newStudent.obtainedMarks || ''} onChange={e => setNewStudent(prev => ({...prev, obtainedMarks: Number(e.target.value)}))} className="h-16 font-black text-xl sm:text-2xl text-slate-900 text-center rounded-2xl border-2 bg-slate-50/30" />
            </div>
            <div className="space-y-2">
               <label className="text-[11px] font-black text-emerald-600 tracking-widest px-1 block">📊 કુલ ગુણ</label>
               <Input type="number" value={newStudent.totalMarks || ''} onChange={e => setNewStudent(prev => ({...prev, totalMarks: Number(e.target.value)}))} className="h-16 font-black text-xl sm:text-2xl text-slate-900 text-center rounded-2xl border-2 bg-slate-50/30" />
            </div>
            <div className="space-y-3 pt-2">
               <label className="text-[11px] font-black text-emerald-600 tracking-widest px-1 block">% ટકાવારી</label>
               <div className="bg-emerald-500 text-white font-black px-6 py-6 rounded-2xl text-center text-3xl sm:text-4xl font-mono border-2 border-emerald-600 shadow-xl shadow-emerald-100 transition-all">
                {newStudent.totalMarks > 0 ? ((newStudent.obtainedMarks / newStudent.totalMarks) * 100).toFixed(2) : '0.00'}%
               </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 pt-10">
              <Button variant="outline" onClick={closeNew} className="h-16 rounded-2xl font-black border-2 text-xl sm:w-1/3">રદ કરો</Button>
              <Button onClick={handleSaveNew} disabled={isSaving} className="h-16 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-2xl shadow-xl text-xl flex items-center justify-center gap-3 flex-1">{isSaving ? <Loader2 className="h-6 w-6 animate-spin" /> : <Save className="h-6 w-6" />}માહિતી સેવ કરો</Button>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  if (editingStudent) {
    return (
      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="p-4 sm:p-12 max-w-4xl mx-auto space-y-12 pb-32">
        <div className="pb-10 border-b-8 border-slate-50 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={closeEdit} className="h-12 w-12 rounded-full border-2 border-slate-200 hover:border-primary hover:bg-primary/5 shadow-md flex items-center justify-center shrink-0 transition-all"><ArrowLeft className="h-6 w-6 text-slate-700" /></Button>
            <div>
              <h1 className="text-2xl sm:text-4xl font-black text-primary tracking-tighter flex items-center gap-2 py-1 leading-tight">વિદ્યાર્થી પ્રોફાઇલ એડિટ</h1>
              <p className="text-muted-foreground font-bold uppercase tracking-widest text-[10px]">માહિતી સુધારો</p>
            </div>
          </div>
        </div>

        <div className="max-w-2xl mx-auto p-4 sm:p-12 space-y-10 sm:space-y-14 bg-white rounded-[1.5rem] sm:rounded-[2.5rem] shadow-2xl border border-slate-100">
          <div className="space-y-8 sm:space-y-10">
             {(['marksheetPhotoBase64', 'aadhaarPhotoBase64'] as const).map(f => {
               const fKey = f === 'marksheetPhotoBase64' ? 'marksheet' : 'aadhar';
               const label = f === 'marksheetPhotoBase64' ? '📄 માર્કશીટ ફોટો' : '🪪 આધાર કાર્ડ ફોટો';
               const photo = editingStudent[f];
               const loading = photoLoading[f] || isFetchingPhotos === editingStudent.id;
               return (
               <div key={f} className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <label className="text-xs font-black uppercase text-slate-600 tracking-widest">{label}</label>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">(ઐચ્છિક)</span>
                  </div>
                  <div className={cn("rounded-2xl border-2 border-dashed overflow-hidden bg-slate-50 flex items-center justify-center transition-all", photo ? 'aspect-video p-3 border-emerald-300 bg-emerald-50/20' : 'min-h-[160px] p-6')}>
                     {loading ? (
                       <div className="flex flex-col items-center justify-center gap-3 py-10 w-full"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /><span className="text-[11px] font-black text-emerald-600 uppercase tracking-widest">ફોટો સંકુચિત...</span></div>
                     ) : photo ? (
                       <div className="relative w-full h-full group">
                         <img src={photo as string} className="w-full h-full object-contain cursor-zoom-in rounded-xl shadow-sm" alt="preview" onClick={() => openPreview(photo as string)} style={{ pointerEvents: 'auto' }} />
                         <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-3 rounded-xl">
                           <Button type="button" variant="secondary" size="icon" className="h-12 w-12 rounded-xl shadow-lg" onClick={() => openPreview(photo as string)}><Eye className="h-6 w-6" /></Button>
                           <Button type="button" variant="secondary" size="icon" className="h-12 w-12 rounded-xl shadow-lg" onClick={() => triggerEditCamera(f)}><Camera className="h-6 w-6" /></Button>
                           <Button type="button" variant="secondary" size="icon" className="h-12 w-12 rounded-xl shadow-lg" onClick={() => triggerEditGallery(f)}><Image className="h-6 w-6" /></Button>
                           <Button type="button" variant="destructive" size="icon" className="h-12 w-12 rounded-xl shadow-lg" onClick={() => setEditingStudent(prev => prev ? { ...prev, [f]: '' } : null)}><Trash2 className="h-6 w-6" /></Button>
                         </div>
                       </div>
                     ) : (
                       <div className="flex flex-col items-center justify-center gap-4 w-full text-center p-4">
                         <span className="text-xs font-black text-slate-400 uppercase tracking-widest">ફોટો ઉમેરો</span>
                         <div className="flex flex-col gap-3 w-full max-w-xs">
                           <button type="button" className="h-14 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-black flex items-center justify-center gap-2 text-sm shadow-md active:scale-95 transition-transform" onClick={() => triggerEditCamera(f)}><Camera className="h-5 w-5" /><span>લાઈવ કૅમેરો</span></button>
                           <button type="button" className="h-14 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-black flex items-center justify-center gap-2 text-sm shadow-md active:scale-95 transition-transform" onClick={() => triggerEditGallery(f)}><Image className="h-5 w-5" /><span>ગેલેરી</span></button>
                         </div>
                         <span className="text-[10px] font-bold text-slate-400">ના ઉમેરો તો પણ સેવ થશે</span>
                       </div>
                     )}
                     <input id={`${uid}-edit-${fKey}-gal`} type="file" className="hidden" accept="image/*" onChange={ev => handleImageReplace(ev, f)} />
                  </div>
               </div>
               );
             })}
          </div>

          <div className="space-y-8 pt-4">
            <div className="space-y-2">
               <label className="text-[11px] font-black uppercase text-slate-500 tracking-widest px-1">👤 વિદ્યાર્થીનું નામ</label>
               <Input value={editingStudent.name} onChange={e => setEditingStudent(prev => prev ? {...prev, name: e.target.value} : null)} className="h-16 font-black text-xl sm:text-2xl text-slate-900 rounded-2xl border-2 px-6 bg-slate-50/30" />
            </div>
            <div className="space-y-2">
               <label className="text-[11px] font-black uppercase text-slate-500 tracking-widest px-1">🎓 ધોરણ</label>
               <SearchableSelect options={academicStandards} value={editingStudent.standard} onSelect={val => setEditingStudent(prev => prev ? {...prev, standard: val} : null)} placeholder="ધોરણ પસંદ કરો..." label="ધોરણ" />
            </div>
            <div className="space-y-2">
               <label className="text-[11px] font-black uppercase text-slate-500 tracking-widest px-1">📍 ગામનું નામ</label>
               <SearchableSelect options={palitanaVillages} value={editingStudent.villageName} onSelect={val => setEditingStudent(prev => prev ? {...prev, villageName: val} : null)} placeholder="ગામ પસંદ કરો..." label="ગામ" />
            </div>
            <div className="space-y-2">
               <label className="text-[11px] font-black uppercase text-emerald-600 tracking-widest px-1">📱 મોબાઈલ નંબર</label>
               <Input value={editingStudent.mobileNumber} onChange={(e) => { const val = e.target.value.replace(/\D/g, ''); if (val.length <= 10) setEditingStudent(prev => prev ? {...prev, mobileNumber: val} : null); }} className="h-16 font-black text-xl sm:text-2xl text-slate-900 rounded-2xl border-2 px-6 bg-emerald-50/10" />
            </div>
            <div className="space-y-2">
               <label className="text-[11px] font-black text-emerald-600 tracking-widest px-1 block">✅ મેળવેલ ગુણ</label>
               <Input type="number" value={editingStudent.obtainedMarks} onChange={e => setEditingStudent(prev => prev ? {...prev, obtainedMarks: Number(e.target.value)} : null)} className="h-16 font-black text-xl sm:text-2xl text-slate-900 text-center rounded-2xl border-2 bg-slate-50/30" />
            </div>
            <div className="space-y-2">
               <label className="text-[11px] font-black text-emerald-600 tracking-widest px-1 block">📊 કુલ ગુણ</label>
               <Input type="number" value={editingStudent.totalMarks} onChange={e => setEditingStudent(prev => prev ? {...prev, totalMarks: Number(e.target.value)} : null)} className="h-16 font-black text-xl sm:text-2xl text-slate-900 text-center rounded-2xl border-2 bg-slate-50/30" />
            </div>
            <div className="space-y-3 pt-2">
               <label className="text-[11px] font-black text-emerald-600 tracking-widest px-1 block">% ટકાવારી</label>
               <div className="bg-emerald-500 text-white font-black px-6 py-6 rounded-2xl text-center text-3xl sm:text-4xl font-mono border-2 border-emerald-600 shadow-xl shadow-emerald-100 transition-all">
                {editingStudent.totalMarks > 0 ? ((editingStudent.obtainedMarks / editingStudent.totalMarks) * 100).toFixed(2) : '0.00'}%
               </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 pt-10">
              <Button variant="outline" onClick={closeEdit} className="h-16 rounded-2xl font-black border-2 text-xl sm:w-1/3">રદ કરો</Button>
              <Button onClick={handleUpdate} disabled={isUpdating} className="h-16 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-2xl shadow-xl text-xl flex items-center justify-center gap-3 flex-1">{isUpdating ? <Loader2 className="h-6 w-6 animate-spin" /> : <Save className="h-6 w-6" />}માહિતી સેવ કરો</Button>
            </div>
          </div>
        </div>

        {previewImage && (
          <AnimatePresence>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[500] bg-black/95 flex flex-col items-center justify-center p-4 md:p-8 overflow-hidden">
              <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[510] flex items-center gap-3 bg-white/10 backdrop-blur-md px-6 py-3 rounded-full border border-white/20">
                 <Button variant="ghost" size="icon" className="h-10 w-10 text-white hover:bg-white/10 rounded-full" onClick={() => setZoomLevel(prev => Math.max(prev - 0.5, 1))}><ZoomOut className="h-6 w-6" /></Button>
                 <span className="text-white font-black text-sm font-mono px-2">{Math.round(zoomLevel * 100)}%</span>
                 <Button variant="ghost" size="icon" className="h-10 w-10 text-white hover:bg-white/10 rounded-full" onClick={() => setZoomLevel(prev => Math.min(prev + 0.5, 5))}><ZoomIn className="h-6 w-6" /></Button>
                 <Button variant="ghost" size="icon" className="h-10 w-10 text-white hover:bg-white/10 rounded-full" onClick={() => { setZoomLevel(1); setPosition({ x: 0, y: 0 }); }}><RefreshCw className="h-5 w-5" /></Button>
                 <div className="h-6 w-px bg-white/20 mx-1" />
                 <Button variant="ghost" size="icon" className="h-10 w-10 text-white hover:bg-white/10 rounded-full" onClick={handleDownload}><Download className="h-5 w-5" /></Button>
              </div>
              <div className="absolute top-6 right-6 z-[510]">
                 <Button variant="outline" size="icon" className="h-14 w-14 rounded-full bg-white/10 text-white border-white/20 hover:bg-white/20 transition-all" onClick={closePreview}><X className="h-8 w-8" /></Button>
              </div>
              <motion.div className="w-full h-full flex items-center justify-center overflow-hidden cursor-zoom-out p-12" onClick={closePreview}>
                <div className="relative" onClick={(e) => e.stopPropagation()}>
                  <img src={previewImage} className={cn("shadow-2xl rounded-lg origin-center select-none max-w-none max-h-none ease-out", isDragging ? "cursor-grabbing transition-none" : "cursor-grab transition-transform duration-200")} style={{ transform: `translate(${position.x}px, ${position.y}px) scale(${zoomLevel})`, maxHeight: '85vh', maxWidth: '95vw', objectFit: 'contain', pointerEvents: isDragging ? 'none' : 'auto' }} alt="Fullscreen Preview" onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd} onDragStart={(e) => e.preventDefault()} />
                </div>
              </motion.div>
            </motion.div>
          </AnimatePresence>
        )}
      </motion.div>
    );
  }

  return (
    <div className="p-4 sm:p-10 max-w-7xl mx-auto space-y-6 sm:space-y-10 pb-32 overflow-x-hidden w-full max-w-full px-2 sm:px-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pb-8 border-b-4 border-slate-100">
        <div>
          <h1 className="text-2xl sm:text-4xl md:text-5xl font-black text-primary tracking-tighter flex items-center gap-3 py-2 leading-tight">
            <Users className="h-8 w-8 sm:h-10 sm:w-10 text-primary shrink-0" /> ઈનામ મળવા પાત્ર વિદ્યાર્થીઓનું લિસ્ટ
          </h1>
          </div>
          <div className="flex flex-col sm:flex-row gap-4">
             <Button onClick={handleExportToExcel} className="h-14 px-8 text-lg font-black rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-xl flex items-center gap-2 transition-all duration-200"><FileDown className="h-6 w-6" /> એક્સેલ ડાઉનલોડ ({filteredStudents.length})</Button>
             <Button onClick={openNew} className="h-14 px-8 text-lg font-black rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white shadow-xl flex items-center gap-2 transition-all duration-200"><Users className="h-6 w-6" /> નવી એન્ટ્રી ઉમેરો</Button>
          </div>
      </div>

      <Card className="rounded-[1.5rem] sm:rounded-[2.5rem] border-none shadow-xl bg-slate-50 p-4 sm:p-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 items-end">
        <div className="space-y-2">
          <label className="text-xs font-black uppercase text-slate-900 tracking-widest px-1">સર્ચ</label>
          <div className="relative"><Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" /><Input placeholder="નામ કે મોબાઈલ..." className="h-14 pl-12 rounded-xl border-2 font-black bg-white text-slate-900 border-slate-200 text-lg" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
        </div>
        <div className="space-y-2">
          <label className="text-xs font-black uppercase text-slate-900 tracking-widest px-1">ગામ</label>
          <Select onValueChange={setVillageFilter} defaultValue="all">
            <SelectTrigger className="h-14 rounded-xl border-2 font-black bg-white text-slate-900 border-slate-200 text-lg"><SelectValue placeholder="તમામ ગામ" /></SelectTrigger>
            <SelectContent className="max-h-80 z-[100]"><SelectItem value="all">તમામ ગામ</SelectItem>{palitanaVillages.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label className="text-xs font-black uppercase text-slate-900 tracking-widest px-1">ધોરણ</label>
          <Select onValueChange={setStandardFilter} defaultValue="all">
            <SelectTrigger className="h-14 rounded-xl border-2 font-black bg-white text-slate-900 border-slate-200 text-lg"><SelectValue placeholder="તમામ ધોરણ" /></SelectTrigger>
            <SelectContent className="max-h-80 z-[100]"><SelectItem value="all">તમામ ધોરણ</SelectItem>{academicStandards.map(std => <SelectItem key={std} value={std}>{std}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </Card>

      <Card className="shadow-2xl border-none rounded-[1.5rem] sm:rounded-[3.5rem] overflow-hidden bg-white relative">
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow>
                <TableHead className="w-16 p-8"><Checkbox checked={filteredStudents.length > 0 && selectedIds.size === filteredStudents.length} onCheckedChange={toggleSelectAll} className="h-7 w-7 border-2 border-primary data-[state=checked]:bg-primary" /></TableHead>
                <TableHead className="p-8 font-black text-slate-900 uppercase text-sm">વિદ્યાર્થી</TableHead>
                <TableHead className="font-black text-slate-900 text-center uppercase text-sm">સરનામું અને ધોરણ</TableHead>
                <TableHead className="font-black text-slate-900 text-center uppercase text-sm">ટકાવારી</TableHead>
                <TableHead className="text-right p-8 font-black text-slate-900 uppercase text-sm">એક્શન</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? Array.from({ length: 3 }).map((_, i) => (<TableRow key={i}><TableCell colSpan={5} className="p-8"><Skeleton className="h-20 w-full rounded-2xl" /></TableCell></TableRow>)) : paginatedStudents.length > 0 ? (
                paginatedStudents.map((s, i) => (
                  <TableRow key={s.id} className={cn("hover:bg-slate-50/50 transition-all border-b-2 last:border-none group", selectedIds.has(s.id) && "bg-slate-50")}>
                    <TableCell className="p-8"><Checkbox checked={selectedIds.has(s.id)} onCheckedChange={() => toggleSelect(s.id)} className="h-7 w-7 border-2 border-primary data-[state=checked]:bg-primary" /></TableCell>
                    <TableCell className="p-6">
                      <div className="flex items-center gap-5">
                         <div className="h-12 w-12 rounded-full bg-indigo-50 flex items-center justify-center font-black text-primary shrink-0 text-base">{(currentPage - 1) * pageSize + i + 1}</div>
                         <div className="flex flex-col min-w-0"><span className="font-black text-xl uppercase tracking-tighter text-slate-900 truncate">{s.name}</span><span className="text-sm font-black text-slate-900 flex items-center gap-2"><a href={`tel:${s.mobileNumber}`} className="hover:underline flex items-center gap-1.5 hover:text-primary transition-colors" title="કૉલ કરો"><Phone className="h-3.5 w-3.5 text-slate-500" /> {s.mobileNumber}</a><Button onClick={() => { navigator.clipboard.writeText(s.mobileNumber); toast({ title: 'નકલ થઈ ગઈ!', description: 'મોબાઈલ નંબર કોપી થઈ ગયો છે.' }); }} variant="ghost" size="icon" className="h-6 w-6 rounded-md hover:bg-slate-100 text-slate-400 hover:text-primary shrink-0 transition-all" title="કોપી કરો"><Copy className="h-3 w-3" /></Button></span></div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center"><div className="flex flex-col"><span className="font-black text-slate-900 text-sm">{s.villageName}</span><span className="text-[10px] font-black text-slate-400 uppercase">{s.standard}</span></div></TableCell>
                    <TableCell className="text-center"><Badge className="px-4 py-1 rounded-full bg-indigo-50 border-none text-lg font-black text-indigo-600">{s.percentage?.toFixed(2)}%</Badge></TableCell>
                    <TableCell className="p-6 text-right">
                      <div className="flex justify-end gap-2">
                         <Button onClick={() => handleViewPhotosClick(s)} size="icon" variant="outline" className="h-12 w-12 rounded-xl border-2 border-emerald-500 text-emerald-600 hover:bg-emerald-50 transition-all" title="ફોટા જુઓ">
                           {isFetchingPhotosForView === s.id ? <Loader2 className="h-5 w-5 animate-spin" /> : <Eye className="h-5 w-5" />}
                         </Button>
                         <Button onClick={() => handleEditClick(s)} size="icon" variant="outline" className="h-12 w-12 rounded-xl border-2 border-primary text-primary hover:bg-primary/5 transition-all"><Edit3 className="h-5 w-5" /></Button>
                         <Button onClick={() => setStudentToDelete(s)} variant="ghost" size="icon" className="h-12 w-12 rounded-xl text-rose-500 hover:bg-rose-50 transition-all" title="ટ્રેશ કરો"><Trash2 className="h-5 w-5" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={5} className="p-40 text-center font-black italic text-slate-200 text-3xl uppercase">કોઈ રેકોર્ડ મળ્યા નથી.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>

        {/* Pagination Bar */}
        {filteredStudents.length > 0 && (
          <div className="p-6 bg-slate-50/80 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs sm:text-sm font-black text-slate-600">
              દર્શાવાય છે: {filteredStudents.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} થી {Math.min(currentPage * pageSize, filteredStudents.length)} (કુલ {filteredStudents.length} વિદ્યાર્થીઓ)
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-slate-500 uppercase">પ્રતિ પેજ:</span>
                <Select value={String(pageSize)} onValueChange={v => setPageSize(Number(v))}>
                  <SelectTrigger className="h-10 w-20 rounded-xl border font-bold text-sm bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                    <SelectItem value="250">250</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage === 1} className="h-10 px-4 rounded-xl font-black bg-white">અગાઉનું</Button>
                <span className="text-xs sm:text-sm font-black px-2">{currentPage} / {totalPages}</span>
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} disabled={currentPage >= totalPages} className="h-10 px-4 rounded-xl font-black bg-white">આગળનું</Button>
              </div>
            </div>
          </div>
        )}
      </Card>

      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] w-[90vw] max-w-2xl animate-in fade-in slide-in-from-bottom-10 duration-300">
          <div className="bg-primary/95 backdrop-blur-md text-white px-8 py-5 rounded-[2rem] shadow-2xl flex items-center justify-between border border-white/20">
             <div className="flex items-center gap-4"><div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center font-black text-xl">{selectedIds.size}</div><div className="flex flex-col"><span className="font-black text-lg tracking-tight">પસંદ કરેલ વિદ્યાર્થીઓ</span><span className="text-xs font-bold text-white/60 uppercase tracking-widest">બલ્ક એક્શન એક્ટિવ</span></div></div>
             <div className="flex items-center gap-3">
               <Button variant="ghost" onClick={() => setSelectedIds(new Set())} className="text-white hover:bg-white/10 font-black h-12 px-6 rounded-xl">રદ કરો</Button>
               <Button onClick={() => setShowBulkTrashConfirm(true)} disabled={isBulkProcessing} className="bg-rose-500 hover:bg-rose-600 text-white font-black h-12 px-8 rounded-xl shadow-lg flex items-center gap-2">
                 {isBulkProcessing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Trash2 className="h-5 w-5" />} ટ્રેશ ({selectedIds.size})
               </Button>
             </div>
          </div>
        </div>
      )}

      <AlertDialog open={!!studentToDelete} onOpenChange={(open) => !open && setStudentToDelete(null)}>
        <AlertDialogContent className="rounded-[2rem] p-8">
          <AlertDialogHeader><AlertDialogTitle className="text-2xl font-black text-primary">ટ્રેશમાં ખસેડવા માંગો છો?</AlertDialogTitle><AlertDialogDescription className="text-lg font-bold">વિદ્યાર્થી <span className="text-rose-500 font-black">"{studentToDelete?.name}"</span> ને લિસ્ટમાંથી હટાવીને ટ્રેશ (કચરાપેટી) માં મોકલવામાં આવશે.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter className="mt-6 gap-3">
            <AlertDialogCancel className="h-14 rounded-xl border-2 font-black text-lg">ના, રહેવા દો</AlertDialogCancel>
            <AlertDialogAction onClick={async () => {
              if (!studentToDelete) return;
              try {
                const { marksheetPhotoBase64, aadhaarPhotoBase64, ...cleanData } = studentToDelete;
                await moveDocumentToTrash(firestore, 'students', studentToDelete.id, user?.uid || 'unknown');
                deleteDocumentNonBlocking(doc(firestore, 'student_photos', studentToDelete.id)).catch(() => {});
                toast({ title: 'સફળ!', description: 'વિદ્યાર્થીને ટ્રેશમાં ખસેડવામાં આવ્યો છે.' });
              } catch (error: any) { toast({ variant: 'destructive', title: 'ભૂલ', description: 'ખસેડવામાં ભૂલ આવી: ' + error.message }); }
              setStudentToDelete(null);
            }} className="h-14 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-black text-lg">હા, ટ્રેશ કરો</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showBulkTrashConfirm} onOpenChange={setShowBulkTrashConfirm}>
        <AlertDialogContent className="rounded-[2rem] p-8">
          <AlertDialogHeader><AlertDialogTitle className="text-2xl font-black text-primary">બલ્ક ટ્રેશ કન્ફર્મ કરો</AlertDialogTitle><AlertDialogDescription className="text-lg font-bold">તમે પસંદ કરેલા <span className="text-rose-500 font-black">{selectedIds.size}</span> વિદ્યાર્થીઓને ટ્રેશમાં ખસેડવા માંગો છો?</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter className="mt-6 gap-3">
            <AlertDialogCancel className="h-14 rounded-xl border-2 font-black text-lg">ના</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkTrash} className="h-14 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-black text-lg">હા, બધાને ટ્રેશ કરો</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={viewPhotosModal.isOpen} onOpenChange={(open) => !open && setViewPhotosModal(prev => ({...prev, isOpen: false}))}>
        <AlertDialogContent className="rounded-[2rem] p-6 sm:p-8 max-w-2xl max-h-[85vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl sm:text-2xl font-black text-primary flex items-center justify-between">
              <span>{viewPhotosModal.studentName} ના ફોટા</span>
              <Button variant="ghost" size="icon" onClick={() => setViewPhotosModal(prev => ({...prev, isOpen: false}))} className="h-10 w-10 rounded-full hover:bg-slate-100 -mr-2"><X className="h-6 w-6" /></Button>
            </AlertDialogTitle>
          </AlertDialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-2">
            {viewPhotosModal.marksheet ? (
              <div className="space-y-2">
                <span className="text-xs font-black uppercase text-slate-500 tracking-widest">📄 માર્કશીટ</span>
                <div className="relative group aspect-[4/3] rounded-xl overflow-hidden border-2 border-slate-200 bg-slate-50 flex items-center justify-center cursor-zoom-in" onClick={() => openPreview(viewPhotosModal.marksheet!)}>
                   <img src={viewPhotosModal.marksheet} className="w-full h-full object-contain" alt="Marksheet" />
                   <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center"><Eye className="h-8 w-8 text-white" /></div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <span className="text-xs font-black uppercase text-slate-500 tracking-widest">📄 માર્કશીટ</span>
                <div className="aspect-[4/3] rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center text-slate-400 font-bold text-sm">ફોટો નથી</div>
              </div>
            )}
            {viewPhotosModal.aadhar ? (
              <div className="space-y-2">
                <span className="text-xs font-black uppercase text-slate-500 tracking-widest">🪪 આધાર કાર્ડ</span>
                <div className="relative group aspect-[4/3] rounded-xl overflow-hidden border-2 border-slate-200 bg-slate-50 flex items-center justify-center cursor-zoom-in" onClick={() => openPreview(viewPhotosModal.aadhar!)}>
                   <img src={viewPhotosModal.aadhar} className="w-full h-full object-contain" alt="Aadhar" />
                   <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center"><Eye className="h-8 w-8 text-white" /></div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <span className="text-xs font-black uppercase text-slate-500 tracking-widest">🪪 આધાર કાર્ડ</span>
                <div className="aspect-[4/3] rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center text-slate-400 font-bold text-sm">ફોટો નથી</div>
              </div>
            )}
          </div>
          <AlertDialogFooter className="mt-6 border-t-2 border-slate-100 pt-6">
            <AlertDialogCancel className="w-full h-14 rounded-xl text-lg font-black border-2 hover:bg-slate-50">બંધ કરો (Close)</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* In-App Camera Modal */}
      <CameraModal
        open={cameraTarget !== null}
        onClose={() => setCameraTarget(null)}
        onCapture={async (dataUrl) => {
          if (!cameraTarget) return;
          const { field, context } = cameraTarget;
          let finalData = dataUrl;
          try {
            finalData = await compressDataUrl(dataUrl);
          } catch { /* raw use karo */ }
          if (context === 'edit') {
            setEditingStudent(prev => prev ? { ...prev, [field]: finalData } : null);
          } else {
            setNewStudent(prev => ({ ...prev, [field]: finalData }));
          }
          setCameraTarget(null);
        }}
      />
    </div>
  );
}

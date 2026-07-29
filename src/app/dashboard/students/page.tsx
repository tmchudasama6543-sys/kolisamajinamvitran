'use client';

import { useUser, useFirestore, useCollection, useMemoFirebase, updateStudentNonBlocking, moveDocumentToTrash, deleteDocumentNonBlocking } from '@/firebase';
import { collection, query, orderBy, doc, limit, writeBatch, getDoc, deleteField } from 'firebase/firestore';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, Users, Trash2, MapPin, Edit3, Save, Loader2, X, Phone, Copy, FileDown, CheckSquare, AlertTriangle, RefreshCw, Download, ArrowLeft } from 'lucide-react';
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

import { SearchableSelect } from '@/components/ui/searchable-select';
import { cn } from '@/lib/utils';

import * as XLSX from 'xlsx';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';

type StudentData = {
  id: string;
  name: string;
  standard: string;
  villageName: string;
  percentage: number;
  mobileNumber: string;
  totalMarks: number;
  obtainedMarks: number;

  submissionDateTime: any;
};

const gujaratiRegex = /^[\u0A80-\u0AFF\s\.\(\)\-]+$/;

const exportExcelFile = (workbook: any, filename: string) => {
  try {
    const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    
    const blob = new Blob([wbout], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  } catch (err) {
    console.error("Export error:", err);
  }
};

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
    obtainedMarks: '' as number | string,
    totalMarks: '' as number | string
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [isFixingDb, setIsFixingDb] = useState(false);

  const [studentToDelete, setStudentToDelete] = useState<StudentData | null>(null);
  const [showBulkTrashConfirm, setShowBulkTrashConfirm] = useState(false);

  const uid = useId();



  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (!hash.includes('edit')) setEditingStudent(null);
      if (!hash.includes('new')) setIsAddingNew(false);

    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    if (isAddingNew || editingStudent) {
      setTimeout(() => {
        document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' });
      }, 50);
    }
  }, [isAddingNew, editingStudent]);

  const openNew = () => {
    setNewStudent({
      name: '',
      standard: '',
      villageName: '',
      mobileNumber: '',
      obtainedMarks: '',
      totalMarks: ''
    });
    setIsAddingNew(true);
    window.location.hash = 'new';
  };

  const closeNew = () => {
    setIsAddingNew(false);
    if (window.location.hash.includes('new')) window.history.back();
  };

  const closeEdit = () => {
    setEditingStudent(null);
    if (window.location.hash.includes('edit')) window.history.back();
  };



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
      const matchesSearch = (s.name || '').toLowerCase().includes(debouncedSearch.toLowerCase()) || (s.mobileNumber || '').includes(debouncedSearch);
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
    setShowBulkTrashConfirm(false);
    try {
      const batch = writeBatch(firestore);
      const selectedStudents = students?.filter(s => selectedIds.has(s.id)) || [];
      for (const s of selectedStudents) {
        const sourceRef = doc(firestore, 'students', s.id);
        const trashRef = doc(firestore, 'trash_students', s.id);
        const cleanData = s;
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

  const handleFixDatabase = async () => {
    if (!students || students.length === 0) return;
    setIsFixingDb(true);
    toast({ title: 'શરૂઆત...', description: 'ડેટાબેઝ ક્લીનઅપ શરૂ થયું છે. કૃપા કરીને રાહ જુઓ.' });
    try {
      let fixedCount = 0;
      for (const s of students) {
        if (s.marksheetPhotoBase64 || s.aadhaarPhotoBase64) {
          const studentRef = doc(firestore, 'students', s.id);
          const photosRef = doc(firestore, 'student_photos', s.id);
          
          const batch = writeBatch(firestore);
          batch.set(photosRef, {
            marksheetPhotoBase64: s.marksheetPhotoBase64 || "",
            aadhaarPhotoBase64: s.aadhaarPhotoBase64 || ""
          }, { merge: true });
          
          batch.update(studentRef, {
            marksheetPhotoBase64: deleteField(),
            aadhaarPhotoBase64: deleteField()
          });
          
          await batch.commit();
          fixedCount++;
        }
      }
      toast({ title: 'સફળ!', description: `${fixedCount} રેકોર્ડ્સ સફળતાપૂર્વક સાફ થયા. હવે એપ ફાસ્ટ ચાલશે!` });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'ભૂલ', description: 'ક્લીનઅપ નિષ્ફળ: ' + e.message });
    } finally {
      setIsFixingDb(false);
    }
  };

  const handleEditClick = (student: StudentData) => {
    window.location.hash = 'edit';
    setEditingStudent(student);
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
      const parsedTotal = Number(newStudent.totalMarks);
      const parsedObtained = Number(newStudent.obtainedMarks);
      const percentage = parsedTotal > 0 ? parseFloat(((parsedObtained / parsedTotal) * 100).toFixed(2)) : 0;
      const textData = { ...newStudent, obtainedMarks: parsedObtained, totalMarks: parsedTotal };
      
      const studentData = {
        ...textData,
        percentage,
        enteredByUserId: user?.uid || 'admin',
        submissionDateTime: new Date().toISOString()
      };

      const { saveStudentNonBlocking } = await import('@/firebase');
      saveStudentNonBlocking(firestore, studentData).catch(err => {
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
      const parsedTotal = Number(editingStudent.totalMarks);
      const parsedObtained = Number(editingStudent.obtainedMarks);
      const updatedPercentage = parsedTotal > 0 ? parseFloat(((parsedObtained / parsedTotal) * 100).toFixed(2)) : 0;
      const studentTextData = { ...editingStudent, obtainedMarks: parsedObtained, totalMarks: parsedTotal };
      const studentData = { ...studentTextData, percentage: updatedPercentage };
      updateStudentNonBlocking(firestore, editingStudent.id, studentData).catch(err => {
        toast({ variant: 'destructive', title: 'ભૂલ', description: 'ડેટાબેઝ અપડેટ નિષ્ફળ: ' + err.message });
      });
      toast({ title: "સફળ!", description: "માહિતી અપડેટ થઈ ગઈ." });
      closeEdit();
    } catch (e: any) { toast({ variant: 'destructive', title: 'ભૂલ', description: e.message }); }
    finally { setIsUpdating(false); }
  };

  const generateRankedStudents = useCallback(() => {
    if (!filteredStudents || filteredStudents.length === 0) return { topRankers: [], remaining: [] };

    const groupedByStandard: Record<string, typeof filteredStudents> = {};
    filteredStudents.forEach(s => {
      const std = s.standard || 'Unknown';
      if (!groupedByStandard[std]) groupedByStandard[std] = [];
      groupedByStandard[std].push(s);
    });

    const topRankers: any[] = [];
    const remaining: any[] = [];
    const allRanked: any[] = [];

    const sortedStandards = Object.keys(groupedByStandard).sort((a, b) => {
      const idxA = academicStandards.indexOf(a);
      const idxB = academicStandards.indexOf(b);
      if (idxA === -1 && idxB === -1) return a.localeCompare(b);
      if (idxA === -1) return 1;
      if (idxB === -1) return -1;
      return idxA - idxB;
    });

    sortedStandards.forEach(std => {
      const stdStudents = groupedByStandard[std].sort((a, b) => {
        const pctA = typeof a.percentage === 'number' ? a.percentage : parseFloat((a.percentage as any) || '0');
        const pctB = typeof b.percentage === 'number' ? b.percentage : parseFloat((b.percentage as any) || '0');
        return pctB - pctA;
      });

      let currentRank = 1;
      let previousPct: number | null = null;
      
      let pushedToTop = false;
      let pushedToRemaining = false;
      let pushedToAll = false;

      const emptyRow = {
        'ધોરણ (Standard)': '',
        'ક્રમ (Rank)': '',
        'વિદ્યાર્થીનું નામ (Student Name)': '',
        'ટકાવારી (Percentage)': '',
        'મેળવેલ ગુણ (Obtained Marks)': '',
        'કુલ ગુણ (Total Marks)': '',
        'ગામનું નામ (Village Name)': '',
        'મોબાઈલ નંબર (Mobile Number)': ''
      };

      stdStudents.forEach((s) => {
        const pct = typeof s.percentage === 'number' ? s.percentage : parseFloat((s.percentage as any) || '0');
        
        if (previousPct !== null && pct < previousPct) {
          currentRank++;
        }
        
        const row = {
          'ધોરણ (Standard)': s.standard,
          'ક્રમ (Rank)': currentRank,
          'વિદ્યાર્થીનું નામ (Student Name)': s.name,
          'ટકાવારી (Percentage)': `${pct.toFixed(2)}%`,
          'મેળવેલ ગુણ (Obtained Marks)': s.obtainedMarks || 0,
          'કુલ ગુણ (Total Marks)': s.totalMarks || 0,
          'ગામનું નામ (Village Name)': s.villageName,
          'મોબાઈલ નંબર (Mobile Number)': s.mobileNumber
        };

        if (!pushedToAll) {
          if (allRanked.length > 0) allRanked.push(emptyRow);
          pushedToAll = true;
        }
        allRanked.push(row);

        if (currentRank <= 3) {
          if (!pushedToTop) {
            if (topRankers.length > 0) topRankers.push(emptyRow);
            pushedToTop = true;
          }
          topRankers.push(row);
        } else {
          if (!pushedToRemaining) {
            if (remaining.length > 0) remaining.push(emptyRow);
            pushedToRemaining = true;
          }
          remaining.push(row);
        }

        previousPct = pct;
      });
    });

    return { topRankers, remaining, allRanked };
  }, [filteredStudents]);

  const handleDownloadTopRankers = useCallback(() => {
    const { topRankers } = generateRankedStudents();
    if (topRankers.length === 0) {
       toast({ variant: 'destructive', title: 'ભૂલ', description: 'ડાઉનલોડ કરવા માટે કોઈ ડેટા નથી.' });
       return;
    }
    const worksheet = XLSX.utils.json_to_sheet(topRankers);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Top Rankers");
    
    exportExcelFile(workbook, `Top_Rankers_${new Date().toLocaleDateString('en-IN').replace(/\//g, '-')}.xlsx`);
    
    toast({ title: 'સફળ!', description: 'ટોપર વિદ્યાર્થીઓની ફાઇલ ડાઉનલોડ થઈ ગઈ છે.' });
  }, [generateRankedStudents, toast]);

  const handleDownloadRemaining = useCallback(() => {
    const { remaining } = generateRankedStudents();
    if (remaining.length === 0) {
       toast({ variant: 'destructive', title: 'ભૂલ', description: 'ડાઉનલોડ કરવા માટે કોઈ ડેટા નથી.' });
       return;
    }
    const worksheet = XLSX.utils.json_to_sheet(remaining);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Remaining Students");
    
    exportExcelFile(workbook, `Remaining_Students_${new Date().toLocaleDateString('en-IN').replace(/\//g, '-')}.xlsx`);
    
    toast({ title: 'સફળ!', description: 'બાકીના વિદ્યાર્થીઓની ફાઇલ ડાઉનલોડ થઈ ગઈ છે.' });
  }, [generateRankedStudents, toast]);

  const handleExportToExcel = useCallback(() => {
    if (!filteredStudents || filteredStudents.length === 0) {
       toast({ variant: 'destructive', title: 'ભૂલ', description: 'ડાઉનલોડ કરવા માટે કોઈ ડેટા નથી.' });
       return;
    }
    const { allRanked } = generateRankedStudents();
    
    const worksheet = XLSX.utils.json_to_sheet(allRanked);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "All Students");
    
    exportExcelFile(workbook, `All_Students_${new Date().toLocaleDateString('en-IN').replace(/\//g, '-')}.xlsx`);
    
    toast({ title: 'સફળ!', description: 'તમામ વિદ્યાર્થીઓની ફાઇલ ડાઉનલોડ થઈ ગઈ છે.' });
  }, [filteredStudents, generateRankedStudents, toast]);

  if (userLoading) return <div className="p-10"><Skeleton className="h-[70vh] w-full rounded-3xl" /></div>;
  if (!user || user.role !== 'admin') return null;

  if (isAddingNew) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="p-4 sm:p-10 max-w-4xl mx-auto space-y-8 pb-64">
        <div className="pb-10 border-b-8 border-slate-50 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={closeNew} className="h-12 w-12 rounded-full border-2 border-slate-200 hover:border-emerald-500 hover:bg-emerald-50 shadow-md flex items-center justify-center shrink-0 transition-all"><ArrowLeft className="h-6 w-6 text-slate-700" /></Button>
            <div>
              <h1 className="text-2xl sm:text-4xl font-black text-emerald-600 tracking-tighter flex items-center gap-2 py-1 leading-tight">નવી વિદ્યાર્થી એન્ટ્રી</h1>
              <p className="text-muted-foreground font-bold uppercase tracking-widest text-[10px]">બધી વિગતો ભરો</p>
            </div>
          </div>
        </div>

        <div className="max-w-2xl mx-auto p-4 sm:p-10 space-y-5 sm:space-y-6 bg-white rounded-[1.5rem] sm:rounded-[2.5rem] shadow-2xl border border-slate-100">
          

          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
               <label className="text-[11px] font-black uppercase text-slate-500 tracking-widest px-1">👤 વિદ્યાર્થીનું નામ</label>
               <Input placeholder="નામ લખો..." value={newStudent.name} onChange={e => setNewStudent(prev => ({...prev, name: e.target.value}))} className="h-14 font-black text-lg sm:text-xl text-slate-900 rounded-2xl border-2 px-6 bg-slate-50/30" />
            </div>
            <div className="space-y-1.5">
               <label className="text-[11px] font-black uppercase text-slate-500 tracking-widest px-1">🎓 ધોરણ</label>
               <SearchableSelect options={academicStandards} value={newStudent.standard} onSelect={val => setNewStudent(prev => ({...prev, standard: val}))} placeholder="ધોરણ પસંદ કરો..." label="ધોરણ" />
            </div>
            <div className="space-y-1.5">
               <label className="text-[11px] font-black uppercase text-slate-500 tracking-widest px-1">📍 ગામનું નામ</label>
               <SearchableSelect options={palitanaVillages} value={newStudent.villageName} onSelect={val => setNewStudent(prev => ({...prev, villageName: val}))} placeholder="ગામ પસંદ કરો..." label="ગામ" />
            </div>
            <div className="space-y-1.5">
               <label className="text-[11px] font-black uppercase text-emerald-600 tracking-widest px-1">📱 મોબાઈલ નંબર</label>
               <Input placeholder="૧૦ આંકડાનો નંબર" value={newStudent.mobileNumber} onChange={(e) => { const val = e.target.value.replace(/\D/g, ''); if (val.length <= 10) setNewStudent(prev => ({...prev, mobileNumber: val})); }} className="h-14 font-black text-lg sm:text-xl text-slate-900 rounded-2xl border-2 px-6 bg-emerald-50/10" />
            </div>
            <div className="space-y-1.5">
               <label className="text-[11px] font-black text-emerald-600 tracking-widest px-1 block">✅ મેળવેલ ગુણ</label>
               <Input type="number" value={newStudent.obtainedMarks} onChange={e => setNewStudent(prev => ({...prev, obtainedMarks: e.target.value}))} className="h-14 font-black text-lg sm:text-xl text-slate-900 text-center rounded-2xl border-2 bg-slate-50/30" />
            </div>
            <div className="space-y-1.5">
               <label className="text-[11px] font-black text-emerald-600 tracking-widest px-1 block">📊 કુલ ગુણ</label>
               <Input type="number" value={newStudent.totalMarks} onChange={e => setNewStudent(prev => ({...prev, totalMarks: e.target.value}))} className="h-14 font-black text-lg sm:text-xl text-slate-900 text-center rounded-2xl border-2 bg-slate-50/30" />
            </div>
            <div className="space-y-3 pt-2">
               <label className="text-[11px] font-black text-emerald-600 tracking-widest px-1 block">% ટકાવારી</label>
               <div className="bg-emerald-500 text-white font-black px-6 py-4 rounded-2xl text-center text-2xl sm:text-3xl font-mono border-2 border-emerald-600 shadow-xl shadow-emerald-100 transition-all">
                {Number(newStudent.totalMarks) > 0 ? ((Number(newStudent.obtainedMarks) / Number(newStudent.totalMarks)) * 100).toFixed(2) : '0.00'}%
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
      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="p-4 sm:p-10 max-w-4xl mx-auto space-y-8 pb-64">
        <div className="pb-10 border-b-8 border-slate-50 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={closeEdit} className="h-12 w-12 rounded-full border-2 border-slate-200 hover:border-primary hover:bg-primary/5 shadow-md flex items-center justify-center shrink-0 transition-all"><ArrowLeft className="h-6 w-6 text-slate-700" /></Button>
            <div>
              <h1 className="text-2xl sm:text-4xl font-black text-primary tracking-tighter flex items-center gap-2 py-1 leading-tight">વિદ્યાર્થી પ્રોફાઇલ એડિટ</h1>
              <p className="text-muted-foreground font-bold uppercase tracking-widest text-[10px]">માહિતી સુધારો</p>
            </div>
          </div>
        </div>

        <div className="max-w-2xl mx-auto p-4 sm:p-10 space-y-6 sm:space-y-8 bg-white rounded-[1.5rem] sm:rounded-[2.5rem] shadow-2xl border border-slate-100">
          

          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
               <label className="text-[11px] font-black uppercase text-slate-500 tracking-widest px-1">👤 વિદ્યાર્થીનું નામ</label>
               <Input value={editingStudent.name} onChange={e => setEditingStudent(prev => prev ? {...prev, name: e.target.value} : null)} className="h-14 font-black text-lg sm:text-xl text-slate-900 rounded-2xl border-2 px-6 bg-slate-50/30" />
            </div>
            <div className="space-y-1.5">
               <label className="text-[11px] font-black uppercase text-slate-500 tracking-widest px-1">🎓 ધોરણ</label>
               <SearchableSelect options={academicStandards} value={editingStudent.standard} onSelect={val => setEditingStudent(prev => prev ? {...prev, standard: val} : null)} placeholder="ધોરણ પસંદ કરો..." label="ધોરણ" />
            </div>
            <div className="space-y-1.5">
               <label className="text-[11px] font-black uppercase text-slate-500 tracking-widest px-1">📍 ગામનું નામ</label>
               <SearchableSelect options={palitanaVillages} value={editingStudent.villageName} onSelect={val => setEditingStudent(prev => prev ? {...prev, villageName: val} : null)} placeholder="ગામ પસંદ કરો..." label="ગામ" />
            </div>
            <div className="space-y-1.5">
               <label className="text-[11px] font-black uppercase text-emerald-600 tracking-widest px-1">📱 મોબાઈલ નંબર</label>
               <Input value={editingStudent.mobileNumber} onChange={(e) => { const val = e.target.value.replace(/\D/g, ''); if (val.length <= 10) setEditingStudent(prev => prev ? {...prev, mobileNumber: val} : null); }} className="h-14 font-black text-lg sm:text-xl text-slate-900 rounded-2xl border-2 px-6 bg-emerald-50/10" />
            </div>
            <div className="space-y-1.5">
               <label className="text-[11px] font-black text-emerald-600 tracking-widest px-1 block">✅ મેળવેલ ગુણ</label>
               <Input type="number" value={editingStudent.obtainedMarks} onChange={e => setEditingStudent(prev => prev ? {...prev, obtainedMarks: e.target.value as any} : null)} className="h-14 font-black text-lg sm:text-xl text-slate-900 text-center rounded-2xl border-2 bg-slate-50/30" />
            </div>
            <div className="space-y-1.5">
               <label className="text-[11px] font-black text-emerald-600 tracking-widest px-1 block">📊 કુલ ગુણ</label>
               <Input type="number" value={editingStudent.totalMarks} onChange={e => setEditingStudent(prev => prev ? {...prev, totalMarks: e.target.value as any} : null)} className="h-14 font-black text-lg sm:text-xl text-slate-900 text-center rounded-2xl border-2 bg-slate-50/30" />
            </div>
            <div className="space-y-3 pt-2">
               <label className="text-[11px] font-black text-emerald-600 tracking-widest px-1 block">% ટકાવારી</label>
               <div className="bg-emerald-500 text-white font-black px-6 py-4 rounded-2xl text-center text-2xl sm:text-3xl font-mono border-2 border-emerald-600 shadow-xl shadow-emerald-100 transition-all">
                {Number(editingStudent.totalMarks) > 0 ? ((Number(editingStudent.obtainedMarks) / Number(editingStudent.totalMarks)) * 100).toFixed(2) : '0.00'}%
               </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 pt-10">
              <Button variant="outline" onClick={closeEdit} className="h-16 rounded-2xl font-black border-2 text-xl sm:w-1/3">રદ કરો</Button>
              <Button onClick={handleUpdate} disabled={isUpdating} className="h-16 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-2xl shadow-xl text-xl flex items-center justify-center gap-3 flex-1">{isUpdating ? <Loader2 className="h-6 w-6 animate-spin" /> : <Save className="h-6 w-6" />}માહિતી સેવ કરો</Button>
            </div>
          </div>
        </div>


      </motion.div>
    );
  }

  return (
    <div className="p-4 sm:p-10 max-w-7xl mx-auto space-y-4 sm:space-y-6 pb-32 overflow-x-hidden w-full max-w-full px-2 sm:px-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pb-8 border-b-4 border-slate-100">
        <div>
          <h1 className="text-2xl sm:text-4xl md:text-5xl font-black text-primary tracking-tighter flex items-center gap-3 py-2 leading-tight">
            <Users className="h-8 w-8 sm:h-10 sm:w-10 text-primary shrink-0" /> ઈનામ મળવા પાત્ર વિદ્યાર્થીઓનું લિસ્ટ
          </h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
             <Button onClick={handleDownloadTopRankers} className="h-12 px-4 sm:px-5 text-sm font-black rounded-2xl bg-amber-500 hover:bg-amber-600 text-white shadow-md flex items-center gap-2 transition-all">
               🏆 ટોપર (૧ થી ૩)
             </Button>
             <Button onClick={handleDownloadRemaining} className="h-12 px-4 sm:px-5 text-sm font-black rounded-2xl bg-indigo-500 hover:bg-indigo-600 text-white shadow-md flex items-center gap-2 transition-all">
               👥 અન્ય
             </Button>
             <Button onClick={handleExportToExcel} className="h-12 px-4 sm:px-5 text-sm font-black rounded-2xl bg-blue-600 hover:bg-blue-700 text-white shadow-md flex items-center gap-2 transition-all">
               <FileDown className="h-4 w-4" /> તમામ એક્સેલ ({filteredStudents.length})
             </Button>
             <Button onClick={openNew} className="h-12 px-6 text-sm sm:text-base font-black rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white shadow-xl flex items-center gap-2 transition-all">
               <Users className="h-5 w-5" /> નવી એન્ટ્રી
             </Button>
          </div>
      </div>

      <Card className="rounded-[1.5rem] sm:rounded-[2.5rem] border-none shadow-xl bg-slate-50 p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
        <div className="space-y-2">
          <label className="text-xs font-black uppercase text-slate-900 tracking-widest px-1">સર્ચ</label>
          <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" /><Input placeholder="નામ કે મોબાઈલ..." className="h-12 pl-10 rounded-xl border-2 font-black bg-white text-slate-900 border-slate-200 text-base" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
        </div>
        <div className="space-y-2">
          <label className="text-xs font-black uppercase text-slate-900 tracking-widest px-1">ગામ</label>
          <Select onValueChange={setVillageFilter} defaultValue="all">
            <SelectTrigger className="h-12 rounded-xl border-2 font-black bg-white text-slate-900 border-slate-200 text-base"><SelectValue placeholder="તમામ ગામ" /></SelectTrigger>
            <SelectContent className="max-h-80 z-[100]"><SelectItem value="all">તમામ ગામ</SelectItem>{palitanaVillages.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label className="text-xs font-black uppercase text-slate-900 tracking-widest px-1">ધોરણ</label>
          <Select onValueChange={setStandardFilter} defaultValue="all">
            <SelectTrigger className="h-12 rounded-xl border-2 font-black bg-white text-slate-900 border-slate-200 text-base"><SelectValue placeholder="તમામ ધોરણ" /></SelectTrigger>
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
                    <TableCell className="text-center"><Badge className="px-4 py-1 rounded-full bg-indigo-50 border-none text-lg font-black text-indigo-600">{(typeof s.percentage === 'number' ? s.percentage : parseFloat((s.percentage as any) || '0')).toFixed(2)}%</Badge></TableCell>
                    <TableCell className="p-6 text-right">
                      <div className="flex justify-end gap-2">

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
        <AlertDialogContent className="rounded-[2rem] p-6 sm:p-8 w-[95vw] sm:max-w-md">
          <AlertDialogHeader><AlertDialogTitle className="text-2xl font-black text-primary">ટ્રેશમાં ખસેડવા માંગો છો?</AlertDialogTitle><AlertDialogDescription className="text-lg font-bold">વિદ્યાર્થી <span className="text-rose-500 font-black">"{studentToDelete?.name}"</span> ને લિસ્ટમાંથી હટાવીને ટ્રેશ (કચરાપેટી) માં મોકલવામાં આવશે.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter className="mt-6 flex flex-col sm:flex-row gap-3">
            <AlertDialogCancel className="h-14 w-full sm:w-auto rounded-xl border-2 font-black text-lg m-0">ના, રહેવા દો</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (!studentToDelete) return;
              const student = studentToDelete;
              setStudentToDelete(null);
              moveDocumentToTrash(firestore, 'students', student.id, user?.uid || 'unknown')
                .then(() => {
                  deleteDocumentNonBlocking(doc(firestore, 'student_photos', student.id)).catch(() => {});
                  toast({ title: 'સફળ!', description: 'વિદ્યાર્થીને ટ્રેશમાં ખસેડવામાં આવ્યો છે.' });
                })
                .catch((error: any) => {
                  toast({ variant: 'destructive', title: 'ભૂલ', description: 'ખસેડવામાં ભૂલ આવી: ' + error.message });
                });
            }} className="h-14 w-full sm:w-auto rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-black text-lg m-0">હા, ટ્રેશ કરો</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showBulkTrashConfirm} onOpenChange={setShowBulkTrashConfirm}>
        <AlertDialogContent className="rounded-[2rem] p-6 sm:p-8 w-[95vw] sm:max-w-md">
          <AlertDialogHeader><AlertDialogTitle className="text-2xl font-black text-primary">બલ્ક ટ્રેશ કન્ફર્મ કરો</AlertDialogTitle><AlertDialogDescription className="text-lg font-bold">તમે પસંદ કરેલા <span className="text-rose-500 font-black">{selectedIds.size}</span> વિદ્યાર્થીઓને ટ્રેશમાં ખસેડવા માંગો છો?</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter className="mt-6 flex flex-col sm:flex-row gap-3">
            <AlertDialogCancel className="h-14 w-full sm:w-auto rounded-xl border-2 font-black text-lg m-0">ના</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkTrash} className="h-14 w-full sm:w-auto rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-black text-lg m-0">હા, બધાને ટ્રેશ કરો</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>




    </div>
  );
}

'use client';

import { useUser, useFirestore, useCollection, useMemoFirebase, restoreDocumentFromTrash, deleteDocumentNonBlocking } from '@/firebase';
import { collection, query, orderBy, doc, writeBatch, getDoc } from 'firebase/firestore';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Trash2, RefreshCw, MapPin, ShieldAlert, Loader2, CheckSquare, AlertTriangle, X, RefreshCcw } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { useState, useMemo, useEffect } from 'react';
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
import { cn } from '@/lib/utils';

type TrashStudent = {
  id: string;
  name: string;
  standard: string;
  villageName: string;
  percentage: number;
  deletedAt: any;
};

export default function TrashFolderPage() {
  const { user, loading: userLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  useEffect(() => {
    if (!userLoading && user?.role !== 'admin') {
      router.replace('/dashboard');
    }
  }, [user, userLoading, router]);

  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [studentToDelete, setStudentToDelete] = useState<TrashStudent | null>(null);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  
  // Selection State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  const trashQuery = useMemoFirebase(
    () => (user?.role === 'admin' ? query(collection(firestore, 'trash_students'), orderBy('deletedAt', 'desc')) : null),
    [user, firestore]
  );

  const { data: trashStudents, isLoading } = useCollection<TrashStudent>(trashQuery);

  const toggleSelectAll = () => {
    if (!trashStudents) return;
    if (selectedIds.size === trashStudents.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(trashStudents.map(s => s.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleRestore = async (id: string, name: string) => {
    setIsProcessing(id);
    try {
      await restoreDocumentFromTrash(firestore, 'students', id);
      toast({ 
        title: "સફળ!", 
        description: `વિદ્યાર્થી "${name}" નો ડેટા સફળતાપૂર્વક રીસ્ટોર થઈ ગયો છે!` 
      });
      // Selection માંથી કાઢી નાખો જો હોય તો
      const newSelected = new Set(selectedIds);
      newSelected.delete(id);
      setSelectedIds(newSelected);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'ભૂલ', description: error.message });
    } finally {
      setIsProcessing(null);
    }
  };

  const handleBulkRestore = async () => {
    if (selectedIds.size === 0 || !user) return;
    setIsBulkProcessing(true);
    
    try {
      const batch = writeBatch(firestore);
      const selectedStudents = trashStudents?.filter(s => selectedIds.has(s.id)) || [];
      
      for (const student of selectedStudents) {
        const trashRef = doc(firestore, 'trash_students', student.id);
        const originalRef = doc(firestore, 'students', student.id);
        
        // Remove trash metadata and restore original
        const { deletedAt, deletedBy, originalId, ...originalData } = student as any;
        
        batch.set(originalRef, originalData);
        batch.delete(trashRef);
      }
      
      await batch.commit();
      toast({ 
        title: "બલ્ક રીસ્ટોર સફળ!", 
        description: `${selectedIds.size} વિદ્યાર્થીઓનો ડેટા પાછો મેળવ્યો.` 
      });
      setSelectedIds(new Set());
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'ભૂલ', description: 'બલ્ક રીસ્ટોરમાં સમસ્યા આવી.' });
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handlePermanentDelete = async (id: string) => {
    setIsProcessing(id);
    try {
      await deleteDocumentNonBlocking(doc(firestore, 'trash_students', id));
      toast({ 
        variant: "destructive", 
        title: "કાયમી ડિલીટ!", 
        description: "રેકોર્ડ ડેટાબેઝમાંથી કાયમ માટે કાઢી નાખવામાં આવ્યો છે." 
      });
      const newSelected = new Set(selectedIds);
      newSelected.delete(id);
      setSelectedIds(newSelected);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'ભૂલ', description: error.message });
    } finally {
      setIsProcessing(null);
    }
  };

  const handleBulkPermanentDelete = async () => {
    if (selectedIds.size === 0 || !user) return;
    setIsBulkProcessing(true);
    
    try {
      const batch = writeBatch(firestore);
      selectedIds.forEach(id => {
        batch.delete(doc(firestore, 'trash_students', id));
      });
      
      await batch.commit();
      toast({ 
        variant: "destructive",
        title: "બલ્ક કાયમી ડિલીટ!", 
        description: `${selectedIds.size} રેકોર્ડ્સ કાયમ માટે કાઢી નાખ્યા.` 
      });
      setSelectedIds(new Set());
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'ભૂલ', description: 'બલ્ક ડિલીટમાં સમસ્યા આવી.' });
    } finally {
      setIsBulkProcessing(false);
    }
  };

  if (userLoading) return <div className="p-10"><Skeleton className="h-[70vh] w-full rounded-[4rem]" /></div>;
  if (!user || user.role !== 'admin') return null;

  return (
    <div className="p-4 sm:p-12 max-w-7xl mx-auto space-y-6 sm:space-y-12 animate-in fade-in duration-500 pb-32 overflow-visible w-full px-2 sm:px-4">
      <div className="pb-10 border-b-8 border-rose-50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div>
           <h1 className="text-2xl sm:text-4xl md:text-5xl font-black text-rose-600 tracking-tighter flex items-center gap-4 py-2 leading-tight">
              <div className="bg-rose-50 p-3 sm:p-4 rounded-[1.25rem] sm:rounded-[1.5rem] shadow-xl shrink-0">
                 <Trash2 className="h-6 w-6 sm:h-10 sm:w-10" />
              </div>
              રિસાયકલ બિન
           </h1>
           <p className="text-muted-foreground font-bold mt-2 uppercase tracking-widest text-xs">ટ્રેશ ફોલ્ડર: ડિલીટ કરેલા રેકોર્ડ્સનું સંચાલન</p>
        </div>
        <div className="bg-white px-8 py-4 sm:px-10 sm:py-6 rounded-[2rem] border-4 border-rose-100 flex flex-col items-center shadow-xl">
           <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest">કુલ ટ્રેશ</span>
           <span className="text-4xl sm:text-6xl font-black text-rose-600 font-mono tracking-tighter">{trashStudents?.length || 0}</span>
        </div>
      </div>

      <Card className="shadow-2xl border-none rounded-[1.5rem] sm:rounded-[3.5rem] overflow-hidden bg-white border-2 sm:border-8 border-rose-50 relative w-full">
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-rose-50/50">
              <TableRow>
                <TableHead className="w-16 p-8">
                  <Checkbox 
                    checked={!!(trashStudents && trashStudents.length > 0 && selectedIds.size === trashStudents.length)}
                    onCheckedChange={toggleSelectAll}
                    className="h-8 w-8 border-2 border-rose-500 data-[state=checked]:bg-rose-500"
                  />
                </TableHead>
                <TableHead className="p-8 font-black text-rose-700 uppercase text-sm">વિદ્યાર્થી</TableHead>
                <TableHead className="font-black text-rose-700 text-center uppercase text-sm">ડિલીટ કરેલ તારીખ</TableHead>
                <TableHead className="text-right p-8 font-black text-rose-700 uppercase text-sm">એક્શન</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}><TableCell colSpan={4} className="p-8"><Skeleton className="h-20 w-full" /></TableCell></TableRow>
                ))
              ) : trashStudents && trashStudents.length > 0 ? (
                trashStudents.map(student => (
                  <TableRow key={student.id} className={cn("hover:bg-rose-50/20 transition-all border-b-2 group", selectedIds.has(student.id) && "bg-rose-50/30")}>
                    <TableCell className="p-8">
                      <Checkbox 
                        checked={selectedIds.has(student.id)}
                        onCheckedChange={() => toggleSelect(student.id)}
                        className="h-8 w-8 border-2 border-rose-500 data-[state=checked]:bg-rose-500"
                      />
                    </TableCell>
                    <TableCell className="p-8">
                       <div className="flex flex-col min-w-0">
                          <span className="font-black text-2xl uppercase text-slate-900 tracking-tighter truncate">{student.name}</span>
                          <span className="text-sm font-bold text-slate-400 flex items-center gap-2 mt-1">
                             <MapPin className="h-4 w-4" /> {student.villageName} • {student.standard}
                          </span>
                       </div>
                    </TableCell>
                    <TableCell className="text-center font-bold text-slate-500 text-lg">
                       {student.deletedAt ? format(new Date(student.deletedAt), 'dd-MM-yyyy HH:mm') : '-'}
                    </TableCell>
                    <TableCell className="p-8 text-right">
                       <div className="flex justify-end gap-4">
                          <Button 
                            onClick={() => handleRestore(student.id, student.name)} 
                            disabled={isProcessing === student.id}
                            variant="outline" 
                            className="h-14 px-8 rounded-xl border-4 font-black gap-2 hover:bg-green-50 hover:text-green-700 border-green-100 hover:border-green-200 transition-all shadow-sm text-lg"
                          >
                             {isProcessing === student.id ? <Loader2 className="h-5 w-5 animate-spin" /> : <RefreshCw className="h-5 w-5" />}
                             રીસ્ટોર
                          </Button>
                          
                          <Button 
                            disabled={isProcessing === student.id} 
                            onClick={() => setStudentToDelete(student)}
                            variant="ghost" 
                            className="h-14 w-14 rounded-xl text-rose-500 hover:bg-rose-50 border-2 border-transparent hover:border-rose-100 shadow-sm flex items-center justify-center"
                          >
                             <Trash2 className="h-7 w-7" />
                          </Button>
                       </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={4} className="p-40 sm:p-60 text-center font-black italic text-slate-200 text-3xl sm:text-5xl uppercase tracking-widest">ટ્રેશ ફોલ્ડર ખાલી છે.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Floating Action Bar for Bulk Selection */}
      {selectedIds.size > 0 && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[200] w-[90vw] max-w-2xl animate-in fade-in slide-in-from-top-10 duration-500">
          <div className="bg-slate-900/95 backdrop-blur-md text-white px-10 py-6 rounded-[2.5rem] shadow-2xl border-4 border-white/10 flex flex-col sm:flex-row items-center justify-between gap-8">
            <div className="flex items-center gap-6">
              <div className="h-14 w-14 rounded-2xl bg-white/20 flex items-center justify-center">
                <CheckSquare className="h-8 w-8" />
              </div>
              <div>
                <p className="text-3xl font-black tracking-tighter">{selectedIds.size} પસંદ</p>
                <p className="text-[10px] font-black uppercase text-white/60 tracking-widest">બલ્ક એક્શન એક્ટિવ</p>
              </div>
            </div>
            
            <div className="flex gap-4 w-full sm:w-auto">
              <Button 
                variant="outline" 
                onClick={handleBulkRestore}
                disabled={isBulkProcessing}
                className="h-16 px-8 rounded-xl font-black bg-white/10 border-2 border-white/20 text-white hover:bg-white/20 flex-1 sm:flex-none text-lg gap-2"
              >
                {isBulkProcessing ? <Loader2 className="h-6 w-6 animate-spin" /> : <RefreshCcw className="h-6 w-6" />}
                રીસ્ટોર
              </Button>
              
              <Button 
                onClick={() => setShowBulkDeleteConfirm(true)}
                disabled={isBulkProcessing} 
                className="h-16 px-8 rounded-xl font-black bg-rose-600 hover:bg-rose-700 text-white shadow-2xl flex-1 sm:flex-none text-lg gap-2 flex items-center justify-center"
              >
                {isBulkProcessing ? <Loader2 className="h-6 w-6 animate-spin" /> : <Trash2 className="h-6 w-6" />}
                કાયમી ડિલીટ
              </Button>
            </div>
          </div>
        </div>
      )}

      {studentToDelete && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setStudentToDelete(null)} />
          <div className="relative bg-white rounded-[2rem] shadow-2xl border border-slate-100 max-w-xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200 z-10 flex flex-col p-8 sm:p-10 border-t-8 border-rose-600">
            <div className="text-2xl font-black text-rose-600 uppercase tracking-tighter mb-4 flex items-center gap-2">
              <ShieldAlert className="h-8 w-8" /> કાયમ માટે ડિલીટ?
            </div>
            <p className="text-lg font-bold text-slate-800 leading-relaxed mb-8">
              શું તમે ખરેખર <span className="text-rose-600 uppercase">"{studentToDelete.name}"</span> નો રેકોર્ડ કાયમ માટે કાઢી નાખવા માંગો છો? આ ડેટા ફરી ક્યારેય પાછો નહીં મળે.
            </p>
            <div className="flex gap-4">
              <Button variant="outline" onClick={() => setStudentToDelete(null)} className="h-14 rounded-xl font-black flex-1 border-2">રદ કરો</Button>
              <Button 
                onClick={async () => {
                  const id = studentToDelete.id;
                  setStudentToDelete(null);
                  await handlePermanentDelete(id);
                }} 
                className="h-14 rounded-xl font-black bg-rose-600 hover:bg-rose-700 text-white flex-1 flex items-center justify-center shadow-lg"
              >
                હા, કાયમી ડિલીટ
              </Button>
            </div>
          </div>
        </div>
      )}

      {showBulkDeleteConfirm && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowBulkDeleteConfirm(false)} />
          <div className="relative bg-white rounded-[2rem] shadow-2xl border border-slate-100 max-w-xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200 z-10 flex flex-col p-8 sm:p-10 border-t-8 border-rose-600">
            <div className="text-2xl font-black text-rose-600 uppercase tracking-tighter mb-4 flex items-center gap-2">
              <ShieldAlert className="h-8 w-8" /> બલ્ક કાયમી ડિલીટ
            </div>
            <p className="text-lg font-bold text-slate-800 leading-relaxed mb-8">
              શું તમે ખરેખર પસંદ કરેલા <span className="text-rose-600 font-black text-xl px-2">{selectedIds.size}</span> વિદ્યાર્થીઓને કાયમ માટે ડિલીટ કરવા માંગો છો? આ પ્રક્રિયા પાછી નહીં ખેંચી શકાય.
            </p>
            <div className="flex gap-4">
              <Button variant="outline" onClick={() => setShowBulkDeleteConfirm(false)} className="h-14 rounded-xl font-black flex-1 border-2">રદ કરો</Button>
              <Button 
                onClick={async () => {
                  setShowBulkDeleteConfirm(false);
                  await handleBulkPermanentDelete();
                }} 
                className="h-14 rounded-xl font-black bg-rose-600 hover:bg-rose-700 text-white flex-1 flex items-center justify-center shadow-lg"
              >
                હા, કાયમી ડિલીટ કરો
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

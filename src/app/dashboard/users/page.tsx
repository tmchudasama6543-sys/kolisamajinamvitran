'use client';

import { useState, useEffect } from 'react';
import { useFirestore, useCollection, useMemoFirebase, useUser, updateDocumentNonBlocking } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, ShieldCheck, Lock, Unlock, UserCheck, UserX, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
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
import CreateUserModal from '@/components/CreateUserModal';
import { PlusCircle } from 'lucide-react';

type UserProfile = {
  id: string;
  email: string;
  role: 'admin' | 'data_entry';
  accessApproved?: boolean;
};

export default function UsersPage() {
  const { user: adminUser, loading: adminLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  useEffect(() => {
    if (!adminLoading && adminUser?.role !== 'admin') {
      router.replace('/dashboard');
    }
  }, [adminUser, adminLoading, router]);

  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [userToApprove, setUserToApprove] = useState<UserProfile | null>(null);
  const [userToRevoke, setUserToRevoke] = useState<UserProfile | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const usersQuery = useMemoFirebase(() => collection(firestore, 'users'), [firestore]);
  const { data: users, isLoading: usersLoading } = useCollection<UserProfile>(usersQuery);

  const handleUpdateAccess = async (userId: string, status: boolean) => {
    setIsProcessing(userId);
    try {
      await updateDocumentNonBlocking(doc(firestore, 'users', userId), { accessApproved: status });
      toast({ title: status ? "મંજૂરી આપી દીધી!" : "એક્સેસ રદ કર્યો!", variant: status ? "default" : "destructive" });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'ભૂલ', description: e.message });
    } finally {
      setIsProcessing(null);
    }
  };

  if (adminLoading || !adminUser) return <div className="p-10"><Skeleton className="h-[70vh] w-full rounded-3xl" /></div>;
  if (adminUser.role !== 'admin') return null;

  const dataEntryUsers = users?.filter(u => u.role === 'data_entry') || [];
  const pending = dataEntryUsers.filter(u => !u.accessApproved);
  const approved = dataEntryUsers.filter(u => u.accessApproved);

  const UserRow = ({ user }: { user: UserProfile }) => (
    <TableRow key={user.id} className="hover:bg-slate-50 border-b last:border-none transition-all">
      <TableCell className="p-6">
        <div className="flex flex-col"><span className="font-black text-xl text-slate-800 tracking-tight">{user.email}</span><Badge variant="outline" className="w-fit text-[8px] font-black uppercase tracking-widest bg-slate-100 border-none mt-1">DATA ENTRY</Badge></div>
      </TableCell>
      <TableCell>
        {user.accessApproved ? (
          <Badge className="bg-[#D1FAE5] text-[#059669] hover:bg-[#D1FAE5] border-none px-4 py-1 font-black text-[10px] uppercase flex items-center gap-2 w-fit"><Unlock className="h-3 w-3" /> ACTIVE</Badge>
        ) : (
          <Badge className="bg-rose-50 text-rose-600 hover:bg-rose-50 border-none px-4 py-1 font-black text-[10px] uppercase flex items-center gap-2 w-fit"><Lock className="h-3 w-3" /> LOCKED</Badge>
        )}
      </TableCell>
      <TableCell className="p-6 text-right">
        <div className="flex justify-end gap-3">
          {!user.accessApproved ? (
            <Button onClick={() => setUserToApprove(user)} disabled={isProcessing === user.id} className="h-12 px-6 rounded-xl font-black bg-[#059669] shadow-md hover:scale-105 transition-all text-xs">{isProcessing === user.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4 mr-2" />} Approve</Button>
          ) : (
            <Button onClick={() => setUserToRevoke(user)} variant="outline" disabled={isProcessing === user.id} className="h-12 px-6 rounded-xl font-black text-rose-600 border-2 hover:bg-rose-50 transition-all text-xs">{isProcessing === user.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserX className="h-4 w-4 mr-2" />} Revoke</Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );

  return (
    <div className="p-4 sm:p-10 max-w-7xl mx-auto space-y-6 sm:space-y-12 animate-in fade-in duration-500 overflow-visible w-full px-2 sm:px-4">
      <div className="pb-8 border-b-4 border-[#F0FDFA] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-4xl md:text-5xl font-black text-[#0D9488] tracking-tighter flex items-center gap-3 py-2 leading-tight">
            <ShieldCheck className="h-8 w-8 sm:h-10 sm:w-10 shrink-0" /> યુઝર કંટ્રોલ સેન્ટર
          </h1>
          <p className="text-slate-400 font-bold mt-2 uppercase text-xs tracking-widest">એડમિન કંટ્રોલ: ઓપરેટર મંજૂરી અને સિક્યોરિટી</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)} className="h-12 px-6 rounded-2xl font-black shadow-lg hover:scale-105 transition-all text-sm gap-2">
          <PlusCircle className="h-5 w-5" /> નવું એકાઉન્ટ બનાવો
        </Button>
      </div>

      <section className="space-y-6">
        <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-2 px-2"><Users className="h-5 w-5 text-slate-400" /> પેન્ડિંગ મંજૂરી (Waiting)</h2>
        <Card className="shadow-2xl border-none rounded-[1.5rem] sm:rounded-[2.5rem] overflow-hidden bg-white border-l-8 border-amber-400">
          <CardContent className="p-0 overflow-x-auto"><Table><TableHeader className="bg-slate-50"><TableRow><TableHead className="p-6 font-black text-[#0D9488]">પ્રોફાઇલ</TableHead><TableHead className="font-black text-[#0D9488]">સ્ટેટસ</TableHead><TableHead className="text-right p-6 font-black text-[#0D9488]">એક્શન</TableHead></TableRow></TableHeader>
          <TableBody>{usersLoading ? <TableRow><TableCell colSpan={3} className="p-10"><Skeleton className="h-12 w-full" /></TableCell></TableRow> : pending.length > 0 ? pending.map(u => <UserRow key={u.id} user={u} />) : <TableRow><TableCell colSpan={3} className="p-20 text-center font-black italic text-slate-300">કોઈ નવી રજીસ્ટ્રેશન નથી.</TableCell></TableRow>}</TableBody></Table></CardContent>
        </Card>
      </section>

      <section className="space-y-6">
        <h2 className="text-xl font-black text-[#059669] uppercase tracking-tight flex items-center gap-2 px-2"><UserCheck className="h-5 w-5" /> મંજૂર થયેલ ઓપરેટર્સ (Active)</h2>
        <Card className="shadow-2xl border-none rounded-[1.5rem] sm:rounded-[2.5rem] overflow-hidden bg-white border-l-8 border-[#059669]">
          <CardContent className="p-0 overflow-x-auto"><Table><TableHeader className="bg-[#F0FDFA]"><TableRow><TableHead className="p-6 font-black text-[#059669]">પ્રોફાઇલ</TableHead><TableHead className="font-black text-[#059669]">સ્ટેટસ</TableHead><TableHead className="text-right p-6 font-black text-[#059669]">એક્શન</TableHead></TableRow></TableHeader>
          <TableBody>{usersLoading ? <TableRow><TableCell colSpan={3} className="p-10"><Skeleton className="h-12 w-full" /></TableCell></TableRow> : approved.length > 0 ? approved.map(u => <UserRow key={u.id} user={u} />) : <TableRow><TableCell colSpan={3} className="p-20 text-center font-black italic text-slate-300">હજુ સુધી કોઈ મંજૂરી આપી નથી.</TableCell></TableRow>}</TableBody></Table></CardContent>
        </Card>
      </section>

      {userToApprove && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setUserToApprove(null)} />
          <div className="relative bg-white rounded-[2rem] shadow-2xl border border-slate-100 max-w-xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200 z-10 flex flex-col p-8 sm:p-10 border-t-8 border-[#059669]">
            <div className="text-2xl font-black text-[#059669] uppercase tracking-tighter mb-4 flex items-center gap-2">
              <UserCheck className="h-6 w-6" /> એક્સેસ મંજૂરી
            </div>
            <p className="text-lg font-bold text-slate-800 leading-relaxed mb-8">
              શું તમે ખરેખર "{userToApprove.email}" ને એક્સેસ આપવા માંગો છો?
            </p>
            <div className="flex gap-4">
              <Button variant="outline" onClick={() => setUserToApprove(null)} className="h-14 rounded-xl font-black flex-1 border-2">રદ કરો</Button>
              <Button 
                onClick={async () => {
                  const uid = userToApprove.id;
                  setUserToApprove(null);
                  await handleUpdateAccess(uid, true);
                }} 
                className="h-14 rounded-xl font-black bg-[#059669] text-white flex-1 flex items-center justify-center shadow-lg"
              >
                હા, મંજૂર કરો
              </Button>
            </div>
          </div>
        </div>
      )}

      {userToRevoke && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setUserToRevoke(null)} />
          <div className="relative bg-white rounded-[2rem] shadow-2xl border border-slate-100 max-w-xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200 z-10 flex flex-col p-8 sm:p-10 border-t-8 border-rose-600">
            <div className="text-2xl font-black text-rose-600 uppercase tracking-tighter mb-4 flex items-center gap-2">
              <UserX className="h-6 w-6" /> એક્સેસ રદ
            </div>
            <p className="text-lg font-bold text-slate-800 leading-relaxed mb-8">
              શું તમે ખરેખર "{userToRevoke.email}" નો એક્સેસ રદ કરવા માંગો છો?
            </p>
            <div className="flex gap-4">
              <Button variant="outline" onClick={() => setUserToRevoke(null)} className="h-14 rounded-xl font-black flex-1 border-2">રદ કરો</Button>
              <Button 
                onClick={async () => {
                  const uid = userToRevoke.id;
                  setUserToRevoke(null);
                  await handleUpdateAccess(uid, false);
                }} 
                className="h-14 rounded-xl font-black bg-rose-600 text-white flex-1 flex items-center justify-center shadow-lg"
              >
                હા, એક્સેસ હટાવો
              </Button>
            </div>
          </div>
        </div>
      )}

      {showCreateModal && <CreateUserModal onClose={() => setShowCreateModal(false)} adminEmail={adminUser?.email || ''} />}
    </div>
  );
}

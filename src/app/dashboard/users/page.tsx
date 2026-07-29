'use client';

import { useState, useEffect } from 'react';
import { useFirestore, useCollection, useMemoFirebase, useUser, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { collection, doc, deleteDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, ShieldCheck, Lock, Unlock, UserCheck, UserX, Users, UserCircle, PlusCircle, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import CreateUserModal from '@/components/CreateUserModal';

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
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
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

  const handleDeleteUser = async (user: UserProfile) => {
    setIsProcessing(user.id);
    try {
      // Delete from 'users' collection
      await deleteDoc(doc(firestore, 'users', user.id));
      // Delete from 'roles_admin' collection if exists
      if (user.role === 'admin') {
        await deleteDoc(doc(firestore, 'roles_admin', user.id)).catch(() => {});
      }
      toast({ title: "સફળતા", description: `"${user.email}" નો રેકોર્ડ ડેટાબેઝમાંથી સફળતાપૂર્વક ડીલીટ કરી દીધો છે.` });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'ડીલીટ કરવામાં ભૂલ', description: e.message });
    } finally {
      setIsProcessing(null);
    }
  };

  if (adminLoading || !adminUser) return <div className="p-10"><Skeleton className="h-[70vh] w-full rounded-3xl" /></div>;
  if (adminUser.role !== 'admin') return null;

  // Categorize users strictly:
  // 1. Pending or Revoked (accessApproved is false or undefined)
  const pendingOrRevoked = users?.filter(u => u.accessApproved === false || u.accessApproved === undefined) || [];
  
  // 2. Active Admins (role === 'admin' AND accessApproved === true)
  const activeAdmins = users?.filter(u => u.role === 'admin' && u.accessApproved === true) || [];
  
  // 3. Active Operators (role === 'data_entry' AND accessApproved === true)
  const activeOperators = users?.filter(u => u.role === 'data_entry' && u.accessApproved === true) || [];

  const UserRow = ({ user }: { user: UserProfile }) => {
    const isMasterAdmin = user.email.toLowerCase() === 'jayhind6543@gmail.com';
    const isApproved = user.accessApproved === true;

    return (
      <TableRow key={user.id} className="hover:bg-slate-50 border-b last:border-none transition-all">
        <TableCell className="p-6">
          <div className="flex flex-col">
            <span className="font-black text-xl text-slate-800 tracking-tight">{user.email}</span>
            {user.role === 'admin' ? (
              <Badge variant="outline" className="w-fit text-[8px] font-black uppercase tracking-widest bg-indigo-50 text-indigo-600 border-none mt-1">ADMINISTRATOR</Badge>
            ) : (
              <Badge variant="outline" className="w-fit text-[8px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-600 border-none mt-1">DATA ENTRY</Badge>
            )}
          </div>
        </TableCell>
        <TableCell>
          {isApproved ? (
            <Badge className="bg-[#D1FAE5] text-[#059669] hover:bg-[#D1FAE5] border-none px-4 py-1 font-black text-[10px] uppercase flex items-center gap-2 w-fit"><Unlock className="h-3 w-3" /> ACTIVE</Badge>
          ) : (
            <Badge className="bg-rose-50 text-rose-600 hover:bg-rose-50 border-none px-4 py-1 font-black text-[10px] uppercase flex items-center gap-2 w-fit"><Lock className="h-3 w-3" /> LOCKED / REVOKED</Badge>
          )}
        </TableCell>
        <TableCell className="p-6 text-right">
          <div className="flex justify-end gap-2 sm:gap-3">
            {!isApproved ? (
              <Button 
                onClick={() => setUserToApprove(user)} 
                disabled={isProcessing === user.id} 
                className="h-11 px-4 sm:px-6 rounded-xl font-black bg-[#059669] shadow-md hover:scale-105 transition-all text-xs"
              >
                {isProcessing === user.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4 mr-1.5" />} Approve
              </Button>
            ) : (
              !isMasterAdmin && (
                <Button 
                  onClick={() => setUserToRevoke(user)} 
                  variant="outline" 
                  disabled={isProcessing === user.id} 
                  className="h-11 px-4 sm:px-6 rounded-xl font-black text-amber-600 border-2 border-amber-200 hover:bg-amber-50 transition-all text-xs"
                >
                  {isProcessing === user.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserX className="h-4 w-4 mr-1.5" />} Revoke
                </Button>
              )
            )}

            {!isMasterAdmin && (
              <Button 
                onClick={() => setUserToDelete(user)} 
                variant="outline"
                disabled={isProcessing === user.id} 
                className="h-11 px-3 sm:px-4 rounded-xl font-black text-rose-600 border-2 border-rose-200 hover:bg-rose-50 transition-all text-xs"
                title="ડેટાબેઝમાંથી ડીલીટ કરો"
              >
                <Trash2 className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">ડીલીટ</span>
              </Button>
            )}
          </div>
        </TableCell>
      </TableRow>
    );
  };

  return (
    <div className="p-4 sm:p-10 max-w-7xl mx-auto space-y-6 sm:space-y-12 animate-in fade-in duration-500 overflow-visible w-full px-2 sm:px-4">
      <div className="pb-8 border-b-4 border-[#F0FDFA] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-4xl md:text-5xl font-black text-[#0D9488] tracking-tighter flex items-center gap-3 py-2 leading-tight">
            <ShieldCheck className="h-8 w-8 sm:h-10 sm:w-10 shrink-0" /> યુઝર કંટ્રોલ સેન્ટર
          </h1>
          <p className="text-slate-400 font-bold mt-2 uppercase text-xs tracking-widest">એડમિન અને ઓપરેટર એકાઉન્ટ મંજૂરી તથા સિક્યોરિટી</p>
        </div>
        {adminUser?.email?.toLowerCase() === 'jayhind6543@gmail.com' && (
          <Button onClick={() => setShowCreateModal(true)} className="h-12 px-6 rounded-2xl font-black shadow-lg bg-[#4F46E5] hover:bg-[#4338CA] text-white hover:scale-105 transition-all text-sm gap-2">
            <PlusCircle className="h-5 w-5" /> નવું એડમિન બનાવો
          </Button>
        )}
      </div>

      {/* Section 1: Pending & Revoked Accounts */}
      <section className="space-y-6">
        <h2 className="text-xl font-black text-rose-600 uppercase tracking-tight flex items-center gap-2 px-2">
          <Lock className="h-5 w-5 text-rose-600" /> પેન્ડિંગ અને રદ કરેલ એકાઉન્ટ્સ (Waiting & Revoked)
        </h2>
        <Card className="shadow-2xl border-none rounded-[1.5rem] sm:rounded-[2.5rem] overflow-hidden bg-white border-l-8 border-rose-500">
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader className="bg-rose-50/50">
                <TableRow>
                  <TableHead className="p-6 font-black text-rose-700">પ્રોફાઇલ</TableHead>
                  <TableHead className="font-black text-rose-700">સ્ટેટસ</TableHead>
                  <TableHead className="text-right p-6 font-black text-rose-700">એક્શન</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usersLoading ? (
                  <TableRow><TableCell colSpan={3} className="p-10"><Skeleton className="h-12 w-full" /></TableCell></TableRow>
                ) : pendingOrRevoked.length > 0 ? (
                  pendingOrRevoked.map(u => <UserRow key={u.id} user={u} />)
                ) : (
                  <TableRow><TableCell colSpan={3} className="p-16 text-center font-black italic text-slate-300">કોઈ પેન્ડિંગ કે રદ કરેલું એકાઉન્ટ નથી.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>

      {/* Section 2: Active Administrators */}
      <section className="space-y-6">
        <h2 className="text-xl font-black text-[#4F46E5] uppercase tracking-tight flex items-center gap-2 px-2">
          <ShieldCheck className="h-5 w-5 text-[#4F46E5]" /> સક્રિય એડમિનિસ્ટ્રેટર્સ (Active Admins)
        </h2>
        <Card className="shadow-2xl border-none rounded-[1.5rem] sm:rounded-[2.5rem] overflow-hidden bg-white border-l-8 border-[#4F46E5]">
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader className="bg-indigo-50">
                <TableRow>
                  <TableHead className="p-6 font-black text-[#4F46E5]">પ્રોફાઇલ</TableHead>
                  <TableHead className="font-black text-[#4F46E5]">સ્ટેટસ</TableHead>
                  <TableHead className="text-right p-6 font-black text-[#4F46E5]">એક્શન</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usersLoading ? (
                  <TableRow><TableCell colSpan={3} className="p-10"><Skeleton className="h-12 w-full" /></TableCell></TableRow>
                ) : activeAdmins.length > 0 ? (
                  activeAdmins.map(u => <UserRow key={u.id} user={u} />)
                ) : (
                  <TableRow><TableCell colSpan={3} className="p-16 text-center font-black italic text-slate-300">કોઈ સક્રિય એડમિન નથી.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>

      {/* Section 3: Active Data Entry Operators */}
      <section className="space-y-6">
        <h2 className="text-xl font-black text-[#059669] uppercase tracking-tight flex items-center gap-2 px-2">
          <UserCircle className="h-5 w-5 text-[#059669]" /> સક્રિય ઓપરેટર્સ (Active Operators)
        </h2>
        <Card className="shadow-2xl border-none rounded-[1.5rem] sm:rounded-[2.5rem] overflow-hidden bg-white border-l-8 border-[#059669]">
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader className="bg-[#F0FDFA]">
                <TableRow>
                  <TableHead className="p-6 font-black text-[#059669]">પ્રોફાઇલ</TableHead>
                  <TableHead className="font-black text-[#059669]">સ્ટેટસ</TableHead>
                  <TableHead className="text-right p-6 font-black text-[#059669]">એક્શન</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usersLoading ? (
                  <TableRow><TableCell colSpan={3} className="p-10"><Skeleton className="h-12 w-full" /></TableCell></TableRow>
                ) : activeOperators.length > 0 ? (
                  activeOperators.map(u => <UserRow key={u.id} user={u} />)
                ) : (
                  <TableRow><TableCell colSpan={3} className="p-16 text-center font-black italic text-slate-300">કોઈ સક્રિય ઓપરેટર નથી.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>

      {/* Approve Confirmation Modal */}
      {userToApprove && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setUserToApprove(null)} />
          <div className="relative bg-white rounded-[2rem] shadow-2xl border border-slate-100 max-w-xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200 z-10 flex flex-col p-8 sm:p-10 border-t-8 border-[#059669]">
            <div className="text-2xl font-black text-[#059669] uppercase tracking-tighter mb-4 flex items-center gap-2">
              <UserCheck className="h-6 w-6" /> એક્સેસ મંજૂરી (Approve)
            </div>
            <p className="text-lg font-bold text-slate-800 leading-relaxed mb-8">
              શું તમે ખરેખર "{userToApprove.email}" ને ફરીથી એક્સેસ આપવા માંગો છો?
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

      {/* Revoke Confirmation Modal */}
      {userToRevoke && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setUserToRevoke(null)} />
          <div className="relative bg-white rounded-[2rem] shadow-2xl border border-slate-100 max-w-xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200 z-10 flex flex-col p-8 sm:p-10 border-t-8 border-amber-500">
            <div className="text-2xl font-black text-amber-600 uppercase tracking-tighter mb-4 flex items-center gap-2">
              <UserX className="h-6 w-6" /> એક્સેસ રદ (Revoke)
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
                className="h-14 rounded-xl font-black bg-amber-500 text-white flex-1 flex items-center justify-center shadow-lg"
              >
                હા, એક્સેસ હટાવો
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {userToDelete && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setUserToDelete(null)} />
          <div className="relative bg-white rounded-[2rem] shadow-2xl border border-slate-100 max-w-xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200 z-10 flex flex-col p-8 sm:p-10 border-t-8 border-rose-600">
            <div className="text-2xl font-black text-rose-600 uppercase tracking-tighter mb-4 flex items-center gap-2">
              <Trash2 className="h-6 w-6" /> એકાઉન્ટ કાયમી ડીલીટ (Delete)
            </div>
            <p className="text-lg font-bold text-slate-800 leading-relaxed mb-8">
              શું તમે ખરેખર "{userToDelete.email}" નો રેકોર્ડ ડેટાબેઝમાંથી કાયમ માટે ડીલીટ કરવા માંગો છો?
            </p>
            <div className="flex gap-4">
              <Button variant="outline" onClick={() => setUserToDelete(null)} className="h-14 rounded-xl font-black flex-1 border-2">રદ કરો</Button>
              <Button 
                onClick={async () => {
                  const u = userToDelete;
                  setUserToDelete(null);
                  await handleDeleteUser(u);
                }} 
                className="h-14 rounded-xl font-black bg-rose-600 text-white flex-1 flex items-center justify-center shadow-lg"
              >
                હા, કાયમી ડીલીટ કરો
              </Button>
            </div>
          </div>
        </div>
      )}

      {showCreateModal && <CreateUserModal onClose={() => setShowCreateModal(false)} adminEmail={adminUser?.email || ''} />}
    </div>
  );
}

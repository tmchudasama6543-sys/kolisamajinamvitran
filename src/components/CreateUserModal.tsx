'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ShieldCheck, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { doc, setDoc } from 'firebase/firestore';
import { firebaseConfig } from '@/firebase/config';
import { useFirestore } from '@/firebase';

export default function CreateUserModal({ onClose, adminEmail }: { onClose: () => void, adminEmail: string }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const firestore = useFirestore();

  const handleCreate = async () => {
    if (!email || password.length < 6) {
      toast({ variant: 'destructive', title: 'ભૂલ', description: 'કૃપા કરીને માન્ય ઈમેલ અને ઓછામાં ઓછો 6 અક્ષરનો પાસવર્ડ દાખલ કરો.' });
      return;
    }
    
    setLoading(true);
    const cleanEmail = email.trim().toLowerCase();
    
    try {
      const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${firebaseConfig.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, password, returnSecureToken: true })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(`API Error: ${data.error?.message || 'Unknown Identity Toolkit Error'}`);
      }
      
      const newUserId = data.localId;
      
      // 1. Add user to 'users' collection as approved admin
      await setDoc(doc(firestore, 'users', newUserId), {
        email: cleanEmail,
        role: 'admin',
        dataEntryCenterId: null,
        accessApproved: true
      });
      
      // 2. Add user to 'roles_admin' collection
      await setDoc(doc(firestore, 'roles_admin', newUserId), {
        email: cleanEmail,
        createdAt: new Date().toISOString()
      });
      
      toast({ title: 'સફળતા', description: `નવું એડમિન એકાઉન્ટ (${cleanEmail}) સફળતાપૂર્વક બની ગયું છે!` });
      onClose();
    } catch (error: any) {
      let errorMsg = error.message;
      if (errorMsg.includes('EMAIL_EXISTS')) errorMsg = 'આ ઈમેલથી પહેલેથી જ એકાઉન્ટ બનેલું છે.';
      if (errorMsg.includes('WEAK_PASSWORD')) errorMsg = 'પાસવર્ડ ઓછામાં ઓછો 6 અક્ષરનો હોવો જોઈએ.';
      if (errorMsg.includes('PERMISSION_DENIED')) errorMsg = 'Firebase Rules અપડેટ નથી થયા. કૃપા કરીને Rules ચેક કરો.';
      toast({ variant: 'destructive', title: 'એકાઉન્ટ બનાવવામાં ભૂલ', description: errorMsg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 z-[1001] flex flex-col">
        <div className="flex items-center justify-between p-6 pb-4 border-b">
          <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-[#4F46E5]" /> નવું એડમિન એકાઉન્ટ બનાવો
          </h2>
          <button onClick={onClose} className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors">
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>
        
        <form onSubmit={(e) => { e.preventDefault(); handleCreate(); }} className="p-6 space-y-5">
          <div className="space-y-2">
            <Label className="font-bold text-xs uppercase tracking-wider text-slate-500">નવું એડમિન ઈમેલ</Label>
            <Input 
              type="email" 
              placeholder="admin@email.com" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              className="h-12 rounded-xl focus-visible:ring-[#4F46E5]"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label className="font-bold text-xs uppercase tracking-wider text-slate-500">પાસવર્ડ</Label>
            <Input 
              type="text" 
              placeholder="ઓછામાં ઓછા 6 અક્ષર" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              className="h-12 rounded-xl focus-visible:ring-[#4F46E5]"
              required
            />
          </div>
          
          <Button 
            type="submit"
            disabled={loading} 
            className="w-full h-14 mt-4 rounded-xl font-black text-lg shadow-lg bg-[#4F46E5] hover:bg-[#4338CA] text-white transition-all"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : 'એડમિન એકાઉન્ટ બનાવો'}
          </Button>
        </form>
      </div>
    </div>
  );
}

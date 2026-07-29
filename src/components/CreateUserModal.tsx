'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ShieldCheck, X, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { doc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { firebaseConfig } from '@/firebase/config';
import { useFirestore } from '@/firebase';

export default function CreateUserModal({ onClose, adminEmail }: { onClose: () => void, adminEmail: string }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [inlineSuccess, setInlineSuccess] = useState<string | null>(null);
  const firestore = useFirestore();

  const handleCreate = async () => {
    setInlineError(null);
    setInlineSuccess(null);

    if (!email || password.length < 6) {
      setInlineError('કૃપા કરીને માન્ય ઈમેલ અને ઓછામાં ઓછો 6 અક્ષરનો પાસવર્ડ દાખલ કરો.');
      return;
    }
    
    setLoading(true);
    const cleanEmail = email.trim().toLowerCase();

    // 0. Pre-check if email already exists in Firestore 'users' collection
    try {
      const usersRef = collection(firestore, 'users');
      const q = query(usersRef, where('email', '==', cleanEmail));
      const querySnap = await getDocs(q);
      if (!querySnap.empty) {
        const existingData = querySnap.docs[0].data();
        if (existingData.role === 'admin' && existingData.accessApproved === true) {
          setInlineError('આ ઈમેલથી પહેલેથી જ સક્રિય એડમિન એકાઉન્ટ હાજર છે!');
          setLoading(false);
          return;
        }
      }
    } catch (e) {
      // Continue
    }
    
    try {
      // 1. Attempt REST API signUp
      const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${firebaseConfig.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, password, returnSecureToken: true })
      });

      const data = await response.json();

      if (response.ok) {
        const newUserId = data.localId;
        
        await setDoc(doc(firestore, 'users', newUserId), {
          email: cleanEmail,
          role: 'admin',
          dataEntryCenterId: null,
          accessApproved: true
        });
        
        await setDoc(doc(firestore, 'roles_admin', newUserId), {
          email: cleanEmail,
          createdAt: new Date().toISOString()
        });
        
        setInlineSuccess(`નવું એડમિન એકાઉન્ટ (${cleanEmail}) સફળતાપૂર્વક બની ગયું છે!`);
        setTimeout(() => onClose(), 1800);
        return;
      }

      // 2. If EMAIL_EXISTS in Firebase Auth, attempt signInWithPassword to get UID & restore Firestore docs
      if (data.error?.message?.includes('EMAIL_EXISTS')) {
        const loginRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${firebaseConfig.apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: cleanEmail, password, returnSecureToken: true })
        });

        const loginData = await loginRes.json();

        if (loginRes.ok) {
          const existingUserId = loginData.localId;

          // Re-create/Update Firestore documents as approved Admin
          await setDoc(doc(firestore, 'users', existingUserId), {
            email: cleanEmail,
            role: 'admin',
            dataEntryCenterId: null,
            accessApproved: true
          });

          await setDoc(doc(firestore, 'roles_admin', existingUserId), {
            email: cleanEmail,
            createdAt: new Date().toISOString()
          });

          setInlineSuccess(`આ ઈમેલ રજીસ્ટર હતો, તેનો એડમિન એક્સેસ સફળતાપૂર્વક સક્રિય (Activated) કરી દીધો છે!`);
          setTimeout(() => onClose(), 1800);
          return;
        } else {
          setInlineError('આ ઈમેલ ફાયરબેઝમાં પહેલેથી હાજર છે! જો આ તમારો ઈમેલ હોય તો સાચો પાસવર્ડ નાખીને સેવ કરો.');
          return;
        }
      }

      throw new Error(data.error?.message || 'Unknown Error');
    } catch (error: any) {
      let errorMsg = error.message;
      if (errorMsg.includes('WEAK_PASSWORD')) {
        errorMsg = 'પાસવર્ડ ઓછામાં ઓછો 6 અક્ષરનો હોવો જોઈએ.';
      } else if (errorMsg.includes('PERMISSION_DENIED')) {
        errorMsg = 'Firebase Rules ના લીધે એક્સેસ મંજૂર નથી થઈ રહ્યો.';
      } else {
        errorMsg = `ભૂલ આવી: ${errorMsg}`;
      }
      setInlineError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 z-50 flex flex-col">
        <div className="flex items-center justify-between p-6 pb-4 border-b">
          <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-[#4F46E5]" /> નવું એડમિન એકાઉન્ટ બનાવો
          </h2>
          <button onClick={onClose} className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors">
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>
        
        <form onSubmit={(e) => { e.preventDefault(); handleCreate(); }} className="p-6 space-y-5">
          {/* Inline Error Message */}
          {inlineError && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm font-bold flex items-start gap-3 animate-in fade-in duration-200">
              <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
              <span>{inlineError}</span>
            </div>
          )}

          {/* Inline Success Message */}
          {inlineSuccess && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-bold flex items-start gap-3 animate-in fade-in duration-200">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
              <span>{inlineSuccess}</span>
            </div>
          )}

          <div className="space-y-2">
            <Label className="font-bold text-xs uppercase tracking-wider text-slate-500">એડમિન ઈમેલ</Label>
            <Input 
              type="email" 
              placeholder="admin@email.com" 
              value={email} 
              onChange={e => {
                setEmail(e.target.value);
                if (inlineError) setInlineError(null);
              }} 
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
              onChange={e => {
                setPassword(e.target.value);
                if (inlineError) setInlineError(null);
              }} 
              className="h-12 rounded-xl focus-visible:ring-[#4F46E5]"
              required
            />
          </div>
          
          <Button 
            type="submit"
            disabled={loading || !!inlineSuccess} 
            className="w-full h-14 mt-4 rounded-xl font-black text-lg shadow-lg bg-[#4F46E5] hover:bg-[#4338CA] text-white transition-all"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : 'એડમિન એકાઉન્ટ બનાવો / એક્ટિવ કરો'}
          </Button>
        </form>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useAuth } from '@/firebase';
import LoginForm from '@/components/login-form';
import { Loader2 } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';

export default function LoginPage() {
  const { user, loading } = useUser();
  const router = useRouter();
  const auth = useAuth();
  const { toast } = useToast();
  const signingOutRef = useRef(false);

  useEffect(() => {
    if (loading) return;

    if (user) {
      const isMaster = user.email?.toLowerCase() === 'jayhind6543@gmail.com';
      const isRevoked = !isMaster && user.accessApproved === false;

      if (isRevoked) {
        if (!signingOutRef.current) {
          signingOutRef.current = true;
          signOut(auth).then(() => {
            toast({
              variant: 'destructive',
              title: 'એક્સેસ બંધ છે!',
              description: 'તમારું એકાઉન્ટ રદ (Revoke) કરવામાં આવ્યું છે. કૃપા કરીને મુખ્ય એડમિનનો સંપર્ક કરો.',
            });
            signingOutRef.current = false;
          }).catch(() => {
            signingOutRef.current = false;
          });
        }
      } else {
        router.replace('/dashboard');
      }
    }
  }, [user, loading, router, auth]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  // If no user or revoked, show LoginForm
  if (!user || (user.email?.toLowerCase() !== 'jayhind6543@gmail.com' && user.accessApproved === false)) {
    return <LoginForm />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
    </div>
  );
}
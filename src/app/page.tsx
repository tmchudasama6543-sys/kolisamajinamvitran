'use client';

import { useEffect } from 'react';
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

  useEffect(() => {
    if (!loading && user) {
      // If user is revoked, sign them out immediately and show notification
      if (user.email !== 'jayhind6543@gmail.com' && user.accessApproved === false) {
        signOut(auth).then(() => {
          toast({
            variant: 'destructive',
            title: 'એક્સેસ બંધ છે!',
            description: 'તમારું એકાઉન્ટ રદ (Revoke) કરવામાં આવ્યું છે. કૃપા કરીને મુખ્ય એડમિનનો સંપર્ક કરો.',
          });
        });
      } else {
        router.replace('/dashboard');
      }
    }
  }, [user, loading, router, auth, toast]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  // If user is revoked or not logged in, show the login form
  if (!user || user.accessApproved === false) {
    return <LoginForm />;
  }
  
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
    </div>
  );
}
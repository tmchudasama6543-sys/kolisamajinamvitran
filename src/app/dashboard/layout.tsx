'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useAuth } from '@/firebase';
import { AppSidebar } from '@/components/app-sidebar';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Loader2, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { signOut } from 'firebase/auth';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useUser();
  const router = useRouter();
  const auth = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.replace('/');
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/');
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
        <p className="sr-only">Loading...</p>
      </div>
    );
  }

  const isAdmin = user.role === 'admin';

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-slate-50/50">
        <AppSidebar user={user} />
        <SidebarInset className="flex flex-col flex-1 min-w-0 overflow-hidden w-full max-w-full">
          {/* Top Header Bar */}
          <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b bg-white/80 px-6 backdrop-blur-md">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="h-10 w-10 rounded-xl hover:bg-slate-100" />
              <div className="h-4 w-px bg-slate-200" />
              <span className="font-black text-slate-800 tracking-tight text-sm sm:text-base">
                {isAdmin ? 'એડમિન પેનલ (Admin)' : 'સેન્ટર પેનલ (Center)'}
              </span>
            </div>
            
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full max-w-[150px] sm:max-w-[200px] truncate">
                {user.email}
              </span>
            </div>
          </header>

          {/* Main Content Area */}
          <main className="flex-1 overflow-y-auto overflow-x-hidden w-full max-w-full">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

    
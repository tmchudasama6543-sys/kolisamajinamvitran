'use client';

import { useUser } from '@/firebase';
import CenterPanel from '@/components/data-entry-form';
import AdminPanel from '@/components/admin-dashboard';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardPage() {
  const { user, loading } = useUser();

  if (loading || !user) {
    return (
       <div className="p-6 md:p-10 max-w-7xl mx-auto">
        <Card className="rounded-[3rem] border-none shadow-2xl overflow-hidden bg-white">
          <CardHeader className="bg-muted/5 p-8 border-b">
            <Skeleton className="h-12 w-1/2 rounded-2xl" />
            <Skeleton className="mt-4 h-6 w-2/3 rounded-xl" />
          </CardHeader>
          <CardContent className="p-8">
            <div className="space-y-8">
              <Skeleton className="h-64 w-full rounded-[2.5rem]" />
              <Skeleton className="h-16 w-full rounded-2xl" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isAdmin = user.role === 'admin';

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-6">
      <div className="pb-8 border-b-4 border-primary/10">
        <h1 className="text-2xl sm:text-4xl md:text-6xl font-black tracking-tighter bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent animate-gradient-x py-3 leading-tight">
          તળપદા કોળી સમાજ ઇનામ વિતરણ
        </h1>
        <div className="flex items-center gap-2 mt-2">
          <div className="h-0.5 w-12 bg-primary/40 rounded-full" />
          <p className="text-muted-foreground font-black uppercase text-[10px] tracking-[0.2em]">
            {isAdmin ? 'એડમિન કંટ્રોલ પેનલ' : 'ડેટા એન્ટ્રી સેન્ટર પેનલ'}
          </p>
        </div>
      </div>

      <div className="mt-4">
        {isAdmin ? <AdminPanel /> : <CenterPanel />}
      </div>
    </div>
  );
}

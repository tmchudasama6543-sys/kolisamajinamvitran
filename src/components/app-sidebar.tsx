'use client';

import { useState, useEffect } from 'react';

import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
  useSidebar,
} from '@/components/ui/sidebar';
import { GraduationCap, LayoutDashboard, Users, LogOut, UserCog, ShieldCheck, Trash2 } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { signOut } from 'firebase/auth';
import { useAuth } from '@/firebase';
import type { AppUser } from '@/firebase/auth/use-user';
import { Button } from './ui/button';
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

export function AppSidebar({ user }: { user: AppUser }) {
  const pathname = usePathname() || '';
  const router = useRouter();
  const auth = useAuth();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const { isMobile, setOpenMobile } = useSidebar();

  const handleNavigate = (path: string) => {
    router.push(path);
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      if (isMobile) {
        setOpenMobile(false);
      }
      router.push('/');
    } catch (error) {
      console.error(error);
    }
  };

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    router.prefetch('/dashboard');
    if (isAdmin) {
      router.prefetch('/dashboard/students');
      router.prefetch('/dashboard/users');
      router.prefetch('/dashboard/trash');
    }
  }, [isAdmin, router]);

  return (
    <>
      <Sidebar className="border-r border-slate-100 shadow-xl">
        <SidebarHeader className="p-8">
          <div className="flex items-center gap-4">
            <div className={cn("flex h-12 w-12 items-center justify-center rounded-2xl shadow-lg transition-transform hover:rotate-6", isAdmin ? "bg-[#4F46E5]" : "bg-[#10B981]")}>
              <GraduationCap className="h-7 w-7 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-500 tracking-tight leading-none mb-1">ડાયમંડ ગ્રુપ પાલિતાણા દ્વારા આયોજિત</span>
              <span className={cn("text-xl font-black tracking-tighter", isAdmin ? "text-[#4F46E5]" : "text-[#10B981]")}>તળપદા કોળી સમાજ</span>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-0.5 rounded-full w-fit mt-1">ઈનામ વિતરણ</span>
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent className="p-4">
          <SidebarMenu className="gap-3">
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={pathname === '/dashboard'}
                tooltip="ડેશબોર્ડ"
                className={cn("h-12 rounded-xl font-bold transition-all", pathname === '/dashboard' && (isAdmin ? "bg-[#EEF2FF] text-[#4F46E5]" : "bg-[#F0FDFA] text-[#10B981]"))}
              >
                <Link href="/dashboard" replace={true} prefetch={true} onClick={() => isMobile && setOpenMobile(false)}>
                  <LayoutDashboard className="h-5 w-5" />
                  <span>ડેશબોર્ડ</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>

            {isAdmin && (
              <>
                <SidebarSeparator className="my-6 opacity-40" />
                <div className="px-3 mb-3 text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                   <ShieldCheck className="h-3 w-3 text-[#4F46E5]" /> એડમિન મેનૂ
                </div>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname.startsWith('/dashboard/students')}
                    tooltip="વિદ્યાર્થીઓ"
                    className={cn("h-12 rounded-xl font-bold transition-all", pathname.startsWith('/dashboard/students') && "bg-[#EEF2FF] text-[#4F46E5]")}
                  >
                    <Link href="/dashboard/students" replace={true} prefetch={true} onClick={() => isMobile && setOpenMobile(false)}>
                      <Users className="h-5 w-5" />
                      <span>વિદ્યાર્થીઓ</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                {user?.email?.toLowerCase() === 'jayhind6543@gmail.com' && (
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname.startsWith('/dashboard/users')}
                      tooltip="વપરાશકર્તાઓ"
                      className={cn("h-12 rounded-xl font-bold transition-all", pathname.startsWith('/dashboard/users') && "bg-[#F0FDFA] text-[#0D9488]")}
                    >
                      <Link href="/dashboard/users" replace={true} prefetch={true} onClick={() => isMobile && setOpenMobile(false)}>
                        <UserCog className="h-5 w-5" />
                        <span>વપરાશકર્તાઓ</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname.startsWith('/dashboard/trash')}
                    tooltip="ટ્રેશ ફોલ્ડર"
                    className={cn("h-12 rounded-xl font-bold text-rose-500 hover:text-rose-600 hover:bg-rose-50 transition-all", pathname.startsWith('/dashboard/trash') && "bg-rose-50 text-rose-600")}
                  >
                    <Link href="/dashboard/trash" replace={true} prefetch={true} onClick={() => isMobile && setOpenMobile(false)}>
                      <Trash2 className="h-5 w-5" />
                      <span>ટ્રેશ ફોલ્ડર</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </>
            )}
          </SidebarMenu>
        </SidebarContent>
        
        <SidebarFooter className="p-6">
          <Button 
            variant="ghost" 
            onClick={() => setShowLogoutConfirm(true)}
            className="w-full justify-start gap-3 p-4 h-14 rounded-xl font-black text-rose-500 hover:bg-rose-50 hover:text-rose-600 transition-all shadow-sm border border-transparent hover:border-rose-100"
          >
              <LogOut className="h-5 w-5" />
              <span>લૉગ આઉટ</span>
          </Button>

          {/* Standalone Custom Viewport Centered Logout Confirmation Overlay */}
          {showLogoutConfirm && (
            <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowLogoutConfirm(false)} />
              <div className="relative bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200 z-[510] p-8 sm:p-10">
                 <div className="flex items-center gap-3 text-rose-600 mb-4">
                    <LogOut className="h-8 w-8" />
                    <h3 className="text-2xl font-black uppercase tracking-tighter">લૉગ આઉટ?</h3>
                 </div>
                 
                 <p className="text-lg font-bold text-slate-800 leading-relaxed">
                    શું તમે ચોક્કસ લૉગ આઉટ કરવા માંગો છો?
                 </p>
                 
                 <div className="mt-8 flex gap-4">
                    <Button 
                      variant="outline" 
                      onClick={() => setShowLogoutConfirm(false)} 
                      className="flex-1 h-14 rounded-xl font-black border-2 text-lg active:scale-95 transition-all"
                    >
                      રદ કરો
                    </Button>
                    <Button 
                      onClick={handleSignOut} 
                      className="flex-1 h-14 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl shadow-lg text-lg active:scale-95 transition-all"
                    >
                      હા, લૉગ આઉટ
                    </Button>
                 </div>
              </div>
            </div>
          )}
        </SidebarFooter>
      </Sidebar>
    </>
  );
}

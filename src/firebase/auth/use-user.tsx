'use client';

import { useEffect, useState } from 'react';
import { useFirebase } from '@/firebase/provider';
import { doc, onSnapshot, getDocFromServer } from 'firebase/firestore';
import type { User } from 'firebase/auth';

export type AppUser = User & { 
  role?: 'admin' | 'data_entry';
  accessApproved?: boolean;
};

const ADMIN_EMAIL = 'jayhind6543@gmail.com';
const CENTER_EMAIL = 'yuvapalitana123@gmail.com';

export interface UserHookResult {
  user: AppUser | null;
  loading: boolean;
}

let globalAppUser: AppUser | null = null;
let globalUserLoading = true;

/**
 * Expert Real-time User Hook with Cache Bypass & Instant Revoke/Approve Sync.
 */
export function useUser(): UserHookResult {
  const { auth, firestore, isUserLoading } = useFirebase();
  const [appUser, setAppUser] = useState<AppUser | null>(globalAppUser);
  const [loading, setLoading] = useState<boolean>(globalAppUser ? false : globalUserLoading);

  useEffect(() => {
    // If Firebase Auth is still determining initial state, keep loading.
    if (isUserLoading) {
      setLoading(true);
      return;
    }

    const firebaseUser = auth.currentUser;

    if (firebaseUser) {
      const emailLower = firebaseUser.email?.toLowerCase() || '';

      // Reset global cache if user UID changed
      if (globalAppUser && globalAppUser.uid !== firebaseUser.uid) {
        globalAppUser = null;
        setAppUser(null);
        setLoading(true);
      }

      // 1. Immediate check for Super Admin by Email
      if (emailLower === ADMIN_EMAIL) {
        const adminUser: AppUser = { ...firebaseUser, role: 'admin', accessApproved: true };
        globalAppUser = adminUser;
        globalUserLoading = false;
        setAppUser(adminUser);
        setLoading(false);
        return;
      }

      // 1.5. Center Panel users will now correctly fetch from database.

      // 2. Fetch fresh live profile directly from server first (bypassing stale browser cache)
      const userDocRef = doc(firestore, 'users', firebaseUser.uid);

      let isSubscribed = true;

      getDocFromServer(userDocRef)
        .then((serverSnap) => {
          if (!isSubscribed) return;

          let initialRole = 'data_entry';
          let initialApproval = false;

          if (serverSnap.exists()) {
            const data = serverSnap.data();
            initialRole = data.role || 'data_entry';
            initialApproval = data.accessApproved !== undefined ? Boolean(data.accessApproved) : false;
          }

          const freshUser: AppUser = {
            ...firebaseUser,
            role: initialRole as any,
            accessApproved: initialApproval,
          };

          globalAppUser = freshUser;
          globalUserLoading = false;
          setAppUser(freshUser);
          setLoading(false);
        })
        .catch(() => {
          // If server fetch fails (e.g. offline), continue with listener
        });

      // 3. Setup Real-time Listener for instant live updates (Revoke / Approve in real-time)
      const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
        if (!isSubscribed) return;

        let finalUser: AppUser;
        if (docSnap.exists()) {
          const userData = docSnap.data();
          const finalRole = userData.role || 'data_entry';
          const finalApproval = userData.accessApproved !== undefined ? Boolean(userData.accessApproved) : false;

          finalUser = { 
            ...firebaseUser, 
            role: finalRole as any,
            accessApproved: finalApproval,
          };
        } else {
          finalUser = { ...firebaseUser, role: 'data_entry', accessApproved: false }; 
        }

        globalAppUser = finalUser;
        globalUserLoading = false;
        setAppUser(finalUser);
        setLoading(false);
      }, (error) => {
        console.error("Error listening to user details:", error);
      });

      return () => {
        isSubscribed = false;
        unsubscribe();
      };
    } else {
      globalAppUser = null;
      globalUserLoading = false;
      setAppUser(null);
      setLoading(false);
    }
  }, [auth.currentUser, firestore, isUserLoading]);

  return { user: appUser, loading };
}

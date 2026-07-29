'use client';

import { useEffect, useState } from 'react';
import { useFirebase } from '@/firebase/provider';
import { doc, onSnapshot } from 'firebase/firestore';
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
 * Expert Real-time User Hook.
 * Listens to the user profile document in Firestore and updates the UI instantly
 * when an Admin approves or revokes access.
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

      // Reset global cache if user changed to prevent stale state bleed
      if (globalAppUser && globalAppUser.uid !== firebaseUser.uid) {
        globalAppUser = null;
        setAppUser(null);
        setLoading(true);
      }

      // 1. Immediate check for Super Admin by Email (Hardcoded safety)
      if (emailLower === ADMIN_EMAIL) {
        const adminUser: AppUser = { ...firebaseUser, role: 'admin', accessApproved: true };
        globalAppUser = adminUser;
        globalUserLoading = false;
        setAppUser(adminUser);
        setLoading(false);
        return;
      }

      // 1.5. Immediate check for approved Center Panel user by Email
      if (emailLower === CENTER_EMAIL) {
        const centerUser: AppUser = { ...firebaseUser, role: 'data_entry', accessApproved: true };
        globalAppUser = centerUser;
        globalUserLoading = false;
        setAppUser(centerUser);
        setLoading(false);
        return;
      }

      // 2. Setup Real-time Synchronous Listener for the User's Profile Document
      const userDocRef = doc(firestore, 'users', firebaseUser.uid);
      
      const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
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
          // Default fallback for new user doc creation
          finalUser = { ...firebaseUser, role: 'data_entry', accessApproved: false }; 
        }

        globalAppUser = finalUser;
        globalUserLoading = false;
        setAppUser(finalUser);
        setLoading(false);
      }, (error) => {
        console.error("Error listening to user details:", error);
        const fallbackUser: AppUser = { ...firebaseUser, role: 'data_entry', accessApproved: false };
        globalAppUser = fallbackUser;
        globalUserLoading = false;
        setAppUser(fallbackUser);
        setLoading(false);
      });

      return () => unsubscribe();
    } else {
      globalAppUser = null;
      globalUserLoading = false;
      setAppUser(null);
      setLoading(false);
    }
  }, [auth.currentUser, firestore, isUserLoading]);

  return { user: appUser, loading };
}

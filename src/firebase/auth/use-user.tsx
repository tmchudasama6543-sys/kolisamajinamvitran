'use client';

import { useEffect, useState } from 'react';
import { useFirebase } from '@/firebase/provider';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
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
      if (!globalAppUser) {
        setLoading(true);
      }
      return;
    }

    const firebaseUser = auth.currentUser;

    if (firebaseUser) {
      const emailLower = firebaseUser.email?.toLowerCase() || '';

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

      // 2. Setup Real-time Listener for the User's Profile Document
      const userDocRef = doc(firestore, 'users', firebaseUser.uid);
      const adminDocRef = doc(firestore, 'roles_admin', firebaseUser.uid);

      const unsubscribe = onSnapshot(userDocRef, (userSnap) => {
        getDoc(adminDocRef).then((adminSnap) => {
          let finalRole = 'data_entry';
          let finalApproval = false;

          if (userSnap.exists()) {
            const userData = userSnap.data();
            finalRole = userData.role || 'data_entry';
            finalApproval = userData.accessApproved !== undefined ? userData.accessApproved : false;
          }

          // If user exists in roles_admin collection, they are ALWAYS an Admin
          if (adminSnap.exists()) {
            finalRole = 'admin';
            // Only set finalApproval = true if accessApproved is NOT explicitly set to false (i.e. Revoked)
            if (userSnap.exists()) {
              if (userSnap.data().accessApproved !== false) {
                finalApproval = true;
              }
            } else {
              finalApproval = true;
            }
          }

          const finalUser: AppUser = { 
            ...firebaseUser, 
            role: finalRole as any,
            accessApproved: finalApproval,
          };

          globalAppUser = finalUser;
          globalUserLoading = false;
          setAppUser(finalUser);
          setLoading(false);
        }).catch((err) => {
          console.warn("adminDoc check skipped or fallback:", err);
          let finalRole = 'data_entry';
          let finalApproval = false;

          if (userSnap.exists()) {
            const userData = userSnap.data();
            finalRole = userData.role || 'data_entry';
            finalApproval = userData.accessApproved !== undefined ? userData.accessApproved : false;
          }

          const fallbackUser: AppUser = { 
            ...firebaseUser, 
            role: finalRole as any,
            accessApproved: finalApproval,
          };

          globalAppUser = fallbackUser;
          globalUserLoading = false;
          setAppUser(fallbackUser);
          setLoading(false);
        });
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

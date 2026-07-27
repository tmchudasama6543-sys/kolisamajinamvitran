
'use client';

import { useEffect, useState } from 'react';
import { useFirebase } from '@/firebase/provider';
import { doc, onSnapshot, getDoc, setDoc } from 'firebase/firestore';
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
    // If Firebase Auth is still determining the initial user state, keep loading.
    if (isUserLoading) {
      if (!globalAppUser) {
        setLoading(true);
      }
      return;
    }

    const firebaseUser = auth.currentUser;

    if (firebaseUser) {
      if (globalAppUser && globalAppUser.uid === firebaseUser.uid) {
        setAppUser(globalAppUser);
        setLoading(false);
      } else {
        setLoading(true);
      }

      // 1. Immediate check for Super Admin by Email (Hardcoded safety)
      if (firebaseUser.email === ADMIN_EMAIL) {
        const adminUser: AppUser = { ...firebaseUser, role: 'admin', accessApproved: true };
        globalAppUser = adminUser;
        globalUserLoading = false;
        setAppUser(adminUser);
        setLoading(false);
        return;
      }

      // 1.5. Immediate check for approved Center Panel user by Email
      if (firebaseUser.email === CENTER_EMAIL) {
        const centerUser: AppUser = { ...firebaseUser, role: 'data_entry', accessApproved: true };
        globalAppUser = centerUser;
        globalUserLoading = false;
        setAppUser(centerUser);
        setLoading(false);
        return;
      }

      // 2. Setup Real-time Listener for the User's Profile Document
      const userDocRef = doc(firestore, 'users', firebaseUser.uid);
      
      const unsubscribe = onSnapshot(userDocRef, async (docSnap) => {
        let finalUser: AppUser;
        if (docSnap.exists()) {
          const userData = docSnap.data();
          
          let finalRole = userData.role || 'data_entry';
          let finalApproval = userData.accessApproved || false;

          const adminDocRef = doc(firestore, 'roles_admin', firebaseUser.uid);
          const adminDoc = await getDoc(adminDocRef);
          
          if (adminDoc.exists()) {
            finalRole = 'admin';
            finalApproval = true;
          }

          finalUser = { 
            ...firebaseUser, 
            role: finalRole as any,
            accessApproved: finalApproval,
          };
        } else {
          finalUser = { ...firebaseUser, role: 'data_entry', accessApproved: false }; 
          setDoc(userDocRef, {
            email: firebaseUser.email || "",
            role: 'data_entry',
            dataEntryCenterId: null,
            accessApproved: firebaseUser.email === CENTER_EMAIL ? true : false
          }).catch((err) => {
            console.error("Error creating default user profile doc:", err);
          });
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

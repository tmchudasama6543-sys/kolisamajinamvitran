'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
  getFirestore, 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager 
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

let firestoreInstance: ReturnType<typeof getFirestore> | null = null;

/**
 * Initializes Firebase services (App, Auth, Firestore, Storage).
 * Ensures a single instance is used throughout the client-side app.
 */
export function initializeFirebase() {
  if (!getApps().length) {
    const firebaseApp = initializeApp(firebaseConfig);
    return getSdks(firebaseApp);
  }

  return getSdks(getApp());
}

/**
 * Returns initialized Firebase SDKs.
 * @param firebaseApp The initialized FirebaseApp instance.
 */
export function getSdks(firebaseApp: FirebaseApp) {
  // Production ready storage bucket explicitly defined
  const storage = getStorage(firebaseApp, "studio-3355214124-2b100.firebasestorage.app");
  
  if (!firestoreInstance) {
    try {
      firestoreInstance = initializeFirestore(firebaseApp, {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager()
        })
      });
    } catch (e) {
      firestoreInstance = getFirestore(firebaseApp);
    }
  }

  return {
    firebaseApp,
    auth: getAuth(firebaseApp),
    firestore: firestoreInstance,
    storage
  };
}

export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './auth/use-user';
export * from './non-blocking-updates';
export * from './non-blocking-login';
export * from './errors';
export * from './error-emitter';

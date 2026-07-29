'use client';
    
import {
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  CollectionReference,
  DocumentReference,
  SetOptions,
  doc,
  getDoc,
  writeBatch,
  Firestore,
  collection
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

/**
 * Retries a Firestore write operation with exponential backoff in case of resource-exhausted errors.
 */
async function runWithRetry<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const errorMsg = error?.message || '';
    const errorCode = error?.code || '';
    const isResourceExhausted = errorCode === 'resource-exhausted' || 
                                errorMsg.includes('resource-exhausted') ||
                                errorMsg.includes('exceeded their maximum bandwidth') ||
                                errorMsg.includes('bandwidth');
    if (isResourceExhausted && retries > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
      return runWithRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
}

/**
 * Initiates a setDoc operation for a document reference.
 */
export function setDocumentNonBlocking(docRef: DocumentReference, data: any, options: SetOptions) {
  const promise = runWithRetry(() => setDoc(docRef, data, options))
    .catch(error => {
      errorEmitter.emit(
        'permission-error',
        new FirestorePermissionError({
          path: docRef.path,
          operation: 'write',
          requestResourceData: data,
        })
      );
      throw error;
    });
  return promise;
}

/**
 * Saves student document and separated photos document atomically in a single batch.
 */
export function saveStudentWithPhotosNonBlocking(db: Firestore, studentData: any, photoData: any) {
  const studentRef = doc(collection(db, 'students'));
  const photosRef = doc(db, 'student_photos', studentRef.id);
  
  const batch = writeBatch(db);
  batch.set(studentRef, studentData);
  if (photoData && (photoData.marksheetPhotoBase64 || photoData.aadhaarPhotoBase64)) {
    batch.set(photosRef, photoData);
  }
  
  const promise = runWithRetry(() => batch.commit())
    .catch(error => {
      errorEmitter.emit(
        'permission-error',
        new FirestorePermissionError({
          path: studentRef.path,
          operation: 'create',
          requestResourceData: studentData,
        })
      );
      throw error;
    });
  return promise;
}

/**
 * Updates student document and separated photos document atomically in a single batch.
 */
export function updateStudentWithPhotosNonBlocking(db: Firestore, studentId: string, studentData: any, photoData: any) {
  const studentRef = doc(db, 'students', studentId);
  const photosRef = doc(db, 'student_photos', studentId);
  
  const batch = writeBatch(db);
  batch.update(studentRef, studentData);
  if (photoData && (photoData.marksheetPhotoBase64 || photoData.aadhaarPhotoBase64)) {
    batch.set(photosRef, photoData, { merge: true });
  }
  
  const promise = runWithRetry(() => batch.commit())
    .catch(error => {
      errorEmitter.emit(
        'permission-error',
        new FirestorePermissionError({
          path: studentRef.path,
          operation: 'update',
          requestResourceData: studentData,
        })
      );
      throw error;
    });
  return promise;
}

/**
 * Initiates an addDoc operation for a collection reference.
 */
export function addDocumentNonBlocking(colRef: CollectionReference, data: any) {
  const promise = runWithRetry(() => addDoc(colRef, data))
    .catch(error => {
      errorEmitter.emit(
        'permission-error',
        new FirestorePermissionError({
          path: colRef.path,
          operation: 'create',
          requestResourceData: data,
        })
      );
      throw error;
    });
  return promise;
}

/**
 * Initiates an updateDoc operation for a document reference.
 */
export function updateDocumentNonBlocking(docRef: DocumentReference, data: any) {
  const promise = runWithRetry(() => updateDoc(docRef, data))
    .catch(error => {
      errorEmitter.emit(
        'permission-error',
        new FirestorePermissionError({
          path: docRef.path,
          operation: 'update',
          requestResourceData: data,
        })
      );
      throw error;
    });
  return promise;
}

/**
 * Bulletproof Atomic Move to Trash Pipeline.
 */
export async function moveDocumentToTrash(db: Firestore, sourceCollection: string, docId: string, adminId: string) {
  try {
    const sourceRef = doc(db, sourceCollection, docId);
    const docSnap = await getDoc(sourceRef);
    
    if (!docSnap.exists()) {
      throw new Error("વિદ્યાર્થીનો મૂળ રેકોર્ડ મળ્યો નથી.");
    }

    const data = docSnap.data();
    const trashRef = doc(db, `trash_${sourceCollection}`, docId);
    
    const batch = writeBatch(db);
    
    // Remove photo fields from main student document to prevent bloating trash_students
    const { marksheetPhotoBase64, aadhaarPhotoBase64, ...cleanData } = data;
    
    batch.set(trashRef, {
      ...cleanData,
      deletedAt: new Date().toISOString(),
      deletedBy: adminId,
      originalId: docId
    });
    batch.delete(sourceRef);

    await runWithRetry(() => batch.commit());
    
    // Move base64 photos document in background
    try {
      const photosRef = doc(db, 'student_photos', docId);
      const trashPhotosRef = doc(db, 'trash_student_photos', docId);
      const photosSnap = await getDoc(photosRef);
      if (photosSnap.exists()) {
        const subBatch = writeBatch(db);
        subBatch.set(trashPhotosRef, photosSnap.data());
        subBatch.delete(photosRef);
        await runWithRetry(() => subBatch.commit());
      } else if (marksheetPhotoBase64 || aadhaarPhotoBase64) {
        await runWithRetry(() => setDoc(trashPhotosRef, {
          marksheetPhotoBase64: marksheetPhotoBase64 || "",
          aadhaarPhotoBase64: aadhaarPhotoBase64 || ""
        }));
      }
    } catch (photoError) {
      console.warn("Photos trash transfer skipped due to rules or network:", photoError);
    }

    return true;
  } catch (error: any) {
    throw error;
  }
}

/**
 * Bulletproof Atomic Restore Pipeline.
 */
export async function restoreDocumentFromTrash(db: Firestore, sourceCollection: string, docId: string) {
  try {
    const trashRef = doc(db, `trash_${sourceCollection}`, docId);
    const docSnap = await getDoc(trashRef);
    
    if (!docSnap.exists()) {
      throw new Error("ટ્રેશમાં આ રેકોર્ડ મળ્યો નથી.");
    }

    const data = docSnap.data();
    const { deletedAt, deletedBy, originalId, ...originalData } = data;
    const originalRef = doc(db, sourceCollection, docId);
    
    const batch = writeBatch(db);
    batch.set(originalRef, originalData);
    batch.delete(trashRef);

    await runWithRetry(() => batch.commit());
    
    // Restore base64 photos document in background
    try {
      const trashPhotosRef = doc(db, 'trash_student_photos', docId);
      const photosRef = doc(db, 'student_photos', docId);
      const photosSnap = await getDoc(trashPhotosRef);
      if (photosSnap.exists()) {
        const subBatch = writeBatch(db);
        subBatch.set(photosRef, photosSnap.data());
        subBatch.delete(trashPhotosRef);
        await runWithRetry(() => subBatch.commit());
      }
    } catch (photoError) {
      console.warn("Photos restoration skipped due to rules or network:", photoError);
    }

    return true;
  } catch (error: any) {
    throw error;
  }
}

/**
 * Permanent Delete operation.
 */
export function deleteDocumentNonBlocking(docRef: DocumentReference) {
  const promise = runWithRetry(() => deleteDoc(docRef))
    .catch(error => {
      errorEmitter.emit(
        'permission-error',
        new FirestorePermissionError({
          path: docRef.path,
          operation: 'delete',
        })
      );
      throw error;
    });
  return promise;
}

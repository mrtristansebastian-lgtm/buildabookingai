import { initializeApp } from 'firebase/app';
import { Capacitor } from '@capacitor/core';
import { browserLocalPersistence, browserSessionPersistence, createUserWithEmailAndPassword, getAuth, getRedirectResult, GoogleAuthProvider, indexedDBLocalPersistence, initializeAuth, onAuthStateChanged, setPersistence, signInAnonymously, signInWithCredential, signInWithCustomToken, signInWithEmailAndPassword, signInWithPopup, signInWithRedirect, signOut } from 'firebase/auth';
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, getFirestore, increment, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, startAfter, updateDoc, where } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage';

export { addDoc, browserLocalPersistence, browserSessionPersistence, collection, createUserWithEmailAndPassword, deleteDoc, doc, getDoc, getDocs, getDownloadURL, getRedirectResult, GoogleAuthProvider, httpsCallable, increment, indexedDBLocalPersistence, limit, onAuthStateChanged, onSnapshot, orderBy, query, ref, serverTimestamp, setDoc, setPersistence, signInAnonymously, signInWithCredential, signInWithCustomToken, signInWithEmailAndPassword, signInWithPopup, signInWithRedirect, signOut, startAfter, updateDoc, uploadBytes, where };

const runtimeFirebaseConfig = globalThis.__firebase_config;
const runtimeAppId = globalThis.__app_id;
const runtimeInitialAuthToken = globalThis.__initial_auth_token;

export const firebaseConfigStr = runtimeFirebaseConfig || import.meta.env.VITE_FIREBASE_CONFIG || '{}';
export const appId = runtimeAppId || import.meta.env.VITE_APP_ID || 'build-a-booking-v2';
export const initialAuthToken = runtimeInitialAuthToken || import.meta.env.VITE_INITIAL_AUTH_TOKEN || '';

let firebaseApp = null;
let authInstance = null;
let dbInstance = null;
let storageInstance = null;
let functionsInstance = null;

if (firebaseConfigStr !== '{}') {
  try {
    firebaseApp = initializeApp(JSON.parse(firebaseConfigStr));
    if (Capacitor?.isNativePlatform?.()) {
      try {
        authInstance = initializeAuth(firebaseApp, {
          persistence: indexedDBLocalPersistence
        });
      } catch {
        authInstance = getAuth(firebaseApp);
      }
    } else {
      authInstance = getAuth(firebaseApp);
    }
    dbInstance = getFirestore(firebaseApp);
    storageInstance = getStorage(firebaseApp);
    functionsInstance = getFunctions(firebaseApp);
  } catch (error) {
    console.error('Firebase failed to initialize. Check VITE_FIREBASE_CONFIG.', error);
  }
}

export const app = firebaseApp;
export const auth = authInstance;
export const db = dbInstance;
export const storage = storageInstance;
export const functions = functionsInstance;
export const isFirebaseConfigured = Boolean(firebaseApp && authInstance && dbInstance);

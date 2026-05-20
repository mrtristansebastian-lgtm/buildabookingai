import { initializeApp } from 'firebase/app';
import { browserLocalPersistence, browserSessionPersistence, createUserWithEmailAndPassword, getAuth, getRedirectResult, GoogleAuthProvider, onAuthStateChanged, setPersistence, signInAnonymously, signInWithCustomToken, signInWithEmailAndPassword, signInWithPopup, signInWithRedirect, signOut } from 'firebase/auth';
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, getFirestore, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage';

export { addDoc, browserLocalPersistence, browserSessionPersistence, collection, createUserWithEmailAndPassword, deleteDoc, doc, getDoc, getDocs, getDownloadURL, getRedirectResult, GoogleAuthProvider, onAuthStateChanged, onSnapshot, ref, serverTimestamp, setDoc, setPersistence, signInAnonymously, signInWithCustomToken, signInWithEmailAndPassword, signInWithPopup, signInWithRedirect, signOut, updateDoc, uploadBytes };

const runtimeFirebaseConfig = globalThis.__firebase_config;
const runtimeAppId = globalThis.__app_id;
const runtimeInitialAuthToken = globalThis.__initial_auth_token;

export const firebaseConfigStr = runtimeFirebaseConfig || import.meta.env.VITE_FIREBASE_CONFIG || '{}';
export const appId = runtimeAppId || import.meta.env.VITE_APP_ID || 'build-a-booking-v2';
export const initialAuthToken = runtimeInitialAuthToken || import.meta.env.VITE_INITIAL_AUTH_TOKEN || '';

const shouldUseCurrentHostForAuth = (config) => {
  if (typeof window === 'undefined' || !config?.projectId) return false;
  const { hostname, protocol } = window.location;
  if (protocol !== 'https:') return false;
  if (!hostname || hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]') return false;

  // Firebase redirect sign-in is most reliable when the auth helper is served
  // from the same Hosting origin as the app. Keep localhost/dev on the configured
  // firebaseapp.com helper, but use the live web.app Hosting domain in production.
  return hostname === `${config.projectId}.web.app` || hostname === `${config.projectId}.firebaseapp.com`;
};

const getFirebaseConfig = () => {
  const config = JSON.parse(firebaseConfigStr);
  if (shouldUseCurrentHostForAuth(config)) {
    return { ...config, authDomain: window.location.hostname };
  }
  return config;
};

let firebaseApp = null;
let authInstance = null;
let dbInstance = null;
let storageInstance = null;

if (firebaseConfigStr !== '{}') {
  try {
    firebaseApp = initializeApp(getFirebaseConfig());
    authInstance = getAuth(firebaseApp);
    dbInstance = getFirestore(firebaseApp);
    storageInstance = getStorage(firebaseApp);
  } catch (error) {
    console.error('Firebase failed to initialize. Check VITE_FIREBASE_CONFIG.', error);
  }
}

export const app = firebaseApp;
export const auth = authInstance;
export const db = dbInstance;
export const storage = storageInstance;
export const isFirebaseConfigured = Boolean(firebaseApp && authInstance && dbInstance);

import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import * as FirebaseSDK from './firebase';
import { GOOGLE_CALENDAR_EVENTS_SCOPE } from './googleCalendar';

export const shouldUseRedirectGoogleAuth = () => {
  if (typeof window === 'undefined') return false;
  if (Capacitor?.isNativePlatform?.()) return true;
  return false;
};

export const createGoogleProvider = (options = {}) => {
  const provider = new FirebaseSDK.GoogleAuthProvider();
  if (options.calendar) provider.addScope(GOOGLE_CALENDAR_EVENTS_SCOPE);
  provider.setCustomParameters({ prompt: options.calendar ? 'consent select_account' : 'select_account' });
  return provider;
};

export const getGoogleAccessTokenFromResult = (result) => {
  const credential = FirebaseSDK.GoogleAuthProvider.credentialFromResult?.(result);
  return credential?.accessToken || result?._tokenResponse?.oauthAccessToken || '';
};

export const signInWithNativeGoogle = async (authInstance, options = {}) => {
  const result = await FirebaseAuthentication.signInWithGoogle(options);
  const idToken = result?.credential?.idToken;
  const accessToken = result?.credential?.accessToken;
  if (!idToken && !accessToken) {
    throw new Error('Google did not return a usable sign-in token. Check the Android Firebase app setup.');
  }
  const credential = FirebaseSDK.GoogleAuthProvider.credential(idToken || null, accessToken || undefined);
  const firebaseResult = await FirebaseSDK.signInWithCredential(authInstance, credential);
  return { firebaseResult, accessToken };
};

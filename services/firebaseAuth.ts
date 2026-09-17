/**
 * Google Sign-In + user profile bootstrap.
 *
 * Auth is Google-only: the Firebase ID token is the app session, and the
 * profile (role, contact) lives in Realtime Database at `/users/{uid}`.
 *
 * Bootstrap: the very first account to sign in becomes admin and claims
 * `/meta/hasAdmin`; every later account defaults to `staff`. Admins promote
 * people afterwards with the role toggle in the admin hub.
 */
import {
  GoogleAuthProvider,
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import { get, ref, set } from 'firebase/database';
import { getFirebaseAuth, getFirebaseDb, isFirebaseConfigured } from './firebase';

export interface AppUser {
  uid: string;
  name: string;
  email: string;
  avatar: string;
  role: 'staff' | 'admin';
  contact?: string;
  status: 'active' | 'inactive' | 'locked';
}

function fallbackAvatar(name: string, email: string): string {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || email || 'User')}&background=6366f1&color=fff&size=128`;
}

function profileFromFirebaseUser(fbUser: FirebaseUser): AppUser {
  const email = fbUser.email || '';
  const name = fbUser.displayName || email.split('@')[0] || 'User';
  return {
    uid: fbUser.uid,
    name,
    email,
    avatar: fbUser.photoURL || fallbackAvatar(name, email),
    role: 'staff',
    status: 'active',
  };
}

/**
 * Sign in with Google. Falls back to a full-page redirect when the browser
 * blocks (or cannot render) a popup.
 */
export async function signInWithGoogle(): Promise<void> {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error('Firebase is not configured. Set VITE_FIREBASE_* in .env.');

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  try {
    await signInWithPopup(auth, provider);
  } catch (err: any) {
    const code = err?.code || '';
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') throw err;
    if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
      await signInWithRedirect(auth, provider);
      return;
    }
    throw err;
  }
}

/** Complete a pending redirect sign-in (no-op for popup flows). */
export async function consumeGoogleRedirectResult(): Promise<FirebaseUser | null> {
  const auth = getFirebaseAuth();
  if (!auth) return null;
  try {
    const result = await getRedirectResult(auth);
    return result?.user ?? null;
  } catch (err) {
    console.warn('[SmartKey] Google redirect sign-in failed:', err);
    return null;
  }
}

export async function signOutUser(): Promise<void> {
  const auth = getFirebaseAuth();
  if (auth) await signOut(auth);
}

/** Read the stored profile for a uid. */
export async function fetchUserProfile(uid: string): Promise<AppUser | null> {
  const db = getFirebaseDb();
  if (!db) return null;
  const snapshot = await get(ref(db, `users/${uid}`));
  return snapshot.exists() ? (snapshot.val() as AppUser) : null;
}

/**
 * Ensure `/users/{uid}` exists and is current.
 * This is what turns a Google account into an app user with a role.
 */
export async function ensureUserProfile(fbUser: FirebaseUser): Promise<AppUser> {
  const db = getFirebaseDb();
  const base = profileFromFirebaseUser(fbUser);
  if (!db) return base;

  const profileRef = ref(db, `users/${fbUser.uid}`);
  const existing = await get(profileRef);

  if (existing.exists()) {
    const current = existing.val() as AppUser;
    const refreshed: AppUser = {
      ...current,
      name: current.name || base.name,
      email: base.email || current.email,
      avatar: fbUser.photoURL || current.avatar || base.avatar,
    };
    await set(profileRef, { ...refreshed, lastLogin: Date.now() });
    return refreshed;
  }

  // New account — the first one ever becomes admin, everyone else is staff.
  const hasAdminSnap = await get(ref(db, 'meta/hasAdmin'));
  const hasAdmin = hasAdminSnap.val() === true;
  const role: 'staff' | 'admin' = hasAdmin ? 'staff' : 'admin';

  const profile: AppUser & { createdAt: number; lastLogin: number } = {
    ...base,
    contact: '',
    role,
    status: 'active',
    createdAt: Date.now(),
    lastLogin: Date.now(),
  };

  await set(profileRef, profile);
  // Claim the bootstrap flag only after the admin profile exists, so the
  // `role` validation rule still sees an un-bootstrapped database.
  if (role === 'admin' && !hasAdmin) {
    await set(ref(db, 'meta/hasAdmin'), true);
  }

  return profile;
}

/**
 * Subscribe to the signed-in user. Emits `null` when signed out.
 * Returns an unsubscribe function.
 */
export function subscribeAuthUser(onUser: (user: AppUser | null) => void): () => void {
  if (!isFirebaseConfigured) {
    onUser(null);
    return () => {};
  }
  const auth = getFirebaseAuth();
  if (!auth) {
    onUser(null);
    return () => {};
  }

  return onAuthStateChanged(auth, async (fbUser) => {
    if (!fbUser) {
      onUser(null);
      return;
    }
    try {
      onUser(await ensureUserProfile(fbUser));
    } catch (err) {
      // Offline or rules rejected the profile write — keep the user signed in.
      console.warn('[SmartKey] Profile sync failed, using Google account data:', err);
      onUser(profileFromFirebaseUser(fbUser));
    }
  });
}

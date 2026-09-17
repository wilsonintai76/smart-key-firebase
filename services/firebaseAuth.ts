/**
 * Google Sign-In + user profile bootstrap.
 *
 * Auth is Google-only: the Firebase ID token is the app session, and the
 * profile (role, contact) lives in Realtime Database at `/users/{uid}`.
 *
 * First-run bootstrap rules:
 *  - An admin-created invite at `/invites/{email}` grants the invited role.
 *  - Otherwise the very first account to sign in becomes admin and claims
 *    `/meta/hasAdmin`; every later account defaults to `staff`.
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
import { get, ref, remove, set } from 'firebase/database';
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

export interface Invite {
  name: string;
  role: 'staff' | 'admin';
  contact?: string;
}

/** Realtime Database keys cannot contain dots, so emails are stored comma-escaped. */
export function emailToKey(email: string): string {
  return (email || '').trim().toLowerCase().replace(/\./g, ',');
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
    console.warn('[SecureKey] Google redirect sign-in failed:', err);
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
 * Ensure `/users/{uid}` exists and is current, applying any pending invite.
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

  // New account — resolve role from a pending invite, else bootstrap the first admin.
  const inviteKey = emailToKey(base.email);
  const [inviteSnap, hasAdminSnap] = await Promise.all([
    get(ref(db, `invites/${inviteKey}`)),
    get(ref(db, 'meta/hasAdmin')),
  ]);

  const invite: Invite | null = inviteSnap.exists() ? (inviteSnap.val() as Invite) : null;
  const hasAdmin = hasAdminSnap.val() === true;
  const role: 'staff' | 'admin' = invite?.role === 'admin' ? 'admin' : (!hasAdmin && !invite ? 'admin' : 'staff');

  const profile: AppUser & { createdAt: number; lastLogin: number } = {
    ...base,
    name: invite?.name || base.name,
    contact: invite?.contact || '',
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
  if (invite) await remove(ref(db, `invites/${inviteKey}`));

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
      console.warn('[SecureKey] Profile sync failed, using Google account data:', err);
      onUser(profileFromFirebaseUser(fbUser));
    }
  });
}

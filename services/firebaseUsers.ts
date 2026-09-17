/**
 * Realtime Database access for users, invites and the audit trail.
 *
 * Schema:
 *   /users/{uid}                  → name, email, avatar, role, contact, status, createdAt, lastLogin
 *   /invites/{email-with-commas}  → email, name, role, contact, createdBy  (admin pre-registration, claimed on first sign-in)
 *   /audit/{pushId}               → action, actorUid, actorName, actorEmail, slotLabel, pegState*, ts
 *   /meta/hasAdmin                → first-admin bootstrap flag
 */
import { onValue, push, query, ref, remove, set, update, limitToLast } from 'firebase/database';
import { getFirebaseAuth, getFirebaseDb } from './firebase';
import { emailToKey, type Invite } from './firebaseAuth';

export interface CloudUser {
  uid: string;
  name: string;
  email: string;
  avatar?: string;
  role: 'staff' | 'admin';
  contact?: string;
  status?: 'active' | 'inactive' | 'locked';
}

export interface AuditEventPayload {
  action: string;
  slotLabel?: string;
  pegStateBefore?: string;
  pegStateAfter?: string;
  timestamp?: number;
}

function db() {
  return getFirebaseDb();
}

/** Live view of every registered user profile. */
export function subscribeUsers(onUsers: (users: CloudUser[]) => void): () => void {
  const database = db();
  if (!database) return () => {};

  return onValue(
    ref(database, 'users'),
    (snapshot) => {
      const value = snapshot.val() || {};
      const users: CloudUser[] = Object.entries(value).map(([uid, raw]) => {
        const row = raw as Partial<CloudUser>;
        return {
          uid,
          name: row.name || 'Unnamed',
          email: row.email || '',
          avatar: row.avatar,
          role: row.role === 'admin' ? 'admin' : 'staff',
          contact: row.contact || '',
          status: row.status || 'active',
        };
      });
      onUsers(users);
    },
    (error) => console.warn('[SecureKey] User subscription failed:', error.message)
  );
}

/** Update the signed-in user's own profile fields. */
export async function updateUserProfile(uid: string, fields: Partial<CloudUser>): Promise<boolean> {
  const database = db();
  if (!database) return false;
  try {
    await update(ref(database, `users/${uid}`), fields as Record<string, unknown>);
    return true;
  } catch (err) {
    console.warn('[SecureKey] Profile update failed:', err);
    return false;
  }
}

/** Remove a user profile (admin only, enforced by database rules). */
export async function deleteUserProfile(uid: string): Promise<boolean> {
  const database = db();
  if (!database) return false;
  try {
    await remove(ref(database, `users/${uid}`));
    return true;
  } catch (err) {
    console.warn('[SecureKey] Profile delete failed:', err);
    return false;
  }
}

/**
 * Pre-register a member by email. They receive the invited role the first
 * time they sign in with that Google account.
 */
export async function createInvite(email: string, invite: Invite): Promise<boolean> {
  const database = db();
  if (!database) return false;
  const auth = getFirebaseAuth();
  try {
    await set(ref(database, `invites/${emailToKey(email)}`), {
      ...invite,
      email: email.trim().toLowerCase(),
      createdAt: Date.now(),
      createdBy: auth?.currentUser?.email || '',
    });
    return true;
  } catch (err) {
    console.warn('[SecureKey] Invite failed:', err);
    return false;
  }
}

export async function deleteInvite(email: string): Promise<boolean> {
  const database = db();
  if (!database) return false;
  try {
    await remove(ref(database, `invites/${emailToKey(email)}`));
    return true;
  } catch {
    return false;
  }
}

/**
 * Append an audit event to `/audit`. `timestamp` is only set when replaying
 * the offline queue, so live events carry the server-round-trip-free clock.
 */
export async function writeAuditEvent(event: AuditEventPayload): Promise<boolean> {
  const database = db();
  const user = getFirebaseAuth()?.currentUser;
  if (!database || !user) return false;

  try {
    await set(push(ref(database, 'audit')), {
      action: event.action,
      slotLabel: event.slotLabel || '',
      pegStateBefore: event.pegStateBefore || '',
      pegStateAfter: event.pegStateAfter || '',
      actorUid: user.uid,
      actorName: user.displayName || user.email?.split('@')[0] || 'Unknown',
      actorEmail: user.email || '',
      ts: event.timestamp || Date.now(),
      deviceTime: Date.now(),
    });
    return true;
  } catch (err) {
    console.warn('[SecureKey] Audit write failed:', err);
    return false;
  }
}

/** Live, newest-last stream of audit events (most recent `max` entries). */
export function subscribeAuditEvents(
  onEvents: (events: Array<AuditEventPayload & { id: string; ts: number }>) => void,
  max = 200
): () => void {
  const database = db();
  if (!database) return () => {};

  return onValue(
    query(ref(database, 'audit'), limitToLast(max)),
    (snapshot) => {
      const value = snapshot.val() || {};
      const events = Object.entries(value).map(([id, raw]) => ({ id, ...(raw as any) }));
      onEvents(events);
    },
    (error) => console.warn('[SecureKey] Audit subscription failed:', error.message)
  );
}

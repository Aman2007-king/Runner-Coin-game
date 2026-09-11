import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, query, orderBy, limit, getDocs, serverTimestamp } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth();

// ── Anonymous auth ──────────────────────────────────────────────────────────
// firestore.rules requires an authenticated user (even an anonymous one) to
// create a leaderboard entry. Nothing previously signed the player in, so
// every write failed with permission-denied. This signs them in lazily on
// first use and caches the in-flight promise so concurrent callers (e.g. the
// Game Over screen and a Victory screen both mounting) share one sign-in.
let authReady: Promise<void> | null = null;
export function ensureAuth(): Promise<void> {
  if (!authReady) {
    authReady = new Promise((resolve, reject) => {
      const unsubscribe = onAuthStateChanged(
        auth,
        (user) => { if (user) { unsubscribe(); resolve(); } },
        (err)  => { unsubscribe(); authReady = null; reject(err); },
      );
      if (!auth.currentUser) {
        signInAnonymously(auth).catch((err) => { unsubscribe(); authReady = null; reject(err); });
      }
    });
  }
  return authReady;
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function logFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
}

export interface LeaderboardEntry { name: string; score: number }
export type SaveScoreResult = { ok: true } | { ok: false; message: string };

export const saveHighScore = async (name: string, score: number): Promise<SaveScoreResult> => {
  const cleanName = name.trim().slice(0, 30);
  if (!cleanName) return { ok: false, message: 'Enter a name first.' };
  const path = 'leaderboard';
  try {
    await ensureAuth();
    await addDoc(collection(db, path), {
      name: cleanName,
      score: Math.max(0, Math.floor(score)),
      timestamp: serverTimestamp(),
    });
    return { ok: true };
  } catch (error) {
    logFirestoreError(error, OperationType.CREATE, path);
    return { ok: false, message: 'Could not submit your score — check your connection and try again.' };
  }
};

export const getLeaderboard = async (): Promise<LeaderboardEntry[]> => {
  const path = 'leaderboard';
  try {
    const q = query(collection(db, path), orderBy('score', 'desc'), limit(10));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => doc.data() as LeaderboardEntry);
  } catch (error) {
    logFirestoreError(error, OperationType.LIST, path);
    return [];
  }
};

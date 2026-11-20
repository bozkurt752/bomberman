import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import {
  doc,
  getDocFromServer,
  getFirestore,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Timestamp,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { AVATAR_PRESETS, AvatarId, MAX_MP_LEVEL, MAX_SOLO_LEVEL } from '../game/types';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
void testConnection();

export interface CloudPlayerProfile {
  uid: string;
  displayName: string;
  photoUrl: string;
  avatarId: AvatarId;
  bestScore: number;
  soloHighestUnlocked: number;
  mpHighestUnlocked: number;
  totalMatches: number;
  totalWins: number;
  totalKills: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface LocalSyncSnapshot {
  displayName: string;
  avatarId: AvatarId;
  bestScore: number;
  soloHighestUnlocked: number;
  mpHighestUnlocked: number;
  deltaMatches?: number;
  deltaWins?: number;
  deltaKills?: number;
}

const VALID_AVATAR_IDS = new Set<string>(AVATAR_PRESETS.map((a) => a.id));

export function clampSoloLevel(val: number): number {
  const n = Math.floor(Number(val));
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(MAX_SOLO_LEVEL, n);
}

export function clampMpLevel(val: number): number {
  const n = Math.floor(Number(val));
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(MAX_MP_LEVEL, n);
}

export function sanitizeDisplayName(raw: string | null | undefined, fallback = 'Oyuncu'): string {
  const cleaned = (raw ?? '').trim().slice(0, 32);
  return cleaned.length >= 1 ? cleaned : fallback;
}

export function sanitizePhotoUrl(raw: string | null | undefined): string {
  return (raw ?? '').trim().slice(0, 512);
}

export function sanitizeAvatarId(raw: string | null | undefined): AvatarId {
  return raw && VALID_AVATAR_IDS.has(raw) ? (raw as AvatarId) : 'knight';
}

export function clampNonNegativeInt(val: number, max: number): number {
  const n = Math.floor(Number(val));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(max, n);
}

export async function signInWithGooglePlay(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signOutGooglePlay(): Promise<void> {
  await signOut(auth);
}

export function observeAuthChanges(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}

export function subscribePlayerProfile(
  uid: string,
  onProfile: (profile: CloudPlayerProfile | null) => void,
  onError?: (error: Error) => void
): () => void {
  const path = `playerProfiles/${uid}`;
  const docRef = doc(db, 'playerProfiles', uid);
  return onSnapshot(
    docRef,
    (snapshot) => {
      if (!snapshot.exists()) {
        onProfile(null);
        return;
      }
      const d = snapshot.data();
      onProfile({
        uid: String(d.uid ?? uid),
        displayName: sanitizeDisplayName(d.displayName),
        photoUrl: sanitizePhotoUrl(d.photoUrl),
        avatarId: sanitizeAvatarId(d.avatarId),
        bestScore: clampNonNegativeInt(d.bestScore, 100000000),
        soloHighestUnlocked: clampSoloLevel(d.soloHighestUnlocked),
        mpHighestUnlocked: clampMpLevel(d.mpHighestUnlocked),
        totalMatches: clampNonNegativeInt(d.totalMatches, 1000000),
        totalWins: clampNonNegativeInt(d.totalWins, 1000000),
        totalKills: clampNonNegativeInt(d.totalKills, 10000000),
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
      });
    },
    (err) => {
      try {
        handleFirestoreError(err, OperationType.GET, path);
      } catch (wrapped) {
        if (onError && wrapped instanceof Error) {
          onError(wrapped);
        }
      }
    }
  );
}

export async function syncPlayerProfileToCloud(
  user: User,
  local: LocalSyncSnapshot,
  existingCloud: CloudPlayerProfile | null
): Promise<CloudPlayerProfile> {
  const path = `playerProfiles/${user.uid}`;
  const docRef = doc(db, 'playerProfiles', user.uid);

  const mergedBestScore = clampNonNegativeInt(
    Math.max(local.bestScore, existingCloud?.bestScore ?? 0),
    100000000
  );
  const mergedSolo = clampSoloLevel(
    Math.max(local.soloHighestUnlocked, existingCloud?.soloHighestUnlocked ?? 1)
  );
  const mergedMp = clampMpLevel(
    Math.max(local.mpHighestUnlocked, existingCloud?.mpHighestUnlocked ?? 1)
  );
  const nextMatches = clampNonNegativeInt(
    (existingCloud?.totalMatches ?? 0) + (local.deltaMatches ?? 0),
    1000000
  );
  const nextWins = clampNonNegativeInt(
    (existingCloud?.totalWins ?? 0) + (local.deltaWins ?? 0),
    1000000
  );
  const nextKills = clampNonNegativeInt(
    (existingCloud?.totalKills ?? 0) + (local.deltaKills ?? 0),
    10000000
  );

  const customLocalName =
    local.displayName && local.displayName.trim() && local.displayName.trim() !== 'Oyuncu 1'
      ? local.displayName.trim()
      : '';
  const displayName = sanitizeDisplayName(
    customLocalName || existingCloud?.displayName || user.displayName || local.displayName
  );
  const photoUrl = sanitizePhotoUrl(user.photoURL || existingCloud?.photoUrl || '');
  const avatarId = sanitizeAvatarId(local.avatarId || existingCloud?.avatarId);

  if (!existingCloud) {
    // Check server once before creating so an offline/pending snapshot doesn't overwrite existing createdAt
    let serverData: CloudPlayerProfile | null = null;
    try {
      const snap = await getDocFromServer(docRef);
      if (snap.exists()) {
        const d = snap.data();
        serverData = {
          uid: String(d.uid ?? user.uid),
          displayName: sanitizeDisplayName(d.displayName),
          photoUrl: sanitizePhotoUrl(d.photoUrl),
          avatarId: sanitizeAvatarId(d.avatarId),
          bestScore: clampNonNegativeInt(d.bestScore, 100000000),
          soloHighestUnlocked: clampSoloLevel(d.soloHighestUnlocked),
          mpHighestUnlocked: clampMpLevel(d.mpHighestUnlocked),
          totalMatches: clampNonNegativeInt(d.totalMatches, 1000000),
          totalWins: clampNonNegativeInt(d.totalWins, 1000000),
          totalKills: clampNonNegativeInt(d.totalKills, 10000000),
          createdAt: d.createdAt,
          updatedAt: d.updatedAt,
        };
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, path);
    }

    if (serverData) {
      return syncPlayerProfileToCloud(user, local, serverData);
    }

    const createPayload = {
      uid: user.uid,
      displayName,
      photoUrl,
      avatarId,
      bestScore: mergedBestScore,
      soloHighestUnlocked: mergedSolo,
      mpHighestUnlocked: mergedMp,
      totalMatches: nextMatches,
      totalWins: nextWins,
      totalKills: nextKills,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    try {
      await setDoc(docRef, createPayload);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
    return {
      uid: user.uid,
      displayName,
      photoUrl,
      avatarId,
      bestScore: mergedBestScore,
      soloHighestUnlocked: mergedSolo,
      mpHighestUnlocked: mergedMp,
      totalMatches: nextMatches,
      totalWins: nextWins,
      totalKills: nextKills,
    };
  }

  const updatePayload = {
    displayName,
    photoUrl,
    avatarId,
    bestScore: Math.max(mergedBestScore, existingCloud.bestScore),
    soloHighestUnlocked: Math.max(mergedSolo, existingCloud.soloHighestUnlocked),
    mpHighestUnlocked: Math.max(mergedMp, existingCloud.mpHighestUnlocked),
    totalMatches: Math.max(nextMatches, existingCloud.totalMatches),
    totalWins: Math.max(nextWins, existingCloud.totalWins),
    totalKills: Math.max(nextKills, existingCloud.totalKills),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(docRef, updatePayload, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }

  return {
    uid: user.uid,
    displayName: updatePayload.displayName,
    photoUrl: updatePayload.photoUrl,
    avatarId: updatePayload.avatarId,
    bestScore: updatePayload.bestScore,
    soloHighestUnlocked: updatePayload.soloHighestUnlocked,
    mpHighestUnlocked: updatePayload.mpHighestUnlocked,
    totalMatches: updatePayload.totalMatches,
    totalWins: updatePayload.totalWins,
    totalKills: updatePayload.totalKills,
    createdAt: existingCloud.createdAt,
  };
}

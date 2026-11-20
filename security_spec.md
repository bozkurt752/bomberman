# Security Specification — Bomberman Mobil Arena

## Phase 0: Data Invariants
1. A `PlayerProfile` document at `/playerProfiles/{userId}` can only be read (`get`), created, or updated by the authenticated, email-verified user whose `request.auth.uid == userId`.
2. Collection-wide `list` queries on `/playerProfiles` are strictly denied (`allow list: if false`) to prevent user enumeration.
3. No PII (email, phone, address) is stored in Firestore; Google account email remains solely in Firebase Auth on the client.
4. `uid` and `createdAt` are immutable after document creation.
5. `soloHighestUnlocked` is strictly bounded to `[1, 500]`, `mpHighestUnlocked` to `[1, 100]`, and counters (`bestScore`, `totalMatches`, `totalWins`, `totalKills`) are bounded non-negative integers.
6. `createdAt` and `updatedAt` must equal `request.time` (server timestamp).

## Dirty Dozen Attack Payloads (All Must Return PERMISSION_DENIED)
1. **Unauthenticated Read**: `get /playerProfiles/userA` with `auth = null`.
2. **Cross-User Read**: `get /playerProfiles/userB` signed in as `userA`.
3. **Collection Scrape**: `list /playerProfiles` signed in as `userA`.
4. **Unverified Email Write**: `create /playerProfiles/userA` with `email_verified: false`.
5. **Identity Spoofing on Create**: `create /playerProfiles/userA` with `uid: "userB"`.
6. **Shadow / Ghost Field Injection**: `create /playerProfiles/userA` adding `isAdmin: true`.
7. **Level Cap Overflow**: `update /playerProfiles/userA` with `soloHighestUnlocked: 999`.
8. **Negative Score Poisoning**: `update /playerProfiles/userA` with `bestScore: -500`.
9. **Immutable Timestamp Tampering**: `update /playerProfiles/userA` modifying `createdAt`.
10. **Client-Forged Timestamp**: `update /playerProfiles/userA` setting `updatedAt` to a past timestamp instead of `request.time`.
11. **Invalid Avatar Enum**: `update /playerProfiles/userA` setting `avatarId: "hacked_avatar"`.
12. **Oversized String / Path Poisoning**: `create /playerProfiles/<1500-char-id>` or `displayName` > 32 chars.

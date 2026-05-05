/**
 * Grant or revoke the `admin` custom claim on a Firebase Auth user.
 *
 * Usage:
 *   npm run set-admin -- user@example.com           # grant
 *   npm run set-admin -- user@example.com --revoke  # revoke
 *
 * Reuses the same Admin SDK credentials as the server (FIREBASE_PROJECT_ID /
 * FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY, or GOOGLE_APPLICATION_CREDENTIALS).
 */
import { admin } from '../src-server/config/firebase';

async function main() {
  const args = process.argv.slice(2);
  const revoke = args.includes('--revoke');
  const email = args.find((a) => !a.startsWith('--'));

  if (!email) {
    console.error('Usage: npm run set-admin -- <email> [--revoke]');
    process.exit(1);
  }

  const user = await admin.auth().getUserByEmail(email);
  const existingClaims = user.customClaims ?? {};
  const nextClaims = revoke
    ? (() => {
        const { admin: _omit, ...rest } = existingClaims as Record<string, unknown>;
        return rest;
      })()
    : { ...existingClaims, admin: true };

  await admin.auth().setCustomUserClaims(user.uid, nextClaims);

  console.log(
    revoke
      ? `Revoked admin from ${email} (uid=${user.uid}).`
      : `Granted admin to ${email} (uid=${user.uid}).`,
  );
  console.log(
    'The user must sign out and back in (or call getIdToken(true) in the',
    'browser) before the new claim appears in their ID token.',
  );
}

main().catch((err) => {
  console.error('set-admin failed:', err);
  process.exit(1);
});

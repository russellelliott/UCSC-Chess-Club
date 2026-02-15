import admin from 'firebase-admin';

if (!admin.apps.length) {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const projectId = process.env.FIREBASE_PROJECT_ID;

  if (privateKey && clientEmail && projectId) {
    try {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          // Replace escaped newlines with actual newlines
          privateKey: privateKey.replace(/\\n/g, '\n'),
        }),
      });
    } catch (error) {
      console.error('Firebase Admin initialization failed:', error);
    }
  } else {
    console.warn(
      'Firebase Admin not initialized. Missing FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL, or FIREBASE_PROJECT_ID environment variables.'
    );
  }
}

const adminDb = admin.apps.length ? admin.firestore() : null;
const adminStorage = admin.apps.length ? admin.storage() : null;

export { admin, adminDb, adminStorage };
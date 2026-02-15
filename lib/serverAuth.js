import { admin } from './firebase-admin';

/**
 * Verifies the Firebase ID token from the request.
 * @param {import('next').NextApiRequest} req
 * @returns {Promise<import('firebase-admin/auth').DecodedIdToken | null>}
 */
export async function authenticateRequest(req) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.split('Bearer ')[1];

  if (!admin.apps.length) {
    console.error("Firebase Admin not initialized. Cannot verify token.");
    return null;
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    return decodedToken;
  } catch (error) {
    console.error("Error verifying auth token:", error);
    return null;
  }
}

import { authenticateRequest } from '@/lib/serverAuth';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const user = await authenticateRequest(req);

  if (!user) {
    return res.status(401).json({ message: 'Unauthorized: Invalid or missing token' });
  }

  console.log("Server Verified User:", user.email);

  return res.status(200).json({ 
    message: 'Authenticated successfully',
    user: {
      uid: user.uid,
      email: user.email,
      name: user.name,
      picture: user.picture
    }
  });
}

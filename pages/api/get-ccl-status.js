import { db } from '../../lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { season, year } = req.query;

  if (!season || !year) {
    return res.status(400).json({ message: 'Season and year are required' });
  }

  try {
    const tournamentsRef = collection(db, "ccl-tournament-info");
    const q = query(tournamentsRef, where("season", "==", season), where("year", "==", year));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return res.status(200).json({ exists: false });
    }

    const doc = querySnapshot.docs[0].data();
    
    return res.status(200).json({
      exists: true,
      data: doc
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
}

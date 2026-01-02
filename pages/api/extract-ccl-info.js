import { db } from '../../lib/firebase';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { ChatOpenAI } from '@langchain/openai';
import pdf from 'pdf-parse';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { season, year } = req.body;

  if (!season || !year) {
    return res.status(400).json({ message: 'Season and year are required' });
  }

  try {
    // 1. Get Firestore Document
    const tournamentsRef = collection(db, "ccl-tournament-info");
    const q = query(tournamentsRef, where("season", "==", season), where("year", "==", year));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return res.status(404).json({ message: `No tournament info found for ${season} ${year}.` });
    }

    const docSnapshot = querySnapshot.docs[0];
    const docData = docSnapshot.data();
    const docId = docSnapshot.id;

    if (!docData.pdfStorageUrl) {
      return res.status(400).json({ message: 'PDF has not been uploaded yet.' });
    }

    // 2. Fetch PDF and Extract Text
    const response = await fetch(docData.pdfStorageUrl);
    if (!response.ok) throw new Error(`Failed to fetch PDF: ${response.statusText}`);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const data = await pdf(buffer);
    const fullText = data.text;

    // 3. Initialize LangChain
    const llm = new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: process.env.OPENAI_API_MODEL_NAME || 'gpt-4o',
      temperature: 0,
    });

    // 4. Run Single Comprehensive Query
    const prompt = `You are a helpful assistant. Based on the following tournament rules document, extract all the required information and return it as a single JSON object.

The JSON object must have the following structure:
{
    "logistics": [
        {"title": "Registration Opens", "date": "YYYY-MM-DD HH:MM AM/PM PT"},
        {"title": "Registration Closes", "date": "YYYY-MM-DD HH:MM AM/PM PT"},
        {"title": "Schedule Release", "date": "YYYY-MM-DD HH:MM AM/PM PT"},
        {"title": "Roster Lock", "date": "YYYY-MM-DD HH:MM AM/PM PT"}
    ],
    "regular_season": [
        {"title": "Regular Season Round 1", "date": "YYYY-MM-DD HH:MM AM/PM PT"},
        // ... more rounds
    ],
    "divisions": [
        {
            "division": 1,
            "playoff_rounds": [
                {"title": "Quarterfinals", "date": "YYYY-MM-DD HH:MM AM/PM PT"},
                // ... more rounds
            ]
        },
        {
            "division": "2+",
            "playoff_rounds": [
                {"title": "Round 1", "date": "YYYY-MM-DD HH:MM AM/PM PT"},
                // ... more rounds
            ]
        }
    ],
    "requirements": {
        "minimum_account_age": <numeric_value>,
        "minimum_games": <numeric_value>
    }
}
Specific Instructions:
1. Dates should be formatted as "YYYY-MM-DD HH:MM AM/PM PT".
2. For "logistics", find the dates for registration open, close, schedule release, and roster locking.
3. For "regular_season", list all events in the 'schedule' section. Note the time of day for group A teams (PT).
3. For "regular_season", list all events in the 'schedule' section. Note the time of day for group A teams (PT).
4. For "divisions", extract the playoff schedules.
   - Division 1 rounds: Quarterfinals, Semifinals, 3rd Place/Final.
   - Division 2+ rounds: Round 1, Quarterfinal, Semifinal, Final/3rd Place.
5. For "requirements":
   - Find "Minimum account age" in section 5.4.4 (in days).
   - Find "Minimum number of rated blitz games" in section 5.4.3.

Context:
${fullText}
`;

    const result = await llm.invoke(prompt);
    let tournamentInfo = {};
    try {
        // Clean up the response if it contains markdown code blocks
        const content = result.content.replace(/```json/g, '').replace(/```/g, '').trim();
        tournamentInfo = JSON.parse(content);
    } catch (e) {
        console.error("Failed to parse tournament info JSON", e);
        throw new Error("Failed to parse LLM response");
    }

    // 5. Update Firestore
    const docRef = doc(db, "ccl-tournament-info", docId);
    await updateDoc(docRef, { tournamentInfo });

    return res.status(200).json({
        message: 'Tournament info extracted and saved successfully',
        tournamentInfo
    });

  } catch (error) {
    console.error('Error extracting info:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
}

import { load } from 'cheerio';
import { db, storage } from '../../lib/firebase';
import { collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { season, year } = req.body;

  if (!season || !year) {
    return res.status(400).json({ message: 'Season and year are required' });
  }

  try {
    // Check if tournament already exists
    const tournamentsRef = collection(db, "ccl-tournament-info");
    const q = query(tournamentsRef, where("season", "==", season), where("year", "==", year));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const existingData = querySnapshot.docs.map(doc => doc.data());
      return res.status(200).json({ 
        message: `Tournament info for ${season} ${year} already exists.`,
        exists: true,
        savedData: existingData
      });
    }

    const searchQuery = `Collegiate Chess League ${season.charAt(0).toUpperCase() + season.slice(1)} ${year} site:chess.com`;
    
    const perplexityResponse = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.REACT_APP_PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [{ role: 'user', content: searchQuery }]
      })
    });

    if (!perplexityResponse.ok) {
      throw new Error(`Perplexity API error! status: ${perplexityResponse.status}`);
    }

    const data = await perplexityResponse.json();
    const answer = data.choices[0]?.message?.content || '';
    const rawSources = data.citations || [];
    
    // Filter sources
    const filteredSources = rawSources.filter(url => {
      const lowerUrl = url.toLowerCase();
      const lowerSeason = season.toLowerCase();
      return lowerUrl.includes(year) && lowerUrl.includes(lowerSeason) && !lowerUrl.includes('india');
    });

    const results = [];
    
    for (const url of filteredSources) {
      try {
        const response = await fetch(url);
        if (!response.ok) {
            console.error(`Failed to fetch ${url}: ${response.status}`);
            continue;
        }
        
        const html = await response.text();
        const $ = load(html);
        
        const result = {
          url,
          pdf: [],
          instructions: [],
          registration: [],
          fairPlay: [],
          platform: []
        };

        $('a').each((i, el) => {
          const href = $(el).attr('href');
          const text = $(el).text().toLowerCase();
          if (!href) return;

          const lowerHref = href.toLowerCase();

          if (lowerHref.includes('chess.com/register') || lowerHref.includes('chess.com/login')) return;

          const addLink = (arr, link) => {
              if (!arr.includes(link)) arr.push(link);
          };

          if (text.includes('pdf') || lowerHref.includes('.pdf') || lowerHref.includes('drive.google.com') || (lowerHref.includes('docs.google.com') && !lowerHref.includes('/forms/'))) addLink(result.pdf, href);
          if (text.includes('instruction')) addLink(result.instructions, href);
          if (text.includes('registration') || text.includes('register') || text.includes('sign up') || lowerHref.includes('forms.gle') || lowerHref.includes('docs.google.com/forms')) addLink(result.registration, href);
          if (lowerHref.includes('fairplay-agreement') || (text.includes('fair play') && !lowerHref.includes('user-agreement') && !lowerHref.includes('/cheating') && !lowerHref.includes('legal'))) addLink(result.fairPlay, href);
          if (lowerHref.includes('pcl.gg')) addLink(result.platform, href);
        });
        
        if (result.pdf.length > 0 || result.instructions.length > 0 || result.registration.length > 0 || result.fairPlay.length > 0 || result.platform.length > 0) {
          results.push(result);
        }
      } catch (e) {
        console.error(`Failed to scrape ${url}`, e);
      }
    }

    const savedData = [];

    for (const result of results) {
      const tournamentData = {
        season: season,
        year: year,
        source: result.url,
        pdf: result.pdf[0] || '',
        pdfStorageUrl: '', // Will be populated by the second API call
        instructions: result.instructions[0] || '',
        registration: result.registration[0] || '',
        fairPlay: result.fairPlay[0] || '',
        platform: result.platform[0] || ''
      };

      await addDoc(tournamentsRef, tournamentData);
      savedData.push(tournamentData);
    }

    return res.status(200).json({
      message: 'Search and save completed',
      answer,
      sources: filteredSources,
      scrapedData: results,
      savedData
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
}

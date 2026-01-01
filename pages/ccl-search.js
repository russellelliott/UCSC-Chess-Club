import { useState } from 'react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export default function CCLSearchPage() {
  const [season, setSeason] = useState('spring');
  const [year, setYear] = useState('2026');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleSearch = async () => {
    setLoading(true);
    setResult(null);

    try {
      // Step 1: Search and Save Metadata
      const response = await fetch('/api/run-ccl-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ season, year }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Something went wrong during search');
      }

      if (data.exists) {
        toast.info(data.message);
      } else {
        toast.success('Search and save completed successfully!');
      }

      // Step 2: Process PDF Uploads
      toast.info('Processing PDF uploads...');
      const pdfResponse = await fetch('/api/upload-ccl-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ season, year }),
      });

      const pdfData = await pdfResponse.json();

      if (!pdfResponse.ok) {
        // Don't throw here, just warn, as the main search succeeded
        console.error('PDF upload failed:', pdfData.message);
        toast.warning('PDF upload failed, but search results saved.');
      } else {
        toast.success('PDF processing completed!');
        
        // Merge PDF data into result if needed
        if (data.savedData && pdfData.updatedDocs) {
            data.savedData = data.savedData.map(item => {
                // Find matching updated doc if possible
                // We match by checking if the item has a pdf link that matches the one we just processed
                // But since we don't have the ID in the item, we can try to match by source or just update all that have a pdf link
                // A simpler way is to just update the item if it has a pdf link and we have a new storage url
                // However, since we just want to display the link, we can just update the state
                
                // Let's try to match by PDF link if possible, or just update the first one found
                // Since we don't have a perfect ID match here without more complex logic, 
                // we will just iterate and update if we find a match in the updatedDocs array
                // based on the fact that we just processed them.
                
                // Actually, the best way is to just use the updatedDocs to patch the savedData
                // But since we don't have a common ID in savedData (it was just created/fetched),
                // we can just rely on the fact that if we have a pdfStorageUrl in updatedDocs, we should show it.
                
                // Let's just update the item if it has a pdf link
                const updatedDoc = pdfData.updatedDocs.find(doc => doc.pdfStorageUrl);
                if (updatedDoc && item.pdf) {
                    return { ...item, pdfStorageUrl: updatedDoc.pdfStorageUrl };
                }
                return item;
            });
        }
      }

      setResult(data);

    } catch (error) {
      console.error(error);
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <ToastContainer />
      <h1>CCL Tournament Search</h1>
      
      <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <label>
          Season:
          <select 
            value={season} 
            onChange={(e) => setSeason(e.target.value)}
            style={{ marginLeft: '0.5rem', padding: '0.25rem' }}
          >
            <option value="fall">Fall</option>
            <option value="spring">Spring</option>
          </select>
        </label>
        
        <label>
          Year:
          <input 
            type="number" 
            value={year} 
            onChange={(e) => setYear(e.target.value)}
            min="2025" 
            max="2030"
            style={{ marginLeft: '0.5rem', width: '80px', padding: '0.25rem' }}
          />
        </label>
        
        <button 
          onClick={handleSearch} 
          disabled={loading}
          style={{ 
            padding: '0.5rem 1rem',
            background: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Processing...' : 'Search & Save'}
        </button>
      </div>

      {result && (
        <div style={{ marginTop: '2rem' }}>
          {result.answer && (
            <div style={{ marginBottom: '1rem', padding: '1rem', background: '#f8f9fa', borderRadius: '4px' }}>
              <h3>Perplexity Summary</h3>
              <p style={{ whiteSpace: 'pre-wrap' }}>{result.answer}</p>
            </div>
          )}

          {result.savedData && result.savedData.length > 0 && (
            <div>
              <h3>Saved Tournaments</h3>
              {result.savedData.map((item, index) => (
                <div key={index} style={{ marginBottom: '1rem', padding: '1rem', border: '1px solid #dee2e6', borderRadius: '4px' }}>
                  <p><strong>Source:</strong> <a href={item.source} target="_blank" rel="noopener noreferrer">{item.source}</a></p>
                  {item.pdfStorageUrl ? (
                    <p><strong>PDF Saved:</strong> <a href={item.pdfStorageUrl} target="_blank" rel="noopener noreferrer">View PDF</a></p>
                  ) : item.pdf ? (
                     <p><strong>PDF Link Found (Processing...):</strong> <a href={item.pdf} target="_blank" rel="noopener noreferrer">Original Link</a></p>
                  ) : null}
                  {item.instructions && <p><strong>Instructions:</strong> <a href={item.instructions} target="_blank" rel="noopener noreferrer">Link</a></p>}
                  {item.registration && <p><strong>Registration:</strong> <a href={item.registration} target="_blank" rel="noopener noreferrer">Link</a></p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

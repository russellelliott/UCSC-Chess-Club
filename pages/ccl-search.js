import { useState, useEffect } from 'react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export default function CCLSearchPage() {
  const [season, setSeason] = useState('spring');
  const [year, setYear] = useState('2026');
  
  // Step 1: Search
  const [searchStatus, setSearchStatus] = useState('idle'); // idle, loading, success, error
  const [searchData, setSearchData] = useState(null);

  // Step 2: Upload PDF
  const [uploadStatus, setUploadStatus] = useState('idle');
  const [uploadData, setUploadData] = useState(null);

  // Step 3: Extract Info
  const [extractStatus, setExtractStatus] = useState('idle');
  const [extractData, setExtractData] = useState(null);

  useEffect(() => {
    const checkStatus = async () => {
        // Reset states
        setSearchStatus('idle');
        setSearchData(null);
        setUploadStatus('idle');
        setUploadData(null);
        setExtractStatus('idle');
        setExtractData(null);

        try {
            const res = await fetch(`/api/get-ccl-status?season=${season}&year=${year}`);
            const data = await res.json();
            
            if (data.exists) {
                // Step 1 is done
                setSearchStatus('success');
                setSearchData({ exists: true, savedData: [data.data] });

                // Step 2 check
                if (data.data.pdfStorageUrl) {
                    setUploadStatus('success');
                    setUploadData({ updatedDocs: [{ pdfStorageUrl: data.data.pdfStorageUrl, exists: true }] });
                }

                // Step 3 check
                if (data.data.tournamentInfo) {
                    setExtractStatus('success');
                    setExtractData({ tournamentInfo: data.data.tournamentInfo });
                }
            }
        } catch (e) {
            console.error("Error checking status", e);
        }
    };

    checkStatus();
  }, [season, year]);

  const handleSearch = async () => {
    setSearchStatus('loading');
    try {
      const response = await fetch('/api/run-ccl-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ season, year }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      
      setSearchData(data);
      setSearchStatus('success');
      toast.success(data.exists ? 'Tournament found!' : 'Search completed!');
      
      // Reset subsequent steps if search changes context
      setUploadStatus('idle');
      setUploadData(null);
      setExtractStatus('idle');
      setExtractData(null);

    } catch (error) {
      console.error(error);
      setSearchStatus('error');
      toast.error(error.message);
    }
  };

  const handleUpload = async () => {
    setUploadStatus('loading');
    try {
      const response = await fetch('/api/upload-ccl-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ season, year }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);

      setUploadData(data);
      setUploadStatus('success');
      
      const alreadyExists = data.updatedDocs.some(doc => doc.exists);
      toast.success(alreadyExists ? 'PDF already uploaded.' : 'PDF uploaded successfully!');
      
    } catch (error) {
      console.error(error);
      setUploadStatus('error');
      toast.error(error.message);
    }
  };

  const handleExtract = async () => {
    setExtractStatus('loading');
    try {
      const response = await fetch('/api/extract-ccl-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ season, year }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);

      setExtractData(data);
      setExtractStatus('success');
      toast.success('Info extracted and saved!');
    } catch (error) {
      console.error(error);
      setExtractStatus('error');
      toast.error(error.message);
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <ToastContainer />
      <h1>CCL Tournament Manager</h1>
      
      <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <label>
          Season:
          <select value={season} onChange={(e) => setSeason(e.target.value)} style={{ marginLeft: '0.5rem', padding: '0.25rem' }}>
            <option value="fall">Fall</option>
            <option value="spring">Spring</option>
          </select>
        </label>
        <label>
          Year:
          <input type="number" value={year} onChange={(e) => setYear(e.target.value)} min="2025" max="2030" style={{ marginLeft: '0.5rem', width: '80px', padding: '0.25rem' }} />
        </label>
      </div>

      {/* Step 1 */}
      <div style={stepStyle}>
        <div style={headerStyle}>
          <input type="checkbox" checked={searchStatus === 'success'} readOnly style={{ transform: 'scale(1.5)' }} />
          <h3>Step 1: Search & Save Metadata</h3>
        </div>
        <button onClick={handleSearch} disabled={searchStatus === 'loading'} style={buttonStyle}>
          {searchStatus === 'loading' ? 'Searching...' : 'Run Search'}
        </button>
        {searchData && (
            <div style={resultStyle}>
                <p><strong>Status:</strong> {searchData.exists ? <span style={{color: 'green'}}>(already exists)</span> : 'New data saved'}</p>
                {searchData.savedData && searchData.savedData.map((item, i) => (
                    <div key={i} style={{marginBottom: '5px'}}>
                        <a href={item.source} target="_blank" rel="noreferrer">Source Link</a>
                        {item.fairPlay && <span style={{marginLeft: '10px'}}> | <a href={item.fairPlay} target="_blank" rel="noreferrer">Fair Play</a></span>}
                    </div>
                ))}
            </div>
        )}
      </div>

      {/* Step 2 */}
      <div style={{...stepStyle, opacity: searchStatus === 'success' ? 1 : 0.5, pointerEvents: searchStatus === 'success' ? 'auto' : 'none'}}>
        <div style={headerStyle}>
          <input type="checkbox" checked={uploadStatus === 'success'} readOnly style={{ transform: 'scale(1.5)' }} />
          <h3>Step 2: Upload PDF</h3>
        </div>
        <button 
            onClick={handleUpload} 
            disabled={uploadStatus === 'loading'} 
            style={buttonStyle}
        >
          {uploadStatus === 'loading' ? 'Uploading...' : 'Upload PDF'}
        </button>
        {uploadData && (
            <div style={resultStyle}>
                {uploadData.updatedDocs.map((doc, i) => (
                    <div key={i}>
                        <p><strong>Status:</strong> {doc.exists ? <span style={{color: 'green'}}>(already exists)</span> : 'New PDF uploaded'}</p>
                        {doc.pdfStorageUrl ? (
                            <a href={doc.pdfStorageUrl} target="_blank" rel="noreferrer">View PDF</a>
                        ) : 'No PDF URL'}
                    </div>
                ))}
            </div>
        )}
      </div>

      {/* Step 3 */}
      <div style={{...stepStyle, opacity: uploadStatus === 'success' ? 1 : 0.5, pointerEvents: uploadStatus === 'success' ? 'auto' : 'none'}}>
        <div style={headerStyle}>
          <input type="checkbox" checked={extractStatus === 'success'} readOnly style={{ transform: 'scale(1.5)' }} />
          <h3>Step 3: Extract Info (LangChain)</h3>
        </div>
        <button 
            onClick={handleExtract} 
            disabled={extractStatus === 'loading'} 
            style={buttonStyle}
        >
          {extractStatus === 'loading' ? 'Extracting...' : extractStatus === 'success' ? 'Extract Again' : 'Extract Info'}
        </button>
        {extractData && (
            <div style={resultStyle}>
                <details>
                    <summary style={{cursor: 'pointer', fontWeight: 'bold'}}>View Extracted JSON</summary>
                    <pre style={{background: '#f4f4f4', padding: '10px', overflow: 'auto', maxHeight: '300px', marginTop: '10px'}}>
                        {JSON.stringify(extractData.tournamentInfo, null, 2)}
                    </pre>
                </details>
            </div>
        )}
      </div>

    </div>
  );
}

const stepStyle = {
    border: '1px solid #ddd',
    borderRadius: '8px',
    padding: '1.5rem',
    marginBottom: '1.5rem',
    background: 'white',
    transition: 'opacity 0.3s ease'
};

const headerStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '15px',
    marginBottom: '1rem'
};

const buttonStyle = {
    padding: '0.5rem 1rem',
    background: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '1rem'
};

const resultStyle = {
    marginTop: '1rem',
    padding: '1rem',
    background: '#f8f9fa',
    borderRadius: '4px',
    fontSize: '0.9rem',
    border: '1px solid #eee'
};

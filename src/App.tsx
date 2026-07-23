import { useEffect, useState } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import PreviewPage from './PreviewPage';
import Studio from './Studio';

function getPreviewToken() {
  const match = window.location.hash.match(/^#\/preview\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

function App() {
  const [previewToken, setPreviewToken] = useState(getPreviewToken);

  useEffect(() => {
    const onHashChange = () => setPreviewToken(getPreviewToken());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  return (
    <>
      {previewToken ? <PreviewPage token={previewToken} /> : <Studio />}
      <Analytics />
      <SpeedInsights sampleRate={0.5} />
    </>
  );
}

export default App;

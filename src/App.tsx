import { useEffect, useState } from 'react';
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

  return previewToken ? <PreviewPage token={previewToken} /> : <Studio />;
}

export default App;

import { useEffect, useState } from 'react';
import { api } from '@appdeploy/client';
import { ArrowRight, Monitor, RefreshCw, Smartphone } from 'lucide-react';

type PreviewPayload = { html?: string; name?: string; remoteUrl?: string };

const APPDEPLOY_BASE_URL = 'https://441a4987f6936b832e.v2.appdeploy.ai';

function isAppDeployHost() {
  return window.location.hostname.endsWith('.appdeploy.ai');
}

function remotePreviewUrl(token: string) {
  return token === 'demo'
    ? `${APPDEPLOY_BASE_URL}/api/demo-preview`
    : `${APPDEPLOY_BASE_URL}/api/public-preview/${encodeURIComponent(token)}`;
}

function PreviewPage({ token }: { token: string }) {
  const [payload, setPayload] = useState<PreviewPayload | null>(null);
  const [errorText, setErrorText] = useState('');
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');

  useEffect(() => {
    let active = true;
    setPayload(null);
    setErrorText('');
    if (!isAppDeployHost()) {
      setPayload({
        name: token === 'demo' ? 'مرصد تسعة Pro' : 'معاينة الموقع',
        remoteUrl: remotePreviewUrl(token)
      });
      return () => { active = false; };
    }

    api.get(`/api/preview-content/${encodeURIComponent(token)}`)
      .then(response => { if (active) setPayload(response.data as PreviewPayload); })
      .catch(() => { if (active) setErrorText('تعذر فتح المعاينة أو أن الرابط لم يعد صالحًا.'); });
    return () => { active = false; };
  }, [token]);

  const goBack = () => { window.location.hash = ''; };

  if (errorText) return <main className="grid min-h-screen place-items-center bg-[#05070B] p-5 text-[#F7FBFF]" dir="rtl"><section className="w-full max-w-lg rounded-[2rem] border border-[#FF7A91]/20 bg-[#0A0E15] p-7 text-center"><h1 className="text-2xl font-extrabold">المعاينة غير متاحة</h1><p className="mt-3 leading-7 text-[#768496]">{errorText}</p><button onClick={goBack} className="mt-6 rounded-xl bg-[#73E7FF] px-6 py-3 font-bold text-[#05070B]">العودة إلى الاستوديو</button></section></main>;

  if (!payload?.html && !payload?.remoteUrl) return <main className="grid min-h-screen place-items-center bg-[#05070B] text-[#73E7FF]" dir="rtl"><div className="text-center"><RefreshCw className="mx-auto h-8 w-8 animate-spin" /><p className="mt-4 text-sm text-white/40">جاري تجهيز معاينة الموقع...</p></div></main>;

  return <main className="min-h-screen bg-[#030508] text-[#F7FBFF]" dir="rtl">
    <header className="sticky top-0 z-30 border-b border-[#1B2736] bg-[#05070B]/95 backdrop-blur-2xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-3 sm:px-6">
        <button onClick={goBack} className="inline-flex items-center gap-2 rounded-xl border border-[#1B2736] bg-[#0A0E15] px-3 py-2 text-xs text-white/60 hover:text-white"><ArrowRight className="h-4 w-4" />الاستوديو</button>
        <div className="hidden rounded-xl border border-[#1B2736] bg-[#0A0E15] p-1 sm:flex"><button onClick={() => setDevice('desktop')} className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs ${device === 'desktop' ? 'bg-[#73E7FF]/10 text-[#73E7FF]' : 'text-white/35'}`}><Monitor className="h-4 w-4" />كمبيوتر</button><button onClick={() => setDevice('mobile')} className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs ${device === 'mobile' ? 'bg-[#73E7FF]/10 text-[#73E7FF]' : 'text-white/35'}`}><Smartphone className="h-4 w-4" />جوال</button></div>
        <div className="min-w-0 text-left"><span className="block text-[9px] font-bold tracking-[.16em] text-[#73E7FF]/70">CLIENT PREVIEW</span><strong className="block max-w-[150px] truncate text-sm sm:max-w-sm">{payload.name || 'معاينة الموقع'}</strong></div>
      </div>
      <div className="flex justify-center gap-2 border-t border-[#1B2736] p-2 sm:hidden"><button onClick={() => setDevice('desktop')} className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs ${device === 'desktop' ? 'bg-[#73E7FF]/10 text-[#73E7FF]' : 'text-white/35'}`}><Monitor className="h-4 w-4" />كمبيوتر</button><button onClick={() => setDevice('mobile')} className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs ${device === 'mobile' ? 'bg-[#73E7FF]/10 text-[#73E7FF]' : 'text-white/35'}`}><Smartphone className="h-4 w-4" />جوال</button></div>
    </header>
    <section className="flex min-h-[calc(100vh-4rem)] items-start justify-center overflow-auto p-2 sm:p-5">
      <div className={`overflow-hidden border border-[#2B3B4E] bg-white shadow-[0_35px_100px_rgba(0,0,0,.55)] transition-all duration-500 ${device === 'mobile' ? 'mt-3 w-[390px] max-w-full rounded-[2rem]' : 'w-full max-w-[1500px] rounded-2xl'}`}>
        <iframe src={payload.remoteUrl} srcDoc={payload.remoteUrl ? undefined : payload.html} title={payload.name || 'معاينة الموقع'} sandbox="allow-popups allow-top-navigation-by-user-activation" className="block h-[calc(100vh-7rem)] min-h-[620px] w-full border-0 bg-white" />
      </div>
    </section>
  </main>;
}

export default PreviewPage;

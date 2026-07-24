import { api } from '@appdeploy/client';

type CwcProject = {
  id: string;
  status: string;
  progress: number;
  currentWave: number;
  agentOutputs: unknown[];
  synthesis?: Record<string, unknown>;
};

type Hooks<T extends CwcProject> = {
  onStatus: (value: string) => void;
  onProject: (project: T) => void;
  finalize: (project: T) => Promise<T>;
};

const sleep = (ms: number) => new Promise<void>(resolve => window.setTimeout(resolve, ms));

export async function runCwcWaves<T extends CwcProject>(project: T, hooks: Hooks<T>): Promise<T> {
  let current = project;
  let previousCount = current.agentOutputs.length;

  for (let cycle = 0; cycle < 4 && !current.synthesis; cycle += 1) {
    if (current.agentOutputs.length === 9) {
      current = await hooks.finalize(current);
      break;
    }

    const wave = Math.floor(current.agentOutputs.length / 3) + 1;
    hooks.onStatus(`مجلس CWC يشغّل الموجة ${wave}/3 عبر جسر Vercel ويحفظها قبل الانتقال...`);
    let response: { data: { project: T; needsContinue?: boolean; needsFinalize?: boolean } } | null = null;
    let lastError: unknown;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        response = await api.post(`/api/projects/${project.id}/run`, {});
        break;
      } catch (error) {
        lastError = error;
        try {
          const latestResponse = await api.get(`/api/projects/${project.id}`);
          current = latestResponse.data.project as T;
          hooks.onProject(current);
          if (current.agentOutputs.length > previousCount || current.synthesis) break;
        } catch {}
        if (attempt < 2) {
          hooks.onStatus(`تعذر اتصال الموجة ${wave} مؤقتًا؛ إعادة المحاولة من آخر نقطة محفوظة...`);
          await sleep(attempt === 0 ? 3000 : 7000);
        }
      }
    }

    if (response) {
      current = response.data.project;
      hooks.onProject(current);
      if (response.data.needsFinalize && !current.synthesis) current = await hooks.finalize(current);
    } else if (current.agentOutputs.length <= previousCount && !current.synthesis) {
      throw lastError instanceof Error ? lastError : new Error('تعذر استكمال موجة CWC');
    }

    previousCount = current.agentOutputs.length;
    if (!current.synthesis && current.agentOutputs.length < 9) await sleep(900);
  }

  if (current.agentOutputs.length === 9 && !current.synthesis) current = await hooks.finalize(current);
  return current;
}

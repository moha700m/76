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

async function readLatest<T extends CwcProject>(projectId: string, hooks: Hooks<T>): Promise<T | null> {
  try {
    const response = await api.get(`/api/projects/${projectId}`);
    const latest = response.data.project as T;
    hooks.onProject(latest);
    return latest;
  } catch {
    return null;
  }
}

async function finalizeWithResume<T extends CwcProject>(project: T, hooks: Hooks<T>): Promise<T> {
  let current = project;
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    hooks.onStatus('اكتملت 9/9. المنسق النهائي يجمع النتيجة في طلب مستقل ثم يبني محتوى المعاينة...');
    try {
      return await hooks.finalize(current);
    } catch (error) {
      lastError = error;
      const latest = await readLatest(project.id, hooks);
      if (latest) current = latest;
      if (current.synthesis) return current;
      if (current.agentOutputs.length < 9) throw error;
      if (attempt < 2) {
        hooks.onStatus('مخرجات 9/9 محفوظة. التجميع النهائي ما زال يعمل وسنستأنفه دون إعادة أي وكيل...');
        await sleep(attempt === 0 ? 8000 : 15000);
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error('تعذر إكمال التجميع النهائي');
}

export async function runCwcWaves<T extends CwcProject>(project: T, hooks: Hooks<T>): Promise<T> {
  let current = project;

  for (let cycle = 0; cycle < 5 && !current.synthesis; cycle += 1) {
    if (current.agentOutputs.length === 9) {
      current = await finalizeWithResume(current, hooks);
      break;
    }

    const previousCount = current.agentOutputs.length;
    const wave = Math.floor(previousCount / 3) + 1;
    hooks.onStatus(`مجلس CWC يشغّل الموجة ${wave}/3 ويحفظ نتائجها قبل الانتقال...`);
    let response: { data: { project: T; needsContinue?: boolean; needsFinalize?: boolean } } | null = null;
    let lastError: unknown;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        response = await api.post(`/api/projects/${project.id}/run`, {});
        break;
      } catch (error) {
        lastError = error;
        const latest = await readLatest(project.id, hooks);
        if (latest) current = latest;
        if (current.agentOutputs.length > previousCount || current.synthesis) break;
        if (attempt < 2) {
          hooks.onStatus(`تعذر اتصال الموجة ${wave} مؤقتًا؛ النتائج السابقة محفوظة وسنستأنف من ${current.agentOutputs.length}/9...`);
          await sleep(attempt === 0 ? 5000 : 10000);
        }
      }
    }

    if (response) {
      current = response.data.project;
      hooks.onProject(current);
      if (response.data.needsFinalize && !current.synthesis) current = await finalizeWithResume(current, hooks);
    } else if (current.agentOutputs.length <= previousCount && !current.synthesis) {
      throw lastError instanceof Error ? lastError : new Error('تعذر استكمال موجة CWC');
    }

    if (!current.synthesis && current.agentOutputs.length < 9) await sleep(700);
  }

  if (current.agentOutputs.length === 9 && !current.synthesis) current = await finalizeWithResume(current, hooks);
  return current;
}

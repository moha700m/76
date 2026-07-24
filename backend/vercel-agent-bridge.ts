import { secrets } from '@appdeploy/sdk';
import { DESIGN_AGENTS, type AgentOutput, type ProjectContext, type ThinkingMode } from './design-agents';

const BRIDGE_BASE_URL = 'https://marsad-tisaa-pro-git-agent-sync-appde-a62057-moha700ms-projects.vercel.app';

type BridgeResponse = {
  ok?: boolean;
  wave?: number;
  outputs?: AgentOutput[];
  synthesis?: Record<string, unknown>;
  error?: string;
  message?: string;
  retryable?: boolean;
  providerStatus?: number;
};

export class VercelAgentBridgeError extends Error {
  code: string;
  retryable: boolean;
  status: number;

  constructor(message: string, options: { code?: string; retryable?: boolean; status?: number } = {}) {
    super(message);
    this.name = 'VercelAgentBridgeError';
    this.code = options.code || 'bridge_error';
    this.retryable = Boolean(options.retryable);
    this.status = Number(options.status || 502);
  }
}

function compactPrevious(outputs: AgentOutput[], concise = false) {
  return outputs.map(item => ({
    agentId: item.agentId,
    name: item.name,
    summary: item.summary.slice(0, concise ? 650 : 1000),
    findings: item.findings.slice(0, concise ? 3 : 5).map(value => value.slice(0, concise ? 360 : 600)),
    decisions: item.decisions.slice(0, concise ? 3 : 4).map(value => value.slice(0, concise ? 360 : 600)),
    deliverable: item.deliverable.slice(0, concise ? 700 : 1200),
    confidence: item.confidence
  }));
}

function projectPayload(context: ProjectContext, concise = false) {
  return {
    name: context.name,
    brief: context.brief.slice(0, concise ? 4200 : 7000),
    audience: context.audience.slice(0, 900),
    goal: context.goal.slice(0, 900),
    style: context.style.slice(0, 900),
    references: context.references.slice(0, concise ? 3 : 5),
    feedback: (context.feedback || '').slice(0, concise ? 700 : 2000),
    evidence: context.referenceEvidence.slice(0, concise ? 1 : 3).map(item => ({
      title: item.title,
      excerpt: item.text.slice(0, concise ? 1400 : 5000)
    })),
    memories: context.memories.slice(0, concise ? 4 : 8).map(item => ({
      title: item.title,
      content: item.content.slice(0, concise ? 900 : 3500)
    }))
  };
}

function validateOutputs(wave: number, outputs: unknown): AgentOutput[] {
  const start = (wave - 1) * 3;
  const roles = DESIGN_AGENTS.slice(start, start + 3);
  const values = Array.isArray(outputs) ? outputs : [];
  if (values.length !== 3) throw new VercelAgentBridgeError('لم يُرجع الجسر ثلاثة وكلاء', { code: 'invalid_bridge_output', retryable: true });
  return roles.map((role, index) => {
    const item = values.find(value => value && typeof value === 'object' && (value as AgentOutput).agentId === role.id) || values[index];
    const output = item as AgentOutput | undefined;
    if (!output || output.agentId !== role.id || output.status !== 'complete' || !output.summary || !output.deliverable || !Array.isArray(output.findings) || !Array.isArray(output.decisions)) {
      throw new VercelAgentBridgeError(`مخرج ${role.name} غير صالح`, { code: 'invalid_bridge_output', retryable: true });
    }
    return {
      ...output,
      agentId: role.id,
      name: role.name,
      title: role.title,
      workshop: role.workshop,
      status: 'complete',
      confidence: Math.max(55, Math.min(98, Number(output.confidence) || 75)),
      elapsedMs: Math.max(0, Number(output.elapsedMs) || 0)
    };
  });
}

async function readBridgeSecrets() {
  try {
    const [bridgeSecret, protectionBypass] = await Promise.all([
      secrets.readSecret('NASQ_AGENT_BRIDGE_SECRET'),
      secrets.readSecret('VERCEL_AUTOMATION_BYPASS_SECRET')
    ]);
    return { bridgeSecret, protectionBypass };
  } catch {
    throw new VercelAgentBridgeError('أسرار جسر الوكلاء أو تجاوز حماية Vercel غير مضبوطة داخل AppDeploy', { code: 'bridge_secret_missing', status: 503 });
  }
}

async function requestBridge(path: string, body: Record<string, unknown>, requestId: string, timeoutMs: number) {
  const { bridgeSecret, protectionBypass } = await readBridgeSecrets();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${BRIDGE_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${bridgeSecret}`,
        'content-type': 'application/json',
        'x-vercel-protection-bypass': protectionBypass,
        'x-nasq-request-id': requestId
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    const data = await response.json().catch(() => ({})) as BridgeResponse;
    if (!response.ok) {
      throw new VercelAgentBridgeError(data.message || 'تعذر تشغيل طلب الوكلاء عبر Vercel', {
        code: data.error || 'bridge_request_failed',
        retryable: Boolean(data.retryable) || response.status === 429 || response.status >= 500,
        status: response.status
      });
    }
    return data;
  } catch (error) {
    if (error instanceof VercelAgentBridgeError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new VercelAgentBridgeError('انتهت مهلة اتصال جسر الوكلاء، والنتائج المحفوظة لم تتغير', { code: 'bridge_timeout', retryable: true, status: 504 });
    }
    throw new VercelAgentBridgeError('تعذر الاتصال بجسر الوكلاء، والنتائج المحفوظة لم تتغير', { code: 'bridge_network_error', retryable: true });
  } finally {
    clearTimeout(timeout);
  }
}

export async function runVercelCwcWave(options: {
  wave: 1 | 2 | 3;
  context: ProjectContext;
  previous: AgentOutput[];
  thinkingMode: ThinkingMode;
  requestId: string;
}): Promise<{ outputs: AgentOutput[] }> {
  const splitWave3 = options.wave === 3;
  const data = await requestBridge(
    splitWave3 ? '/api/agent-wave3' : '/api/agent-bridge',
    {
      wave: options.wave,
      mode: splitWave3 ? 'economy' : options.thinkingMode === 'DEEP' ? 'deep' : 'balanced',
      requestId: options.requestId,
      project: projectPayload(options.context, splitWave3),
      previousOutputs: compactPrevious(options.previous, splitWave3)
    },
    options.requestId,
    splitWave3 ? 48_000 : 54_000
  );
  return { outputs: validateOutputs(options.wave, data.outputs) };
}

export async function runVercelCwcSynthesis(options: {
  context: ProjectContext;
  outputs: AgentOutput[];
  thinkingMode: ThinkingMode;
  requestId: string;
}): Promise<Record<string, unknown>> {
  if (options.outputs.length !== 9) {
    throw new VercelAgentBridgeError('التجميع النهائي يتطلب مخرجات 9/9', { code: 'invalid_synthesis_input', status: 409 });
  }
  const data = await requestBridge(
    '/api/agent-synthesis',
    {
      mode: options.thinkingMode === 'DEEP' ? 'deep' : 'balanced',
      requestId: options.requestId,
      project: projectPayload(options.context, true),
      previousOutputs: compactPrevious(options.outputs, true)
    },
    options.requestId,
    50_000
  );
  if (!data.synthesis || typeof data.synthesis !== 'object') {
    throw new VercelAgentBridgeError('لم يصل التجميع النهائي من Vercel', { code: 'missing_synthesis', retryable: true });
  }
  return data.synthesis;
}

import { secrets } from '@appdeploy/sdk';
import { DESIGN_AGENTS, type AgentOutput, type ProjectContext, type ThinkingMode } from './design-agents';

const BRIDGE_URL = 'https://marsad-tisaa-pro-git-agent-sync-appde-a62057-moha700ms-projects.vercel.app/api/agent-bridge';

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

function compactPrevious(outputs: AgentOutput[]) {
  return outputs.map(item => ({
    agentId: item.agentId,
    name: item.name,
    summary: item.summary,
    findings: item.findings.slice(0, 5),
    decisions: item.decisions.slice(0, 4),
    deliverable: item.deliverable,
    confidence: item.confidence
  }));
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

export async function runVercelCwcWave(options: {
  wave: 1 | 2 | 3;
  context: ProjectContext;
  previous: AgentOutput[];
  thinkingMode: ThinkingMode;
  requestId: string;
}): Promise<{ outputs: AgentOutput[]; synthesis?: Record<string, unknown> }> {
  let bridgeSecret = '';
  try {
    bridgeSecret = await secrets.readSecret('NASQ_AGENT_BRIDGE_SECRET');
  } catch {
    throw new VercelAgentBridgeError('سر جسر الوكلاء غير مضبوط داخل AppDeploy', { code: 'bridge_secret_missing', status: 503 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 58_000);
  try {
    const response = await fetch(BRIDGE_URL, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${bridgeSecret}`,
        'content-type': 'application/json',
        'x-nasq-request-id': options.requestId
      },
      body: JSON.stringify({
        wave: options.wave,
        mode: options.thinkingMode === 'DEEP' ? 'deep' : 'balanced',
        requestId: options.requestId,
        project: {
          name: options.context.name,
          brief: options.context.brief,
          audience: options.context.audience,
          goal: options.context.goal,
          style: options.context.style,
          references: options.context.references,
          feedback: options.context.feedback || '',
          evidence: options.context.referenceEvidence.map(item => ({ title: item.title, excerpt: item.text.slice(0, 5000) })),
          memories: options.context.memories
        },
        previousOutputs: compactPrevious(options.previous)
      }),
      signal: controller.signal
    });
    const data = await response.json().catch(() => ({})) as BridgeResponse;
    if (!response.ok) {
      throw new VercelAgentBridgeError(data.message || 'تعذر تشغيل موجة الوكلاء عبر Vercel', {
        code: data.error || 'bridge_request_failed',
        retryable: Boolean(data.retryable) || response.status === 429 || response.status >= 500,
        status: response.status
      });
    }
    const outputs = validateOutputs(options.wave, data.outputs);
    if (options.wave === 3 && (!data.synthesis || typeof data.synthesis !== 'object')) {
      throw new VercelAgentBridgeError('لم يصل التجميع النهائي من الموجة الثالثة', { code: 'missing_synthesis', retryable: true });
    }
    return { outputs, synthesis: data.synthesis };
  } catch (error) {
    if (error instanceof VercelAgentBridgeError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new VercelAgentBridgeError('انتهت مهلة اتصال موجة الوكلاء، والنتائج السابقة محفوظة', { code: 'bridge_timeout', retryable: true, status: 504 });
    }
    throw new VercelAgentBridgeError('تعذر الاتصال بجسر الوكلاء، والنتائج السابقة محفوظة', { code: 'bridge_network_error', retryable: true });
  } finally {
    clearTimeout(timeout);
  }
}

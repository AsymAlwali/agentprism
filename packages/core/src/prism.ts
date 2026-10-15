import { mkdirSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { PrismOptions, Span, SpanEvent, SpanKind, SpanStatus, Trace } from './types.js';

const uid = () => randomUUID().slice(0, 12);

export class TraceHandle {
  private spans = new Map<string, Span>();
  private openStack: string[] = [];
  private rootSpanId: string;

  constructor(public readonly data: Trace, private prism: AgentPrism) {
    // a synthetic root span that owns trace-level events
    const root: Span = {
      id: uid(),
      traceId: data.id,
      parentId: null,
      kind: 'agent',
      name: data.name,
      startTime: data.startTime,
      endTime: null,
      status: 'running',
      attributes: { synthetic: true },
      events: [],
    };
    this.spans.set(root.id, root);
    this.openStack.push(root.id);
    this.rootSpanId = root.id;
  }

  private currentParentId(): string {
    return this.openStack[this.openStack.length - 1] ?? this.rootSpanId;
  }

  private startSpan(kind: SpanKind, name: string, input?: unknown, attributes: Record<string, unknown> = {}): Span {
    const parentId = this.currentParentId();
    const span: Span = {
      id: uid(), traceId: this.data.id, parentId, kind, name,
      startTime: Date.now(), endTime: null, status: 'running',
      input: this.prism.maybeRedact(input), attributes, events: [],
    };
    this.spans.set(span.id, span);
    this.openStack.push(span.id);
    return span;
  }

  private endSpan(span: Span, status: SpanStatus, output?: unknown) {
    span.endTime = Date.now();
    span.status = status;
    if (output !== undefined) span.output = this.prism.maybeRedact(output);
    const idx = this.openStack.lastIndexOf(span.id);
    if (idx !== -1) this.openStack.splice(idx, 1);
  }

  private async run<T>(kind: SpanKind, name: string, input: unknown, attributes: Record<string, unknown>, fn: () => Promise<T> | T): Promise<T> {
    const span = this.startSpan(kind, name, input, attributes);
    try {
      const result = await fn();
      this.endSpan(span, 'ok', result);
      return result;
    } catch (err) {
      span.events.push({ time: Date.now(), type: 'error', data: String(err) });
      this.endSpan(span, 'error', undefined);
      throw err;
    }
  }

  llm<T>(input: unknown, fn: () => Promise<T> | T, attributes: Record<string, unknown> = {}) {
    return this.run('llm', (input as any)?.model ?? 'llm', input, attributes, fn);
  }
  tool<T>(name: string, input: unknown, fn: () => Promise<T> | T, attributes: Record<string, unknown> = {}) {
    return this.run('tool', name, input, attributes, fn);
  }
  agent<T>(name: string, fn: () => Promise<T> | T, attributes: Record<string, unknown> = {}) {
    return this.run('agent', name, undefined, attributes, fn);
  }

  sideEffect(type: string, data: Record<string, unknown>) {
    const parent = this.spans.get(this.currentParentId());
    if (!parent) return;
    parent.events.push({ time: Date.now(), type: 'side_effect', data: { type, ...data } });
  }

  checkpoint(state: unknown) {
    const parent = this.spans.get(this.currentParentId());
    if (!parent) return;
    parent.events.push({ time: Date.now(), type: 'snapshot', data: state });
  }

  async end() {
    const root = this.spans.get(this.rootSpanId);
    if (root) {
      root.endTime = Date.now();
      root.status = 'ok';
    }
    this.data.endTime = Date.now();
    this.data.spans = [...this.spans.values()];
    this.prism.write(this.data);
  }
}

export class AgentPrism {
  private dir: string;
  private redact: string[];
  private silent: boolean;

  constructor(opts: PrismOptions = {}) {
    this.dir = opts.dir ?? '.agentprism/traces';
    this.redact = opts.redact ?? [];
    this.silent = opts.silent ?? false;
    try { mkdirSync(this.dir, { recursive: true }); } catch {}
  }

  trace(name: string, metadata: Record<string, unknown> = {}): TraceHandle {
    const data: Trace = { id: uid(), name, startTime: Date.now(), endTime: null, metadata, spans: [] };
    return new TraceHandle(data, this);
  }

  maybeRedact(value: unknown): unknown {
    if (!value || this.redact.length === 0) return value;
    try {
      const json = JSON.stringify(value);
      if (!json) return value;
      const keys = this.redact;
      return JSON.parse(json, (k, v) => (keys.includes(k) ? '[REDACTED]' : v));
    } catch { return value; }
  }

  write(trace: Trace) {
    const file = join(this.dir, `${trace.startTime}-${trace.id}.jsonl`);
    try {
      appendFileSync(file, JSON.stringify(trace) + '\n');
      if (!this.silent) console.error(`[agentprism] wrote ${file}`);
    } catch (err) {
      if (!this.silent) console.error('[agentprism] write failed:', err);
    }
  }
}

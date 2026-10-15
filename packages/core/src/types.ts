export type SpanKind = 'agent' | 'llm' | 'tool' | 'retrieval' | 'delegation' | 'checkpoint';
export type SpanStatus = 'ok' | 'error' | 'running' | 'killed';
export type EventType = 'log' | 'error' | 'retry' | 'token' | 'snapshot' | 'claim' | 'artifact' | 'side_effect';

export interface SpanEvent { time: number; type: EventType; data: unknown; }

export interface Span {
  id: string; traceId: string; parentId: string | null;
  kind: SpanKind; name: string;
  startTime: number; endTime: number | null;
  status: SpanStatus;
  input?: unknown; output?: unknown;
  attributes: Record<string, unknown>;
  events: SpanEvent[];
}

export interface Trace {
  id: string; name: string;
  startTime: number; endTime: number | null;
  metadata: Record<string, unknown>;
  spans: Span[];
}

export interface PrismOptions { dir?: string; redact?: string[]; silent?: boolean; }

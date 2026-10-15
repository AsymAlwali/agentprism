# AgentPrism

> An X-ray for AI agents. One trace in, a spectrum of insights out.

AgentPrism is an open-source instrumentation layer for AI agents. It gives you the primitives to **see what your agent actually did** — every LLM call, tool call, delegation, side effect, and checkpoint — in one structured stream.

Every other agent tool is just a lens on that stream.

## Why

Agents fail in ways that traditional logs can't explain. When your agent hallucinates a success, loops on a tool call, or drifts after a memory update, you're left staring at hundreds of lines of nested traces with no root cause.

AgentPrism records the *right* events — and only the right events — so every debugging tool you need becomes a cheap transform on top of the same data.

Built for open models and free tiers. Works with Groq, Together, Fireworks, OpenRouter, Ollama, vLLM, Gemini Flash — and yes, OpenAI and Anthropic too.

## Packages

| Package | Status | What it does |
|---|---|---|
| `@agentprism/core` | v0 | SDK + schema. Records traces locally as JSONL. |
| `@agentprism/cli` | v0 | Renders a trace as a readable tree in your terminal. |

Coming: `@agentprism/openai` (works with any OpenAI-compatible endpoint: Groq, Together, OpenRouter, Ollama), `@agentprism/gemini`, `@agentprism/langchain`, `@agentprism/trace` (web UI), `@agentprism/loop`, `@agentprism/drift`, `@agentprism/verify`, `@agentprism/rollback`.

## Quickstart

```bash
npm install @agentprism/core
import { AgentPrism } from '@agentprism/core';
import Groq from 'groq-sdk';

const prism = new AgentPrism();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const trace = prism.trace('research-agent');

const answer = await trace.llm(
  { model: 'llama-3.3-70b-versatile' },
  () => groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [{ role: 'user', content: 'hello' }],
  })
);

await trace.tool('web_search', { query: 'x' }, () => search('x'));

trace.sideEffect('email.sent', { to: 'user@example.com' });
trace.checkpoint({ memory: 'v1' });

await trace.end();

Then:

```bash
npx agentprism view
```

Design

Three primitives:

· Trace — one full agent run
· Span — a unit of work (llm, tool, agent step, delegation, checkpoint)
· Event — a timestamped thing inside a span (log, error, retry, snapshot, claim, artifact, side effect)

Every lens — debugger, loop detector, drift checker, verifier, rollback — is a pure function over the span stream. Adding a new lens is a weekend, not a rewrite.

The schema is the product. The lenses are features.

Status

Pre-alpha. The schema is intentionally opinionated and will stabilize at v0.1. If you're building an agent and want to shape it, open an issue.


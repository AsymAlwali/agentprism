#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { Span, Trace } from '@agentprism/core';

const C = {
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  magenta: (s: string) => `\x1b[35m${s}\x1b[0m`,
};

function resolveFile(arg: string): string {
  if (arg && arg !== 'latest') {
    try { if (statSync(arg).isFile()) return arg; } catch {}
  }
  const dir = '.agentprism/traces';
  const files = readdirSync(dir).filter((f) => f.endsWith('.jsonl')).sort();
  if (files.length === 0) throw new Error(`no traces found in ${dir}`);
  return join(dir, files[files.length - 1]);
}

function fmtMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function colorStatus(s: string): string {
  if (s === 'ok') return C.green('ok');
  if (s === 'error') return C.red('ERR');
  if (s === 'killed') return C.red('KILL');
  return C.yellow('..');
}

function colorKind(k: string): string {
  switch (k) {
    case 'llm': return C.cyan(k);
    case 'tool': return C.magenta(k);
    case 'agent': return C.bold(k);
    default: return k;
  }
}

function renderSpan(span: Span, all: Span[], depth: number) {
  const indent = '  '.repeat(depth);
  const dur = span.endTime ? fmtMs(span.endTime - span.startTime) : '--';
  console.log(`${indent}[${colorStatus(span.status)}] ${colorKind(span.kind)} ${C.bold(span.name)} ${C.dim(`(${dur})`)}`);
  for (const evt of span.events) {
    if (evt.type === 'error') {
      console.log(`${indent}    ${C.red('! ' + String(evt.data).slice(0, 140))}`);
    } else if (evt.type === 'side_effect') {
      console.log(`${indent}    ${C.yellow('> side_effect:')} ${C.dim(JSON.stringify(evt.data).slice(0, 120))}`);
    } else if (evt.type === 'snapshot') {
      console.log(`${indent}    ${C.dim('* checkpoint')}`);
    }
  }
  for (const child of all.filter((s) => s.parentId === span.id)) renderSpan(child, all, depth + 1);
}

function main() {
  const arg = process.argv[3] ?? 'latest';
  const file = resolveFile(arg);
  const raw = readFileSync(file, 'utf8').trim().split('\n').filter(Boolean);
  const trace: Trace = JSON.parse(raw[raw.length - 1]);
  console.log();
  console.log(C.bold(`trace: ${trace.name}`) + C.dim(`  ${trace.id}`));
  const total = trace.endTime ? fmtMs(trace.endTime - trace.startTime) : '--';
  console.log(C.dim(`spans: ${trace.spans.length}   total: ${total}`));
  console.log();
  for (const r of trace.spans.filter((s) => s.parentId === null)) renderSpan(r, trace.spans, 0);
  console.log();
}

main();

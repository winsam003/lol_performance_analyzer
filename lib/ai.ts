export type AiFeedbackResult = { text: string } | { error: string };

import { createHash } from 'node:crypto';

const reports = new Map<string, { text: string; expires: number }>();
const pending = new Map<string, Promise<string>>();
const starts: number[] = [];

// Bound client-controlled data before constructing a prompt.
export function validateAiInput(value: unknown): void {
  const visit = (item: unknown, depth: number): void => {
    if (depth > 8) throw new Error('분석 입력이 너무 복잡합니다.');
    if (typeof item === 'number' && !Number.isFinite(item)) throw new Error('잘못된 수치입니다.');
    if (typeof item === 'string' && item.length > 200)
      throw new Error('입력 문자열이 너무 깁니다.');
    if (item !== null && typeof item === 'object') {
      const values = Object.values(item);
      if (values.length > 100) throw new Error('분석 입력이 너무 많습니다.');
      values.forEach((child) => visit(child, depth + 1));
    }
  };
  visit(value, 0);
  if (JSON.stringify(value).length > 30_000) throw new Error('분석 입력이 너무 큽니다.');
}

// Cache successful reports only. Limits are shared within one server process.
export async function reuseAiReport(
  prompt: string,
  generate: () => Promise<string>,
): Promise<string> {
  const key = createHash('sha256').update(`report-v2:${prompt}`).digest('hex');
  const now = Date.now();
  for (const [id, entry] of reports) if (entry.expires <= now) reports.delete(id);
  const cached = reports.get(key);
  if (cached) return cached.text;
  const existing = pending.get(key);
  if (existing) return existing;
  while (starts.length && starts[0] <= now - 60_000) starts.shift();
  if (starts.length >= 6 || pending.size >= 2)
    throw new Error('분석 요청이 많습니다. 잠시 후 다시 시도해주세요.');
  starts.push(now);
  const request = generate();
  pending.set(key, request);
  try {
    const text = await request;
    if (!text.trim()) throw new Error('분석 결과를 생성하지 못했습니다.');
    if (reports.size >= 100) reports.delete(reports.keys().next().value!);
    reports.set(key, { text, expires: Date.now() + 3_600_000 });
    return text;
  } finally {
    pending.delete(key);
  }
}

export function hasNumericFields(value: unknown, fields: readonly string[]): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return fields.every(
    (field) => typeof record[field] === 'number' && Number.isFinite(record[field]),
  );
}

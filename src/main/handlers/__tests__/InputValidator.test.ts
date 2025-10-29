import { describe, it, expect } from 'vitest';

function validateUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  try {
    const urlObj = new URL(url);
    return ['http:', 'https:', 'file:'].includes(urlObj.protocol);
  } catch {
    return false;
  }
}

describe('InputValidator', () => {
  it('HTTP URL을 허용해야 함', () => {
    expect(validateUrl('http://example.com')).toBe(true);
  });

  it('HTTPS URL을 허용해야 함', () => {
    expect(validateUrl('https://example.com')).toBe(true);
  });

  it('빈 문자열은 거부해야 함', () => {
    expect(validateUrl('')).toBe(false);
  });
});

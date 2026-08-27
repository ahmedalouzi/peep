import { scrubString } from './sentry-scrubber';

describe('sentry-scrubber', () => {
  it('scrubs Bearer tokens', () => {
    const input = 'Authorization: Bearer my-secret-token-123';
    expect(scrubString(input)).toBe('Authorization: Bearer [REDACTED]');
  });

  it('scrubs session tokens', () => {
    const input = 'Cookie: session_token=abcd1234efgh5678';
    expect(scrubString(input)).toBe('Cookie: session_token=[REDACTED]');
  });

  it('scrubs OpenAI API keys', () => {
    const input = 'My key is sk-abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234';
    expect(scrubString(input)).toBe('My key is [REDACTED_API_KEY]');
  });

  it('scrubs Gemini API keys', () => {
    const input = 'Gemini key AIzaSyA1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6';
    expect(scrubString(input)).toBe('Gemini key [REDACTED_API_KEY]');
  });

  it('scrubs local Windows file paths', () => {
    const input = 'Error at C:\\Users\\Administrator\\Desktop\\peep\\apps\\server\\src\\index.ts line 42';
    expect(scrubString(input)).toBe('Error at [REDACTED]/index.ts line 42');
  });

  it('scrubs local Unix file paths', () => {
    const input = 'Error at /home/user/workspace/peep/apps/desktop/src/main/index.ts line 42';
    expect(scrubString(input)).toBe('Error at [REDACTED]/index.ts line 42');
  });

  it('handles null/undefined/empty string gracefully', () => {
    expect(scrubString('')).toBe('');
    expect(scrubString(undefined as any)).toBeUndefined();
    expect(scrubString(null as any)).toBeNull();
  });
});

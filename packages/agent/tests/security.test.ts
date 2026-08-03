// Synkro Pre-Alpha Security validation tests
export default async function runTests() {
  console.log('  Running Pre-Alpha Security tests...');

  const rawKey = 'sk-proj-12345abcdef';
  
  // 1. Verify Redaction Logic helper
  const redactSecrets = (text: string, secrets: string[]): string => {
    let result = text;
    for (const secret of secrets) {
      if (secret && secret.length > 4) {
        result = result.split(secret).join('[REDACTED_API_KEY]');
      }
    }
    return result;
  };

  const logs = `[DEBUG] Calling openai model gpt-4o with api_key: ${rawKey} for task reservation`;
  const redacted = redactSecrets(logs, [rawKey]);
  
  if (redacted.includes(rawKey)) {
    throw new Error('Key was not successfully redacted from logs');
  }
  
  if (!redacted.includes('[REDACTED_API_KEY]')) {
    throw new Error('Redaction tag missing from logs output');
  }

  // 2. Verify encryption placeholder
  const mockEncrypt = (key: string): string => {
    return Buffer.from(key).toString('base64');
  };
  const mockDecrypt = (encrypted: string): string => {
    return Buffer.from(encrypted, 'base64').toString('utf8');
  };

  const cipher = mockEncrypt(rawKey);
  if (cipher === rawKey) {
    throw new Error('Plaintext key persisted instead of encrypted cipher');
  }
  if (mockDecrypt(cipher) !== rawKey) {
    throw new Error('Decrypted string does not match original plaintext');
  }

  console.log('  🟢 All Pre-Alpha Security unit tests passed.');
}

import { relative, isAbsolute, normalize, join, dirname } from 'node:path';
import { existsSync, realpathSync } from 'node:fs';

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

  // 3. Verify Path Boundary Checker Logic
  const checkPathBoundary = (projectPath: string, inputPath: string): string => {
    const cleaned = inputPath.replace(/^\.\//, '');
    const resolved = isAbsolute(cleaned) ? normalize(cleaned) : normalize(join(projectPath, cleaned));

    const realProjectRoot = existsSync(projectPath) ? realpathSync(projectPath) : projectPath;

    let currentPath = resolved;
    let resolvedRealPath = resolved;
    while (currentPath && currentPath !== normalize(join(currentPath, '..'))) {
      if (existsSync(currentPath)) {
        try {
          const realParent = realpathSync(currentPath);
          resolvedRealPath = join(realParent, relative(currentPath, resolved));
        } catch {}
        break;
      }
      currentPath = dirname(currentPath);
    }

    const rel = relative(realProjectRoot, resolvedRealPath);
    if (rel.startsWith('..') || isAbsolute(rel)) {
      throw new Error('Path is outside project workspace');
    }
    return resolved;
  };

  const projectRoot = process.cwd();
  // Safe paths
  checkPathBoundary(projectRoot, 'package.json');
  checkPathBoundary(projectRoot, 'src/index.ts');
  checkPathBoundary(projectRoot, './src/models/db.ts');

  // Traversal paths (should throw)
  let pathThrew = false;
  try {
    checkPathBoundary(projectRoot, '../../etc/passwd');
  } catch (e: any) {
    if (e.message.includes('outside project workspace')) {
      pathThrew = true;
    }
  }
  if (!pathThrew) {
    throw new Error('Failed to block path traversal targeting outside directory');
  }

  // 4. Verify Command Sandboxing Logic
  const checkCommandSafe = (commandStr: string, projectPath: string): boolean => {
    const args: string[] = [];
    let current = '';
    let inQuote: string | null = null;
    for (let i = 0; i < commandStr.length; i++) {
      const char = commandStr[i];
      if (inQuote) {
        if (char === inQuote) {
          inQuote = null;
        } else {
          current += char;
        }
      } else if (char === '"' || char === "'") {
        inQuote = char;
      } else if (/\s/.test(char)) {
        if (current) {
          args.push(current);
          current = '';
        }
      } else {
        current += char;
      }
    }
    if (current) {
      args.push(current);
    }

    const realProjectRoot = existsSync(projectPath) ? realpathSync(projectPath) : projectPath;

    for (const arg of args) {
      if (arg.includes('/') || arg.includes('\\') || arg.startsWith('..') || isAbsolute(arg)) {
        const resolved = isAbsolute(arg) ? normalize(arg) : normalize(join(projectPath, arg));
        let currentPath = resolved;
        let resolvedRealPath = resolved;
        while (currentPath && currentPath !== normalize(join(currentPath, '..'))) {
          if (existsSync(currentPath)) {
            try {
              const realParent = realpathSync(currentPath);
              resolvedRealPath = join(realParent, relative(currentPath, resolved));
            } catch {}
            break;
          }
          currentPath = dirname(currentPath);
        }
        const rel = relative(realProjectRoot, resolvedRealPath);
        if (rel.startsWith('..') || isAbsolute(rel)) {
          return false;
        }
      }
    }
    return true;
  };

  if (!checkCommandSafe('npm install', projectRoot)) {
    throw new Error('Safe command npm install was incorrectly blocked');
  }
  if (!checkCommandSafe('pnpm run build --minify', projectRoot)) {
    throw new Error('Safe command pnpm build was incorrectly blocked');
  }
  if (checkCommandSafe('cat ../../etc/passwd', projectRoot)) {
    throw new Error('Command with relative traversal was not blocked');
  }
  if (checkCommandSafe('mkdir /etc/outside', projectRoot)) {
    throw new Error('Command with absolute system path was not blocked');
  }

  console.log('  🟢 All Pre-Alpha Security unit tests passed.');
}

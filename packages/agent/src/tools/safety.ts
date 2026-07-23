/**
 * Command Safety Layer
 *
 * Classifies terminal commands as:
 * - SAFE: auto-execute without confirmation (normal dev commands)
 * - DANGEROUS: require explicit user confirmation
 * - BLOCKED: never allow
 */

export type SafetyLevel = 'safe' | 'dangerous' | 'blocked';

export interface CommandSafetyResult {
  level: SafetyLevel;
  reason?: string;
}

/** Patterns that are always blocked — never execute */
const BLOCKED_PATTERNS = [
  /rm\s+-rf\s+\//, // rm -rf on root
  /format\s+[a-z]:/i, // Windows disk format
  /mkfs\./,
  /dd\s+if=/,
  /shutdown/i,
  /reboot/i,
  /halt/i,
];

/** Patterns that require explicit user confirmation */
const DANGEROUS_PATTERNS = [
  /rm\s+-rf/i,
  /del\s+\/[sq]/i,          // Windows: del /s or /q
  /rmdir\s+\/s/i,            // Windows: rmdir /s
  /git\s+push\s+.*--force/i,
  /git\s+reset\s+--hard/i,
  /git\s+clean\s+-fd/i,
  /DROP\s+TABLE/i,
  /DROP\s+DATABASE/i,
  /truncate/i,
  /sudo\s+rm/i,
  /sudo\s+chmod/i,
  /sudo\s+chown/i,
  /\/etc\//,                  // any write to /etc
  /passwd/i,
  /curl.*\|\s*(sh|bash)/i,   // curl pipe to shell
  /wget.*\|\s*(sh|bash)/i,
  /chmod\s+777/,
];

/** Safe dev commands — always auto-execute */
const SAFE_PREFIXES = [
  'flutter pub get',
  'flutter pub upgrade',
  'flutter analyze',
  'flutter test',
  'flutter build',
  'flutter run',
  'flutter clean',
  'flutter create',
  'flutter doctor',
  'dart pub get',
  'dart analyze',
  'dart test',
  'dart format',
  'npm install',
  'npm run',
  'npm test',
  'npm build',
  'npx',
  'pnpm install',
  'pnpm run',
  'pnpm test',
  'pnpm build',
  'pnpm typecheck',
  'pnpm add',
  'pnpm remove',
  'yarn install',
  'yarn run',
  'yarn add',
  'yarn remove',
  'git status',
  'git log',
  'git diff',
  'git add',
  'git commit',
  'git fetch',
  'git pull',
  'git branch',
  'git checkout',
  'git stash',
  'git merge',
  'cat ',
  'ls ',
  'dir ',
  'echo ',
  'pwd',
  'mkdir',
  'touch',
  'cp ',
  'mv ',
  'node ',
  'python ',
  'pip install',
  'gem install',
  'pod install',
  'adb ',
  'emulator ',
  'xcrun ',
];

export function classifyCommand(command: string): CommandSafetyResult {
  const normalized = command.trim().toLowerCase();

  // Check blocked first
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(command)) {
      return {
        level: 'blocked',
        reason: `This command matches a blocked pattern and will never be executed: \`${pattern}\``,
      };
    }
  }

  // Check dangerous
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(command)) {
      return {
        level: 'dangerous',
        reason: `This command requires your explicit confirmation before execution.`,
      };
    }
  }

  // Check safe prefixes
  for (const prefix of SAFE_PREFIXES) {
    if (normalized.startsWith(prefix.toLowerCase())) {
      return { level: 'safe' };
    }
  }

  // Unknown commands are treated as dangerous (require confirmation)
  return {
    level: 'dangerous',
    reason: `This command is not in the known-safe list and requires your confirmation before execution.`,
  };
}

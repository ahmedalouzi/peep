$env:SYNKRO_DEV_AUTH_BYPASS = "true"
$env:GOOGLE_API_KEY = "***REDACTED***"
pnpm --filter @peep/agent exec tsx ../../verify_auth.ts

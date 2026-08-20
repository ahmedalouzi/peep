$env:SYNKRO_DEV_AUTH_BYPASS = "true"
$env:GOOGLE_API_KEY = "AIzaSyDAL4Kc429XwN5fnsHtCIQEYC0ehrJtzJY"
pnpm --filter @peep/agent exec tsx ../../verify_auth.ts

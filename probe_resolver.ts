// Runtime proof: GatewayResolver output when SYNKRO_DEV_AUTH_BYPASS=true
process.env.SYNKRO_DEV_AUTH_BYPASS = 'true';

import { GatewayResolver } from './packages/agent/src/models/gateway-resolver.js';

const resolved = GatewayResolver.resolve({
  settingsUrl:   undefined,                         // nothing persisted in Settings
  devBypass:     process.env.SYNKRO_DEV_AUTH_BYPASS === 'true',
  envGatewayUrl: process.env.SYNKRO_GATEWAY_URL,   // not set
  nodeEnv:       process.env.NODE_ENV,
});

console.log('[GATEWAY_RESOLVER] devBypass          :', process.env.SYNKRO_DEV_AUTH_BYPASS === 'true');
console.log('[GATEWAY_RESOLVER] settingsUrl         :', undefined);
console.log('[GATEWAY_RESOLVER] SYNKRO_GATEWAY_URL  :', process.env.SYNKRO_GATEWAY_URL ?? '(not set)');
console.log('[GATEWAY_RESOLVER] resolved URL        :', resolved);

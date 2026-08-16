/**
 * GatewayResolver — Single source of truth for the active AI Gateway base URL.
 *
 * This is a pure function: it reads no global state. All required values must
 * be explicitly injected by the call site. This makes the resolver fully
 * testable and free of hidden side effects.
 *
 * Resolution order:
 *   [Dev bypass active: devBypass === true]
 *     1. envGatewayUrl  (SYNKRO_GATEWAY_URL — env override for dev)
 *     2. DEV_DEFAULT    (http://localhost:8080)
 *     Note: settingsUrl is intentionally IGNORED in dev bypass mode to guarantee
 *           deterministic developer behavior regardless of previously saved Settings.
 *
 *   [Normal mode]
 *     3. settingsUrl    (user-configured via the Settings UI)
 *     4. envGatewayUrl  (SYNKRO_GATEWAY_URL — env override)
 *     5. PRODUCTION_DEFAULT (https://api.synkro.com)
 */

export interface GatewayResolverOptions {
  /** User-configured URL from the Settings store. Ignored when devBypass is true. */
  settingsUrl?: string;
  /**
   * True when SYNKRO_DEV_AUTH_BYPASS === 'true'.
   * Dev bypass takes absolute precedence over all other resolution paths.
   */
  devBypass?: boolean;
  /** Value of SYNKRO_GATEWAY_URL. Must be injected by the call site — not read internally. */
  envGatewayUrl?: string;
  /** Value of NODE_ENV. Reserved for future use; injected by the call site. */
  nodeEnv?: string;
}

export class GatewayResolver {
  /** Default base URL used when dev bypass is active and no env override is present. */
  static readonly DEV_DEFAULT = 'http://localhost:8080';

  /** Fallback base URL for production environments. */
  static readonly PRODUCTION_DEFAULT = 'https://api.synkro.com';

  /**
   * Resolves the active gateway base URL.
   * Pure function — reads no process.env or global state internally.
   */
  static resolve(options: GatewayResolverOptions = {}): string {
    const { settingsUrl, devBypass, envGatewayUrl } = options;

    // --- Dev bypass: absolute precedence, settingsUrl intentionally ignored ---
    if (devBypass) {
      return envGatewayUrl ?? GatewayResolver.DEV_DEFAULT;
    }

    // --- Normal mode ---
    // 1. User-configured URL (highest priority in non-dev mode)
    if (settingsUrl) return settingsUrl;

    // 2. Environment variable override
    if (envGatewayUrl) return envGatewayUrl;

    // 3. Production default
    return GatewayResolver.PRODUCTION_DEFAULT;
  }
}

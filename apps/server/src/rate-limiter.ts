import rateLimit from 'express-rate-limit';

export function ipRateLimiter() {
  return rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 120, // Limit each IP to 120 requests per windowMs
    message: { error: 'Too many requests from this IP, please try again after a minute' },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  });
}

export function scrubString(str: string): string {
  if (!str) return str;
  const tokenRegex = /(Bearer\s+|session_token=)([a-zA-Z0-9\-_]+)/g;
  const apiKeyRegex = /AIza[0-9A-Za-z\-_]{35}|sk-[a-zA-Z0-9]{48}/g;
  let res = str.replace(tokenRegex, '$1[REDACTED]');
  res = res.replace(apiKeyRegex, '[REDACTED_API_KEY]');
  res = res.replace(/(?:[A-Z]:\\[^\s]+|\/[^\s]+)[\\/]([^\s\\/]+)/g, '[REDACTED]/$1');
  return res;
}

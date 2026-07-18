/**
 * Auth for the agent-facing API / MCP server.
 *
 * A single shared bearer token (AGENT_API_TOKEN) gates every request. It is
 * checked at the HTTP layer; data access itself runs with the Supabase service
 * role, so the token must be treated as a full-access secret and only ever sent
 * over HTTPS. Rotate it by changing the env var in Netlify.
 */

/** True when the request carries a valid `Authorization: Bearer <AGENT_API_TOKEN>`. */
export function isAuthorized(req: Request): boolean {
  const expected = process.env.AGENT_API_TOKEN;
  if (!expected) return false; // not configured → deny everything
  const header = req.headers.get('authorization') ?? '';
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
  if (!token || token.length !== expected.length) return false;
  // Constant-time-ish comparison.
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= token.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

export function unauthorized(): Response {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'content-type': 'application/json', 'www-authenticate': 'Bearer' },
  });
}

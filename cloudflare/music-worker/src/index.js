const ALLOWED_PATHS = new Set([
  '/auth/qr/key',
  '/auth/qr/create',
  '/auth/qr/check',
  '/user/profile',
  '/user/account',
  '/user/playlist',
  '/user/vip',
  '/search',
  '/lyric',
  '/song'
]);

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = String(env.ALLOWED_ORIGIN || '').split(',').map(value => value.trim()).filter(Boolean);
  const allowOrigin = allowed.includes(origin) ? origin : (allowed.includes('*') ? origin : allowed[0] || origin);
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Vary': 'Origin'
  };
}

function json(data, status, request, env) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders(request, env) }
  });
}

function upstreamUrl(request, env) {
  const base = String(env.UPSTREAM_BASE_URL || '').replace(/\/$/, '');
  if (!base) throw new Error('UPSTREAM_BASE_URL is not configured');
  const incoming = new URL(request.url);
  const path = incoming.pathname.replace(/^\/api/, '') || '/';
  if (![...ALLOWED_PATHS].some(allowed => path === allowed || path.startsWith(`${allowed}/`))) {
    throw new Error('Path is not allowed');
  }
  const target = new URL(`${base}${path}`);
  target.search = incoming.search;
  return target;
}

async function proxy(request, env) {
  const target = upstreamUrl(request, env);
  const headers = new Headers();
  const authorization = request.headers.get('Authorization');
  const cookie = request.headers.get('Cookie');
  if (authorization) headers.set('Authorization', authorization);
  if (cookie) headers.set('Cookie', cookie);
  headers.set('Accept', 'application/json');

  const upstream = await fetch(target, { method: 'GET', headers, redirect: 'manual' });
  const responseHeaders = new Headers(corsHeaders(request, env));
  responseHeaders.set('Content-Type', upstream.headers.get('Content-Type') || 'application/json; charset=utf-8');
  const setCookies = typeof upstream.headers.getSetCookie === 'function'
    ? upstream.headers.getSetCookie()
    : (upstream.headers.get('Set-Cookie') ? [upstream.headers.get('Set-Cookie')] : []);
  for (const value of setCookies) responseHeaders.append('Set-Cookie', value);
  return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders(request, env) });
    if (request.method !== 'GET') return json({ error: '只允许 GET 请求' }, 405, request, env);
    try {
      return await proxy(request, env);
    } catch (error) {
      console.error(JSON.stringify({ event: 'music_api_error', message: error.message }));
      return json({ error: error.message || '音乐接口暂时不可用' }, 502, request, env);
    }
  }
};

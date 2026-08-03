// Cloudflare Pages Function: /api/proxy
// Recibe peticiones del frontend (que ya pasó Cloudflare Access),
// inyecta la clave secreta, y hace fetch al Google Apps Script backend.
// Las variables WEB_APP_URL_VIDA y VIDA_KEY se configuran en el dashboard
// de Cloudflare Pages → Settings → Environment variables.

export async function onRequest(context) {
  const { request, env } = context;

  if (!env.WEB_APP_URL_VIDA || !env.VIDA_KEY) {
    return new Response(JSON.stringify({ ok: false, error: 'env vars not configured' }), {
      status: 500,
      headers: { 'content-type': 'application/json' }
    });
  }

  const upstream = new URL(env.WEB_APP_URL_VIDA);

  if (request.method === 'GET') {
    const url = new URL(request.url);
    url.searchParams.forEach((v, k) => upstream.searchParams.set(k, v));
    upstream.searchParams.set('key', env.VIDA_KEY);
    const r = await fetch(upstream.toString(), { redirect: 'follow' });
    return new Response(await r.text(), {
      status: r.status,
      headers: { 'content-type': 'application/json' }
    });
  }

  if (request.method === 'POST') {
    let body;
    try { body = await request.json(); }
    catch { return new Response(JSON.stringify({ ok: false, error: 'invalid json' }), { status: 400 }); }
    body.key = env.VIDA_KEY;
    const r = await fetch(upstream.toString(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      redirect: 'follow'
    });
    return new Response(await r.text(), {
      status: r.status,
      headers: { 'content-type': 'application/json' }
    });
  }

  return new Response('method not allowed', { status: 405 });
}

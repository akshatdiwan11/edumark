/**
 * Cloudflare Pages Function: forwards every /api/* request (including the
 * realtime WebSocket) to the EduMark API on Render. Keeping the API behind the
 * site's own domain means auth cookies are first-party and work in every browser.
 *
 * Set API_ORIGIN in the Pages project settings, e.g. https://edumark-api.onrender.com
 */
interface Env {
  API_ORIGIN: string;
}

export const onRequest = async ({ request, env }: { request: Request; env: Env }) => {
  if (!env.API_ORIGIN) return new Response("API_ORIGIN is not configured", { status: 500 });
  const incoming = new URL(request.url);
  const target = new URL(incoming.pathname + incoming.search, env.API_ORIGIN);

  const headers = new Headers(request.headers);
  headers.delete("host");
  const ip = request.headers.get("cf-connecting-ip");
  if (ip) headers.set("x-forwarded-for", ip);
  headers.set("x-forwarded-proto", incoming.protocol.replace(":", ""));
  headers.set("x-forwarded-host", incoming.host);

  return fetch(new Request(target.toString(), { method: request.method, headers, body: request.body, redirect: "manual" }));
};

/**
 * Cloudflare Worker for the EduMark website.
 *
 * Serves the built web app from static assets and forwards every /api/*
 * request (including the realtime WebSocket) to the EduMark API on Render.
 * Keeping the API behind the site's own domain means login cookies are
 * first-party and work in every browser.
 */
interface Env {
  API_ORIGIN: string;
  ASSETS: { fetch: (request: Request) => Promise<Response> };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);

    const target = new URL(url.pathname + url.search, env.API_ORIGIN);
    const headers = new Headers(request.headers);
    headers.delete("host");
    const ip = request.headers.get("cf-connecting-ip");
    if (ip) headers.set("x-forwarded-for", ip);
    headers.set("x-forwarded-proto", url.protocol.replace(":", ""));
    headers.set("x-forwarded-host", url.host);

    return fetch(target.toString(), { method: request.method, headers, body: request.body, redirect: "manual" });
  },
};

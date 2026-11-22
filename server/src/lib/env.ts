import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  // Comma-separated list of origins allowed to call the API directly (dev / non-proxied setups).
  CORS_ORIGINS: z.string().default("http://localhost:5173"),
  // Set to "none" when the web app and API live on different sites without a proxy.
  // How many proxies sit in front of the API (Render = 1, Cloudflare Pages proxy + Render = 2).
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(1),
  COOKIE_SAMESITE: z.enum(["lax", "strict", "none"]).default("lax"),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === "production";

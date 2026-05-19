import { z } from "zod";

const schema = z.object({
  VITE_CLERK_PUBLISHABLE_KEY: z.string().min(1),
  VITE_APP_URL: z.url().default("http://localhost:5173"),
  VITE_SUPPORT_EMAIL: z.email().default("support@outboundspotter.com"),
});

const parsed = schema.safeParse(import.meta.env);

if (!parsed.success) {
  console.error("Invalid environment variables:", z.treeifyError(parsed.error));
  throw new Error("Missing or invalid environment variables. See .env.local.example.");
}

export const env = parsed.data;

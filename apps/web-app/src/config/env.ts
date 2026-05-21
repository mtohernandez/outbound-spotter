import { z } from "zod";

const schema = z.object({
  VITE_API_URL: z.url().default("http://localhost:8000"),
  VITE_CLERK_PUBLISHABLE_KEY: z.string().min(1),
  VITE_AUTH_SIGN_IN_URL: z.url().default("http://localhost:5174/sign-in"),
  VITE_AUTH_SIGN_UP_URL: z.url().default("http://localhost:5174/sign-up"),
  // Own origin — Clerk satellite domains require the `domain` prop to point at
  // the satellite (this app). In dev the default matches the Vite port.
  VITE_APP_URL: z.url().default("http://localhost:5173"),
});

const parsed = schema.safeParse(import.meta.env);

if (!parsed.success) {
  console.error("Invalid environment variables:", z.treeifyError(parsed.error));
  throw new Error("Missing or invalid environment variables.");
}

export const env = parsed.data;

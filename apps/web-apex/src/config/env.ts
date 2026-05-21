import { z } from "zod";

const schema = z.object({
  VITE_CLERK_PUBLISHABLE_KEY: z.string().min(1),
  // Own deployed origin — Clerk satellite mode requires the `domain` prop.
  VITE_APEX_URL: z.url().default("http://localhost:5175"),
  // Where signed-in users land.
  VITE_APP_URL: z.url().default("http://localhost:5173"),
  // Where signed-out users go to authenticate.
  VITE_AUTH_SIGN_IN_URL: z.url().default("http://localhost:5174/sign-in"),
});

const parsed = schema.safeParse(import.meta.env);

if (!parsed.success) {
  console.error("Invalid environment variables:", z.treeifyError(parsed.error));
  throw new Error("Missing or invalid environment variables.");
}

export const env = parsed.data;

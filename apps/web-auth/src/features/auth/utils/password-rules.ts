import { z } from "zod";

export type PasswordScore = 0 | 1 | 2 | 3 | 4;

// Clerk enforces the same minimum length server-side; client-side preflight catches typos early.
export const MIN_PASSWORD_LENGTH = 10;
export const MIN_PASSWORD_SCORE: PasswordScore = 3;

export const emailSchema = z.email("Enter a valid email address.");

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required."),
});

export type SignInValues = z.infer<typeof signInSchema>;

export const signUpSchema = z.object({
  email: emailSchema,
  password: z
    .string()
    .min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters.`)
    .regex(/[a-z]/, "Include at least one lowercase letter.")
    .regex(/[A-Z]/, "Include at least one uppercase letter.")
    .regex(/[0-9]/, "Include at least one number."),
});

export type SignUpValues = z.infer<typeof signUpSchema>;

export const forgotPasswordEmailSchema = z.object({ email: emailSchema });
export const forgotPasswordResetSchema = z
  .object({
    password: z
      .string()
      .min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters.`),
    confirmPassword: z.string().min(1, "Confirm your new password."),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export type ForgotPasswordResetValues = z.infer<typeof forgotPasswordResetSchema>;

export const paths = {
  root: "/",
  signIn: "/sign-in/*",
  signUp: "/sign-up/*",
  ssoCallback: "/sso-callback",
  forgotPassword: "/forgot-password",
} as const;

export type AuthPath = (typeof paths)[keyof typeof paths];

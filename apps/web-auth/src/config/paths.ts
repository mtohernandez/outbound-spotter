export const paths = {
  signIn: "/sign-in/*",
  signUp: "/sign-up/*",
  ssoCallback: "/sso-callback",
} as const;

export type AuthPath = (typeof paths)[keyof typeof paths];

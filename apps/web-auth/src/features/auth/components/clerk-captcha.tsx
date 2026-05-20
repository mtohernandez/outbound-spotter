// Clerk's frontend SDK looks up "#clerk-captcha" when `signUp.create` runs and renders the
// Turnstile iframe into it if bot protection is enabled. The element must exist in the DOM before
// `create` is called; we render an empty placeholder div with the conventional id so Clerk owns it.
// https://clerk.com/docs/guides/secure/bot-protection
export function ClerkCaptcha(): React.ReactElement {
  return <div id="clerk-captcha" />;
}

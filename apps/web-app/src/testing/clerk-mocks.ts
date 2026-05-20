import { vi } from "vitest";

// Per spec-02 decision: @clerk/testing only covers Cypress/Playwright. Vitest
// gets hand-rolled vi.mock shims instead. Tests in this app call
// `mockClerk(...)` once at the top of the file (before component imports).

export interface ClerkMockOptions {
  readonly isLoaded?: boolean;
  readonly isSignedIn?: boolean;
  readonly userId?: string;
  readonly email?: string;
  readonly firstName?: string | null;
  readonly lastName?: string | null;
  readonly imageUrl?: string | null;
  readonly token?: string;
}

export function buildClerkMocks(options: ClerkMockOptions = {}): {
  useAuth: () => unknown;
  useUser: () => unknown;
  signOut: ReturnType<typeof vi.fn>;
} {
  const signOut = vi.fn(() => Promise.resolve());
  const auth = {
    isLoaded: options.isLoaded ?? true,
    isSignedIn: options.isSignedIn ?? true,
    userId: options.userId ?? "user_test_123",
    getToken: vi.fn(() => Promise.resolve(options.token ?? "test-token")),
    signOut,
  };
  const user = {
    user:
      options.isSignedIn === false
        ? null
        : {
            id: options.userId ?? "user_test_123",
            firstName: options.firstName ?? "Jane",
            lastName: options.lastName ?? "Driver",
            imageUrl: options.imageUrl ?? null,
            primaryEmailAddress: {
              emailAddress: options.email ?? "jane@example.com",
            },
          },
    isLoaded: options.isLoaded ?? true,
    isSignedIn: options.isSignedIn ?? true,
  };
  return {
    useAuth: () => auth,
    useUser: () => user,
    signOut,
  };
}

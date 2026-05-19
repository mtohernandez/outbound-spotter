import { http, HttpResponse } from "msw";

// Stub responses for Clerk's Frontend API endpoints touched by the auth flows.
// Reference: https://clerk.com/docs/reference/frontend-api
// Tests reprogram individual handlers via `server.use(...)` as needed.

const FAPI_BASE = "https://*.clerk.accounts.dev/v1";

interface ClientResponse {
  response: Record<string, unknown>;
  client: Record<string, unknown>;
}

function clientEnvelope(body: Record<string, unknown> = {}): ClientResponse {
  return {
    response: body,
    client: { sign_in: null, sign_up: null, sessions: [] },
  };
}

export const handlers = [
  http.post(`${FAPI_BASE}/client/sign_ins`, () =>
    HttpResponse.json(clientEnvelope({ status: "complete", created_session_id: "sess_mock" })),
  ),
  http.post(`${FAPI_BASE}/client/sign_ins/:id/attempt_first_factor`, () =>
    HttpResponse.json(clientEnvelope({ status: "needs_new_password" })),
  ),
  http.post(`${FAPI_BASE}/client/sign_ins/:id/reset_password`, () =>
    HttpResponse.json(clientEnvelope({ status: "complete", created_session_id: "sess_mock" })),
  ),
  http.post(`${FAPI_BASE}/client/sign_ups`, () =>
    HttpResponse.json(clientEnvelope({ status: "missing_requirements", created_session_id: null })),
  ),
  http.post(`${FAPI_BASE}/client/sign_ups/:id/prepare_verification`, () =>
    HttpResponse.json(clientEnvelope({})),
  ),
  http.post(`${FAPI_BASE}/client/sign_ups/:id/attempt_verification`, () =>
    HttpResponse.json(clientEnvelope({ status: "complete", created_session_id: "sess_mock" })),
  ),
];

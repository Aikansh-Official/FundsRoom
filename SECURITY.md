# FundsRoom security model

This document describes who can use each part of the portal and the controls that protect the API. The backend is the authority; hiding a button in the frontend is only a usability improvement and never replaces server-side authorization.

## Roles and permissions

| Capability | Admin | Sales | Warehouse | Accounts |
|---|---:|---:|---:|---:|
| Sign in and view dashboard, analytics, alerts | Yes | Yes | Yes | Yes |
| View and search customers | Yes | Yes | No | No |
| Create/update customers | Yes | Yes | No | No |
| Add follow-ups, queries, and reviews | Yes | Yes | No | No |
| View product catalogue and stock levels | Yes | Yes | Yes | No |
| Create/update products | Yes | No | Yes | No |
| Record stock movements | Yes | No | Yes | No |
| View challans | Yes | Yes | Yes | Yes |
| Create, confirm, or cancel challans | Yes | Yes | No | No |
| Download challan PDFs and sales CSV | Yes | Yes | No | Yes |
| Mark personal notifications read | Yes | Yes | Yes | Yes |

Every protected route runs authentication first and then checks the role required for that operation. A user cannot gain a role by changing browser storage or editing a request: the API validates the signed JWT and applies the role check again.

## Implemented controls

- Signed JWTs use an issuer, audience, and 12-hour expiry. Claims are checked for a valid user identity and known role before a request reaches a route.
- Login attempts are rate limited to 10 per 15 minutes per client address. The password check uses a dummy bcrypt hash for unknown users so email enumeration is harder through timing differences.
- The API has a broader 600-request/15-minute limiter, strict JSON size limits, Helmet security headers, exact-origin CORS, disabled `x-powered-by`, and `Cache-Control: no-store` responses.
- All SQL values are parameterized. The one dynamic analytics value is bounded by Zod before it is interpolated into SQL.
- Request bodies are validated with Zod, including bounded text lengths, enums, positive quantities, UUID product/customer IDs, and non-negative prices and stock.
- Challan confirmation uses database transactions and row locks so concurrent requests cannot oversell stock or confirm a challan twice.
- CSV exports neutralize spreadsheet formula prefixes (`=`, `+`, `-`, `@`, tabs, and carriage returns) before opening in Excel or similar tools.
- Notification read state is stored per user in `notification_reads`; one employee cannot clear another employee's inbox.
- React renders customer-entered text as escaped content. There is no raw HTML injection path in the UI.
- Production startup requires a database password, client origin, and a JWT secret of at least 32 characters.

## Production requirements

1. Serve the frontend and API only over HTTPS. Set `CLIENT_ORIGIN` to the exact HTTPS frontend origin; never use `*`.
2. Use a dedicated MySQL application account with only the database privileges required by this service. Do not run production with `root`.
3. Replace all seeded demo passwords and remove the demo-password hint from the login screen before inviting real users.
4. Put rate limiting behind a shared store (Redis or the platform equivalent) when running more than one API instance. The built-in limiter is process-local.
5. Prefer an HttpOnly, Secure, SameSite session cookie for a public deployment. The current assignment build uses a bearer token held by the browser so the local frontend can call the API directly.
6. Keep `.env`, database dumps, generated PDFs, and logs outside version control. Rotate the JWT secret if it is ever exposed; rotation invalidates existing tokens.
7. Add centralized audit logging and alerting for sign-ins, permission failures, stock changes, challan confirmation/cancellation, and exports.

## Security verification commands

```powershell
cd backend
npm audit --audit-level=high
npm run typecheck

cd ..\frontend
npm run build
```

The role matrix should also be exercised with one token for each demo account. A denied operation must return `403`, while an expired, malformed, or issuer/audience-mismatched token must return `401`.

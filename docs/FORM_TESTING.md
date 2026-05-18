# Form Module Test Record

## Automated Coverage

- Unauthenticated access to `/dashboard/forms` redirects to login.
- Authenticated user can create a form from the dashboard.
- Builder can configure text, email, and select fields.
- Builder preview renders configured fields.
- Published form appears in the forms table with published status.
- Published forms expose a same-tab fill link from the forms table and edit screen.
- Public form accepts a valid submission.
- Submitted responses are visible from the dashboard responses page.
- Required validation blocks empty UI and API submissions.

## Commands

```bash
npm run lint
npm run typecheck
npm run test:e2e
```

## Notes

- Tests create isolated users and forms with unique emails/names.
- The E2E suite expects a working `DATABASE_URL` and initialized schema.
- Playwright runs the app on port `3210` and clears `.next` first so it does not interfere with a developer server on `3000`.

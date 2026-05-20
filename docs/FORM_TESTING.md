# Form Module Test Record

## Automated Coverage

- Unauthenticated access to `/studio/interfaces/forms` redirects to login.
- Authenticated user can create a form from Studio.
- Builder can configure text, email, and select fields.
- Builder preview renders configured fields.
- Published form appears in the forms table with published status.
- Published forms expose a same-tab fill link from the forms table and edit screen.
- Public form accepts a valid submission.
- Submitted responses are visible from the Studio responses page.
- Submitted responses also create entity records that are visible in Data Studio.
- Required validation blocks empty UI and API submissions.
- Existing Entity fields can be imported into a Form, published, submitted, and stored back as Entity Record data.

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

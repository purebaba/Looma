# Form Module Test Record

## Automated Coverage

- Unauthenticated access to `/studio/interfaces/forms` redirects to login.
- Authenticated user can create a form from Studio.
- Builder can configure text, email, and select fields.
- Builder shows whether each field is bound to an existing Entity Field or will create/sync a new Entity Field.
- Builder can configure conditional field visibility, and public submissions skip hidden required fields.
- Builder blocks publishing when checks find duplicate data keys, missing condition sources, invalid labels, or invalid option definitions.
- Builder supports structured option editing and field default values that carry through preview, public submission, and Entity Record data.
- Builder warns about data impact for bound/published fields and asks for confirmation before deleting fields that affect Entity Record semantics.
- Forms API preserves published field bindings when saving from stale schemas and rejects unsafe data key or Entity Field rebinding attempts.
- Form configuration shows draft-vs-published field diffs before publishing a new version.
- Builder preview renders configured fields.
- Published form appears in the forms table with published status.
- Published forms expose a same-tab fill link from the forms table and edit screen.
- Form detail pages expose the core operational tabs/links: Builder, Public form, Responses, Records, and Settings.
- Form publishing creates immutable version snapshots; public forms continue serving the last published version while a new draft is edited.
- Published version snapshots can be restored into a new draft and republished.
- Published forms return to draft with a new version when edited, can be republished, archived, restored, and deleted.
- Public forms can be paused with a closed message and can show configurable success copy after submission.
- Public forms can redirect submitters to a configured URL after a valid submission.
- Public submissions include a honeypot guard, per-form burst rate limiting, and visible submit error feedback.
- Public form accepts a valid submission.
- Authenticated users can reopen a Record through its source Form, edit existing values, update the same Entity Record, and create a new Submission audit event.
- Studio Record details show Record version history with changed field values after Form-driven updates.
- Submitted responses are visible from the Studio responses page.
- Submitted responses have a detail page with audit metadata, linked Entity Record navigation, and CSV export.
- Studio Entity Record details show linked source form submissions and can jump back to the response snapshot.
- Responses can be searched, filtered by field value, sorted, and exported with the active filters applied.
- Responses list, detail, and CSV export show submission snapshots using the form version that was active when each submission was created.
- Submitted responses also create entity records that are visible in Data Studio.
- Schema validation blocks empty required fields, invalid emails, and option values outside configured choices.
- Existing Entity fields can be imported into a Form, published, submitted, and stored back as Entity Record data.
- App Runtime lets an authenticated business user open an app, create a record, edit it, and see the updated record in the runtime list.
- Studio Table View configuration is saved and used by the App Runtime record list, including basic search behavior.
- App Runtime record lists support configured per-field filters from the Table View.
- Studio can create multiple Table Views for one Entity, and App Runtime users can switch between them.
- Studio Detail View configuration is saved and used by the App Runtime record detail page, including sections, labels, and editable fields.

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

# Takt 11.0

Existing Worker, D1 database, tenant IDs, languages and paid dates are preserved. The additive migration is `0011_takt_v11.sql`; the Worker also upgrades a version 9/10 database atomically on first use. No production fixture records are inserted.

## Verification

- `npm test`: 108 backend tests, including signed Telegram authentication, tenant ownership, role permissions, parallel reservations, status transitions, reminder dispatch, no-show suppression, retry/idempotency, migration, paid terms, quotas and configuration rollback.
- `npm run test:ui`: isolated DOM checks with the actual Worker/SQLite at 320, 390, 600, 768, 1024 and 1440 widths; client/specialist/admin navigation, month overflow, picker/Back, administrator forms and duplicate submission. DOM checks do not measure rendered geometry or emulate a hardware keyboard.
- `npm run check`: frontend and Worker syntax checks.

## Operational rules

OWNER is the existing ADMIN_ID (or first SUPERADMIN_IDS). SUPPORT can diagnose users/bookings, view support and delivery and retry a known temporary failure. FINANCE can manage subscriptions, tariffs/promos and export the permitted minimal data. CONTENT can manage FAQ, translations and document/message content. Global controls, administrator roles and rollback remain OWNER-only. Preview never gives an impersonation token or permission to mutate another tenant.

24-hour messages contain information only. The attendance question is sent once in the 2-hour event; an earlier answer converts that event into a normal reminder. Cancellation, completion, no-show and changed timestamps invalidate queued reminders immediately before delivery. No-show does not update a client Telegram message or request a review. Review invitations wait until the scheduled end of a completed visit.

Telegram does not offer an idempotency key for sendMessage. Known 429/5xx responses use bounded retries. An ambiguous send is marked unknown and is not automatically resent; an edit of an existing message can safely retry. The delivery screen makes this distinction visible.

Configuration is stored in D1 with an audit trail. Changing a tariff preserves existing paid dates and the paid period’s price/limits. Billing-month quotas use UTC creation dates; 0 means unlimited. Freezing pauses new reservations while retaining appointments/data and the remaining subscription time.

Promo redemption registers a discount quote and its usage limit. The existing payment URL is preserved; reduced-price purchases are handled through support until a payment-provider checkout/webhook can verify and apply the quote. No unverified payment grants access.

## Device verification remaining

Real Telegram WebViews on iPhone, Android phones and tablets must still be checked with the native keyboard, rotation and Telegram fullscreen controls. Automated DOM verification cannot establish those hardware behaviors. No real client messages or test bookings are created during verification.

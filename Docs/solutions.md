# Solutions - Chatin

- 2025-08-16: To avoid FK failures on message insert, API now upserts `users` for sender/receiver before inserting into `messages`.

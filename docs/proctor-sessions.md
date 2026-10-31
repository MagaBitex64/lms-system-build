# Proctor-session recovery (BUG-002)

The server issues a random 256-bit capability when an authenticated student
activates an owned attempt. Only its SHA-256 hash is stored. Answer writes and
proctor events require that capability and the matching per-page session ID.
The capability expires after 45 seconds without a valid heartbeat (15-second
client interval). Expired capabilities cannot renew themselves. Activation
rotates the capability and invalidates older tabs. Loss events revoke it.
Only activation and affirmative requirement heartbeats renew freshness.

The frontend keeps the capability in component memory, never browser storage.
Every mount/attempt change requires local screen/fullscreen readiness, plus
camera readiness when required. Loss pauses editing; accepted answers and the
server deadline remain unchanged. Reload/reconnect reactivates the same attempt.
Timeout finalization still grades previously accepted answers through the
existing server mechanism; media loss alone does not submit.

Deploy frontend/backend together after the additive, journaled migration in
`backend/scripts/proctor_migrations.py` via the established
`python -m scripts.init_db` entrypoint. No historical scores or answers are
rewritten. Existing in-progress attempts have no valid capability until the
student reloads/reactivates. Old frontend versions fail closed on writes.
No production migration or deployment was performed during implementation.

Limitations: neither a heartbeat nor an opaque capability proves that a browser
is genuinely capturing a screen. A malicious authenticated client can emulate
browser claims. This is freshness/authorization and UI recovery protection,
not hardware attestation. Abrupt disconnect revocation is bounded by the
45-second lease; timely media-loss events revoke earlier. Production HTTPS
remains necessary to protect bearer credentials in transit.

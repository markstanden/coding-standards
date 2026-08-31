<!-- defined:start -->

This project is gated by Mark's portable defined gate (`runtime/`).
House standards, tool pins and the decision log live in the gate's PLAN.md;
the canonical cross-project index is the coding-standards README. Run
`./runtime/verify.sh comply` to bootstrap, repair and verify; `./runtime/verify.sh verify`
for a read-only check; a missing ecosystem skips, a missing tool fails loudly.
<!-- defined:end -->

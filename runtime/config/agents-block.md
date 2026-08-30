<!-- defined:start -->

This project is gated by Mark's portable defined gate (`runtime/`).
House standards, tool pins and the decision log live in the gate's PLAN.md;
the canonical cross-project index is the coding-standards README. Run
`./runtime/verify.sh` to gate (add `--fix` to repair mechanically, `--silent`
for log-style output); a missing ecosystem skips, a missing tool fails loudly.
<!-- defined:end -->

// House Prettier config — travels inside runtime/config/, passed explicitly
// via --config so it applies regardless of CWD or target repo.
//
// Sole intentional override from Prettier defaults. Change here, then run
// the gate with --fix — keep .editorconfig indent_size and steps/shell.mts
// shfmt expectations in lockstep.
// Applies repo-wide (markdown, JSON/JSONC, YAML, CSS).
/** @type {import("prettier").Config} */
export default {
    tabWidth: 4,
};

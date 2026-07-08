# @q-peppa/pi-collapse-tools

> A [Pi](https://github.com/earendil-works/pi-coding-agent) plugin that collapses built-in tool calls into a single compact row with an expand badge.

The npm package name is **`@q-peppa/pi-collapse-tools`** (scoped). The repo / directory is still `pi-collapse-tools`.

[![npm version](https://img.shields.io/npm/v/@q-peppa/pi-collapse-tools.svg)](https://www.npmjs.com/package/@q-peppa/pi-collapse-tools)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

`@q-peppa/pi-collapse-tools` overrides the default renderers for the seven built-in Pi
tools — `bash`, `read`, `edit`, `write`, `grep`, `find`, and `ls` — so each
tool call occupies a **single line** while collapsed. A status indicator
(`ok`, `+N -N`, `N matches`, `N files`, …) is shown inline, and a `[> Ctrl+O]`
badge lets you expand the block to inspect the full output on demand.

Compact by default, expandable when you need the detail.

---

## Features

- **Single-row collapsed view** for every built-in tool — no more multi-line
  output flooding your transcript until you ask for it.
- **Inline status badges** that update live:
  - `bash` → `ok` / `exit <code>`
  - `edit` → `+N -N` (added / removed lines) or `fail`
  - `write` → `ok`
  - `read` → `NL` / `image`
  - `grep` → `N matches` / `0 matches`
  - `find` → `N files`
  - `ls` → `N entries`
- **Expand on demand** — press <kbd>Ctrl+O</kbd> (or the key mapped to
  `app.tools.expand`) to toggle the full output for any tool call.
- **Zero-config** — register the plugin and it transparently replaces the
  built-in tool renderers. No arguments, no options.

## Installation

```bash
npm install @q-peppa/pi-collapse-tools
```

Pi auto-discovers plugins installed under `node_modules`, so adding the
package to the same workspace as your Pi agent is enough. You can also load it
explicitly in your Pi config:

```jsonc
{
  "plugins": ["@q-peppa/pi-collapse-tools"]
}
```

## Usage

```ts
// entry point (e.g. pi.config.ts or your custom agent build)
import collapseTools from "@q-peppa/pi-collapse-tools";

export default function (pi: ExtensionAPI) {
  collapseTools(pi);
  // ...your other registrations
}
```

Once registered, the built-in tools continue to work exactly as before — only
their rendering changes. Collapsed calls show a compact summary line; expanded
calls show the full output just like the default renderers.

### Keyboard shortcut

| Action       | Shortcut                         |
| ------------ | -------------------------------- |
| Expand / collapse | <kbd>Ctrl+O</kbd> (or `app.tools.expand`) |

## How it works

Each built-in tool (`createBashTool`, `createReadTool`, …) is re-registered
with custom `renderCall` / `renderResult` hooks:

1. **`renderCall`** writes a single-line summary (tool name + primary argument
   + live status + expand badge) into the reused `Text` component.
2. **`renderResult`** computes a short status string, triggers
   `context.invalidate()` only when the status actually changes, and returns
   an empty `Text` while collapsed (so the Box only shows the call line). When
   expanded, it returns the full output text.

Rendering still flows through the standard Pi tool `Box`, so padding,
background, and theming behave exactly like the default tools.

## Supported tools

| Tool   | Collapsed status     | Expanded content          |
| ------ | -------------------- | ------------------------ |
| `bash` | `ok` / `exit <code>` | full stdout/stderr       |
| `read` | `NL` / `image`       | file contents             |
| `edit` | `+N -N` / `fail`     | unified diff             |
| `write`| `ok`                 | written confirmation      |
| `grep` | `N matches`          | full match list           |
| `find` | `N files`            | full file list            |
| `ls`   | `N entries`          | full entry list           |

## Requirements

- Node.js ≥ 18
- [`@earendil-works/pi-coding-agent`](https://www.npmjs.com/package/@earendil-works/pi-coding-agent) `^0.80.0`
- [`@earendil-works/pi-tui`](https://www.npmjs.com/package/@earendil-works/pi-tui) `^0.80.0`

## License

[MIT](./LICENSE) © Q-Peppa
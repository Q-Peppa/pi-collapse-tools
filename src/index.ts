/**
 * pi-collapse-tools: collapse built-in tool output into a single line.
 *
 * - Respects pi's --tools / --no-tools / --no-builtin-tools flags.
 * - Reuses context.lastComponent (no unnecessary re-creation / flicker).
 * - Shows per-tool status badges (exit code, +N/-N diff, match count…).
 * - Delegates expanded view to the native renderer for full highlighting.
 * - Press the expand key (Ctrl+O by default) to view full output.
 */
import type { EditToolDetails, ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  createBashToolDefinition,
  createEditToolDefinition,
  createFindToolDefinition,
  createGrepToolDefinition,
  createLsToolDefinition,
  createReadToolDefinition,
  createWriteToolDefinition,
  keyHint,
} from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";

// ─── helpers ───────────────────────────────────────────────────

function expandBadge(expanded: boolean): string {
  return expanded ? " [v]" : ` [> ${keyHint("app.tools.expand", "expand")}]`;
}

function reuseText(context: any): Text {
  return (context.lastComponent as Text | undefined) ?? new Text("", 0, 0);
}

function countNonEmptyLines(text: string): number {
  let n = 0;
  for (const line of text.split("\n")) {
    if (line.trim().length > 0) n++;
  }
  return n;
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function title(name: string, theme: any): string {
  return theme.fg("toolTitle", theme.bold(name));
}

// ─── per-tool specs ────────────────────────────────────────────

interface ToolSpec {
  /** Format the call line (title + params). Status and badge are added by the wrapper. */
  callFmt: (args: any, theme: any, context: any) => string;
  /** Compute the status badge from the final result. */
  statusFrom: (result: any, theme: any, context: any) => string;
  /** Fallback text when expanded and no native renderResult exists. */
  expandedFallback: (result: any) => string;
}

const SPECS: Record<string, ToolSpec> = {
  bash: {
    callFmt(args, theme, context) {
      const cmd =
        context.argsComplete && args.command ? truncate(args.command, 60) : "...";
      return `${title("bash", theme)} ${theme.fg("bashMode", args.command ? cmd : "...")}`;
    },
    statusFrom(result, theme) {
      const output = result.content?.[0]?.text ?? "";
      const m = output.match(/exit code: (\d+)/);
      return m ? theme.fg("error", `exit ${m[1]}`) : theme.fg("success", "ok");
    },
    expandedFallback: (r) => r.content?.[0]?.text ?? "",
  },

  read: {
    callFmt(args, theme) {
      let s = `${title("read", theme)} ${theme.fg("accent", args.path || "...")}`;
      if (args.offset) s += theme.fg("dim", ` @L${args.offset}`);
      return s;
    },
    statusFrom(result, theme, context) {
      if (context.isError) return theme.fg("error", "error");
      const c = result.content?.[0];
      if (c?.type === "image") return theme.fg("dim", "image");
      if (c?.type === "text") return theme.fg("dim", `${c.text.split("\n").length}L`);
      return "";
    },
    expandedFallback: (r) => r.content?.[0]?.text ?? "",
  },

  edit: {
    callFmt(args, theme) {
      return `${title("edit", theme)} ${theme.fg("accent", args.path || "...")}`;
    },
    statusFrom(result, theme) {
      const c = result.content?.[0];
      if (c?.type === "text" && c.text.startsWith("Error")) {
        return theme.fg("error", "fail");
      }
      const details = result.details as EditToolDetails | undefined;
      const lines = details?.diff?.split("\n") ?? [];
      let adds = 0,
        dels = 0;
      for (const l of lines) {
        if (l.startsWith("+") && !l.startsWith("+++")) adds++;
        if (l.startsWith("-") && !l.startsWith("---")) dels++;
      }
      return `${theme.fg("success", `+${adds}`)} ${theme.fg("error", `-${dels}`)}`;
    },
    expandedFallback: (r) =>
      (r.details as EditToolDetails | undefined)?.diff ?? "Applied",
  },

  write: {
    callFmt(args, theme) {
      const n = args.content ? args.content.split("\n").length : 0;
      return `${title("write", theme)} ${theme.fg("accent", args.path || "...")}${theme.fg("dim", ` (${n}L)`)}`;
    },
    statusFrom(_r, theme, context) {
      return context.isError
        ? theme.fg("error", "error")
        : theme.fg("success", "ok");
    },
    expandedFallback: (r) => r.content?.[0]?.text ?? "Written",
  },

  grep: {
    callFmt(args, theme) {
      let s = `${title("grep", theme)} ${theme.fg("accent", args.pattern || "...")}`;
      if (args.path) s += ` ${theme.fg("muted", args.path)}`;
      return s;
    },
    statusFrom(result, theme, context) {
      if (context.isError) return theme.fg("error", "error");
      const output = result.content?.[0]?.text ?? "";
      const n = countNonEmptyLines(output);
      return theme.fg("dim", n === 0 ? "0 matches" : `${n} matches`);
    },
    expandedFallback: (r) => r.content?.[0]?.text ?? "",
  },

  find: {
    callFmt(args, theme) {
      let s = `${title("find", theme)} ${theme.fg("accent", args.pattern || "...")}`;
      if (args.path) s += ` ${theme.fg("muted", args.path)}`;
      return s;
    },
    statusFrom(result, theme, context) {
      if (context.isError) return theme.fg("error", "error");
      const output = result.content?.[0]?.text ?? "";
      return theme.fg("dim", `${countNonEmptyLines(output)} files`);
    },
    expandedFallback: (r) => r.content?.[0]?.text ?? "",
  },

  ls: {
    callFmt(args, theme) {
      return `${title("ls", theme)} ${theme.fg("accent", args.path || ".")}`;
    },
    statusFrom(result, theme, context) {
      if (context.isError) return theme.fg("error", "error");
      const output = result.content?.[0]?.text ?? "";
      return theme.fg("dim", `${countNonEmptyLines(output)} entries`);
    },
    expandedFallback: (r) => r.content?.[0]?.text ?? "",
  },
};

// ─── factory: wrap a built-in tool with collapse + status ──────

function wrapTool(origTool: any, spec: ToolSpec): any {
  return {
    ...origTool,
    renderCall(args: any, theme: any, context: any) {
      const text = reuseText(context);
      let content = spec.callFmt(args, theme, context);
      if (context.state._status) content += "  " + context.state._status;
      content += theme.fg("dim", expandBadge(context.expanded));
      text.setText(content);
      return text;
    },
    renderResult(result: any, options: any, theme: any, context: any) {
      const { expanded, isPartial } = options;

      // Update status badge only when result is final (avoid flicker on partials)
      if (!isPartial) {
        const newStatus = spec.statusFrom(result, theme, context);
        if (context.state._status !== newStatus) {
          context.state._status = newStatus;
          context.invalidate();
        }
      }

      const text = reuseText(context);

      // Collapsed: single-line, no output
      if (!expanded) {
        text.setText("");
        return text;
      }

      // Expanded: delegate to native renderer for full highlighting
      if (origTool.renderResult) {
        return origTool.renderResult(result, options, theme, context);
      }

      // Fallback: raw text
      text.setText(spec.expandedFallback(result));
      return text;
    },
  };
}

// ─── tool selection (mirrors pi's --tools / --no-tools semantics) ──

type BuiltInToolName = "read" | "bash" | "edit" | "write" | "grep" | "find" | "ls";
const VALID_TOOLS: BuiltInToolName[] = [
  "read",
  "bash",
  "edit",
  "write",
  "grep",
  "find",
  "ls",
];
const VALID_SET: Set<string> = new Set(VALID_TOOLS);
const DEFAULT_TOOLS: BuiltInToolName[] = ["read", "bash", "edit", "write"];

function parseToolSelection(argv: string[]): {
  noTools: boolean;
  noBuiltinTools: boolean;
  tools?: BuiltInToolName[];
} {
  let noTools = false;
  let noBuiltinTools = false;
  let raw: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--no-tools" || a === "-nt") {
      noTools = true;
      continue;
    }
    if (a === "--no-builtin-tools" || a === "-nbt") {
      noBuiltinTools = true;
      continue;
    }
    if ((a === "--tools" || a === "-t") && i + 1 < argv.length) {
      raw = argv[++i];
      continue;
    }
    if (a.startsWith("--tools=")) {
      raw = a.slice(8);
      continue;
    }
    if (a.startsWith("-t=")) {
      raw = a.slice(3);
      continue;
    }
  }

  if (!raw) return { noTools, noBuiltinTools, tools: undefined };

  const seen = new Set<string>();
  const tools: BuiltInToolName[] = [];
  for (const s of raw.split(",").map((s) => s.trim())) {
    if (s && VALID_SET.has(s) && !seen.has(s)) {
      seen.add(s);
      tools.push(s as BuiltInToolName);
    }
  }
  return { noTools, noBuiltinTools, tools };
}

function getToolsToOverride(): BuiltInToolName[] {
  const { noTools, noBuiltinTools, tools } = parseToolSelection(
    process.argv.slice(2),
  );
  if (noTools || noBuiltinTools) return tools ?? [];
  return tools ?? DEFAULT_TOOLS;
}

// ─── entry point ───────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
  const cwd = process.cwd();
  const factories: Record<BuiltInToolName, () => any> = {
    read: () => createReadToolDefinition(cwd),
    bash: () => createBashToolDefinition(cwd),
    write: () => createWriteToolDefinition(cwd),
    edit: () => createEditToolDefinition(cwd),
    grep: () => createGrepToolDefinition(cwd),
    find: () => createFindToolDefinition(cwd),
    ls: () => createLsToolDefinition(cwd),
  };

  const names = getToolsToOverride();
  for (const name of names) {
    const orig = factories[name]();
    pi.registerTool(wrapTool(orig, SPECS[name]));
  }

  pi.on("session_start", async (_event, ctx) => {
    const wrapped = names.length > 0 ? names.join(", ") : "none";
    ctx.ui.notify(
      `Collapse Tools: output hidden (${keyHint("app.tools.expand", "expand")} to expand) • wrapped: ${wrapped}`,
      "info",
    );
  });
}

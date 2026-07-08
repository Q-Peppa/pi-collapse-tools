/**
 * pi-collapse-tools: compact single-line output for all built-in tools.
 * Press Ctrl+O to expand a block.
 *
 * Rendering follows the default Box shell (no `renderShell: "self"`), so the
 * standard tool Box handles padding (paddingX=1, paddingY=1) and background
 * (toolPendingBg / toolSuccessBg / toolErrorBg). Each slot returns a `Text`
 * component, reused via `context.lastComponent`.
 */
import type {
  EditToolDetails,
  ExtensionAPI,
} from "@earendil-works/pi-coding-agent";
import {
  createBashTool,
  createEditTool,
  createFindTool,
  createGrepTool,
  createLsTool,
  createReadTool,
  createWriteTool,
  keyHint,
} from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";

function expandBadge(expanded: boolean): string {
  return expanded
    ? " [v]"
    : ` [> ${keyHint("app.tools.expand", "expand")}]`;
}

// Reused empty Text for collapsed result slots. Returns no lines so the Box
// only shows the call line, keeping the collapsed view a single row.
function emptyText(context: any): Text {
  return (context.lastComponent as Text | undefined) ?? new Text("", 0, 0);
}

export default function (pi: ExtensionAPI) {
  const cwd = process.cwd();

  // ── bash ──
  const origBash = createBashTool(cwd);
  pi.registerTool({
    ...origBash,
    renderCall(args, theme, context) {
      const text = (context.lastComponent as Text | undefined) ?? new Text("", 0, 0);
      const cmd =
        context.argsComplete && args.command
          ? args.command.length > 60
            ? `${args.command.slice(0, 57)}...`
            : args.command
          : "...";
      let content =
        theme.fg("toolTitle", theme.bold("bash")) +
        " " +
        theme.fg("bashMode", args.command ? cmd : "...");
      if (context.state._status) content += "  " + context.state._status;
      content += theme.fg("dim", expandBadge(context.expanded));
      text.setText(content);
      return text;
    },
    renderResult(result, { expanded }, theme, context) {
      const content = result.content[0];
      const output = content?.type === "text" ? content.text : "";
      const exitMatch = output.match(/exit code: (\d+)/);
      const ok = !exitMatch || exitMatch[1] === "0";
      const newStatus = ok
        ? theme.fg("success", "ok")
        : theme.fg("error", `exit ${exitMatch![1]}`);

      if (context.state._status !== newStatus) {
        context.state._status = newStatus;
        context.invalidate();
      }

      const text = emptyText(context);
      if (!expanded) {
        text.setText("");
        return text;
      }
      text.setText(output);
      return text;
    },
  });

  // ── read ──
  const origRead = createReadTool(cwd);
  pi.registerTool({
    ...origRead,
    renderCall(args, theme, context) {
      const text = (context.lastComponent as Text | undefined) ?? new Text("", 0, 0);
      let content =
        theme.fg("toolTitle", theme.bold("read")) +
        " " +
        theme.fg("accent", args.path || "...");
      if (args.offset) content += theme.fg("dim", ` @L${args.offset}`);
      if (context.state._status) content += "  " + context.state._status;
      content += theme.fg("dim", expandBadge(context.expanded));
      text.setText(content);
      return text;
    },
    renderResult(result, { expanded }, theme, context) {
      const content = result.content[0];
      let newStatus: string;
      if (content?.type === "image") {
        newStatus = theme.fg("dim", "image");
      } else if (content?.type === "text") {
        newStatus = theme.fg("dim", `${content.text.split("\n").length}L`);
      } else {
        newStatus = "";
      }

      if (context.state._status !== newStatus) {
        context.state._status = newStatus;
        context.invalidate();
      }

      const text = emptyText(context);
      if (!expanded || content?.type !== "text") {
        text.setText("");
        return text;
      }
      text.setText(content.text);
      return text;
    },
  });

  // ── edit ──
  const origEdit = createEditTool(cwd);
  pi.registerTool({
    ...origEdit,
    renderCall(args, theme, context) {
      const text = (context.lastComponent as Text | undefined) ?? new Text("", 0, 0);
      let content =
        theme.fg("toolTitle", theme.bold("edit")) +
        " " +
        theme.fg("accent", args.path || "...");
      if (context.state._status) content += "  " + context.state._status;
      content += theme.fg("dim", expandBadge(context.expanded));
      text.setText(content);
      return text;
    },
    renderResult(result, { expanded }, theme, context) {
      const content = result.content[0];
      let newStatus: string;

      if (content?.type === "text" && content.text.startsWith("Error")) {
        newStatus = theme.fg("error", "fail");
      } else {
        const details = result.details as EditToolDetails | undefined;
        const diffLines = details?.diff?.split("\n") ?? [];
        let adds = 0, dels = 0;
        for (const l of diffLines) {
          if (l.startsWith("+") && !l.startsWith("+++")) adds++;
          if (l.startsWith("-") && !l.startsWith("---")) dels++;
        }
        newStatus = `${theme.fg("success", `+${adds}`)} ${theme.fg("error", `-${dels}`)}`;
      }

      if (context.state._status !== newStatus) {
        context.state._status = newStatus;
        context.invalidate();
      }

      const text = emptyText(context);
      if (!expanded) {
        text.setText("");
        return text;
      }
      const details = result.details as EditToolDetails | undefined;
      text.setText(details?.diff ?? "Applied");
      return text;
    },
  });

  // ── write ──
  const origWrite = createWriteTool(cwd);
  pi.registerTool({
    ...origWrite,
    renderCall(args, theme, context) {
      const text = (context.lastComponent as Text | undefined) ?? new Text("", 0, 0);
      const n = args.content ? args.content.split("\n").length : 0;
      let content =
        theme.fg("toolTitle", theme.bold("write")) +
        " " +
        theme.fg("accent", args.path || "...") +
        theme.fg("dim", ` (${n}L)`);
      if (context.state._status) content += "  " + context.state._status;
      content += theme.fg("dim", expandBadge(context.expanded));
      text.setText(content);
      return text;
    },
    renderResult(result, { expanded }, theme, context) {
      const newStatus = theme.fg("success", "ok");

      if (context.state._status !== newStatus) {
        context.state._status = newStatus;
        context.invalidate();
      }

      const text = emptyText(context);
      if (!expanded) {
        text.setText("");
        return text;
      }
      const content = result.content[0];
      text.setText(content?.type === "text" ? content.text : "Written");
      return text;
    },
  });

  // ── grep ──
  const origGrep = createGrepTool(cwd);
  pi.registerTool({
    ...origGrep,
    renderCall(args, theme, context) {
      const text = (context.lastComponent as Text | undefined) ?? new Text("", 0, 0);
      let content =
        theme.fg("toolTitle", theme.bold("grep")) +
        " " +
        theme.fg("accent", args.pattern || "...");
      if (context.state._status) content += "  " + context.state._status;
      content += theme.fg("dim", expandBadge(context.expanded));
      text.setText(content);
      return text;
    },
    renderResult(result, { expanded }, theme, context) {
      const content = result.content[0];
      const output = content?.type === "text" ? content.text : "";
      const matchCount = output.split("\n").filter((l) => l.trim()).length;
      const newStatus = theme.fg(
        "dim",
        !output.trim() ? "0 matches" : `${matchCount} matches`,
      );

      if (context.state._status !== newStatus) {
        context.state._status = newStatus;
        context.invalidate();
      }

      const text = emptyText(context);
      if (!expanded) {
        text.setText("");
        return text;
      }
      text.setText(output);
      return text;
    },
  });

  // ── find ──
  const origFind = createFindTool(cwd);
  pi.registerTool({
    ...origFind,
    renderCall(args, theme, context) {
      const text = (context.lastComponent as Text | undefined) ?? new Text("", 0, 0);
      let content =
        theme.fg("toolTitle", theme.bold("find")) +
        " " +
        (args.path || "...");
      if (context.state._status) content += "  " + context.state._status;
      content += theme.fg("dim", expandBadge(context.expanded));
      text.setText(content);
      return text;
    },
    renderResult(result, { expanded }, theme, context) {
      const content = result.content[0];
      const output = content?.type === "text" ? content.text : "";
      const fileCount = output.split("\n").filter((l) => l.trim()).length;
      const newStatus = theme.fg("dim", `${fileCount} files`);

      if (context.state._status !== newStatus) {
        context.state._status = newStatus;
        context.invalidate();
      }

      const text = emptyText(context);
      if (!expanded) {
        text.setText("");
        return text;
      }
      text.setText(output);
      return text;
    },
  });

  // ── ls ──
  const origLs = createLsTool(cwd);
  pi.registerTool({
    ...origLs,
    renderCall(args, theme, context) {
      const text = (context.lastComponent as Text | undefined) ?? new Text("", 0, 0);
      let content =
        theme.fg("toolTitle", theme.bold("ls")) +
        " " +
        (args.path || "...");
      if (context.state._status) content += "  " + context.state._status;
      content += theme.fg("dim", expandBadge(context.expanded));
      text.setText(content);
      return text;
    },
    renderResult(result, { expanded }, theme, context) {
      const content = result.content[0];
      const output = content?.type === "text" ? content.text : "";
      const entryCount = output.split("\n").filter((l) => l.trim()).length;
      const newStatus = theme.fg("dim", `${entryCount} entries`);

      if (context.state._status !== newStatus) {
        context.state._status = newStatus;
        context.invalidate();
      }

      const text = emptyText(context);
      if (!expanded) {
        text.setText("");
        return text;
      }
      text.setText(output);
      return text;
    },
  });
}

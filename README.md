# gstack-browse

**The browser tool that Claude Code deserves.** Persistent headless Chromium daemon with ~100ms commands. No MCP. No Chrome extension. No bullshit.

Created by [Garry Tan](https://x.com/garrytan), President & CEO of [Y Combinator](https://www.ycombinator.com/).

## The Problem

Claude Code needs to browse the web. Check a deployment. Verify a UI change. Read documentation. Fill out a form. Take a screenshot. Simple stuff.

The existing solutions are all terrible:

### Why Chrome MCP sucks

Chrome MCP (the "Claude in Chrome" integration) is the default browser tool in Claude Code. It is painfully slow and unreliable. Every tool call dumps a massive JSON schema into your context window. The Chrome extension loses connection randomly. Screenshots take 5+ seconds. Multi-step flows fail halfway through because the WebSocket dropped. Half the time it can't even find the tab you're looking at. And every single call bloats your context with MCP protocol overhead that has nothing to do with your actual task.

If you've used it, you know. It's the tool you learn to avoid.

### Why Playwright MCP sucks

Playwright MCP wraps Playwright in an MCP server. Sounds reasonable until you actually use it. It inherits all of MCP's problems: connection management, JSON-RPC overhead, schema bloat in context. The server process is fragile. Reconnection logic is flaky. And because it's MCP, every single browser action costs you context window tokens for protocol framing that adds zero value. You're burning your most precious resource (context) on transport protocol garbage instead of actual work.

### Why MCP itself is the problem

MCP (Model Context Protocol) is a well-intentioned standard that adds a layer of complexity between the AI and the tool. For browser automation, that layer is pure overhead:

- **Context bloat**: Every MCP tool call includes full JSON schemas, capability declarations, and protocol framing. A simple "get the page text" costs 10x more context tokens than it should.
- **Connection fragility**: MCP uses persistent connections (WebSocket/stdio). Connections drop. Reconnection is unreliable. Your multi-step browser flow dies at step 4 of 7.
- **Cold start tax**: MCP servers need to handshake, declare capabilities, and negotiate. This happens every session.
- **Unnecessary abstraction**: The AI agent is *already running in a shell*. It can already call CLI tools via Bash. MCP adds a client-server protocol on top of... calling a local process. It's solving a problem that doesn't exist for local tools.

**The insight**: Claude Code already has `Bash`. A CLI tool that prints to stdout is the simplest, fastest, most reliable interface possible. No protocol overhead. No connection management. No schema bloat. Just input and output.

## The Solution

gstack-browse is a CLI that talks to a persistent local Chromium daemon via HTTP. That's it.

```
Claude Code ──Bash──> browse CLI ──HTTP──> Bun server ──Playwright──> Chromium
                         |                     |
                    compiled binary       persistent daemon
                     (~1ms startup)      (port 9400, auto-start,
                                          30 min idle shutdown)
```

**First call**: CLI auto-starts the Chromium daemon (~3 seconds). You never think about it.

**Every call after that**: ~100-200ms. The browser is already running. The page is already loaded. You're just querying it.

**No MCP**: Zero protocol overhead. Zero context bloat. The CLI prints plain text to stdout. Claude reads it. Done.

**No Chrome extension**: No permissions dialogs. No "extension not responding." No WebSocket reconnection prayer circles. The browser runs headless in a local process that you control.

**Crash recovery**: If Chromium crashes, the server exits. Next CLI call auto-starts a fresh one. No stale state. No zombie processes. No "have you tried restarting the extension?"

**Works with any agent**: Built for Claude Code, but any coding agent with shell access (Codex, Cursor, etc.) can call the CLI. It's just a binary that prints to stdout.

## What it can do

40+ commands covering everything Claude Code needs:

```bash
B=~/.claude/skills/gstack-browse/dist/browse

# Navigate and read pages
$B goto https://yourapp.com
$B text                              # cleaned page text (no scripts/styles)
$B html "main"                       # innerHTML of any element
$B links                             # all links as "text -> href"
$B forms                             # all forms + fields as structured JSON
$B accessibility                     # full ARIA tree

# Interact with pages
$B click "button.submit"
$B fill "#email" "test@test.com"
$B select "#country" "US"
$B type "search query"
$B press "Enter"
$B wait ".loaded"                    # wait for element (max 10s)

# Inspect everything
$B js "document.title"               # run any JavaScript
$B css "body" "font-family"          # computed CSS properties
$B attrs "nav"                       # element attributes as JSON
$B console                           # captured console.log/warn/error
$B network                           # every HTTP request with status/timing/size
$B cookies                           # all cookies as JSON
$B storage                           # localStorage + sessionStorage
$B perf                              # page load performance timings

# Visual verification
$B screenshot /tmp/page.png          # screenshot (Claude can read images)
$B responsive /tmp/layout            # 3 screenshots: mobile, tablet, desktop
$B pdf /tmp/page.pdf                 # save as PDF

# Compare pages
$B diff https://prod.app https://staging.app   # text diff between two URLs

# Multi-step flows (single call, no shell quoting hell)
echo '[
  ["goto", "https://app.com/login"],
  ["fill", "#email", "user@test.com"],
  ["fill", "#password", "secret"],
  ["click", "button[type=submit]"],
  ["wait", ".dashboard"],
  ["screenshot", "/tmp/logged-in.png"]
]' | $B chain

# Multi-tab browsing
$B newtab https://docs.example.com
$B tabs                              # list all tabs
$B tab 1                             # switch back to first tab

# Server management
$B status                            # health, uptime, tab count
$B stop                              # shut down (or just let it idle-timeout)
```

The browser **persists between calls**. Navigate once, then query as many times as you want. Cookies, tabs, localStorage all carry over. This is the killer feature MCP-based tools can't match — they either start fresh every call (slow) or maintain fragile persistent connections (unreliable).

## Install

Just clone it. Claude handles the rest on first use (installs dependencies, compiles the binary, ~10 seconds).

### Option A: Project-level (recommended for teams)

Run this from the root of your git project:

```bash
git submodule add https://github.com/garrytan/gstack-browse.git .claude/skills/gstack-browse
```

Commit the submodule. Everyone who clones your repo gets the browser.

**Worktrees**: New worktrees need `git submodule update --init .claude/skills/gstack-browse` to populate the directory. Claude's auto-setup handles this — it detects an empty submodule and runs the init for you.

### Option B: User-level (personal)

```bash
git clone https://github.com/garrytan/gstack-browse.git ~/.claude/skills/gstack-browse
```

Available across all your projects. No per-repo setup.

**Prerequisite**: [Bun](https://bun.sh/) v1.0+ (Claude will tell you if it's missing).

## Teach Claude to use it

Add this to your project's `CLAUDE.md`:

````markdown
## Browser Automation

Use gstack-browse for all web browsing. NEVER use `mcp__claude-in-chrome__*` tools.

```bash
B=~/.claude/skills/gstack-browse/dist/browse

$B goto <url>                    # navigate
$B text                          # read page
$B js "document.title"           # run JS
$B css "body" "font-family"      # check CSS
$B click "button.submit"         # interact
$B fill "#email" "test@test.com" # fill forms
$B screenshot /tmp/page.png      # visual check
$B console                       # debug console
$B network                       # debug network
```

Navigate once, then query many times — the browser persists between calls.
````

## Command Reference

| Category | Commands |
|----------|----------|
| Navigate | `goto <url>`, `back`, `forward`, `reload`, `url` |
| Read | `text`, `html [sel]`, `links`, `forms`, `accessibility` |
| Interact | `click <sel>`, `fill <sel> <val>`, `select <sel> <val>`, `hover <sel>`, `type <text>`, `press <key>`, `scroll [sel]`, `wait <sel>`, `viewport <WxH>` |
| Inspect | `js <expr>`, `eval <file>`, `css <sel> <prop>`, `attrs <sel>`, `console`, `network`, `cookies`, `storage`, `perf` |
| Visual | `screenshot [path]`, `pdf [path]`, `responsive [prefix]` |
| Compare | `diff <url1> <url2>` |
| Tabs | `tabs`, `tab <id>`, `newtab [url]`, `closetab [id]` |
| Multi-step | `chain` (reads JSON array from stdin) |
| Server | `status`, `stop`, `restart` |

## Architecture

- **Compiled CLI binary** (Bun `--compile`, ~58MB) — ~1ms startup, reads `/tmp/browse-server.json` for server port + auth token
- **Persistent Bun HTTP server** — launches headless Chromium via Playwright, listens on localhost:9400-9410
- **Bearer token auth** — random UUID per server session, stored in state file (chmod 600)
- **Console/network buffers** — all entries in memory, flushed to `/tmp/browse-*.log` every 1s
- **Auto-idle shutdown** — 30 minutes (configurable via `BROWSE_IDLE_TIMEOUT`)
- **Crash handling** — Chromium crash kills server, CLI auto-restarts on next command

## Development

```bash
bun install              # install dependencies
bun test                 # run 40 integration tests (~2s)
bun run dev <cmd>        # run CLI from source (no compile)
bun run build            # compile to dist/browse
```

## Performance comparison

| Tool | First call | Subsequent calls | Context overhead per call |
|------|-----------|-----------------|--------------------------|
| Chrome MCP | ~5s | ~2-5s | ~2000 tokens (schema + protocol) |
| Playwright MCP | ~3s | ~1-3s | ~1500 tokens (schema + protocol) |
| **gstack-browse** | **~3s** | **~100-200ms** | **0 tokens** (plain text stdout) |

The context overhead difference compounds fast. In a 20-command browser session, MCP tools burn 30,000-40,000 tokens on protocol framing alone. gstack-browse burns zero.

## License

MIT

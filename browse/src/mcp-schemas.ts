/**
 * Zod schemas for all browse commands exposed as MCP tools.
 *
 * Each schema maps to a browse daemon command. The MCP server uses these
 * to validate tool inputs and provide structured descriptions to AI agents.
 *
 * Generated from COMMAND_DESCRIPTIONS in commands.ts.
 * Keep in sync when commands are added/changed.
 */

import { z } from 'zod';
import { COMMAND_DESCRIPTIONS } from './commands';

// Helper: selector param (CSS selector or @ref)
const sel = z.string().describe('CSS selector or @ref from snapshot');

// ─── Navigation ────────────────────────────────────────────────
const goto = z.object({ url: z.string().describe('URL to navigate to') });
const back = z.object({});
const forward = z.object({});
const reload = z.object({});
const url = z.object({});

// ─── Reading ───────────────────────────────────────────────────
const text = z.object({});
const html = z.object({ selector: sel.optional().describe('Element selector (omit for full page)') });
const links = z.object({});
const forms = z.object({});
const accessibility = z.object({});

// ─── Inspection ────────────────────────────────────────────────
const js = z.object({ expr: z.string().describe('JavaScript expression to evaluate') });
const eval_ = z.object({ file: z.string().describe('Path to JS file (must be under /tmp or cwd)') });
const css = z.object({ selector: sel, property: z.string().describe('CSS property name') });
const attrs = z.object({ selector: sel });
const is_ = z.object({
  property: z.enum(['visible', 'hidden', 'enabled', 'disabled', 'checked', 'editable', 'focused']).describe('State property to check'),
  selector: sel,
});
const console_ = z.object({
  clear: z.boolean().optional().describe('Clear console buffer'),
  errors: z.boolean().optional().describe('Filter to error/warning only'),
});
const network = z.object({ clear: z.boolean().optional().describe('Clear network buffer') });
const dialog = z.object({ clear: z.boolean().optional().describe('Clear dialog buffer') });
const cookies = z.object({});
const storage = z.object({
  action: z.enum(['get', 'set']).optional().describe('get (default) or set a value'),
  key: z.string().optional().describe('Key to set (only with action=set)'),
  value: z.string().optional().describe('Value to set (only with action=set)'),
});
const perf = z.object({});

// ─── Interaction ───────────────────────────────────────────────
const click = z.object({ selector: sel });
const fill = z.object({ selector: sel, value: z.string().describe('Value to fill') });
const select = z.object({ selector: sel, value: z.string().describe('Option value, label, or visible text') });
const hover = z.object({ selector: sel });
const type = z.object({ text: z.string().describe('Text to type into focused element') });
const press = z.object({
  key: z.string().describe('Key to press: Enter, Tab, Escape, ArrowUp/Down/Left/Right, Backspace, Delete, Home, End, PageUp, PageDown, or modifiers like Shift+Enter'),
});
const scroll = z.object({ selector: sel.optional().describe('Element to scroll into view (omit for page bottom)') });
const wait = z.object({
  target: z.string().describe('CSS selector, --networkidle, or --load'),
});
const upload = z.object({
  selector: sel,
  files: z.array(z.string()).min(1).describe('File paths to upload'),
});
const viewport = z.object({ size: z.string().describe('Viewport size as WxH, e.g. 1280x720') });
const cookie = z.object({ name_value: z.string().describe('Cookie as name=value') });
const cookie_import = z.object({ json: z.string().describe('Path to JSON file with cookies') });
const cookie_import_browser = z.object({
  browser: z.string().optional().describe('Browser name (chrome, chromium, brave, edge)'),
  domain: z.string().optional().describe('Domain filter for direct import (--domain flag)'),
});
const header = z.object({ name_value: z.string().describe('Header as Name:Value') });
const useragent = z.object({ agent: z.string().describe('User agent string') });
const dialog_accept = z.object({ text: z.string().optional().describe('Response text for prompt dialogs') });
const dialog_dismiss = z.object({});

// ─── Visual ────────────────────────────────────────────────────
const screenshot = z.object({
  selector: sel.optional().describe('Element to crop to (CSS or @ref)'),
  path: z.string().optional().describe('Output file path'),
  viewport: z.boolean().optional().describe('Use viewport dimensions'),
  clip: z.string().optional().describe('Clip region as x,y,w,h'),
});
const pdf = z.object({ path: z.string().optional().describe('Output PDF path') });
const responsive = z.object({ prefix: z.string().optional().describe('Filename prefix') });
const diff = z.object({ url1: z.string().describe('First URL'), url2: z.string().describe('Second URL') });

// ─── Tabs ──────────────────────────────────────────────────────
const tabs = z.object({});
const tab = z.object({ id: z.string().describe('Tab ID to switch to') });
const newtab = z.object({ url: z.string().optional().describe('URL to open in new tab') });
const closetab = z.object({ id: z.string().optional().describe('Tab ID to close (omit for current)') });

// ─── Server ────────────────────────────────────────────────────
const status = z.object({});
const stop = z.object({});
const restart = z.object({});

// ─── Snapshot ──────────────────────────────────────────────────
const snapshot = z.object({
  interactive: z.boolean().optional().describe('-i: interactive elements only'),
  compact: z.boolean().optional().describe('-c: compact output'),
  depth: z.number().optional().describe('-d N: depth limit'),
  selector: sel.optional().describe('-s sel: scope to selector'),
  diff: z.boolean().optional().describe('-D: diff vs previous snapshot'),
  annotate: z.boolean().optional().describe('-a: annotated screenshot'),
  output: z.string().optional().describe('-o path: output file path'),
  cursor: z.boolean().optional().describe('-C: cursor-interactive @c refs'),
});

// ─── Chain ─────────────────────────────────────────────────────
const chain = z.object({
  commands: z.array(z.array(z.string())).describe('Array of [command, ...args] arrays to execute sequentially'),
});

// ─── Handoff / Resume ──────────────────────────────────────────
const handoff = z.object({ message: z.string().optional().describe('Message to display') });
const resume = z.object({});

// ─── Headed mode ───────────────────────────────────────────────
const connect = z.object({});
const disconnect = z.object({});
const focus = z.object({ selector: sel.optional().describe('Element to focus on') });

// ─── Inbox / Watch / State / Frame ─────────────────────────────
const inbox = z.object({ clear: z.boolean().optional().describe('Clear inbox') });
const watch = z.object({ stop: z.boolean().optional().describe('Stop watching') });
const state = z.object({
  action: z.enum(['save', 'load']).describe('save or load state'),
  name: z.string().describe('State name'),
});
const frame = z.object({
  target: z.string().describe('CSS selector, @ref, --name <name>, --url <pattern>, or "main"'),
});

// ─── Schema Registry ───────────────────────────────────────────
// Maps command name → { schema, description }
// This is the single source of truth for MCP tool registration.

export interface CommandSchema {
  schema: z.ZodTypeAny;
  description: string;
  // Map Zod schema fields to positional CLI args (in order)
  // e.g., ['url'] means the first arg is the url field
  argOrder: string[];
}

export const COMMAND_SCHEMAS: Record<string, CommandSchema> = {
  // Navigation
  goto:          { schema: goto, description: 'Navigate to URL', argOrder: ['url'] },
  back:          { schema: back, description: 'Go back in browser history', argOrder: [] },
  forward:       { schema: forward, description: 'Go forward in browser history', argOrder: [] },
  reload:        { schema: reload, description: 'Reload current page', argOrder: [] },
  url:           { schema: url, description: 'Print current URL', argOrder: [] },
  // Reading
  text:          { schema: text, description: 'Get cleaned page text content', argOrder: [] },
  html:          { schema: html, description: 'Get HTML of element or full page', argOrder: ['selector'] },
  links:         { schema: links, description: 'Get all links as "text -> href"', argOrder: [] },
  forms:         { schema: forms, description: 'Get form fields as JSON', argOrder: [] },
  accessibility: { schema: accessibility, description: 'Get full ARIA accessibility tree', argOrder: [] },
  // Inspection
  js:            { schema: js, description: 'Evaluate JavaScript expression and return result', argOrder: ['expr'] },
  eval:          { schema: eval_, description: 'Evaluate JavaScript from file', argOrder: ['file'] },
  css:           { schema: css, description: 'Get computed CSS property value', argOrder: ['selector', 'property'] },
  attrs:         { schema: attrs, description: 'Get element attributes as JSON', argOrder: ['selector'] },
  is:            { schema: is_, description: 'Check element state (visible/hidden/enabled/disabled/checked/editable/focused)', argOrder: ['property', 'selector'] },
  console:       { schema: console_, description: 'Get console messages', argOrder: [] },
  network:       { schema: network, description: 'Get network requests', argOrder: [] },
  dialog:        { schema: dialog, description: 'Get dialog messages', argOrder: [] },
  cookies:       { schema: cookies, description: 'Get all cookies as JSON', argOrder: [] },
  storage:       { schema: storage, description: 'Read or write localStorage/sessionStorage', argOrder: [] },
  perf:          { schema: perf, description: 'Get page load performance timings', argOrder: [] },
  // Interaction
  click:         { schema: click, description: 'Click an element', argOrder: ['selector'] },
  fill:          { schema: fill, description: 'Fill an input field with a value', argOrder: ['selector', 'value'] },
  select:        { schema: select, description: 'Select a dropdown option', argOrder: ['selector', 'value'] },
  hover:         { schema: hover, description: 'Hover over an element', argOrder: ['selector'] },
  type:          { schema: type, description: 'Type text into the focused element', argOrder: ['text'] },
  press:         { schema: press, description: 'Press a key (Enter, Tab, Escape, modifiers)', argOrder: ['key'] },
  scroll:        { schema: scroll, description: 'Scroll element into view or to page bottom', argOrder: ['selector'] },
  wait:          { schema: wait, description: 'Wait for element, network idle, or page load', argOrder: ['target'] },
  upload:        { schema: upload, description: 'Upload file(s) to a file input', argOrder: ['selector'] },
  viewport:      { schema: viewport, description: 'Set browser viewport size', argOrder: ['size'] },
  cookie:        { schema: cookie, description: 'Set a cookie on current page domain', argOrder: ['name_value'] },
  'cookie-import': { schema: cookie_import, description: 'Import cookies from JSON file', argOrder: ['json'] },
  'cookie-import-browser': { schema: cookie_import_browser, description: 'Import cookies from installed browser', argOrder: [] },
  header:        { schema: header, description: 'Set custom request header', argOrder: ['name_value'] },
  useragent:     { schema: useragent, description: 'Set user agent string', argOrder: ['agent'] },
  'dialog-accept': { schema: dialog_accept, description: 'Auto-accept next dialog', argOrder: ['text'] },
  'dialog-dismiss': { schema: dialog_dismiss, description: 'Auto-dismiss next dialog', argOrder: [] },
  // Visual
  screenshot:    { schema: screenshot, description: 'Take a screenshot', argOrder: [] },
  pdf:           { schema: pdf, description: 'Save page as PDF', argOrder: ['path'] },
  responsive:    { schema: responsive, description: 'Screenshots at mobile, tablet, desktop sizes', argOrder: ['prefix'] },
  diff:          { schema: diff, description: 'Visual text diff between two URLs', argOrder: ['url1', 'url2'] },
  // Tabs
  tabs:          { schema: tabs, description: 'List open browser tabs', argOrder: [] },
  tab:           { schema: tab, description: 'Switch to a browser tab', argOrder: ['id'] },
  newtab:        { schema: newtab, description: 'Open a new browser tab', argOrder: ['url'] },
  closetab:      { schema: closetab, description: 'Close a browser tab', argOrder: ['id'] },
  // Server
  status:        { schema: status, description: 'Get server health status', argOrder: [] },
  stop:          { schema: stop, description: 'Stop the browse server', argOrder: [] },
  restart:       { schema: restart, description: 'Restart the browse server', argOrder: [] },
  // Snapshot
  snapshot:      { schema: snapshot, description: 'Get accessibility tree with @e element refs for precise interaction', argOrder: [] },
  // Chain
  chain:         { schema: chain, description: 'Execute multiple commands sequentially', argOrder: [] },
  // Handoff
  handoff:       { schema: handoff, description: 'Open visible Chrome for user takeover', argOrder: ['message'] },
  resume:        { schema: resume, description: 'Resume AI control after user takeover', argOrder: [] },
  // Headed
  connect:       { schema: connect, description: 'Launch headed Chromium with Chrome extension', argOrder: [] },
  disconnect:    { schema: disconnect, description: 'Disconnect headed browser', argOrder: [] },
  focus:         { schema: focus, description: 'Bring headed browser to foreground', argOrder: ['selector'] },
  // Inbox / Watch / State / Frame
  inbox:         { schema: inbox, description: 'List messages from sidebar inbox', argOrder: [] },
  watch:         { schema: watch, description: 'Passive observation mode', argOrder: [] },
  state:         { schema: state, description: 'Save or load browser state (cookies + URLs)', argOrder: ['action', 'name'] },
  frame:         { schema: frame, description: 'Switch iframe context', argOrder: ['target'] },
};

// Validate that every command in COMMAND_DESCRIPTIONS has a schema
import { ALL_COMMANDS } from './commands';
const schemaKeys = new Set(Object.keys(COMMAND_SCHEMAS));
for (const cmd of ALL_COMMANDS) {
  if (!schemaKeys.has(cmd)) {
    throw new Error(`COMMAND_SCHEMAS missing entry for: ${cmd}`);
  }
}
for (const key of schemaKeys) {
  if (!ALL_COMMANDS.has(key)) {
    throw new Error(`COMMAND_SCHEMAS has unknown command: ${key}`);
  }
}

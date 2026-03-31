import { describe, it, expect, beforeAll } from 'bun:test';
import { COMMAND_SCHEMAS } from '../src/mcp-schemas';
import { ALL_COMMANDS } from '../src/commands';

// ─── MCP Schema validation ────────────────────────────────────────

describe('COMMAND_SCHEMAS', () => {
  it('has an entry for every command', () => {
    const schemaKeys = new Set(Object.keys(COMMAND_SCHEMAS));
    for (const cmd of ALL_COMMANDS) {
      expect(schemaKeys.has(cmd)).toBe(true);
    }
  });

  it('has no unknown commands', () => {
    for (const key of Object.keys(COMMAND_SCHEMAS)) {
      expect(ALL_COMMANDS.has(key)).toBe(true);
    }
  });

  it('every schema has a description', () => {
    for (const [cmd, entry] of Object.entries(COMMAND_SCHEMAS)) {
      expect(typeof entry.description).toBe('string');
      expect(entry.description.length).toBeGreaterThan(0);
    }
  });

  it('every schema has argOrder', () => {
    for (const [cmd, entry] of Object.entries(COMMAND_SCHEMAS)) {
      expect(Array.isArray(entry.argOrder)).toBe(true);
    }
  });

  it('goto schema parses url', () => {
    const result = COMMAND_SCHEMAS.goto.schema.safeParse({ url: 'https://example.com' });
    expect(result.success).toBe(true);
  });

  it('goto schema rejects missing url', () => {
    const result = COMMAND_SCHEMAS.goto.schema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('click schema parses selector', () => {
    const result = COMMAND_SCHEMAS.click.schema.safeParse({ selector: '@e1' });
    expect(result.success).toBe(true);
  });

  it('is schema validates property enum', () => {
    const result = COMMAND_SCHEMAS.is.schema.safeParse({ property: 'visible', selector: '@e1' });
    expect(result.success).toBe(true);
  });

  it('is schema rejects invalid property', () => {
    const result = COMMAND_SCHEMAS.is.schema.safeParse({ property: 'invalid', selector: '@e1' });
    expect(result.success).toBe(false);
  });

  it('viewport schema parses size', () => {
    const result = COMMAND_SCHEMAS.viewport.schema.safeParse({ size: '1280x720' });
    expect(result.success).toBe(true);
  });

  it('snapshot schema parses all flags', () => {
    const result = COMMAND_SCHEMAS.snapshot.schema.safeParse({
      interactive: true,
      compact: false,
      depth: 3,
      selector: '@e1',
      diff: true,
      annotate: false,
      output: '/tmp/snap.json',
      cursor: true,
    });
    expect(result.success).toBe(true);
  });

  it('chain schema parses command array', () => {
    const result = COMMAND_SCHEMAS.chain.schema.safeParse({
      commands: [['goto', 'https://example.com'], ['click', '@e1']],
    });
    expect(result.success).toBe(true);
  });

  // Spot-check that key commands all have valid schemas
  for (const cmd of ['text', 'links', 'forms', 'accessibility', 'screenshot', 'tabs', 'status']) {
    it(`${cmd} schema parses empty params`, () => {
      const result = COMMAND_SCHEMAS[cmd].schema.safeParse({});
      expect(result.success).toBe(true);
    });
  }
});

describe('mcp-server.ts exports', () => {
  it('can import mcp-server module', async () => {
    // Just verify it compiles — don't run main() since that starts the daemon
    const mod = await import('../src/mcp-server');
    expect(typeof mod.main).toBe('function');
  });
});

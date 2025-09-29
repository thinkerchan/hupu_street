# hupu_street

## Playwright MCP automated debugging

Use the Playwright MCP server to drive a real browser session against the local Vite app through an MCP-capable client (Copilot, Cursor, Claude Code, Windsurf, etc.). The repository ships with a ready-to-use server config and an npm script so you can wire it up without memorising the CLI flags.

### Prerequisites
- Node.js 18+
- Chrome / Chromium installed (Playwright defaults to Chromium; adjust the config if you prefer another engine)
- An MCP-compatible IDE or agent client (VS Code Copilot agents, Cursor, Claude Code, Codex CLI, etc.)

### Local setup
1. Install dependencies: `npm install`
2. Start the Vite development server: `npm run dev`
3. In the MCP client config, point the Playwright server at the provided config. Example VS Code `settings.json` snippet:

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": [
        "--yes",
        "@playwright/mcp@latest",
        "--config",
        "tools/playwright.mcp.config.json"
      ],
      "cwd": "${workspaceFolder}"
    }
  }
}
```

4. Use `npm run mcp:dev` to start both the Vite dev server and the Playwright MCP server in one terminal. If you prefer separate terminals, run `npm run dev` and `npm run mcp:debug` instead. Because the config binds the HTTP transport to `127.0.0.1:8940`, you can connect external MCP clients via `http://127.0.0.1:8940/mcp` if they support HTTP transport.
5. Each MCP session automatically records a Playwright trace (`--save-trace`) into `playwright-mcp-artifacts/`. Keep an eye on that folder if you want to replay runs later.
6. From your MCP client, open the app (default Vite dev server at `http://localhost:5173`) and drive automated debugging commands such as navigation, querying accessibility trees, filling forms, etc.

### Configuration details
- Config file: `tools/playwright.mcp.config.json`
  - Runs Chromium in headed mode at 1280×720 so you can watch the debugging session
  - Restricts network requests to the Vite dev server origin by default
  - Enables tab management and trace capture (`caps: ["tabs", "tracing"]`)
  - Stores traces and other artifacts under `playwright-mcp-artifacts/` (git-ignored)
- Adjust the config to add capabilities (`vision`, `pdf`), change viewport, make sessions headless, or allow additional origins as needed.

### Tips for automated debugging
- Use the `browser_install` MCP tool once if the client reports missing browser binaries.
- `browser_wait_for` and `browser_expect` are handy for step-by-step debugging of async UI flows.
- When you need a clean state between runs, switch the config to isolated mode by setting `"browser": { "isolated": true }` or by launching the server with the `--isolated` flag via your MCP client.
- Replay traces via `npx playwright show-trace playwright-mcp-artifacts/<trace file>` to inspect the exact actions captured by MCP.

Refer to the [Playwright MCP README](https://github.com/microsoft/playwright-mcp) for the full list of available tools and advanced deployment options (Docker, remote HTTP transport, persistent profiles, etc.).

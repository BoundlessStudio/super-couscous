# Super Couscous Weather MCP Server

This repository contains a minimal [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) server that exposes two tools backed by the US National Weather Service API:

- `get_alerts`: Lists active weather alerts for a given US state.
- `get_forecast`: Returns a short-term forecast for a latitude/longitude pair.

The server is implemented in TypeScript with the official Node MCP SDK and runs over stdio so it can be used from clients such as Claude for Desktop.

## Prerequisites

- Node.js 18 or newer
- `npm` (bundled with Node.js)

## Installation

Install dependencies and build the TypeScript project:

```bash
npm install
npm run build
```

## Running the server

After building, the compiled entry point lives in `build/index.js`. You can execute it directly with Node:

```bash
node build/index.js
```

Alternatively, run the package binary that is generated during the build step:

```bash
./build/index.js
```

## Configuring Claude for Desktop

Add the following entry to `claude_desktop_config.json`, adjusting the absolute path to this repository as needed:

```json
{
  "mcpServers": {
    "weather": {
      "command": "node",
      "args": [
        "/ABSOLUTE/PATH/TO/super-couscous/build/index.js"
      ]
    }
  }
}
```

Restart Claude for Desktop to pick up the new configuration. When the server is running you can issue queries such as:

- "What's the weather in Sacramento?"
- "What are the active weather alerts in Texas?"

## Development

The project uses TypeScript for type safety and Zod for tool input validation. Update the code in `src/index.ts` and run `npm run build` to regenerate the compiled output.

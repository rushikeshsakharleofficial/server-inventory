# Verifying an mcp-server connection over stdio

If you have shell access in the same environment as the user (not just a
Claude Desktop config you can't execute), the fastest real confirmation is
driving the MCP protocol directly rather than trusting that a config file
"looks right". A syntactically valid JSON config with a bad key or wrong
host will still fail — only an actual call proves anything.

The `mcp` Python package (same one `mcp-server/server.py` depends on)
includes a client you can drive from a throwaway script:

```python
import asyncio, os, sys
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

SERVER_SCRIPT = "/absolute/path/to/repo/mcp-server/server.py"

env = os.environ.copy()
env.update({
    "SERVER_INVENTORY_BASE_URL": "https://<host>:<port>",
    "SERVER_INVENTORY_API_KEY": "si_live_...",
    "SERVER_INVENTORY_VERIFY_SSL": "false",  # only for self-signed certs
})

async def main():
    params = StdioServerParameters(command=sys.executable, args=[SERVER_SCRIPT], env=env)
    async with stdio_client(params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            tools = await session.list_tools()
            print("registered:", [t.name for t in tools.tools])

            result = await session.call_tool("list_servers", {"limit": 3})
            text = "".join(c.text for c in result.content if hasattr(c, "text"))
            print("ERROR" if result.isError else "OK", text[:300])

asyncio.run(main())
```

What a healthy run looks like: `registered:` lists all 10 tool names, and
`list_servers` returns `OK` with a real JSON body (`total`, `items`, etc.) —
not an exception, not an empty `{}`.

## Never leave a real API key lying around after testing

If you created a throwaway key just to run this check (rather than using
the user's real one), revoke it when done:

```bash
curl -sk -X POST https://<host>:<port>/api/api-keys/<id>/revoke \
  -H "Authorization: Bearer <jwt>"
```

Don't write the raw `si_live_...` token to a file that outlives the check —
scratchpad files are fine mid-session, but delete them or let the session
directory's natural cleanup handle it. Never write a raw key into `~/.claude`
memory, a committed file, or anywhere durable. This is the same rule as any
other secret: shown once by design, treated as sensitive the whole time it
exists.

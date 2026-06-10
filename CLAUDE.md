## graphify

This project has a graphify knowledge graph at `graphify-out/graph.json`.

**Before answering codebase questions:**
- Check `graphify-out/GRAPH_REPORT.md` for god nodes, community structure, and surprising connections.
- Run `/graphify query "<question>"` to traverse the graph for specific questions about architecture, dependencies, or relationships.

**After code changes:**
- If files were added or modified, run `/graphify . --update` to keep the graph current.
- For code-only changes, AST extraction is automatic (no LLM cost).

**Useful commands:**
- `/graphify query "<question>"` — BFS traversal for broad context
- `/graphify query "<question>" --dfs` — DFS to trace a specific path
- `/graphify path "ModuleA" "ModuleB"` — shortest path between two concepts
- `/graphify explain "ConceptName"` — everything connected to a node
- `/graphify . --update` — incremental rebuild after changes

# RepoLens Roadmap

> **Positioning:** Understand any codebase in minutes, not days.

## Current State (v0.1.0) ✅
- ✅ Multi-language scanning (TS/JS, Python, Go, Rust, Java)
- ✅ Symbol extraction with comment capture (AST for TS/JS, regex for others)
- ✅ Import graph with package resolution
- ✅ Heuristic file scoring (import depth, git recency, proximity, test pairing)
- ✅ Content-level diff analysis
- ✅ JSON output for programmatic consumption
- ✅ Smart filtering (.gitignore, include/exclude, generated files)
- ✅ File caching with mtime invalidation
- ✅ 392 tests, CI pipeline
- ✅ npm publishing ready (bundled CLI, 98KB)
- ✅ Interactive web UI (static HTML, no server)
- ✅ GitHub Action for auto-generating architecture docs

## North Star
**Two surfaces, one product:**
1. **Interactive Explorer** — Web UI for navigating codebase architecture
2. **Living Docs** — GitHub Action that auto-generates and updates architecture docs

The context engine is internal infrastructure, not a product.

---

## Phase 1: Interactive Explorer (Weeks 1-3)

### Week 1: Web UI Foundation ✅
- [x] Static HTML web UI (no build step, no server)
- [x] Render import graph using vis.js
- [x] Wire up existing JSON output as data source
- [x] Basic navigation: click file → see imports, imported-by, symbols

### Week 2: Code Flow Tracing ✅
- [x] Click a symbol → see where it's referenced across files
- [x] Search bar: type "auth" → highlight auth-related files and symbols
- [x] Data flow visualization: trace from entry point → database
- [x] File content viewer with syntax highlighting
- [x] Symbol cross-referencing integration

### Week 3: Polish & Launch
- [x] Responsive design for mobile/tablet
- [ ] Dark mode toggle
- [x] Export architecture maps as PNG
- [ ] Deploy to Vercel/Netlify
- [ ] Landing page with demo video
- [ ] Launch on Hacker News / Product Hunt

---

## Phase 2: Living Docs (Weeks 4-5)

### Week 4: GitHub Action ✅
- [x] Create `apps/github-action/`
- [x] Scan repo on push, generate `ARCHITECTURE.json`
- [x] Compare with previous version, detect architectural changes
- [x] Post PR comment with: new deps, removed deps, modified flows
- [x] Support custom config via `.repolensrc.json`

### Week 5: Action Polish
- [ ] Action marketplace listing
- [ ] Configuration options (include/exclude, output format)
- [ ] Badge: "Architecture docs up-to-date"
- [ ] Integration with existing web UI (click badge → explore)

---

## Phase 3: AI Integration (Weeks 6-7)

### Week 6: AI-Powered Navigation
- [x] Per-file AI summaries via `--summarize` flag
- [ ] Natural language search: "How does auth work?" → trace flow
- [ ] Smart suggestions: "You're looking at auth, you might also need to see token validation"

### Week 7: AI Living Docs
- [ ] AI-generated architecture explanations in docs
- [ ] PR comments with AI analysis of architectural impact
- [ ] "What changed?" summaries for non-technical stakeholders

---

## Cut / Deprioritize

| Feature | Status | Reason |
|---------|--------|--------|
| `trace` CLI command | Deprecate | Replaced by interactive UI |
| AI summaries (CLI) | Deprecate | Moved to web UI |
| Token counting | Skip | Not needed for UI, bytes are fine for now |
| Code compression | Skip | Repomix's game, not our moat |
| Security scanning | Skip | Not our core value prop |
| Remote repo CLI | Skip | Web UI handles this better |
| Pack mode | Skip | Repomix owns this space |

---

## Success Metrics

| Metric | Target (3 months) |
|--------|------------------|
| GitHub stars | 1,000+ |
| Web UI users | 500+ monthly |
| GitHub Action installs | 200+ |
| Time to understand a new codebase | < 5 minutes (from hours) |

---

## Technical Architecture

```
┌─────────────────────────────────────────────────┐
│                  RepoLens Product               │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌──────────────┐    ┌───────────────────────┐  │
│  │  Web UI      │    │  GitHub Action        │  │
│  │  (Next.js)   │    │  (Node.js)            │  │
│  └──────┬───────┘    └───────────┬───────────┘  │
│         │                        │              │
│  ┌──────▼────────────────────────▼───────────┐  │
│  │         Context Engine (Internal)         │  │
│  │  - Scanner  - Symbol Extractor            │  │
│  │  - Import Graph - Diff Analyzer           │  │
│  │  - JSON Output - File Caching             │  │
│  └───────────────────────────────────────────┘  │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## Last Updated
May 17, 2026

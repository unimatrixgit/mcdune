# DUNE-016 / SF052 — beta contribution handoff

Confirmed Starfall beta push: `c4169b3d5697a1fdbec19c074537ba3d28ba52f9`, based on `f0752b54f6313a06036b76126853fa0a712c0d91`. Only four agreed files changed: worker/cache.js, scripts/asset-manifest.cjs, tests/cache-efficiency.test.cjs and tests/asset-manifest.test.cjs. No Starfall main push, deployment, reset, game/stronghold/slot edits or build-script edits.

All 241 tests pass (226 baseline + 15 new). Worker cache is exercised by both focused fixtures and the existing full Worker suites. Collector integration remains with the colleague; no production build with the new collector hook is claimed.

## Active cache changes

- Retained public response bodies capped at 2 MiB aggregate, 256 KiB each, 128 entries per DB handle/isolate. These are cache-body limits, not total Worker memory guarantees; in-flight response buffering and application objects are separate.
- Only existing public allowlisted JSON routes are eligible. Catalogue parameter ordering is canonical; unknown/duplicate keys, Authorization and explicit caller no-cache/no-store bypass. Set-Cookie, private Cache-Control, non-JSON, varying personal headers and non-200 responses are not retained or shared across waiting callers.
- TTL begins after completion. Evicted/invalidated in-flight records cannot repopulate the cache or evict a newer replacement. Failed requests permit retry. Existing request-scoped auth and audit logging are unchanged.
- Known unrelated fleet telemetry, mail, ticket, forum, intel and scan writes no longer invalidate public roster/count/catalogue reads. Other successful mutations still conservatively invalidate all public entries. Review this allowlist if endpoint responsibilities expand.
- Optional build-supplied SHA256 ETag metadata avoids same-length content collisions. Without metadata the existing fallback remains. Year-long immutable caching is restricted to portal-runtime URLs whose filename hash matches the supplied content digest; protected pages stay private/no-store. This part needs the collector hook below.

## Read-only asset helper and measured candidates

`createAssetManifest(dist, options)` hashes assets and returns files, omitted, warnings, unreferencedRuntimePaths and byte statistics. It excludes server/.openai directories as the current collector does; everything else, including arbitrary lazy artwork and PNG/WebP pairs, stays included by default. It never writes/deletes source files. Symlinks fail explicitly.

Only root `portal-runtime-<12 hex>.js` files can be omitted. Reachability considers all non-hash HTML/JS/CSS/JSON roots, follows hash-bundle references transitively and fails for a missing referenced runtime. Unresolved dynamic runtime prefixes disable pruning. No general JS/CSS/image tree-shaking is attempted.

On the confirmed source snapshot: 1,703 eligible files, 45,557,159 raw bytes before the old PNG/WebP filter. There are 23 unreferenced hash-runtime candidates totalling 1,268,514 bytes when measured with an explicitly empty compatibility list. **This is a potential maximum, not a deployed saving.** Retaining previous release runtimes may reduce it. Default operation omits zero bytes.

## Complete collector hook for the colleague

This replaces only the existing `collect` function in scripts/build-worker.cjs. It is deliberately supplied here rather than changing that colleague-owned file. Keep its invocation after diagnostic generation so the manifest sees final assets. It uses the build script's existing fs/path/assets/mime bindings.

```js
function collect(dir) {
  const { createAssetManifest } = require('./asset-manifest.cjs');
  const { createHash } = require('node:crypto');
  const manifest = createAssetManifest(dir);
  for (const file of manifest.files) {
    const full = path.join(dir, file.path);
    // Preserve existing publication behaviour; this helper does not add PNG pruning.
    if (file.path.endsWith('.png') && fs.existsSync(full.replace(/\.png$/, '.webp'))) continue;
    const bytes = fs.readFileSync(full);
    if ('sha256-' + createHash('sha256').update(bytes).digest('hex') !== file.etag) {
      throw new Error('Asset changed during collection: ' + file.path);
    }
    assets[file.url] = {
      data: bytes.toString('base64'),
      type: mime[path.extname(full)] || 'application/octet-stream',
      etag: file.etag
    };
  }
  console.log('Asset manifest: ' + manifest.files.length + ' files; '
    + manifest.stats.omittedBytes + ' bytes omitted');
}
```

This safe default enables digest metadata but performs no pruning. To enable pruning, pass `pruneUnreferencedPortalRuntimes:true` and an explicit `previousRuntimePaths` array of root filenames from the preceding deployed pages. Those files must still exist in the input, or the helper fails. Retain compatible runtimes through the HTML cache/rollout window and any agreed rollback interval; do not supply an empty list just to maximise the saving on an existing deployment.

Before publication: rebuild runtimes/Worker in the colleague's composed branch; audit links and actual generated metadata, verify digest-based 304/immutable headers and old cached-page loader compatibility, and run live/preview CPU/D1 measurements. Existing audits still write on authenticated API calls; cache hits are not zero-DB-work. No media binding, telemetry retention, private caching, polling schedule or authentication algorithm was changed by this contribution.

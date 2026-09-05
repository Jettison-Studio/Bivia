# Dependency security notes

Reviewed September 5, 2026. Run `npm audit` again before release; advisories and upstream fixes change over time.

## Fixed findings

### URL decoder denial of service

Expo Router 57.0.19 uses query-string 7.1.3, whose original decoder dependency was vulnerable to excessive CPU use on malformed percent-encoded URL input. The project now pins that decoder to 0.5.0 through a query-string-scoped npm override.

Decoder 0.5.0 is an ESM default export. Query-string 7 expects a callable CommonJS export, so `patches/query-string+7.1.3.patch` adapts that one import while retaining query-string's existing API. `patch-package --error-on-fail` applies it automatically during root postinstall and fails installation if it cannot apply. Root query-string 7.1.3 is explicitly declared as the compatibility-test dependency; this also anchors npm's override resolution through the workspace/peer dependency graph.

Use normal `npm ci` with lifecycle scripts and development dependencies when building. Do not use `--ignore-scripts`: it would skip the required compatibility patch. A decoder-only override would break routing, and a query-string 9 override would break Expo Router's current namespace import API.

`npm run test:dependencies` checks Unicode queries, repeated/empty values, bracket arrays, malformed sequences, and a 300 KB malformed input in a child process with a 5-second timeout. The root `npm test` includes these tests. Remove the override and patch together once an Expo-supported dependency chain ships a compatible safe decoder; rerun deep-link, web, and native validation when doing so.

Source: [decoder maintainer advisory](https://github.com/SamVerschueren/decode-uri-component/security/advisories/GHSA-vcc3-ghjq-m6fr), [decoder 0.5.0 release](https://github.com/SamVerschueren/decode-uri-component/releases/tag/v0.5.0).

### esbuild development-server advisory

Root tsx is 4.23.13 and resolves esbuild 0.28.2, beyond the patched 0.28.1 threshold. Vite 6.4.3 has a separate esbuild 0.25.12 dependency outside the advisory's affected range. The reported flaw concerns Windows development-server file serving; it is not present in the current macOS workflow.

Source: [esbuild maintainer advisory](https://github.com/evanw/esbuild/security/advisories/GHSA-g7r4-m6w7-qqqr).

## Remaining upstream build-tool finding

The current npm audit reports 10 moderate package findings, with zero low, high, or critical findings. These are one uuid advisory plus its transitive effects through xcode and Expo build tooling, not 10 independent vulnerable operations.

Installed chain: Expo 57.0.20 → @expo/config-plugins 57.0.9 → xcode 3.0.1 → uuid 7.0.3. The latest published xcode remains 3.0.1 and declares uuid^7.0.3. The maintainer fix starts at uuid 11.1.1, outside that dependency range.

The advisory concerns v3/v5/v6 calls with caller-supplied output buffers. Installed xcode/lib/pbxProject.js imports uuid and invokes only `uuid.v4()` without a supplied buffer to produce build-project identifiers. The vulnerable operation is therefore not exercised by this inspected call path. These modules support native project/build tooling rather than Bivia gameplay.

Do not use `npm audit fix --force`: its suggested Expo 46 downgrade would break the chosen SDK 57 stack. Recheck upstream xcode/Expo updates before release. A scoped uuid 11 override may retain the particular v4 API, but crosses multiple major versions and should be treated as a separate native-toolchain compatibility change, not an automatic patch.

Source: [uuid maintainer advisory](https://github.com/uuidjs/uuid/security/advisories/GHSA-w5hq-g745-h8pq). Version and dependency ranges were checked against the official npm registry with `npm view`.

## Verification

- All 14 root tests pass: six domain, five editorial, three dependency compatibility tests.
- `npm ls decode-uri-component` resolves 0.5.0 and marks the scoped override without invalid dependencies.
- Clean-install dry run accepts the project lockfile.
- The patch/override and dependency tests were also exercised in an isolated fresh installation.
- Post-fix audit removes decode-uri-component, query-string, expo-router, and esbuild findings; only the documented uuid/Expo build-tool chain remains.

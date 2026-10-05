# VIS — Azure Static Web Apps release

Azure-generated endpoint: filled in by the first successful deployment and reported by
`az staticwebapp show`. Release completion is established by the checks below.

## Target contract

| Setting           | Value                                                      |
| ----------------- | ---------------------------------------------------------- |
| Repository        | `aserdargun/vis-aserdargun-com`                            |
| Production branch | `main`                                                     |
| Subscription      | `aserdargun subscription 4`                                |
| Subscription ID   | `a78f5745-b16b-415a-aaf9-9cfd5d19c6a3`                     |
| Resource group    | `rg-vis-aserdargun-com`                                    |
| Static Web App    | `swa-vis-aserdargun-com`                                   |
| Region / SKU      | `westeurope` / `Free`                                      |
| Static artifact   | `dist/`                                                    |
| Workflow          | `.github/workflows/deploy-swa-vis-aserdargun-com.yml`      |
| Deployment secret | `AZURE_STATIC_WEB_APPS_API_TOKEN_SWA_VIS_ASERDARGUN_COM`   |
| Concurrency       | `swa-vis-aserdargun-com-production`, cancellation disabled |

IHS zone-relative records: `vis` CNAME points to the Azure-generated hostname; `_dnsauth.vis`
TXT holds the Azure ownership token. Never commit the token. Domain completion requires matching
records from both authoritative nameservers, Azure `Validated`, a matching TLS certificate,
HTTPS release verification and a browser check.

## Release pipeline

Pushes to `main` and manual dispatch run the same single workflow:

1. Check out the exact commit and install locked dependencies on Node.js 22.
2. Install Chromium, then run lint, the TypeScript build, artifact verification, 40 field tests
   and the complete 17-case browser suite against the built static preview.
3. Upload the already verified `dist/` to the Free app. Both app and API rebuilding are
   disabled; there is no backend.
4. Check the live `release.json` commit against the workflow SHA, plus root HTML, referenced
   JS/CSS, content types, security headers and cache policy. If a valid VIS manifest still
   reports the previous commit immediately after upload, retry at five-second intervals for at
   most 13 reads. A persistent mismatch fails the release; an old commit is never accepted.
5. Run the same complete browser suite against the generated HTTPS production URL.

## WebGPU in CI

The `webgpu` Playwright project launches Chromium with `--enable-unsafe-webgpu
--use-angle=metal`. Without those flags `requestAdapter()` resolves to `null` while
`navigator.gpu` still exists, so the GPU suite would pass without ever executing a kernel.
`tests/gpu.spec.ts` therefore fails on a missing adapter rather than skipping.

Note that the hosted GitHub Actions runner is Linux without a hardware GPU, so the live
production browser run exercises the CPU path there. GPU parity is proven by the local and
recorded `npm run test:ui` run on Apple Silicon (`metal-3`); the assertion is written so a
runner without an adapter fails loudly instead of pretending.

## Evidence and verification

`dist/release.json` is generated at build time and includes the application, version, complete
git commit, UTC build time and the scope flags. It is served with `Cache-Control: no-store`;
the root HTML is revalidated and hashed assets are immutable.

```sh
# Repeat all local release checks against the production build.
VIS_PREVIEW=1 npm run validate

# Verify a known deployed SHA and run browser checks against that exact site.
VIS_BASE_URL='https://<azure-generated-hostname>' EXPECTED_COMMIT='<full-sha>' npm run verify:live
VIS_BASE_URL='https://<azure-generated-hostname>' npm run test:ui

az staticwebapp show --name swa-vis-aserdargun-com --resource-group rg-vis-aserdargun-com --subscription a78f5745-b16b-415a-aaf9-9cfd5d19c6a3
```

Completion requires the matching pushed commit, a successful Actions run including production
browser checks, Azure production `Ready`, matching live metadata and verified rendered UI. A
resource merely being created or a workflow being queued is not completion.

The deployment token is transferred directly from Azure CLI to the repository secret and is
never committed or printed.

## Scope and operations

- The app remains a deterministic synthetic educational laboratory after publication. There is
  no live model, camera, OCR, telemetry or persistence backend.
- Keep the existing resource in this exact subscription; always pass the subscription ID
  explicitly.
- To roll back application code, revert the intended code change and push a new commit through
  the same validation/deployment pipeline. Do not delete the app or mutate DNS.

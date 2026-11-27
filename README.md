# k6 Performance Testing Demo

A set of [Grafana k6](https://k6.io/) scripts that show common performance-testing patterns: smoke checks, load, stress, and soak tests, plus a small reusable helper layer and a GitHub Actions pipeline that streams results to Grafana Cloud k6.

The scripts target two public demo APIs, so you can run them without standing up a service of your own:

- **[QuickPizza](https://quickpizza.grafana.com/)**: Grafana's demo app. Used by the introductory and bottleneck scripts.
- **[JSONPlaceholder](https://jsonplaceholder.typicode.com/)**: a fake REST API. Used by the "posts flow" tests. You can point it at a different host with `BASE_URL`.

There is also one authenticated journey against a CRM web app (`my-script.js`, generated with Grafana k6 Studio). It needs login credentials, so it won't run out of the box. See [CRM user journey](#crm-user-journey).

> ⚠️ These are shared public services. Keep VU counts and durations modest, and don't aim heavy stress tests at them. To push harder, set `BASE_URL` to a server you own.

---

## Table of contents

- [Prerequisites](#prerequisites)
- [Project structure](#project-structure)
- [Quick start](#quick-start)
- [Test scripts](#test-scripts)
- [Shared helpers](#shared-helpers)
- [Configuration](#configuration)
- [Thresholds and pass/fail](#thresholds-and-passfail)
- [Running in Grafana Cloud k6](#running-in-grafana-cloud-k6)
- [CI/CD with GitHub Actions](#cicd-with-github-actions)
- [Reading the results](#reading-the-results)
- [Extending the suite](#extending-the-suite)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

| Tool | Purpose |
| --- | --- |
| [k6](https://grafana.com/docs/k6/latest/set-up/install-k6/) | Runs the test scripts locally |
| A Grafana Cloud account *(optional)* | Stores and visualizes results with `k6 cloud run` |

Install k6:

```bash
# macOS
brew install k6

# Windows
winget install k6 --source winget

# Debian/Ubuntu: see https://grafana.com/docs/k6/latest/set-up/install-k6/
# Docker
docker pull grafana/k6
```

Check the install:

```bash
k6 version
```

There is no `package.json` and nothing to `npm install`. k6 runs the scripts with its own JavaScript runtime.

---

## Project structure

```
k6-demo/
├── .github/
│   └── workflows/
│       └── k6-performance-test.yml   # CI pipeline (runs cloud-test.js)
├── helpers/
│   ├── api.js                        # Reusable user flow: runPostsFlow()
│   ├── crm.js                        # Authenticated CRM journey: runCrmFlow()
│   └── suite.js                      # Shared scenarios (load, stress) and thresholds
├── script.js                         # Simplest GET test against QuickPizza
├── post_request.js                   # POST with a JSON body and checks
├── bottleneck-demo.js                # Fast vs. deliberately slow endpoint
├── dashboard-comparison.js           # Same as bottleneck-demo, for comparing dashboards
├── loads-test.js                     # Load test (shared "load" scenario)
├── stress-test.js                    # Stress test (shared "stress" scenario)
├── soak-test.js                      # Soak test (steady load held for longer)
├── cloud-test.js                     # Short ramp test used by CI / Grafana Cloud
└── my-script.js                      # CRM login journey (k6 Studio), 1 VU
```

---

## Quick start

```bash
git clone <this-repo-url>
cd k6-demo

# Simplest test
k6 run script.js

# Load test against JSONPlaceholder
k6 run loads-test.js

# Watch it live in the built-in web dashboard (http://localhost:5665)
K6_WEB_DASHBOARD=true k6 run loads-test.js
```

---

## Test scripts

### Introductory scripts

| Script | Target | Load profile | What it shows |
| --- | --- | --- | --- |
| `script.js` | `GET quickpizza.grafana.com/` | 300 VUs for 30s | The smallest possible k6 test: one request, one check. **300 VUs is a lot for a shared demo site, so lower `--vus` for casual runs.** |
| `post_request.js` | `POST quickpizza.grafana.com/api/post` | 10 VUs for 30s | Sending a JSON payload with headers, and checking both the status and the body |

```bash
k6 run --vus 10 --duration 15s script.js
k6 run post_request.js
```

### Bottleneck demos

`bottleneck-demo.js` and `dashboard-comparison.js` contain the same code. Each iteration calls two endpoints:

1. `GET /`, which responds quickly
2. `GET /api/delay/1`, which always waits about 1 second before responding

The thresholds require `p(95) < 500ms`, and the delayed endpoint can never meet that, so **these tests are built to fail**. They show how one slow dependency drags down the overall latency percentiles, and how a failed threshold looks in the CLI summary and in the dashboards. Keeping two copies makes it easy to compare runs side by side (for example, the local web dashboard against Grafana Cloud).

Load profile: ramp to 10 VUs over 10s, go to 12 VUs over 20s, then ramp down over 10s (about 40s in total).

```bash
k6 run bottleneck-demo.js
```

### Posts-flow test types

These scripts all run the same simulated user journey against JSONPlaceholder. Each iteration:

1. **Browse**: `GET /posts?_limit=5` and check for `200`
2. **View**: `GET /posts/1` and check for `200`
3. **Create**: `POST /posts` with a JSON body and check for `201`

The difference between them is the **load profile**:

| Script | Test type | Stages | Peak VUs | Duration | Purpose |
| --- | --- | --- | --- | --- | --- |
| `loads-test.js` | Load | 0→10 (10s), hold 10 (1m), 10→0 (30s) | 10 | ~1m40s | Check behaviour under expected, typical traffic |
| `stress-test.js` | Stress | 0→20→40→60→80 (15s each), 80→0 (15s) | 80 | ~1m15s | Raise the load step by step to find where performance starts to degrade |
| `soak-test.js` | Soak | 0→10 (30s), hold 10 (3m), 10→0 (30s) | 10 | ~4m | Hold a steady load over time to surface leaks, connection exhaustion, and drift |
| `cloud-test.js` | Short ramp | 0→10 (10s), 10→12 (20s), 12→0 (10s) | 12 | ~40s | A quick check suited to CI and Grafana Cloud runs |

```bash
k6 run loads-test.js
k6 run stress-test.js
k6 run soak-test.js
k6 run cloud-test.js
```

> **Note:** `soak-test.js` contains its own inline copy of the posts flow and does not import `helpers/`. The soak in this repo is short (3 minutes) so the demo stays quick. Real soak tests usually run for hours, so raise the hold stage for that.

### CRM user journey

`my-script.js` was generated with Grafana k6 Studio's test-setup wizard and then refactored to call `runCrmFlow()` from `helpers/crm.js`. Each iteration logs in to the CRM app, loads the dashboard data, and logs out:

1. `GET /` and `GET /login`: the HTML pages
2. `GET /api/auth/me`: session check before login
3. `POST /api/auth/login` with `CRM_EMAIL` / `CRM_PASSWORD`
4. `GET /api/auth/me`: session check after login
5. `GET /api/crm/summary` and `GET /api/crm/jobs`
6. `GET /api/crm/quotes?status=...` for `new_lead`, `sent`, `accepted`, and `declined`
7. `POST /api/auth/logout`

Each request has a status check, and the whole journey is wrapped in one `group()`. API calls send an `x-client-id` header that is hard-coded in the helper.

Load profile: ramp to 1 VU over 30s, hold 1 VU for 1m30s, ramp down over 30s (about 2m30s). It uses the shared `thresholds` from `helpers/suite.js`.

Credentials are required. The helper throws at startup if either variable is missing:

```bash
k6 run -e CRM_EMAIL=you@example.com -e CRM_PASSWORD='...' my-script.js
```

> ⚠️ This journey logs in as a real account. Use a dedicated test user, keep the VU count low unless you own the environment, and never commit credentials. In CI, store them as secrets.

---

## Shared helpers

The newer scripts split *what a user does* from *how much load is applied*, so a new test type is just a different scenario around the same flow.

### `helpers/api.js`

Exports `runPostsFlow()`, the browse → view → create journey with its checks. It reads `BASE_URL` from the environment and falls back to `https://jsonplaceholder.typicode.com`.

```js
import { runPostsFlow } from "./helpers/api.js";

export default function () {
  runPostsFlow();
}
```

> `runPostsFlow()` already ends with `sleep(1)`. The scripts that call it also `sleep(1)` afterwards, so each iteration has about 2 seconds of think time. Remove one of them if you want 1 second.

### `helpers/crm.js`

Exports `runCrmFlow()`, the authenticated CRM journey described in [CRM user journey](#crm-user-journey). It reads `BASE_URL` (default `https://services-crm.co.uk`), `CRM_EMAIL`, and `CRM_PASSWORD` from the environment. Unlike `runPostsFlow()`, it doesn't sleep, so the calling script controls think time.

### `helpers/suite.js`

Exports shared `thresholds` and named `scenarios` (`load`, `stress`), so every test uses the same pass/fail criteria:

```js
import { scenarios, thresholds } from "./helpers/suite.js";

export const options = {
  scenarios: { load: scenarios.load },
  thresholds,
};
```

---

## Configuration

### Environment variables

| Variable | Used by | Default | Description |
| --- | --- | --- | --- |
| `BASE_URL` | `helpers/api.js`, `soak-test.js` (and every script that imports the helper) | `https://jsonplaceholder.typicode.com` | Base URL of the API under test. Leave off the trailing slash. |
| `BASE_URL` | `helpers/crm.js` (`my-script.js`) | `https://services-crm.co.uk` | Base URL of the CRM app. Same variable name, different default. |
| `CRM_EMAIL` | `helpers/crm.js` | *(none, required)* | Login email for the CRM journey |
| `CRM_PASSWORD` | `helpers/crm.js` | *(none, required)* | Login password for the CRM journey |

Pass it with `--env` (or `-e`):

```bash
k6 run --env BASE_URL=https://staging.example.com loads-test.js
```

### Useful CLI overrides

```bash
# Override VUs and duration (simple scripts only; scenario-based scripts ignore these)
k6 run --vus 5 --duration 10s script.js

# Export the end-of-test summary as JSON
k6 run --summary-export=summary.json loads-test.js

# Write raw metrics to a file
k6 run --out json=results.json loads-test.js

# Built-in real-time HTML dashboard, plus an HTML report when the run ends
K6_WEB_DASHBOARD=true K6_WEB_DASHBOARD_EXPORT=report.html k6 run stress-test.js
```

### Summary statistics

Most scripts set `summaryTrendStats` so the end-of-test summary shows `avg, min, med, max, p(90), p(95), p(99), count` instead of the default set.

---

## Thresholds and pass/fail

Every scenario-based script uses the same service-level objectives:

| Metric | Threshold | Meaning |
| --- | --- | --- |
| `http_req_duration` | `p(95)<500` | 95% of requests finish in under 500 ms |
| `http_req_failed` | `rate<0.01` | Fewer than 1% of requests fail |

If any threshold is breached, k6 exits with a **non-zero code (99)**. That is what makes these tests usable as a quality gate in CI.

**Checks** (for example `browse status is 200`) are different: they record a pass rate but **don't fail the run** on their own. To make them gate a run, add a threshold on the `checks` metric:

```js
thresholds: {
  checks: ["rate>0.99"],
}
```

---

## Running in Grafana Cloud k6

1. Create a personal API token in Grafana Cloud under **Testing & synthetics → Performance → Settings**.
2. Log in from the CLI:

   ```bash
   k6 cloud login --token <YOUR_TOKEN> --stack <YOUR_STACK_SLUG>
   ```

3. Choose where the load is generated:

   ```bash
   # Run on your machine and stream the results to Grafana Cloud
   k6 cloud run --local-execution cloud-test.js

   # Run on Grafana Cloud's load generators
   k6 cloud run cloud-test.js
   ```

Each run gets a URL where you can explore response times, throughput, check and threshold results, and how they relate to each other.

---

## CI/CD with GitHub Actions

The workflow in [`.github/workflows/k6-performance-test.yml`](.github/workflows/k6-performance-test.yml) runs `cloud-test.js` and streams its results to Grafana Cloud k6.

### Triggers

| Trigger | When |
| --- | --- |
| `push` | Every push to `main` |
| `pull_request` | Pull requests targeting `main` |
| `schedule` | Every Monday at 02:15 UTC (`15 2 * * 1`) |
| `workflow_dispatch` | Manually from the **Actions** tab |

### Steps

1. Check out the repository
2. Install k6 with `grafana/setup-k6-action@v1`
3. Log in to Grafana Cloud k6 with `k6 cloud login`
4. Run `k6 cloud run --local-execution --env BASE_URL=... ./cloud-test.js`

The job fails if a threshold is breached, so a performance regression shows up as a failed check on the PR or commit.

### Required setup

The job runs in the **`staging`** GitHub environment. Configure these under **Settings → Environments → staging**:

| Name | Type | Description |
| --- | --- | --- |
| `K6_CLOUD_TOKEN` | Secret | Grafana Cloud k6 API token |
| `K6_CLOUD_STACK_SLUG` | Variable | Your Grafana Cloud stack slug (for example `mycompany`) |
| `BASE_URL` | Variable | API under test. If empty, the script falls back to JSONPlaceholder. |

### Alternative: run without Grafana Cloud

The workflow has a commented-out step that uses `grafana/run-k6-action@v1` to run a script on the runner alone. To use it, uncomment that step and remove the two cloud steps:

```yaml
- name: Run k6 test
  uses: grafana/run-k6-action@v1
  with:
    path: ./bottleneck-demo.js
```

---

## Reading the results

An end-of-test summary looks roughly like this:

```
  █ THRESHOLDS

    http_req_duration
    ✓ 'p(95)<500' p(95)=212.4ms

    http_req_failed
    ✓ 'rate<0.01' rate=0.00%

  █ TOTAL RESULTS

    checks_succeeded...: 100.00% 1530 out of 1530
    ✓ browse status is 200
    ✓ view status is 200
    ✓ create status is 201

    http_req_duration..: avg=98ms min=41ms med=83ms max=640ms p(90)=180ms p(95)=212ms p(99)=410ms
    http_reqs..........: 1530   15.2/s
    iterations.........: 510    5.07/s
    vus_max............: 10
```

Key metrics:

- **`http_req_duration`**: total request time (sending, waiting, and receiving). Watch the high percentiles (`p(95)`, `p(99)`) more than the average.
- **`http_req_waiting`**: time to first byte, which mostly reflects server processing time.
- **`http_req_failed`**: share of requests that failed (by default, any non-2xx/3xx status).
- **`http_reqs` / `iterations`**: throughput, as requests and complete user journeys per second.
- **`checks`**: pass rate of the functional assertions.

---

## Extending the suite

### Add a new test type

Add a scenario to `helpers/suite.js`:

```js
spike: {
  executor: "ramping-vus",
  startVUs: 0,
  stages: [
    { duration: "10s", target: 5 },
    { duration: "5s",  target: 100 }, // sudden spike
    { duration: "30s", target: 100 },
    { duration: "5s",  target: 5 },
    { duration: "10s", target: 0 },
  ],
},
```

Then create `spike-test.js`:

```js
import { sleep } from "k6";
import { runPostsFlow } from "./helpers/api.js";
import { scenarios, thresholds } from "./helpers/suite.js";

export const options = {
  scenarios: { spike: scenarios.spike },
  thresholds,
};

export default function () {
  runPostsFlow();
  sleep(1);
}
```

### Add a new user flow

Export another function from `helpers/api.js` (for example `runCommentsFlow()`) and call it from a script. You can also mix several flows into one test by giving each scenario its own `exec` function.

### Other ideas

- Use `group()` to break a journey into named steps in the results
- Tag requests (`{ tags: { name: "view-post" } }`) and set thresholds per endpoint
- Move `soak-test.js` onto the shared helpers so its flow can't drift from the others
- Lower `script.js` to a smoke-test level (1–5 VUs) and run it before the heavier tests in CI

---

## Troubleshooting

| Problem | Likely cause and fix |
| --- | --- |
| `level=error msg="... threshold ... crossed"` and exit code 99 | A threshold failed. This is expected for `bottleneck-demo.js`. For other scripts, check `p(95)` and the error rate. |
| `create status is 201` check failing | `BASE_URL` points to an API that doesn't return `201` on `POST /posts`. Adjust the check or the target. |
| Many `429` or timeout errors | The public demo API is rate-limiting you. Lower the VUs, or point `BASE_URL` at your own server. |
| `k6 cloud login` fails in CI | `K6_CLOUD_TOKEN` or `K6_CLOUD_STACK_SLUG` is missing from the `staging` environment, or the token has expired. |
| `Set CRM_EMAIL and CRM_PASSWORD` error on startup | `my-script.js` (or another script importing `helpers/crm.js`) was run without credentials. Pass both with `-e`. |
| CRM `login 200` check failing | Wrong credentials, or `BASE_URL` was set for a posts-flow test and points the CRM helper at the wrong host. |
| `--vus`/`--duration` seem ignored | Scripts that define `scenarios` ignore these flags. Edit the stages in `helpers/suite.js` instead. |

---

## Resources

- [k6 documentation](https://grafana.com/docs/k6/latest/)
- [Test types: load, stress, soak, spike](https://grafana.com/docs/k6/latest/testing-guides/test-types/)
- [Scenarios and executors](https://grafana.com/docs/k6/latest/using-k6/scenarios/)
- [Thresholds](https://grafana.com/docs/k6/latest/using-k6/thresholds/)
- [Grafana Cloud k6](https://grafana.com/docs/grafana-cloud/testing/k6/)
- [setup-k6-action](https://github.com/grafana/setup-k6-action) / [run-k6-action](https://github.com/grafana/run-k6-action)

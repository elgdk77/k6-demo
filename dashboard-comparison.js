import http from "k6/http";
import { sleep, check } from "k6";

export const options = {
  scenarios: {
    cloud_demo: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "10s", target: 10 }, // ramp up to 50 VUs over 30 seconds
        { duration: "20s", target: 12 }, // ramp up to 100 VUs for 30 seconds
        { duration: "10s", target: 0 }
      ],
    },
  },
  summaryTrendStats: [
    "avg",
    "min",
    "med",
    "max",
    "p(90)",
    "p(95)",
    "p(99)",
    "count",
  ],
  thresholds: {
    http_req_duration: ["p(95)<500"], // 95% of requests must complete below 500ms
    http_req_failed: ["rate<0.01"], // error rate should be less than 1%,
  },
};

export default function () {
  const res = http.get("https://quickpizza.grafana.com/");

  const res2 = http.get("https://quickpizza.grafana.com/");

  check(res, { "status is 200": (res) => res.status === 200 });
  check(res2, { "status is 200": (res) => res.status === 200 });
  sleep(1);
}


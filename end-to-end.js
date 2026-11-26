import http from "k6/http";
import { sleep, check } from "k6";

export const options = {
  scenarios: {
    stress: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: 50 }, // ramp up to 50 VUs over 30 seconds
        { duration: "30s", target: 100 }, // ramp up to 100 VUs for 30 seconds
        { duration: "30s", target: 150 }, // ramp up to 150 VUs over 30 seconds
        { duration: "30s", target: 200 }, // ramp up to 200 VUs over 30 seconds
        { duration: "30s", target: 300 }, // ramp up to 300 VUs for 30 seconds
        { duration: "30s", target: 400 }, // ramp up to 400 VUs over 30 seconds
        { duration: "30s", target: 500 }, // ramp up to 500 VUs for 30 seconds
        { duration: "30s", target: 0 }, // ramp down to  0 VUs over 30 seconds
      ],
    },
  },
  thresholds: {
    http_req_duration: ["p(95)<500"], // 95% of requests must complete below 500ms
    http_req_failed: ["rate<0.01"], // error rate should be less than 1%,
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
};

const baseUrl = __ENV["BASE_URL"] || "https://jsonplaceholder.typicode.com";

const createPayload = JSON.stringify({
  title: "foo",
  body: "bar",
  userId: 1,
});

const params = {
  headers: {
    "Content-Type": "application/json",
  },
};

export default function () {
  const browseResponse = http.get(baseUrl + "/posts?_limit=5");

  const viewResponse = http.get(baseUrl + "/posts/1");

  const createResponse = http.post(baseUrl + "/posts", createPayload, params);

  check(browseResponse, {
    "browse status is 200": (res) => res.status === 200,
  });
  check(viewResponse, { "view status is 200": (res) => res.status === 200 });
  check(createResponse, {
    "create status is 201": (res) => res.status === 201,
  });

  sleep(1);
}

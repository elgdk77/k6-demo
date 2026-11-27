import http from "k6/http";
import { group, check } from "k6";

const baseUrl = __ENV["BASE_URL"] || "https://services-crm.co.uk";
const clientId = "4d5ed5de-013d-458b-8fd5-8a071a597545";

const email = __ENV["CRM_EMAIL"];
const password = __ENV["CRM_PASSWORD"];

if (!email || !password) {
  throw new Error(
    "Set CRM_EMAIL and CRM_PASSWORD, e.g. k6 run -e CRM_EMAIL=... -e CRM_PASSWORD=... <script>.js",
  );
}

const htmlHeaders = {
  accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
};

const apiHeaders = {
  "content-type": "application/json",
  "x-client-id": clientId,
  accept: "*/*",
  referer: `${baseUrl}/app`,
};

const apiParams = { headers: apiHeaders };
const apiWriteParams = { headers: { ...apiHeaders, origin: baseUrl } };

export function runCrmFlow() {
  group("Default group", function () {
    let resp = http.get(`${baseUrl}/`, { headers: htmlHeaders });
    check(resp, { "home page 200": (r) => r.status === 200 });

    resp = http.get(`${baseUrl}/login`, {
      headers: { ...htmlHeaders, referer: `${baseUrl}/` },
    });
    check(resp, { "login page 200": (r) => r.status === 200 });

    resp = http.get(`${baseUrl}/api/auth/me`, {
      ...apiParams,
      // 200 is expected before login; don't count it toward http_req_failed
      responseCallback: http.expectedStatuses(200),
    });
    check(resp, { "auth/me before login 200": (r) => r.status === 200 });

    resp = http.post(
      `${baseUrl}/api/auth/login`,
      JSON.stringify({ email, password }),
      apiWriteParams,
    );
    check(resp, { "login 200": (r) => r.status === 200 });

    resp = http.get(`${baseUrl}/api/auth/me`, apiParams);
    check(resp, { "auth/me after login 200": (r) => r.status === 200 });

    resp = http.get(`${baseUrl}/api/crm/summary`, apiParams);
    check(resp, { "crm summary 200": (r) => r.status === 200 });

    resp = http.get(`${baseUrl}/api/crm/jobs`, apiParams);
    check(resp, { "crm jobs 200": (r) => r.status === 200 });

    for (const status of ["new_lead", "sent", "accepted", "declined"]) {
      resp = http.get(`${baseUrl}/api/crm/quotes?status=${status}`, apiParams);
      check(resp, { [`quotes ${status} 200`]: (r) => r.status === 200 });
    }

    resp = http.post(`${baseUrl}/api/auth/logout`, "{}", apiWriteParams);
    check(resp, { "logout 200": (r) => r.status === 200 });
  });
}

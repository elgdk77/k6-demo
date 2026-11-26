import http from "k6/http";
import { sleep, check } from "k6";

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

export function runPostsFlow () {
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

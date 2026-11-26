
import { sleep, check } from "k6";
import { runPostsFlow } from "./helpers/api.js";
import { scenarios, thresholds } from "./helpers/suite.js";

export const options = {
  scenarios: {
    load: scenarios.load,
  },
  thresholds,
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

export default function () {
  runPostsFlow();

  sleep(1);
}

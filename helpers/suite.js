export const thresholds = {
    http_req_duration: ["p(95)<500"], // 95% of requests must complete below 500ms
    http_req_failed: ["rate<0.01"], // error rate should be less than 1%,
};

export const scenarios = {
    stress: {
        executor: "ramping-vus",
        startVUs: 0,
        stages: [
            { duration: "15s", target: 20 }, // ramp up to 50 VUs over 30 seconds
            { duration: "15s", target: 40 }, // ramp up to 100 VUs for 30 seconds
            { duration: "15s", target: 60 }, // ramp up to 150 VUs over 30 seconds
            { duration: "15s", target: 80 }, // ramp up to 200 VUs over 30 seconds
            { duration: "15s", target: 0 }, // ramp up to 300 VUs for 30 seconds
        ],
    },
    load: {
        executor: "ramping-vus",
        startVUs: 0,
        stages: [
            { duration: "10s", target: 10 }, // ramp up to 50 VUs over 30 seconds
            { duration: "1m", target: 10 }, // ramp up to 100 VUs for 30 seconds
            { duration: "30s", target: 0 }
        ],
    },
};
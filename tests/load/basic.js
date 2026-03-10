import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.API_URL || 'http://localhost:4000/api/v1';

export const options = {
  stages: [
    { duration: '30s', target: 20 },   // Ramp up to 20 users
    { duration: '1m', target: 50 },     // Hold at 50 users
    { duration: '30s', target: 0 },     // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95) < 500'],  // 95% of requests under 500ms
    http_req_failed: ['rate < 0.01'],     // Less than 1% errors
  },
};

export default function () {
  // Simulate typical user behavior: load stories
  const stories = http.get(`${BASE_URL}/stories?limit=20`);
  check(stories, {
    'stories returns 200': (r) => r.status === 200,
    'stories has data': (r) => JSON.parse(r.body).stories.length > 0,
  });
  sleep(1);

  // Search for something
  const search = http.get(`${BASE_URL}/headlines?search=war&limit=20`);
  check(search, {
    'search returns 200': (r) => r.status === 200,
  });
  sleep(2);

  // Check health
  const health = http.get(`${BASE_URL}/health`);
  check(health, {
    'health returns 200': (r) => r.status === 200,
  });
  sleep(1);
}

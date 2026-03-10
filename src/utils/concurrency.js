/**
 * Execute async functions with a concurrency limit.
 * Like Promise.all but with a maximum number of concurrent tasks.
 * @param {Array<() => Promise>} tasks - Array of functions that return promises
 * @param {number} limit - Maximum concurrent tasks
 * @returns {Promise<PromiseSettledResult[]>}
 */
export async function parallelLimit(tasks, limit = 10) {
  const results = [];
  const executing = new Set();

  for (const task of tasks) {
    const promise = task().then(
      (value) => { executing.delete(promise); return value; },
      (reason) => { executing.delete(promise); throw reason; }
    );
    executing.add(promise);
    results.push(promise);

    if (executing.size >= limit) {
      await Promise.race(executing);
    }
  }

  return Promise.allSettled(results);
}

const metrics = {
  counters: new Map(),
  gauges: new Map(),
  histograms: new Map(),
};

const startTime = Date.now();

export function incrementCounter(name, labels = {}, value = 1) {
  const key = `${name}:${JSON.stringify(labels)}`;
  metrics.counters.set(key, (metrics.counters.get(key) || 0) + value);
}

export function setGauge(name, labels = {}, value = 0) {
  const key = `${name}:${JSON.stringify(labels)}`;
  metrics.gauges.set(key, value);
}

export function observeHistogram(name, labels = {}, value = 0) {
  const key = `${name}:${JSON.stringify(labels)}`;
  const existing = metrics.histograms.get(key) || { sum: 0, count: 0, buckets: new Map() };
  existing.sum += value;
  existing.count += 1;
  // Simple bucket tracking
  const bucketBounds = [10, 50, 100, 250, 500, 1000, 2500, 5000, 10000];
  for (const bound of bucketBounds) {
    if (value <= bound) {
      existing.buckets.set(bound, (existing.buckets.get(bound) || 0) + 1);
    }
  }
  metrics.histograms.set(key, existing);
}

export function collectMetrics(pool) {
  const lines = [];

  // Uptime
  lines.push(`# HELP process_uptime_seconds Process uptime in seconds`);
  lines.push(`# TYPE process_uptime_seconds gauge`);
  lines.push(`process_uptime_seconds ${(Date.now() - startTime) / 1000}`);

  // Process memory
  const mem = process.memoryUsage();
  lines.push(`# HELP process_heap_used_bytes Process heap used`);
  lines.push(`# TYPE process_heap_used_bytes gauge`);
  lines.push(`process_heap_used_bytes ${mem.heapUsed}`);
  lines.push(`# HELP process_rss_bytes Resident set size`);
  lines.push(`# TYPE process_rss_bytes gauge`);
  lines.push(`process_rss_bytes ${mem.rss}`);

  // Counters
  for (const [key, value] of metrics.counters) {
    const [name, labelsJson] = key.split(":");
    const labels = JSON.parse(labelsJson);
    const labelStr = Object.entries(labels).length > 0
      ? `{${Object.entries(labels).map(([k, v]) => `${k}="${v}"`).join(",")}}`
      : "";
    lines.push(`# TYPE ${name} counter`);
    lines.push(`${name}${labelStr} ${value}`);
  }

  // Gauges
  for (const [key, value] of metrics.gauges) {
    const [name, labelsJson] = key.split(":");
    const labels = JSON.parse(labelsJson);
    const labelStr = Object.entries(labels).length > 0
      ? `{${Object.entries(labels).map(([k, v]) => `${k}="${v}"`).join(",")}}`
      : "";
    lines.push(`# TYPE ${name} gauge`);
    lines.push(`${name}${labelStr} ${value}`);
  }

  // DB pool metrics
  if (pool && typeof pool.totalCount === "number") {
    lines.push(`# HELP db_pool_total Total connections`);
    lines.push(`# TYPE db_pool_total gauge`);
    lines.push(`db_pool_total ${pool.totalCount}`);
    lines.push(`# HELP db_pool_idle Idle connections`);
    lines.push(`# TYPE db_pool_idle gauge`);
    lines.push(`db_pool_idle ${pool.idleCount}`);
    lines.push(`# HELP db_pool_waiting Waiting for connection`);
    lines.push(`# TYPE db_pool_waiting gauge`);
    lines.push(`db_pool_waiting ${pool.waitingCount}`);
  }

  // Histograms
  for (const [key, hist] of metrics.histograms) {
    const [name, labelsJson] = key.split(":");
    const labels = JSON.parse(labelsJson);
    const labelStr = Object.entries(labels).length > 0
      ? `{${Object.entries(labels).map(([k, v]) => `${k}="${v}"`).join(",")}}`
      : "";
    lines.push(`# TYPE ${name} histogram`);
    for (const [bound, count] of hist.buckets) {
      lines.push(`${name}_bucket${labelStr}{le="${bound}"} ${count}`);
    }
    lines.push(`${name}_bucket${labelStr}{le="+Inf"} ${hist.count}`);
    lines.push(`${name}_sum${labelStr} ${hist.sum}`);
    lines.push(`${name}_count${labelStr} ${hist.count}`);
  }

  return lines.join("\n") + "\n";
}

export function metricsMiddleware(req, res, next) {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    incrementCounter("http_requests_total", { method: req.method, status: res.statusCode });
    observeHistogram("http_request_duration_ms", { method: req.method }, duration);
  });
  next();
}
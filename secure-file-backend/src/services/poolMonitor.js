import { getPool } from "../config/db.js";

let poolStats = {
  totalCreated: 0,
  totalDestroyed: 0,
  totalAcquired: 0,
  totalReleased: 0,
  waitQueue: 0,
  errors: 0,
  lastError: null,
  lastErrorTime: null
};

const originalGetPool = getPool;

export function getPoolStats() {
  const pool = originalGetPool();
  return {
    ...poolStats,
    current: {
      totalCount: pool.totalCount,
      idleCount: pool.idleCount,
      waitingCount: pool.waitingCount
    },
    config: {
      max: pool.options?.max || 20,
      idleTimeoutMillis: pool.options?.idleTimeoutMillis || 30000,
      connectionTimeoutMillis: pool.options?.connectionTimeoutMillis || 2000
    }
  };
}

export function resetPoolStats() {
  poolStats = {
    totalCreated: 0,
    totalDestroyed: 0,
    totalAcquired: 0,
    totalReleased: 0,
    waitQueue: 0,
    errors: 0,
    lastError: null,
    lastErrorTime: null
  };
}

function setupPoolMonitoring(pool) {
  pool.on("connect", () => {
    poolStats.totalCreated++;
  });

  pool.on("remove", () => {
    poolStats.totalDestroyed++;
  });

  pool.on("acquire", () => {
    poolStats.totalAcquired++;
  });

  pool.on("release", () => {
    poolStats.totalReleased++;
  });

  const originalQuery = pool.query.bind(pool);
  pool.query = async function(...args) {
    const start = Date.now();
    try {
      const result = await originalQuery(...args);
      return result;
    } catch (error) {
      poolStats.errors++;
      poolStats.lastError = error.message;
      poolStats.lastErrorTime = new Date().toISOString();
      throw error;
    } finally {
      const duration = Date.now() - start;
      if (duration > 1000) {
        console.warn(`Slow query detected: ${duration}ms`, args[0]?.substring?.(0, 100));
      }
    }
  };

  const originalConnect = pool.connect.bind(pool);
  pool.connect = async function(...args) {
    poolStats.waitQueue++;
    try {
      const client = await originalConnect(...args);
      if (client && typeof client.release === 'function') {
        const originalRelease = client.release.bind(client);
        client.release = function(err) {
          poolStats.waitQueue = Math.max(0, poolStats.waitQueue - 1);
          return originalRelease(err);
        };
      } else {
        poolStats.waitQueue = Math.max(0, poolStats.waitQueue - 1);
      }
      return client;
    } catch (error) {
      poolStats.waitQueue = Math.max(0, poolStats.waitQueue - 1);
      poolStats.errors++;
      poolStats.lastError = error.message;
      poolStats.lastErrorTime = new Date().toISOString();
      throw error;
    }
  };
}

let monitoringSetup = false;
export function enablePoolMonitoring() {
  if (!monitoringSetup) {
    const pool = originalGetPool();
    setupPoolMonitoring(pool);
    monitoringSetup = true;
  }
}

export function getPoolHealth() {
  const stats = getPoolStats();
  const current = stats.current;
  const utilization = current.totalCount > 0 
    ? ((current.totalCount - current.idleCount) / current.totalCount) * 100 
    : 0;
  
  return {
    healthy: utilization < 90 && stats.errors === 0,
    utilization: Math.round(utilization * 100) / 100,
    pool: stats.current,
    stats: {
      totalCreated: stats.totalCreated,
      totalDestroyed: stats.totalDestroyed,
      totalAcquired: stats.totalAcquired,
      totalReleased: stats.totalReleased,
      errors: stats.errors,
      lastError: stats.lastError,
      lastErrorTime: stats.lastErrorTime
    },
    config: stats.config
  };
}
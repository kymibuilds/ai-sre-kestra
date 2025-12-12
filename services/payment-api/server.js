const express = require("express");
const client = require("prom-client");

const app = express();
app.use(express.json());

let CHAOS_LATENCY = 0;

const register = new client.Registry();
client.collectDefaultMetrics({ register });

const httpLatency = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "Request latency in seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.05, 0.1, 0.2, 0.5, 1, 2],
});

const httpRequests = new client.Counter({
  name: "http_requests_total",
  help: "Total HTTP requests",
  labelNames: ["method", "route", "status_code"],
});

register.registerMetric(httpLatency);
register.registerMetric(httpRequests);

app.post("/chaos/latency", (req, res) => {
  const { latency_ms, duration_seconds, reason } = req.body;

  CHAOS_LATENCY = latency_ms;

  console.log(
    `🔥 CHAOS ENABLED → +${latency_ms}ms for ${duration_seconds}s (${reason})`
  );

  setTimeout(() => {
    CHAOS_LATENCY = 0;
    console.log("CHAOS DISABLED → latency reset");
  }, duration_seconds * 1000);

  res.json({
    status: "ok",
    latency_injected: latency_ms,
    duration_seconds,
    reason,
  });
});

// CHAOS LATENCY MIDDLEWARE
app.use((req, res, next) => {
  if (CHAOS_LATENCY > 0) {
    setTimeout(() => next(), CHAOS_LATENCY);
  } else {
    next();
  }
});

// DEPLOYMENT STATE (simulates rollback)
let currentDeployment = 100; // 100 is good deployment 101 is bad
let deploymentHistory = [
  {
    id: 100,
    status: "active",
    timestamp: Date.now() - 3600000,
    sha: "a3f9d2c",
    message: "Fix payment timeout logic",
  },
  {
    id: 101,
    status: "inactive",
    timestamp: Date.now() - 1800000,
    sha: "e7b4k9m",
    message: "Add new payment provider integration",
  },
];

// Endpoint to change deployment (simulates GitHub API)
app.post("/deployment/:id/activate", (req, res) => {
  const deploymentId = parseInt(req.params.id);
  const { reason, confidence, rollback_to, execution_id } = req.body;

  // Mark all as inactive
  deploymentHistory.forEach((d) => (d.status = "inactive"));

  // Activate the requested one
  const deployment = deploymentHistory.find((d) => d.id === deploymentId);
  if (deployment) {
    deployment.status = "active";
    deployment.rolledBackAt = new Date().toISOString();
    deployment.rollbackReason = reason;
    currentDeployment = deploymentId;
    console.log(
      `Rolled back to deployment ${deploymentId} (${deployment.sha})`
    );
    console.log(`   Reason: ${reason}`);
    console.log(`   Confidence: ${confidence}%`);
    console.log(`   Execution: ${execution_id}`);
  }

  res.json({
    success: true,
    currentDeployment,
    deploymentHistory,
    rollback_info: {
      from: rollback_to ? rollback_to + 1 : 101,
      to: deploymentId,
      reason,
      confidence,
      timestamp: new Date().toISOString(),
    },
  });
});

//dashboard
app.get("/dashboard", (req, res) => {
  const isBad = currentDeployment === 101;
  const chaosActive = CHAOS_LATENCY > 0;
  
  res.json({
    status: isBad || chaosActive ? "🔴 CRITICAL" : "✅ HEALTHY",
    current_deployment: currentDeployment,
    chaos_mode: chaosActive,
    
    health_summary: {
      error_rate: isBad ? "15.5%" : "0.8%",
      p99_latency: isBad ? "1200ms" : "180ms",
      cpu: isBad ? "92%" : "45%",
      active_alerts: isBad ? 3 : 0,
    },
    
    recent_deployments: deploymentHistory.map(d => ({
      id: d.id,
      sha: d.sha,
      status: d.status,
      message: d.message,
      age_minutes: Math.floor((Date.now() - d.timestamp) / 60000),
    })),
    
    quick_actions: {
      trigger_incident: "POST /demo/trigger-incident",
      reset: "POST /demo/reset",
      enable_chaos: "POST /chaos/latency",
      rollback: "POST /deployment/100/activate",
    },
  });
});

// Get current deployment status
app.get("/deployment/status", (req, res) => {
  res.json({
    currentDeployment,
    deploymentHistory,
    isHealthy: currentDeployment !== 101,
  });
});

// METRICS MIDDLEWARE
app.use((req, res, next) => {
  const endTimer = httpLatency.startTimer();

  res.on("finish", () => {
    httpRequests.inc({
      method: req.method,
      route: req.route ? req.route.path : req.path,
      status_code: res.statusCode,
    });

    endTimer({
      method: req.method,
      route: req.route ? req.route.path : req.path,
      status_code: res.statusCode,
    });
  });

  next();
});

// HEALTH CHECK
app.get("/health", (req, res) => {
  const isHealthy = currentDeployment !== 101;
  res.status(isHealthy ? 200 : 503).json({
    ok: isHealthy,
    deployment: currentDeployment,
    message: isHealthy ? "Service healthy" : "Service degraded",
  });
});

// USER PROFILE
app.get("/api/user/profile", (req, res) => {
  if (currentDeployment === 101) {
    setTimeout(() => {
      res.json({ user: "demo", status: "ok", deployment: currentDeployment });
    }, 800);
  } else {
    res.json({ user: "demo", status: "ok", deployment: currentDeployment });
  }
});

// REALISTIC PAGERDUTY-STYLE ALERTS
app.get("/alerts", (req, res) => {
  const timestamp = new Date().toISOString();

  if (currentDeployment === 101) {
    res.json({
      alerts: [
        {
          id: "PDALERT-001",
          type: "incident",
          summary: "High error rate detected on payment-api",
          severity: "critical",
          status: "triggered",
          urgency: "high",
          service: {
            id: "PSERVICE-001",
            name: "payment-api",
            html_url: "https://example.pagerduty.com/services/PSERVICE-001",
          },
          incident_key: "payment-api/error-rate-spike",
          created_at: new Date(Date.now() - 180000).toISOString(),
          last_status_change_at: timestamp,
          assignments: [
            {
              assignee: {
                summary: "On-Call Engineer",
                type: "user_reference",
              },
            },
          ],
          body: {
            details: {
              error_rate: "15.5%",
              threshold: "5%",
              deployment_id: 101,
              correlation: "Deployment 101 deployed 30 minutes ago",
            },
          },
        },
        {
          id: "PDALERT-002",
          type: "incident",
          summary: "P99 latency exceeding SLA threshold",
          severity: "error",
          status: "triggered",
          urgency: "high",
          service: {
            id: "PSERVICE-001",
            name: "payment-api",
          },
          incident_key: "payment-api/latency-spike",
          created_at: new Date(Date.now() - 150000).toISOString(),
          last_status_change_at: timestamp,
          body: {
            details: {
              p99_latency_ms: 1200,
              threshold_ms: 500,
              sla_breach: true,
            },
          },
        },
        {
          id: "PDALERT-003",
          type: "incident",
          summary: "CPU utilization above 90% threshold",
          severity: "warning",
          status: "triggered",
          urgency: "low",
          service: {
            id: "PSERVICE-001",
            name: "payment-api",
          },
          incident_key: "payment-api/cpu-spike",
          created_at: new Date(Date.now() - 120000).toISOString(),
          last_status_change_at: timestamp,
          body: {
            details: {
              cpu_usage: "92%",
              threshold: "85%",
            },
          },
        },
      ],
      limit: 25,
      offset: 0,
      total: 3,
      more: false,
    });
  } else {
    res.json({
      alerts: [],
      limit: 25,
      offset: 0,
      total: 0,
      more: false,
    });
  }
});

//RESET FOR DEMOS
app.post("/demo/reset", (req, res) => {
  currentDeployment = 100;
  CHAOS_LATENCY = 0;
  deploymentHistory.forEach((d) => (d.status = "inactive"));
  const deployment = deploymentHistory.find((d) => d.id === 100);
  if (deployment) deployment.status = "active";

  console.log("🔄 DEMO RESET: Back to healthy deployment 100");
  res.json({
    message: "System reset to healthy state",
    currentDeployment: 100,
    chaos_disabled: true,
    metrics: {
      error_rate: "0.8%",
      p99_latency: "180ms",
      status: "healthy",
    },
  });
});

//STRUCTURED LOGS (JSON)
app.get("/logs", (req, res) => {
  const timestamp = new Date().toISOString();

  if (currentDeployment === 101) {
    res.json({
      logs: [
        {
          timestamp: new Date(Date.now() - 300000).toISOString(),
          level: "INFO",
          service: "payment-api",
          deployment_id: 101,
          message: "Payment service started",
          trace_id: "7f3a9b2c-4d5e-6f7a-8b9c-0d1e2f3a4b5c",
          metadata: {
            version: "2.4.1",
            environment: "production",
          },
        },
        {
          timestamp: new Date(Date.now() - 240000).toISOString(),
          level: "WARN",
          service: "payment-api",
          deployment_id: 101,
          message: "High latency detected on new payment provider integration",
          trace_id: "8a4b0c3d-5e6f-7a8b-9c0d-1e2f3a4b5c6d",
          metadata: {
            latency_ms: 850,
            endpoint: "/api/payment",
            method: "POST",
          },
        },
        {
          timestamp: new Date(Date.now() - 180000).toISOString(),
          level: "ERROR",
          service: "payment-api",
          deployment_id: 101,
          message: "Database connection timeout",
          trace_id: "9b5c1d4e-6f7a-8b9c-0d1e-2f3a4b5c6d7e",
          error: {
            type: "DatabaseConnectionError",
            message: "Connection pool exhausted",
            stack:
              "at PaymentService.processPayment (/app/services/payment.js:142)\nat async POST /api/payment",
          },
          metadata: {
            pool_size: 10,
            active_connections: 10,
            wait_time_ms: 5000,
          },
        },
        {
          timestamp: new Date(Date.now() - 120000).toISOString(),
          level: "ERROR",
          service: "payment-api",
          deployment_id: 101,
          message: "Payment processing failed - timeout",
          trace_id: "0c6d2e5f-7a8b-9c0d-1e2f-3a4b5c6d7e8f",
          error: {
            type: "TimeoutError",
            message: "Payment provider did not respond within 3000ms",
          },
          metadata: {
            payment_id: "pay_1234567890",
            provider: "new_provider_v2",
            timeout_ms: 3000,
          },
        },
        {
          timestamp: new Date(Date.now() - 90000).toISOString(),
          level: "ERROR",
          service: "payment-api",
          deployment_id: 101,
          message: "Circuit breaker opened for payment gateway",
          trace_id: "1d7e3f6a-8b9c-0d1e-2f3a-4b5c6d7e8f9a",
          metadata: {
            circuit: "payment-gateway",
            failure_rate: "76%",
            threshold: "50%",
            state: "OPEN",
          },
        },
        {
          timestamp: new Date(Date.now() - 60000).toISOString(),
          level: "WARN",
          service: "payment-api",
          deployment_id: 101,
          message: "Memory pressure increasing",
          trace_id: "2e8f4a7b-9c0d-1e2f-3a4b-5c6d7e8f9a0b",
          metadata: {
            heap_used_mb: 450,
            heap_total_mb: 512,
            usage_percent: 88,
          },
        },
        {
          timestamp: new Date(Date.now() - 30000).toISOString(),
          level: "ERROR",
          service: "payment-api",
          deployment_id: 101,
          message: "500 Internal Server Error on /api/payment",
          trace_id: "3f9a5b8c-0d1e-2f3a-4b5c-6d7e8f9a0b1c",
          error: {
            type: "InternalServerError",
            message: "Unhandled promise rejection in payment processing",
          },
          metadata: {
            status_code: 500,
            path: "/api/payment",
            method: "POST",
            response_time_ms: 3542,
          },
        },
      ],
      total_count: 7,
      next_cursor: null,
    });
  } else {
    res.json({
      logs: [
        {
          timestamp: new Date(Date.now() - 300000).toISOString(),
          level: "INFO",
          service: "payment-api",
          deployment_id: 100,
          message: "Payment service started",
          trace_id: "4a0b6c9d-1e2f-3a4b-5c6d-7e8f9a0b1c2d",
          metadata: {
            version: "2.3.8",
            environment: "production",
          },
        },
        {
          timestamp: new Date(Date.now() - 240000).toISOString(),
          level: "INFO",
          service: "payment-api",
          deployment_id: 100,
          message: "All systems nominal",
          trace_id: "5b1c7d0e-2f3a-4b5c-6d7e-8f9a0b1c2d3e",
          metadata: {
            health_check: "passed",
          },
        },
        {
          timestamp: new Date(Date.now() - 180000).toISOString(),
          level: "INFO",
          service: "payment-api",
          deployment_id: 100,
          message: "Payment processed successfully",
          trace_id: "6c2d8e1f-3a4b-5c6d-7e8f-9a0b1c2d3e4f",
          metadata: {
            payment_id: "pay_9876543210",
            amount: 99.99,
            currency: "USD",
            processing_time_ms: 142,
          },
        },
        {
          timestamp: new Date(Date.now() - 120000).toISOString(),
          level: "INFO",
          service: "payment-api",
          deployment_id: 100,
          message: "Background job completed",
          trace_id: "7d3e9f2a-4b5c-6d7e-8f9a-0b1c2d3e4f5a",
          metadata: {
            job_type: "settlement_reconciliation",
            duration_ms: 2341,
            records_processed: 1523,
          },
        },
      ],
      total_count: 4,
      next_cursor: null,
    });
  }
});

// PAYMENT API
app.post("/api/payment", (req, res) => {
  if (currentDeployment === 101) {
    const failureRate = 0.75;
    if (Math.random() < failureRate) {
      setTimeout(() => {
        res.status(500).json({
          error: "Payment processing timeout",
          deployment: currentDeployment,
          message: "Database connection failed",
        });
      }, 1500);
    } else {
      res.status(200).json({
        success: true,
        deployment: currentDeployment,
      });
    }
  } else {
    const failureRate = 0.02;
    if (Math.random() < failureRate) {
      res.status(500).json({ error: "Transient error" });
    } else {
      res.status(200).json({
        success: true,
        paymentId: `pay_${Date.now()}`,
        deployment: currentDeployment,
      });
    }
  }
});

// DEMO INCIDENT
app.post("/demo/trigger-incident", (req, res) => {
  currentDeployment = 101;
  deploymentHistory.forEach((d) => (d.status = "inactive"));
  const deployment = deploymentHistory.find((d) => d.id === 101);
  if (deployment) deployment.status = "active";

  console.log("🔴 DEMO: Triggered incident with deployment 101");
  res.json({
    message: "Incident triggered - bad deployment 101 is now active",
    currentDeployment: 101,
    metrics: {
      error_rate: "15.5%",
      p99_latency: "1200ms",
      status: "degraded",
    },
  });
});

// RAW PROMETHEUS METRICS
app.get("/metrics", async (req, res) => {
  const isBad = currentDeployment === 101;

  const prometheusMetrics = await register.metrics();

  // Add realistic Prometheus-style custom metrics
  const customMetrics = `
# HELP deployment_info Current deployment information
# TYPE deployment_info gauge
deployment_info{deployment_id="${currentDeployment}",sha="${
    deploymentHistory.find((d) => d.id === currentDeployment)?.sha || "unknown"
  }",environment="production"} 1

# HELP deployment_health_status Health status of current deployment (1=healthy, 0=unhealthy)
# TYPE deployment_health_status gauge
deployment_health_status{deployment_id="${currentDeployment}"} ${isBad ? 0 : 1}

# HELP http_request_error_rate_percent Percentage of HTTP requests resulting in errors
# TYPE http_request_error_rate_percent gauge
http_request_error_rate_percent{service="payment-api",environment="production"} ${
    isBad ? 15.5 : 0.8
  }

# HELP http_request_duration_p50_milliseconds 50th percentile request duration
# TYPE http_request_duration_p50_milliseconds gauge
http_request_duration_p50_milliseconds{service="payment-api",environment="production"} ${
    isBad ? 450 : 85
  }

# HELP http_request_duration_p95_milliseconds 95th percentile request duration
# TYPE http_request_duration_p95_milliseconds gauge
http_request_duration_p95_milliseconds{service="payment-api",environment="production"} ${
    isBad ? 850 : 120
  }

# HELP http_request_duration_p99_milliseconds 99th percentile request duration
# TYPE http_request_duration_p99_milliseconds gauge
http_request_duration_p99_milliseconds{service="payment-api",environment="production"} ${
    isBad ? 1200 : 180
  }

# HELP http_requests_per_second Current request rate
# TYPE http_requests_per_second gauge
http_requests_per_second{service="payment-api",environment="production"} ${
    isBad ? 25 : 98
  }

# HELP process_cpu_usage_percent CPU usage percentage
# TYPE process_cpu_usage_percent gauge
process_cpu_usage_percent{service="payment-api",environment="production"} ${
    isBad ? 92 : 45
  }

# HELP process_memory_usage_percent Memory usage percentage
# TYPE process_memory_usage_percent gauge
process_memory_usage_percent{service="payment-api",environment="production"} ${
    isBad ? 88 : 52
  }

# HELP active_connections Current number of active connections
# TYPE active_connections gauge
active_connections{service="payment-api",environment="production"} ${
    isBad ? 450 : 120
  }
`;

  res.set("Content-Type", register.contentType);
  res.end(prometheusMetrics + customMetrics);
});

// CLEAN JSON METRICS (GRAFANA-STYLE)
app.get("/metrics/json", (req, res) => {
  const timestamp = Date.now();

  const isBad = currentDeployment === 101;
  const isGood = currentDeployment !== 101;

  // Chaos mode modifications
  const chaosActive = CHAOS_LATENCY > 0;
  const chaosLatencyBoost = chaosActive ? CHAOS_LATENCY : 0;
  const chaosErrorBoost = chaosActive ? 3 : 0;

  // --- HEALTHY METRICS (e.g., after rollback to 100) ---
  const healthyMetrics = {
    error_rate_percent: 0.8 + chaosErrorBoost,
    p50_latency_ms: 85 + chaosLatencyBoost,
    p95_latency_ms: 120 + chaosLatencyBoost,
    p99_latency_ms: 180 + chaosLatencyBoost,
    requests_per_second: 110,
    cpu_usage_percent: 45,
    memory_usage_percent: 52,
    active_connections: 120,
  };

  // --- DEGRADED METRICS (deployment 101 or chaos) ---
  const degradedMetrics = {
    error_rate_percent: 15.5 + chaosErrorBoost,
    p50_latency_ms: 450 + chaosLatencyBoost,
    p95_latency_ms: 850 + chaosLatencyBoost,
    p99_latency_ms: 1200 + chaosLatencyBoost,
    requests_per_second: 25,
    cpu_usage_percent: 92,
    memory_usage_percent: 88,
    active_connections: 450,
  };

  // Choose final metrics
  const finalMetrics = isBad || chaosActive ? degradedMetrics : healthyMetrics;

  // Choose health status
  const healthStatus = isBad || chaosActive ? "degraded" : "healthy";

  // Prepare deployment info
  const info = deploymentHistory.find((d) => d.id === currentDeployment) || {};

  res.json({
    deployment_id: currentDeployment,
    timestamp: new Date().toISOString(),

    health_status: healthStatus,

    metrics: finalMetrics,

    recent_errors:
      isBad || chaosActive
        ? [
            "Database connection timeout",
            "Payment gateway unreachable",
            "Circuit breaker opened",
          ]
        : [],

    deployment_info: {
      id: currentDeployment,
      sha: info.sha || "unknown",
      message: info.message || "unknown",
      deployed_at: info.timestamp || timestamp,
      status: info.status || (isBad ? "bad" : "stable"),
    },

    chaos_active: chaosActive,
    chaos_latency_ms: CHAOS_LATENCY,
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Payment API running on port ${PORT}`);
  console.log(
    `📊 Current deployment: ${currentDeployment} (${
      currentDeployment === 101 ? "BAD" : "GOOD"
    })`
  );
  console.log(`\n Endpoints:`);
  console.log(`   POST /chaos/latency`);
  console.log(`   GET  /health`);
  console.log(`   GET  /metrics                (Prometheus format)`);
  console.log(`   GET  /metrics/json           (Grafana-style JSON)`);
  console.log(`   GET  /alerts                 (PagerDuty format)`);
  console.log(`   GET  /logs                   (Structured JSON logs)`);
  console.log(`   POST /api/payment`);
  console.log(`   GET  /deployment/status`);
  console.log(`   POST /deployment/:id/activate`);
  console.log(`   POST /demo/trigger-incident`);
  console.log(`\n Demo flow:`);
  console.log(`   1. Service starts healthy with deployment 100`);
  console.log(`   2. Trigger incident OR enable chaos mode`);
  console.log(`   3. AI analyzes and recommends rollback`);
  console.log(`   4. Auto-rollback to deployment 100 (if needed)`);
  console.log(`   5. Metrics improve, incident resolved`);
  console.log(`\n Chaos mode:`);
  console.log(`   - Set chaos_mode: true in Kestra workflow`);
  console.log(`   - Injects 600ms latency into all requests`);
  console.log(`   - Boosts P99 latency: 180ms → 780ms`);
  console.log(`   - Increases error rate by 3%`);
  console.log(`   - Tests incident detection without bad deployment`);
});

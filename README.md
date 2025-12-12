# AI Incident Commander
Autonomous incident response for real-world SRE workflows.

AI Incident Commander is an end-to-end automation engine built on Kestra, GitHub Actions, Slack, and a live mock microservice that behaves like real production infrastructure.

It continuously monitors system signals, reasons about incidents using Kestra’s built-in AI Agent, and executes autonomous remediation such as GitHub-powered rollbacks.

The result: a hands-free SRE workflow that detects, analyzes, and resolves outages automatically.

<p align="center">
  <img src="docs/architecture.svg" width="800"/>
</p>

## What It Does
### 1. Detects production issues in real time
The workflow continuously collects live operational signals:
Metrics (/metrics/json)
Logs (/logs)
Alerts (/alerts)
Deployment history (GitHub or mock)
This becomes the full incident context for the AI decision engine.

### 2. Uses Kestra’s built-in AI Agent to analyze everything
The AI receives a complete incident bundle:
Metrics & latency breakdown
Anomaly list
Logs and alerts
Deployment history
Health status

*It produces a structured JSON decision:*
Severity: P0 | P1 | P2 | P3
Confidence score: 0.0 - 1.0
Incident summary
Root-cause hypothesis
Recommended action (rollback / monitor / escalate)
Deployment to roll back to
PagerDuty priority
This JSON is the brain of the incident workflow.

### 3. Executes decisions automatically

Depending on severity + confidence:
*P0 → Autonomous rollback*
Triggers GitHub Actions workflow_dispatch.
Appears directly under:
`GitHub → Actions → Rollback Deployment`

*P1 → Immediate major-incident alert*
Slack notification + PagerDuty (real or mock).

*P2/P3 → Logged and monitored*
No remediation action.

All execution paths are fully automated.

### 4. Validates recovery with post-remediation health checks

After rollback or remediation, Kestra:
Waits for stabilization
Pulls new metrics
Compares before vs after
Classifies the system:
FULLY_RECOVERED
SIGNIFICANT_IMPROVEMENT
IMPROVING
STABLE
DEGRADED
This ensures the rollback genuinely resolved the incident.

## 5. Sends clean, structured Slack alerts

Two messages go to Slack:

A. The P0 incident alert

Includes:
Summary & Root cause hypothesis
Error rate, CPU, latency
Detected anomalies
Deployment context
Severity + Confidence
Action taken

*B. The post-remediation health report*
Shows:
Before vs after metrics
Improvement percentages
Final recovery classification

### 6. Stores an incident snapshot for auditing
Each execution ends with a complete JSON snapshot:
Metrics (before & after)
Action taken
Anomalies
AI explanations
Deployment changes
Integrations used
Health classification

This allows historical replay, analytics, and dashboards.

## Demo Microservice Included
The mock payment-api replicates real service behavior:
Activate any deployment
Trigger bad deployments
Inject chaos latency
Emit realistic metrics + errors

You can run fully autonomous incidents without touching production.

## GitHub Actions Integration
A true rollback is dispatched via:
```POST /repos/<owner>/<repo>/actions/workflows/rollback.yml/dispatches```
Every remediation becomes a visible workflow run containing:
Deployment ID
Service
Environment
Kestra execution ID

## Chaos Engineering Mode
Enable chaos_mode: true in Kestra:
Injects 600ms latency for 30 seconds
Raises error rate
Forces AI to adapt
Demonstrates resilience testing

## Tech Stack
Kestra Workflows & AI Agent
OpenAI (via Kestra plugin)
GitHub Actions (workflow_dispatch)
Slack Webhooks
Mock microservice (Node.js)
Docker Compose
Python scripting inside tasks

## Running the Demo
```docker compose up -d --build```

This launches:

Kestra
Payment API (mock service)
Grafana + Prometheus (optional)
PostgreSQL for Kestra

Trigger an incident:
```curl -X POST http://localhost:3000/demo/trigger-incident```

Run the Kestra flow.
Watch the GitHub Action fire.
Check Slack for alerts.
Observe the rollback and recovery.
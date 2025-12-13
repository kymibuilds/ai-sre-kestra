# AI Incident Commander

> Autonomous incident response for real-world SRE workflows.

AI Incident Commander is an end-to-end automation engine built on Kestra, GitHub Actions, Slack, and a live mock microservice that behaves like real production infrastructure. It continuously monitors system signals, reasons about incidents using Kestra's built-in AI Agent, and executes autonomous remediation such as GitHub-powered rollbacks.

The result: a hands-free SRE workflow that detects, analyzes, and resolves outages automatically.

<p align="center">
  <img src="docs/architecture.svg" width="800"/>
</p>

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [How It Works](#how-it-works)
  - [Detection Phase](#1-detection-phase)
  - [Analysis Phase](#2-analysis-phase)
  - [Execution Phase](#3-execution-phase)
  - [Validation Phase](#4-validation-phase)
  - [Notification Phase](#5-notification-phase)
  - [Audit Phase](#6-audit-phase)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
  - [Input Parameters](#input-parameters)
  - [Environment Variables](#environment-variables)
- [Usage](#usage)
  - [Quick Start](#quick-start)
  - [Triggering Test Incidents](#triggering-test-incidents)
  - [Chaos Engineering Mode](#chaos-engineering-mode)
- [Kestra Plugins Used](#kestra-plugins-used)
- [GitHub Actions Integration](#github-actions-integration)
- [Demo Microservice](#demo-microservice)
- [Observability](#observability)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

## Overview

AI Incident Commander automates the entire incident response lifecycle. From detection to resolution, the system operates autonomously, making intelligent decisions based on real-time metrics, logs, and deployment history. This reduces mean time to resolution (MTTR) and eliminates manual intervention during critical outages.

## Key Features

- **Autonomous Incident Detection**: Continuously monitors metrics, logs, and alerts to detect production issues in real time
- **AI-Powered Analysis**: Leverages Kestra's AI Agent with OpenAI to analyze incidents and recommend actions with confidence scores
- **Intelligent Severity Classification**: Automatically categorizes incidents as P0 (Critical), P1 (Major), P2 (Moderate), or P3 (Normal)
- **Automated Rollback Execution**: Triggers GitHub Actions workflows to roll back problematic deployments
- **Multi-Channel Alerting**: Sends structured notifications to Slack and creates PagerDuty incidents
- **Post-Remediation Validation**: Verifies that remediation actions successfully resolved the incident
- **Chaos Engineering Support**: Built-in chaos injection for testing resilience and incident response
- **Complete Audit Trail**: Stores detailed incident snapshots for historical analysis and compliance
- **Mock Service Included**: Realistic payment service simulation for safe testing without touching production

## How It Works

### 1. Detection Phase

The workflow continuously collects live operational signals every 5 minutes (configurable):

- **Metrics** (`/metrics/json`): Error rates, latency percentiles (P50, P95, P99), CPU/memory usage, request rates
- **Logs** (`/logs`): Application logs with error patterns and stack traces
- **Alerts** (`/alerts`): Active alert definitions and firing conditions
- **Deployment History**: Recent deployments from GitHub API or mock data

This comprehensive data becomes the full incident context for the AI decision engine.

### 2. Analysis Phase

The AI Agent receives a complete incident bundle and performs multi-dimensional analysis:

**Input Data:**

- Current metrics with historical baselines
- Anomaly detection results (critical, warning, minor)
- Log samples showing error patterns
- Active alerts and their severity
- Recent deployment timeline
- Service health status

**Analysis Output (Structured JSON):**

```json
{
  "severity": "P0",
  "confidence_score": 92,
  "incident_summary": "Critical latency spike detected",
  "root_cause_hypothesis": "Recent deployment introduced N+1 query",
  "recommended_action": "rollback",
  "deployment_to_rollback": 100,
  "pagerduty_priority": "P1"
}
```

The AI applies strict severity rules based on threshold violations and anomaly classifications.

### 3. Execution Phase

Based on severity and confidence score, the system takes appropriate action:

**P0 (Critical) Response:**

- Confidence ≥ 80%: Autonomous rollback via GitHub Actions
- Confidence < 80%: Escalate to humans via Slack with @channel mention
- Creates PagerDuty incident with critical severity
- Sends detailed Slack notification with full context

**P1 (Major) Response:**

- Creates PagerDuty incident with high priority
- Sends Slack notification to on-call team
- No automatic rollback (requires human approval)

**P2 (Moderate) Response:**

- Logs incident for monitoring
- Sends informational Slack notification
- Monitors during business hours

**P3 (Normal) Response:**

- Records in incident log
- No active notifications

### 4. Validation Phase

After remediation, the system validates recovery:

**Health Check Process:**

1. Waits 10 seconds for service stabilization
2. Fetches new metrics from the service
3. Compares before and after states
4. Calculates improvement percentages
5. Classifies recovery status:
   - `FULLY_RECOVERED`: Error rate < 1%, latency < 200ms
   - `SIGNIFICANT_IMPROVEMENT`: 50%+ reduction in errors, 30%+ latency improvement
   - `IMPROVING`: Metrics trending positively
   - `STABLE`: No change detected
   - `DEGRADED`: Metrics worsened

### 5. Notification Phase

The system sends two structured Slack messages:

**A. Incident Alert:**

- Service and environment details
- Severity level with confidence score
- Incident summary and root cause hypothesis
- Current metrics (error rate, latency, CPU, memory)
- Detected anomalies
- Action taken (rollback/monitor/escalate)
- Deployment context and source
- Execution ID and timestamp

**B. Post-Remediation Health Report:**

- Recovery status classification
- Before vs. after metrics comparison
- Percentage improvements for error rate and latency
- Deployment change confirmation
- Link to Kestra execution

### 6. Audit Phase

Each execution concludes with a comprehensive incident snapshot saved as JSON:

```json
{
  "execution_id": "abc123",
  "timestamp": "2025-12-13T10:30:00Z",
  "service": "payment-api",
  "severity": "P0",
  "confidence": 92,
  "metrics": {
    "before": { "error_rate": 15.2, "p99_latency": 850 },
    "after": { "error_rate": 0.8, "p99_latency": 180 },
    "improvement": { "error_rate_pct": 94.7, "latency_pct": 78.8 }
  },
  "action_taken": "rollback",
  "health_status": "FULLY_RECOVERED"
}
```

This enables historical replay, trend analysis, and executive dashboards.

## Architecture

The system follows a microservices architecture with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────┐
│                      Kestra Workflow                         │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐            │
│  │  Monitor   │→ │  AI Agent  │→ │ Remediate  │            │
│  └────────────┘  └────────────┘  └────────────┘            │
└──────────┬──────────────┬──────────────┬───────────────────┘
           │              │              │
           ↓              ↓              ↓
    ┌──────────┐   ┌──────────┐  ┌──────────────┐
    │ Service  │   │  OpenAI  │  │GitHub Actions│
    │ Metrics  │   │   API    │  │  (Rollback)  │
    └──────────┘   └──────────┘  └──────────────┘
           │                             │
           └─────────────┬───────────────┘
                         ↓
              ┌──────────────────────┐
              │  Slack + PagerDuty   │
              └──────────────────────┘
```

**Components:**

- **Kestra**: Workflow orchestration and AI Agent runtime
- **Payment API**: Mock microservice simulating production behavior
- **GitHub Actions**: Deployment and rollback execution
- **OpenAI**: LLM for incident analysis and decision making
- **Slack**: Real-time notifications and alerts
- **PagerDuty**: Incident management and escalation
- **PostgreSQL**: Kestra state and execution history
- **Prometheus + Grafana**: Optional observability stack

## Prerequisites

Before running AI Incident Commander, ensure you have the following installed and configured:

### Required Software

- **Docker**: Version 20.10 or higher
- **Docker Compose**: Version 2.0 or higher
- **Git**: For cloning the repository
- **curl**: For testing API endpoints

### Required Accounts and API Keys

- **OpenAI API Key**: For AI Agent analysis ([Get one here](https://platform.openai.com/api-keys))
- **Slack Incoming Webhook**: For notifications ([Create webhook](https://api.slack.com/messaging/webhooks))
- **GitHub Personal Access Token** (Optional): For real deployment tracking ([Create token](https://github.com/settings/tokens))
- **PagerDuty Integration Key** (Optional): For incident management ([Get integration key](https://support.pagerduty.com/docs/services-and-integrations))

### System Requirements

- **Memory**: Minimum 4GB RAM available for Docker
- **Disk**: At least 2GB free space
- **CPU**: 2+ cores recommended for optimal performance
- **Network**: Internet connectivity for API calls to OpenAI, GitHub, Slack, and PagerDuty

### Knowledge Requirements

Familiarity with:

- Basic Docker and container concepts
- Kestra workflow syntax and execution model
- YAML configuration files
- REST API interaction
- Incident response fundamentals

## Installation

Follow these steps to set up AI Incident Commander:

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/ai-incident-commander.git
cd ai-incident-commander
```

### 2. Configure Environment Variables

Create a `.env` file in the project root:

```bash
cat > .env << EOF
# OpenAI Configuration (Required)
OPENAI_API_KEY=sk-your-openai-api-key-here

# Slack Configuration (Required)
SLACK_WEBHOOK=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# GitHub Configuration (Optional - use 'mock' for demo)
GITHUB_TOKEN=ghp_your-github-token-here
DEPLOYMENTS_REPO=owner/repo

# PagerDuty Configuration (Optional - use 'mock' for demo)
PAGERDUTY_TOKEN=your-pagerduty-integration-key
PAGERDUTY_SERVICE_ID=PSERVICE1
PAGERDUTY_ESCALATION_POLICY=PEPOLICY1
EOF
```

### 3. Start the Services

```bash
docker compose up -d --build
```

This command starts:

- Kestra server (port 8080)
- PostgreSQL database (port 5432)
- Payment API mock service (port 3000)
- Prometheus (port 9090) - optional
- Grafana (port 3001) - optional

### 4. Verify Installation

Check that all services are running:

```bash
docker compose ps
```

Access the Kestra UI:

```bash
open http://localhost:8080
```

Test the Payment API:

```bash
curl http://localhost:3000/health
```

Expected response:

```json
{ "status": "healthy", "service": "payment-api" }
```

### 5. Import the Workflow

In the Kestra UI:

1. Navigate to **Flows**
2. Click **Create**
3. Paste the contents of `ai-incident-commander.yml`
4. Click **Save**

The workflow is now ready to execute.

## Configuration

### Input Parameters

The workflow accepts the following configuration parameters:

| Parameter                     | Type    | Default                                | Description                                                                                               |
| ----------------------------- | ------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `github_token`                | STRING  | `mock`                                 | GitHub personal access token for deployment history. Use `mock` for demo mode without GitHub integration. |
| `pagerduty_token`             | STRING  | `mock`                                 | PagerDuty integration key. Use `mock` for demo mode without PagerDuty alerts.                             |
| `slack_webhook`               | STRING  | `{{ secret('SLACK_WEBHOOK') }}`        | Slack incoming webhook URL for notifications. Required for alerts.                                        |
| `deployments_repo`            | STRING  | `demo/service`                         | GitHub repository in format `owner/repo` for tracking deployments.                                        |
| `service_name`                | STRING  | `payment-api`                          | Name of the service being monitored. Used in alerts and logs.                                             |
| `service_url`                 | STRING  | `http://payment-api:3000`              | Base URL of the service to monitor.                                                                       |
| `environment`                 | STRING  | `production`                           | Environment name (production, staging, dev).                                                              |
| `metrics_url`                 | STRING  | `http://payment-api:3000/metrics/json` | Full URL to metrics endpoint returning JSON.                                                              |
| `logs_url`                    | STRING  | `http://payment-api:3000/logs`         | Full URL to logs endpoint.                                                                                |
| `alerts_url`                  | STRING  | `http://payment-api:3000/alerts`       | Full URL to alerts endpoint.                                                                              |
| `min_confidence_for_rollback` | INT     | `80`                                   | Minimum AI confidence score (0-100) required to trigger automatic rollback.                               |
| `chaos_mode`                  | BOOLEAN | `false`                                | Enable chaos engineering mode to inject failures for testing.                                             |
| `chaos_type`                  | STRING  | `latency`                              | Type of chaos: `latency`, `error-rate`, `cpu-spike`.                                                      |
| `chaos_duration`              | STRING  | `30s`                                  | Duration for chaos experiment (e.g., `30s`, `1m`, `5m`).                                                  |
| `chaos_intensity`             | STRING  | `medium`                               | Chaos intensity level: `low`, `medium`, `high`.                                                           |
| `pagerduty_service_id`        | STRING  | `PSERVICE1`                            | PagerDuty service ID for incident creation.                                                               |
| `pagerduty_escalation_policy` | STRING  | `PEPOLICY1`                            | PagerDuty escalation policy ID.                                                                           |

### Environment Variables

Store sensitive credentials as Kestra secrets:

**Via Kestra UI:**

1. Navigate to **Settings** → **Secrets**
2. Add secrets:
   - `OPENAI_API_KEY`: Your OpenAI API key
   - `SLACK_WEBHOOK`: Your Slack webhook URL
   - `GITHUB_TOKEN`: Your GitHub token (if using real GitHub integration)
   - `PAGERDUTY_TOKEN`: Your PagerDuty integration key (if using real PagerDuty)

**Via Environment Variables:**

```bash
export KESTRA_SECRET_OPENAI_API_KEY=sk-your-key
export KESTRA_SECRET_SLACK_WEBHOOK=https://hooks.slack.com/...
```

## Usage

### Quick Start

**Run the workflow manually:**

1. Open Kestra UI at `http://localhost:8080`
2. Navigate to your flow: `hackathon.sre` → `ai-incident-commander`
3. Click **Execute**
4. Leave default parameters or customize as needed
5. Click **Execute** to start

The workflow will:

- Fetch current metrics from the payment API
- Analyze the service health
- Make AI-powered decisions
- Send notifications to Slack

### Triggering Test Incidents

The mock payment API provides several endpoints to simulate production issues:

**Trigger a generic incident:**

```bash
curl -X POST http://localhost:3000/demo/trigger-incident
```

**Activate a bad deployment:**

```bash
curl -X POST http://localhost:3000/demo/bad-deployment
```

**Inject chaos (latency):**

```bash
curl -X POST http://localhost:3000/chaos/latency \
  -H "Content-Type: application/json" \
  -d '{"latency_ms": 600, "duration_seconds": "60s"}'
```

**Inject chaos (error rate):**

```bash
curl -X POST http://localhost:3000/chaos/errors \
  -H "Content-Type: application/json" \
  -d '{"error_rate_percent": 25, "duration_seconds": "60s"}'
```

**Inject chaos (CPU spike):**

```bash
curl -X POST http://localhost:3000/chaos/cpu \
  -H "Content-Type: application/json" \
  -d '{"cpu_percent": 90, "duration_seconds": "60s"}'
```

**Check current metrics:**

```bash
curl http://localhost:3000/metrics/json
```

### Chaos Engineering Mode

Enable chaos mode directly in the workflow to test resilience:

**In Kestra UI:**

1. Edit the flow execution parameters
2. Set `chaos_mode` to `true`
3. Configure chaos parameters:
   - `chaos_type`: `latency`, `error-rate`, or `cpu-spike`
   - `chaos_intensity`: `low`, `medium`, or `high`
   - `chaos_duration`: Time duration (e.g., `30s`, `2m`)
4. Execute the flow

**Example chaos configurations:**

| Type         | Intensity | Effect          |
| ------------ | --------- | --------------- |
| `latency`    | `low`     | +200ms latency  |
| `latency`    | `medium`  | +600ms latency  |
| `latency`    | `high`    | +1500ms latency |
| `error-rate` | `low`     | 5% error rate   |
| `error-rate` | `medium`  | 15% error rate  |
| `error-rate` | `high`    | 30% error rate  |
| `cpu-spike`  | `low`     | 70% CPU usage   |
| `cpu-spike`  | `medium`  | 85% CPU usage   |
| `cpu-spike`  | `high`    | 95% CPU usage   |

The workflow will automatically inject the specified chaos, detect the anomalies, and execute the appropriate response.

## Kestra Plugins Used

This project leverages the following Kestra plugins:

| Plugin                                 | Purpose                   | Tasks Used                                               |
| -------------------------------------- | ------------------------- | -------------------------------------------------------- |
| `io.kestra.plugin.core.flow`           | Flow control and logic    | `If`, `Switch`, `Parallel`, `Sequential`, `Sleep`        |
| `io.kestra.plugin.core.http`           | HTTP API interactions     | `Request` (for metrics, logs, alerts, GitHub, PagerDuty) |
| `io.kestra.plugin.core.log`            | Logging and debugging     | `Log`                                                    |
| `io.kestra.plugin.scripts.python`      | Python scripting          | `Script` (parsing, analysis, calculations)               |
| `io.kestra.plugin.ai.agent`            | AI Agent integration      | `AIAgent` (incident analysis)                            |
| `io.kestra.plugin.ai.provider`         | AI provider configuration | `OpenAI` (LLM backend)                                   |
| `io.kestra.plugin.notifications.slack` | Slack notifications       | `SlackIncomingWebhook`                                   |
| `io.kestra.plugin.core.trigger`        | Workflow scheduling       | `Schedule` (cron-based monitoring)                       |

**Plugin Documentation:**

- [Core Plugins](https://kestra.io/plugins/core)
- [AI Plugins](https://kestra.io/plugins/plugin-ai)
- [Notification Plugins](https://kestra.io/plugins/plugin-notifications)
- [Script Plugins](https://kestra.io/plugins/plugin-script)

## GitHub Actions Integration

The system integrates with GitHub Actions for automated rollbacks:

**How it works:**

1. When the AI decides to rollback (P0 incident, confidence ≥ 80%), Kestra triggers a GitHub Actions workflow
2. The workflow is dispatched via GitHub's REST API: `POST /repos/{owner}/{repo}/actions/workflows/rollback.yml/dispatches`
3. The workflow receives:
   - Deployment ID to rollback to
   - Service name
   - Environment
   - Kestra execution ID
   - Incident reason
   - AI confidence score

**Example GitHub Actions workflow** (`rollback.yml`):

```yaml
name: Rollback Deployment

on:
  workflow_dispatch:
    inputs:
      rollback_to:
        description: "Deployment ID to rollback to"
        required: true
      service:
        description: "Service name"
        required: true
      environment:
        description: "Environment (production, staging)"
        required: true
      execution_id:
        description: "Kestra execution ID"
        required: true
      reason:
        description: "Rollback reason"
        required: true
      confidence:
        description: "AI confidence score"
        required: true

jobs:
  rollback:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v3

      - name: Execute rollback
        run: |
          echo "Rolling back ${{ github.event.inputs.service }} to deployment ${{ github.event.inputs.rollback_to }}"
          # Your rollback logic here (kubectl, helm, etc.)

      - name: Notify Kestra
        run: |
          curl -X POST "https://your-kestra-instance/api/v1/executions/webhook/rollback-complete" \
            -H "Content-Type: application/json" \
            -d '{"execution_id": "${{ github.event.inputs.execution_id }}", "status": "success"}'
```

**Setup:**

1. Create `.github/workflows/rollback.yml` in your repository
2. Add your rollback logic (Kubernetes, Helm, Docker, etc.)
3. Set `github_token` in Kestra workflow to your GitHub PAT
4. Set `deployments_repo` to your repository (`owner/repo`)

## Demo Microservice

The included `payment-api` mock service provides realistic production behavior:

**Available endpoints:**

| Endpoint                   | Method | Description                                        |
| -------------------------- | ------ | -------------------------------------------------- |
| `/health`                  | GET    | Health check status                                |
| `/metrics/json`            | GET    | Current metrics (error rate, latency, CPU, memory) |
| `/logs`                    | GET    | Recent application logs                            |
| `/alerts`                  | GET    | Active alert definitions                           |
| `/deployment/:id/activate` | POST   | Switch to specific deployment                      |
| `/demo/trigger-incident`   | POST   | Simulate a production incident                     |
| `/demo/bad-deployment`     | POST   | Activate deployment with high error rate           |
| `/chaos/latency`           | POST   | Inject latency chaos                               |
| `/chaos/errors`            | POST   | Inject error rate chaos                            |
| `/chaos/cpu`               | POST   | Inject CPU spike chaos                             |

**Service features:**

- Multiple deployment states (good, degraded, bad)
- Configurable error rates and latency
- Realistic metric generation
- Log patterns matching production issues
- Chaos engineering capabilities
- Health status reporting

## Observability

The project includes optional Prometheus and Grafana for monitoring:

**Access Grafana:**

```bash
open http://localhost:3001
```

Default credentials: `admin` / `admin`

**Access Prometheus:**

```bash
open http://localhost:9090
```

**Pre-configured dashboards:**

- Service health metrics
- Incident response times
- Rollback success rates
- AI confidence score trends
- Alert frequency by severity

## Troubleshooting

### Workflow execution fails immediately

**Symptom:** Workflow fails at the first task with connection error.

**Solutions:**

1. Verify all services are running: `docker compose ps`
2. Check payment-api is accessible: `curl http://localhost:3000/health`
3. Review Kestra logs: `docker compose logs kestra`
4. Ensure network connectivity between containers

### AI Agent returns parsing errors

**Symptom:** `parse_ai_decision` task fails with JSON decode error.

**Solutions:**

1. Check OpenAI API key is valid: `echo $OPENAI_API_KEY`
2. Verify API key is set as Kestra secret
3. Review AI Agent output in task logs
4. Ensure OpenAI account has available credits
5. Check for API rate limiting

### GitHub Actions workflow not triggered

**Symptom:** No workflow runs appear in GitHub Actions tab.

**Solutions:**

1. Verify `github_token` has `repo` and `workflow` scopes
2. Check repository name format is correct (`owner/repo`)
3. Ensure `rollback.yml` workflow exists in `.github/workflows/`
4. Review Kestra logs for GitHub API errors
5. Confirm workflow has `workflow_dispatch` trigger

### Slack notifications not received

**Symptom:** No messages appear in Slack channel.

**Solutions:**

1. Verify webhook URL is correct
2. Test webhook manually: `curl -X POST -H 'Content-Type: application/json' -d '{"text":"test"}' YOUR_WEBHOOK_URL`
3. Check Slack app is installed in workspace
4. Ensure webhook has permission to post to channel
5. Review Kestra task logs for HTTP errors

### PagerDuty incidents not created

**Symptom:** No incidents appear in PagerDuty dashboard.

**Solutions:**

1. Verify integration key is correct
2. Check service ID and escalation policy exist
3. Test PagerDuty Events API manually
4. Ensure integration is active in PagerDuty
5. Review Kestra logs for API responses

### Metrics show zero values

**Symptom:** All metrics are 0 or undefined.

**Solutions:**

1. Check payment-api is generating traffic
2. Verify metrics endpoint returns data: `curl http://localhost:3000/metrics/json`
3. Trigger test incident to generate metrics
4. Review `parse_metrics` task output
5. Ensure JSON structure matches expected format

### Docker containers crash on startup

**Symptom:** Services exit immediately after starting.

**Solutions:**

1. Check system resources (memory, disk space)
2. Review Docker logs: `docker compose logs --tail=50`
3. Ensure ports 8080, 3000, 5432 are available
4. Verify `.env` file is properly formatted
5. Rebuild containers: `docker compose up -d --build --force-recreate`

### High false positive rate

**Symptom:** Workflow triggers rollbacks for normal fluctuations.

**Solutions:**

1. Increase `min_confidence_for_rollback` threshold (e.g., 90)
2. Adjust anomaly detection thresholds in workflow
3. Review AI system prompt for severity rules
4. Add baseline metrics for better comparison
5. Tune chaos injection parameters for testing

## Contributing

We welcome contributions from the community! Here's how you can help:

### Reporting Issues

1. Check existing issues to avoid duplicates
2. Provide clear reproduction steps
3. Include Kestra workflow logs
4. Specify your environment (Docker version, OS)
5. Add relevant configuration (sanitized)

### Submitting Pull Requests

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature-name`
3. Make your changes with clear commit messages
4. Add tests if applicable
5. Update documentation as needed
6. Submit PR with detailed description

### Development Setup

```bash
# Clone your fork
git clone https://github.com/yourusername/ai-incident-commander.git
cd ai-incident-commander

# Create feature branch
git checkout -b feature/amazing-feature

# Make changes and test
docker compose up -d --build

# Commit changes
git commit -m "Add amazing feature"

# Push to your fork
git push origin feature/amazing-feature
```

### Code Style

- Use clear, descriptive variable names
- Add comments for complex logic
- Follow YAML best practices for Kestra workflows
- Keep Python scripts modular and testable
- Document all configuration parameters

### Areas for Contribution

- Additional chaos engineering scenarios
- New integration plugins (ServiceNow, Datadog, etc.)
- Enhanced AI prompts for better incident analysis
- Grafana dashboard templates
- Multi-region deployment support
- Custom metric aggregation logic
- Automated testing framework
- Performance optimizations

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

**Built with ❤️ using Kestra, OpenAI, and the power of autonomous systems.**

# AI Incident Commander

Autonomous incident response system that monitors, analyzes, and remediates production incidents using AI.

## 🎯 Features

- **Anomaly Detection**: Detects error rate spikes, latency issues, resource exhaustion
- **AI Analysis**: GPT-4 analyzes metrics, logs, and alerts with confidence scoring
- **Autonomous Rollback**: Automatically reverts bad deployments when confidence > threshold
- **Chaos Engineering**: Built-in chaos injection for testing
- **Rich Notifications**: Detailed Slack alerts with before/after metrics
- **Production-Ready**: Works with Prometheus, Grafana, PagerDuty, GitHub

## 🚀 Quick Start (Demo Mode)

See it in action with mock data in under 2 minutes:

```bash
# Clone and start
git clone <your-repo>
cd yeahproject
docker-compose up -d

# Access Kestra UI
open http://localhost:8080

# Run the workflow
# 1. Navigate to "hackathon.sre" namespace
# 2. Click "ai-incident-commander"
# 3. Click "Execute"
# 4. Watch the magic happen!
```

**What happens in the demo:**
1. Mock payment service starts with a bad deployment (101)
2. System detects 5 anomalies: high error rate, latency spikes, resource issues
3. AI analyzes with 90% confidence and recommends rollback
4. Automatic rollback to stable deployment (100)
5. Service fully recovers (95% error reduction, 85% latency improvement)
6. Slack notification shows complete incident timeline

## 🏢 Production Setup

### Prerequisites

- Running Kubernetes cluster (for deployment rollbacks)
- Prometheus/Grafana (for metrics)
- PagerDuty (for alerts) - optional
- Slack webhook (for notifications)
- GitHub token (for deployment management)

### Configuration

1. **Update Kestra workflow inputs** in the UI or via API:

```yaml
inputs:
  github_token: "ghp_your_real_token"
  pagerduty_token: "your_pd_token"
  slack_webhook: "https://hooks.slack.com/services/YOUR/WEBHOOK"
  
  # Point to your real service
  service_url: "https://api.yourcompany.com"
  metrics_url: "https://prometheus.yourcompany.com/api/v1/query"
  alerts_url: "https://api.pagerduty.com/incidents"
  
  # Your service details
  service_name: "your-api-name"
  k8s_namespace: "production"
  environment: "production"
```

2. **Adjust thresholds** for your risk tolerance:

```yaml
inputs:
  min_confidence_for_rollback: 80  # AI must be 80%+ confident to auto-rollback
  enable_auto_remediation: true    # Set false to notify-only mode
```

3. **Customize anomaly detection** in the workflow:

```python
# Edit the anomaly_detection task thresholds
if error_rate > 5:        # Adjust for your SLA
if cpu > 85:              # Adjust for your capacity
if p99 > 500:             # Adjust for your latency targets
```

### Integration Examples

#### Prometheus Metrics

Your `/metrics/json` endpoint should return:

```json
{
  "deployment_id": 123,
  "timestamp": "2025-12-12T06:00:00Z",
  "health_status": "healthy",
  "metrics": {
    "error_rate_percent": 0.5,
    "p95_latency_ms": 120,
    "p99_latency_ms": 180,
    "cpu_usage_percent": 45,
    "memory_usage_percent": 52
  }
}
```

#### PagerDuty Alerts

Expected format:

```json
{
  "alerts": [
    {
      "id": "ALERT-001",
      "severity": "critical",
      "summary": "High error rate detected",
      "status": "triggered"
    }
  ]
}
```

#### Structured Logs

Expected format:

```json
{
  "logs": [
    {
      "timestamp": "2025-12-12T06:00:00Z",
      "level": "ERROR",
      "message": "Database connection timeout",
      "trace_id": "abc-123",
      "metadata": {}
    }
  ]
}
```

## 🧪 Testing Your Setup

### 1. Enable Chaos Mode

Test the system without affecting real traffic:

```yaml
inputs:
  chaos_mode: true  # Injects 600ms latency for 30 seconds
```

### 2. Verify Detection

Check that anomalies are detected:
- Error rate threshold breached
- Latency SLA violated
- Resource utilization high

### 3. Test AI Analysis

Verify AI correctly:
- Identifies root cause
- Calculates confidence score
- Recommends appropriate action (rollback/monitor/escalate)

### 4. Validate Rollback

Ensure rollback mechanism works:
- Correct deployment is targeted
- Rollback completes successfully
- Service health improves

## 📊 Architecture

```
┌─────────────┐
│  Production │
│   Service   │──┐
└─────────────┘  │
                 │
┌─────────────┐  │   ┌──────────────┐
│ Prometheus  │──┼──▶│   Kestra     │
│  /Grafana   │  │   │   Workflow   │
└─────────────┘  │   └──────────────┘
                 │          │
┌─────────────┐  │          ├──▶ Anomaly Detection
│  PagerDuty  │──┘          │
└─────────────┘             ├──▶ AI Analysis (GPT-4)
                            │
┌─────────────┐             ├──▶ Auto Rollback
│   GitHub    │◀────────────┤
└─────────────┘             │
                            └──▶ Slack Notification
```

## 🎛️ Configuration Reference

### Input Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `github_token` | STRING | Yes | - | GitHub personal access token |
| `pagerduty_token` | STRING | Yes | - | PagerDuty API token |
| `slack_webhook` | STRING | Yes | - | Slack incoming webhook URL |
| `service_url` | STRING | No | `http://payment-api:3000` | Base URL of service to monitor |
| `metrics_url` | STRING | No | `{service_url}/metrics/json` | Metrics endpoint |
| `alerts_url` | STRING | No | `{service_url}/alerts` | Alerts endpoint |
| `logs_url` | STRING | No | `{service_url}/logs` | Logs endpoint |
| `min_confidence_for_rollback` | INT | No | `80` | Minimum AI confidence % for auto-rollback |
| `enable_auto_remediation` | BOOLEAN | No | `true` | Enable automatic remediation |
| `chaos_mode` | BOOLEAN | No | `false` | Inject chaos for testing |

### Severity Levels

- **P0 (Critical)**: Auto-rollback if confidence > threshold
- **P1 (Major)**: Slack notification, manual review
- **P2 (Minor)**: Logged only
- **P3 (Info)**: Logged only

## 🔒 Security Considerations

1. **Never commit tokens** - Use environment variables or Kestra secrets
2. **Rate limiting** - AI analysis costs API credits
3. **Rollback safety** - Test in staging first
4. **Access control** - Restrict who can trigger rollbacks
5. **Audit trail** - All actions are logged with execution IDs

## 📈 Metrics & Observability

The system tracks:
- Incident detection rate
- False positive rate
- Mean time to detection (MTTD)
- Mean time to recovery (MTTR)
- Rollback success rate
- AI confidence distribution

Access metrics via Kestra's execution history.

## 🛠️ Troubleshooting

### AI not recommending rollback

- Check confidence score vs threshold
- Verify metrics show clear degradation
- Ensure deployment correlation is clear

### Rollback failing

- Verify GitHub token permissions
- Check deployment API endpoint
- Ensure target deployment exists

### No anomalies detected

- Adjust thresholds in anomaly detection
- Verify metrics are being collected
- Check service health endpoint

## 🤝 Contributing

This is a hackathon project! Contributions welcome:
- Add more integration endpoints
- Improve AI prompts
- Add additional anomaly patterns
- Enhance notification templates

## 📝 License

MIT License - feel free to use in production!

## 🙏 Acknowledgments

Built with:
- Kestra - Workflow orchestration
- OpenAI GPT-4 - Incident analysis
- Prometheus - Metrics collection
- Docker - Containerization
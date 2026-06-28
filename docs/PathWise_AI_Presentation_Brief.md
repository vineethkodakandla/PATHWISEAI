# PathWise AI — Presentation Brief

> **How to use this file:** Paste this entire document into Claude (or any
> capable LLM chat) with the prompt:
>
> *"Using the brief below, generate a structured 20–40 minute technical
> presentation on PathWise AI suitable for a graduate-level software
> engineering audience. Produce a slide-by-slide outline with: slide title,
> 3–6 bullet talking points per slide, speaker notes (2–4 sentences), and an
> approximate time budget per slide that sums to 30 minutes (with optional
> deep-dive slides bringing it to 40). Include a hook, a problem statement,
> a live-demo placeholder, a competitive comparison vs. Cisco, and a Q&A
> prep section at the end."*
>
> Everything the LLM needs is in this brief.

---

## 1. Project Identity

| Field | Value |
|---|---|
| Name | **PathWise AI** |
| Tagline | *Predictive, vendor-agnostic SD-WAN management — from reactive to proactive.* |
| Team | **Pathfinders** — Vineeth Reddy Kodakandla, Meghana Nalluri, Bharadwaj Jakkula, Sricharitha Katta |
| Course | COSC6370-001 Advanced Software Engineering, Spring 2026 |
| Source docs | PVD v1.2, SRS v1.0, Project Plan v1.0 |
| Status | Working prototype: FastAPI backend, React dashboard, trained LSTM, Mininet/Batfish sandbox, OpenDaylight + ONOS clients, App-Priority Switch with real OS-level QoS |

---

## 2. Origin Story — Why This Project Exists

### 2.1 The "Switching Gap"
Modern enterprises depend on SD-WAN to glue together heterogeneous links
(fiber, broadband, 5G, satellite). Traditional SD-WAN controllers — including
Cisco Viptela, Meraki, Versa, VMware VeloCloud — are **reactive**: they
detect a link is bad *after* packets are already being lost, then fail over.
That gap (typically 1–10 seconds) is where VoIP calls drop, telemedicine
video freezes, and trading sessions disconnect.

### 2.2 The Insight
WAN link degradation is rarely instantaneous. Latency drifts up, jitter
oscillates, micro-loss events cluster — there is a measurable **brownout
signature** that precedes hard failure by 30–60 seconds. A neural network
trained on telemetry sequences can learn that signature and predict
degradation *before it happens*.

### 2.3 The Mandate
Build an SD-WAN management platform that:
1. **Predicts** link degradation 30–60 seconds in advance using LSTM.
2. **Validates** every proposed routing change in a digital-twin sandbox.
3. **Executes** hitless handoff via standards-based SDN northbound APIs
   (OpenDaylight, ONOS) — *zero* packet loss.
4. **Speaks human** — administrators define policy in natural language,
   not vendor CLIs.
5. **Runs on commodity hardware** — no proprietary appliances.

---

## 3. The Problem in Concrete Terms

| Pain Point | Today's Reality | PathWise AI Approach |
|---|---|---|
| Detection latency | Reactive: link failure → packet loss → failover | Predictive: forecast t+30s / t+60s before user impact |
| Vendor lock-in | Cisco / VMware / Versa appliances + licensing | Standards-only: OpenFlow 1.3, NETCONF/YANG, REST |
| CLI expertise required | IOS, JunOS, vManage CLI knowledge needed | Natural-language Intent-Based Networking (IBN) |
| Blind routing changes | Push to prod, hope it works, roll back on outage | Every change validated in Mininet+Batfish sandbox in < 5s |
| No transparency | "AI decided" — black box | Confidence score + human-readable reasoning displayed |
| End-user has no say | All policy is IT-driven | App-Priority Switch lets users tag apps as HIGH / NORMAL / LOW |

---

## 4. Target Users — Who Benefits

| Sector | Why They Need PathWise AI | Concrete Scenario |
|---|---|---|
| **SMEs** | Can't afford Cisco/Meraki licensing; lack in-house network engineers | A 50-person law firm keeps Zoom depositions running through a fiber brownout |
| **MSPs (Managed Service Providers)** | Manage 100+ client sites from a single pane | One technician monitors 200 retail stores, automated steering handles 95% of incidents |
| **Healthcare** | HIPAA audit + zero tolerance for telemedicine drops | Hospital's tele-ICU video stream auto-shifts from fiber to 5G during a fiber degradation |
| **K–12 / Higher Ed** | Tight budgets, exam-day reliability mandates | University auto-prioritizes proctoring traffic during finals |
| **Retail Chains** | POS uptime = revenue; many small sites, no on-site IT | 500-store chain keeps payment terminals online during a regional ISP brownout |
| **Field Operations / Remote Sites** | Mix of satellite + 5G + intermittent broadband | Oil & gas remote rig keeps SCADA telemetry flowing through weather-induced satellite degradation |

### Role-based access (RBAC) inside the platform
| Role | What they do |
|---|---|
| `SUPER_ADMIN` | Full platform, multi-tenant |
| `NETWORK_ADMIN` | Telemetry, steering, IBN policies |
| `IT_MANAGER` | Read-only dashboards, exportable reports |
| `MSP_TECHNICIAN` | Cross-client ops |
| `BUSINESS_OWNER` / `END_USER` | Self-service App-Priority Switch |

---

## 5. Differentiation — How PathWise AI Differs from Cisco & Incumbents

| Dimension | Cisco SD-WAN (Viptela / Meraki) | VMware VeloCloud | Versa Networks | **PathWise AI** |
|---|---|---|---|---|
| Failover model | Reactive (SLA breach → switch) | Reactive | Reactive | **Predictive (LSTM 30–60s ahead)** |
| Hardware | Proprietary vEdge / Meraki MX | vEdge appliances | Versa CSG | **Commodity x86-64, any OpenFlow 1.3 switch** |
| Northbound API | vManage proprietary | Orchestrator proprietary | Director proprietary | **OpenDaylight + ONOS standards REST** |
| Policy language | vManage GUI + Cisco CLI fragments | Orchestrator GUI | Versa Director | **Natural language → YANG/NETCONF** |
| Pre-deploy validation | None — push live, observe | None | None | **Digital-twin sandbox: Mininet + Batfish, < 5s** |
| Per-app prioritization | Centrally enforced | Centrally enforced | Centrally enforced | **End-user driven via App-Priority Switch + OS-level QoS** |
| Audit transparency | Vendor logs, opaque ML | Vendor logs | Vendor logs | **Open audit log with checksum + confidence + reasoning** |
| Vendor lock-in | High | High | High | **None — open standards stack** |
| Licensing model | Per-edge + subscription | Per-edge + subscription | Per-edge + subscription | **Open implementation** |
| Cloud-only? | Hybrid, prefers cloud | Cloud-managed | Hybrid | **Fully self-hostable** |

**Bottom line for the presentation:** PathWise AI is what an open-source,
ML-native, sandbox-validated SD-WAN controller would look like if you
designed it in 2026 instead of building on a 2014 architecture.

---

## 6. High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                            React Dashboard                            │
│   Login · Telemetry · Health Scoreboard · IBN · Audit · Reports       │
└──────────────────────────┬────────────────────┬──────────────────────┘
              WebSocket    │                    │   REST/JSON
                           ▼                    ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    Backend API (FastAPI)                              │
│   Auth (JWT+bcrypt) · RBAC · Routes · Redis broker · Audit            │
└──────┬─────────────┬─────────────┬─────────────┬──────────────┬──────┘
       │             │             │             │              │
       ▼             ▼             ▼             ▼              ▼
┌───────────┐ ┌────────────┐ ┌─────────────┐ ┌──────────┐ ┌──────────┐
│ Telemetry │ │ Traffic    │ │ Digital     │ │ IBN      │ │ App-     │
│ Engine    │ │ Steering   │ │ Twin        │ │ (NLP →   │ │ Priority │
│ (LSTM +   │ │ (ODL/ONOS) │ │ (Mininet +  │ │ YANG)    │ │ Switch   │
│ scoring)  │ │            │ │ Batfish)    │ │          │ │ (tc/PS)  │
└─────┬─────┘ └─────┬──────┘ └──────┬──────┘ └────┬─────┘ └────┬─────┘
      │             │               │             │            │
      ▼             ▼               ▼             ▼            ▼
┌──────────────────────────────────────────────────────────────────────┐
│   TimescaleDB (telemetry · health_scores · audit · users · policies)  │
│   Redis 7 pub/sub (telemetry · alerts · validation · steering · WS)   │
└──────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
            ┌───────────────────────────────────┐
            │   Live Network (OpenFlow 1.3+)    │
            │   Fiber · Satellite · 5G · BB     │
            └───────────────────────────────────┘
```

### Service Responsibilities
1. **Telemetry Engine** — SNMP/NetFlow/gNMI ingestion at ≥ 1 Hz, LSTM
   inference, health scoring (0–100), threshold alerts (dashboard + email).
2. **Traffic Steering** — Pre-emptive flow-table updates via OpenDaylight
   and ONOS REST APIs; preserves TCP/VoIP session state; < 50 ms end-to-end.
3. **Digital Twin Sandbox** — Mininet builds virtual replica of live
   topology; Batfish runs loop and ACL/firewall policy checks; result
   gates production deployment; < 5 s SLA.
4. **IBN Interface** — Template + embedding NLP parses commands like
   *"prioritize Zoom over Netflix on the Houston site"*, translates to
   YANG/NETCONF, and submits to controller.
5. **Backend API** — FastAPI + WebSocket; JWT auth, 5-role RBAC,
   tamper-evident audit log with SHA-256 checksums.
6. **Dashboard** — React 18 + TypeScript + D3.js; renders scoreboard,
   telemetry graphs, policy manager, audit log, exportable reports.
7. **App-Priority Switch** — Per-app QoS on the host:
   `tc` on Linux, `New-NetQosPolicy` on Windows; falls back to simulate
   mode when not run as admin.

---

## 7. Technology Stack

| Layer | Technology | Why |
|---|---|---|
| Prediction | Python 3.11 + **PyTorch 2.x** LSTM with attention | State-of-the-art sequence modeling; CPU-deployable |
| Time-series DB | **TimescaleDB** (PostgreSQL extension) | Hypertables for 1-Hz telemetry; SQL-friendly |
| Messaging | **Redis 7** pub/sub | Sub-millisecond inter-service events |
| Backend | **FastAPI + Uvicorn** | Async, OpenAPI auto-spec, WebSocket native |
| SDN Controllers | **OpenDaylight + ONOS** northbound REST | Vendor-neutral, OpenFlow 1.3+ |
| Network emulation | **Mininet** (via WSL2 on Windows) | Lightweight virtual topology for sandbox + training data |
| Policy validation | **Batfish** (pybatfish) | Industry-grade config analysis: loops, ACLs, reachability |
| Frontend | **React 18 + TypeScript + Vite** | Modern SPA, type safety, fast dev loop |
| Visualization | **D3.js v7 + Recharts** | Real-time line graphs, scoreboard cards |
| Auth | **JWT + bcrypt** | Stateless, secure password storage |
| Transport security | **TLS 1.3** | Modern minimum, PFS by default |
| At-rest encryption | **AES-256** | Telemetry + credentials |
| Telemetry protocols | **SNMP v2c+, NetFlow v9+, gNMI** | Universal device coverage |
| Container | **Docker + Docker Compose** | Reproducible deployment |
| QoS enforcement | Linux `tc` / Windows `New-NetQosPolicy` | Real OS-level shaping for App-Priority Switch |

---

## 8. LSTM Model — The Predictive Core

**Architecture**
- 2-layer stacked LSTM, hidden_size = 128
- Dropout = 0.2 between layers
- Bahdanau attention over LSTM output sequence
- Linear projection head → 6 outputs (latency/jitter/loss at t+30s and t+60s)
- Health-score mapping = weighted combo of normalized predictions → 0–100

**Input/Output**
- Input: `[batch, seq_len=60, features=3]` — last 60 seconds of latency, jitter, packet loss
- Output: `[batch, 2, 3]` — predictions at t+30s and t+60s

**Training**
- Optimizer: Adam, lr = 1e-3
- Loss: MSE on the 6 predicted values
- Batch size: 256, Epochs: 50 (early stopping, patience = 5)
- Split: 70/15/15 train/val/test
- Data: synthetic telemetry from Mininet — ≥ 10M points covering gradual
  brownout, packet-loss spikes, jitter oscillation, multi-link
  degradation, post-failover recovery
- **Acceptance:** ≥ 90 % prediction accuracy on held-out set (Req-Qual-Perf-1)

**Inference SLA:** single pass < 1 s to fit the 1 Hz polling loop.

---

## 9. Use Cases (from SRS Appendix B)

| UC | Name | Trigger | Outcome |
|---|---|---|---|
| **UC-1** | Monitor Network Telemetry | Admin opens dashboard | Real-time per-link latency/jitter/loss over WebSocket; offline links return last-known + status flag |
| **UC-2** | Predict Link Degradation | Automated every 1 s | Health score + confidence written to TimescaleDB; alert if < threshold (dashboard + email), with 5 s dedup |
| **UC-3** | Execute Traffic Steering | Sandbox PASSED result | Flow-table update via SDN in < 50 ms; TCP/VoIP sessions preserved; audit entry written |
| **UC-4** | Validate Routing Change | Steering proposal | Mininet topology spun up, Batfish runs loop + ACL checks, PASSED/FAILED in < 5 s |
| **UC-5** | Manage Network Policy | Admin types NL intent | Parsed → YANG/NETCONF preview → confirm → deploy; rollback on controller error |
| **UC-6** | Authenticate User | Login attempt | JWT issued on success; generic error on failure; lock after 5 failed attempts |

### App-Priority Switch (extension beyond SRS)
End user opens dashboard → sees detected running apps (Zoom, Teams,
YouTube, Netflix, …) → assigns HIGH / NORMAL / LOW → backend dispatches
`tc` (Linux) or `New-NetQosPolicy` (Windows) on the host → real shaping
applied. Simulate mode if not running as admin.

---

## 10. Functional Requirements (SRS Req-Func-Sw — short form)

1. Telemetry ingestion ≥ 1 Hz across all WAN links
2. LSTM forecast 30–60 s ahead
3. 0–100 health score per link
4. Auto-trigger steering on threshold breach (admin-configurable)
5. OpenDaylight + ONOS northbound integration
6. Hitless handoff for VoIP/video/financial — zero packet loss
7. Preserve session state during handoff
8. Auto-submit every routing change to digital-twin sandbox
9. Mininet virtual replica per validation request
10. Batfish loop + firewall policy check
11. IBN — natural-language policy, no CLI required
12. NLP → YANG/NETCONF translation
13. Multi-link health scoreboard (Fiber / Satellite / 5G / Broadband)
14. Confidence + human reasoning on every automated switch
15. RBAC across 5 roles
16. Bcrypt password hashing
17. Threshold alerts via dashboard + email
18. Tamper-evident audit log (SHA-256 checksums)
19. ≥ 100 concurrent sites
20. SNMP v2c+ and NetFlow v9+
21. Exportable PDF + CSV reports

---

## 11. Quality / Non-Functional Targets — Hard Constraints

| Attribute | Target |
|---|---|
| LSTM accuracy | ≥ 90 % |
| End-to-end traffic steering | < 50 ms |
| Digital-twin validation cycle | < 5 s |
| IBN dashboard UI response | < 2 s under normal load |
| Data in transit | TLS 1.3+ |
| Data at rest | AES-256 |
| HIPAA-compliant audit log | required for healthcare |
| Platform availability | ≥ 99.9 % annually |
| DB backups | every 24 h, geographically separate |
| Concurrent sites | ≥ 100 without degradation |
| Hardware floor | 32 GB RAM, 8 CPU cores, 1 TB SSD, 100 Mbps mgmt link, x86-64 |
| Hypervisor support | VMware ESXi, KVM |
| Dashboard rendering | ≥ 1920×1080 |

---

## 12. Deployment Scenarios — Where It Lives

| Scenario | Topology | What PathWise Does |
|---|---|---|
| Single corporate HQ + 3 branches | Fiber primary, 5G backup at each branch | Predicts fiber brownout, pre-emptively steers VoIP to 5G |
| Hospital campus | Fiber + microwave + 5G | Telemedicine streams hop links pre-emptively; HIPAA audit log |
| MSP NOC | 200 client sites, multi-tenant | One dashboard, role-segregated views, per-tenant audit |
| Retail chain | 500 stores, broadband + LTE backup | POS traffic guaranteed; satellite fallback for remote stores |
| Education | Campus + dorm + remote learning | Auto-prioritize exam-proctoring during finals |
| Field operations | Remote rig: satellite + 5G | SCADA telemetry steered around weather-induced satellite drops |
| Home power-user | Single host, App-Priority Switch only | User tags Zoom as HIGH; real `tc`/PowerShell shaping applied |

---

## 13. Security & Compliance

- **Auth:** JWT (HS256), bcrypt password hash (one-way), 5-failure lockout, generic login error.
- **Transport:** TLS 1.3 enforced; non-TLS connections rejected.
- **Encryption at rest:** AES-256 for telemetry + credentials.
- **RBAC:** enforced at route level; least privilege per role.
- **Audit log:** every steering / validation / policy / auth event captured
  with SHA-256 checksum over row content → tamper evidence.
- **HIPAA:** audit completeness + access controls + encryption satisfy
  the technical safeguards subset.
- **No secrets in repo:** all secrets via `.env`, `.env.example` documents
  required keys without real values.

---

## 14. Testing Strategy

| Test ID | Verifies | Acceptance |
|---|---|---|
| 1 | Telemetry ingestion 1 Hz | ≥ 1 row/sec to TimescaleDB |
| 2 | LSTM accuracy | ≥ 90 % MSE on held-out |
| 3 | Threshold alert | Fires within one polling cycle |
| 4 | SDN flow-table modification | ODL + ONOS return 200 |
| 5 | End-to-end hitless handoff | < 50 ms, zero loss |
| 6 | Session preservation | No TCP drops during handoff |
| 7 | LSTM inference latency | < 1000 ms |
| 8 | Sandbox cycle | < 5 s |
| 9 | Batfish loop detection | Loops correctly rejected |
| 10 | NLP parsing | > 90 % accuracy on common intents |
| 11 | YANG/NETCONF payload | Accepted by controller |
| 12 | Scoreboard rendering | All link types at 1920×1080 |
| 13 | Confidence + reasoning display | Shown on every switch |
| 14 | RBAC | Roles confined to permitted routes |
| 15 | Auth | Bcrypt hash, never plaintext |
| 16 | Email alerts | Delivered on threshold breach |
| 17 | Audit completeness | All event types logged |
| 18 | 100-site load | No degradation |
| 19 | Commodity x86-64 deploy | Docker stack comes up |
| 20 | VMware/KVM | Containers run virtualized |
| 21 | Restart resilience | Services auto-reconnect |
| 22 | TLS 1.3 enforcement | < TLS 1.3 rejected |

**Coverage target:** ≥ 80 % per service.

---

## 15. Data Architecture (Schema Summary)

- **`wan_telemetry`** hypertable — `(time, link_id, site_id, latency, jitter, packet_loss, link_type)`
- **`health_scores`** hypertable — `(time, link_id, score, confidence, window_s)`
- **`audit_log`** — `(id, event_time, type, actor, link_id, score, confidence, validation_result, routing_change, policy_change, details, checksum)`
- **`users`** — `(id, email, password_hash, role, is_active, failed_attempts, locked_at, created_at)`
- **`policies`** — `(id, name, natural_language, yang_config, created_by, created_at, is_active)`

**Redis channels**
`pathwise:telemetry:{link_id}`, `pathwise:alerts:{site_id}`,
`pathwise:validation:request`, `pathwise:validation:result`,
`pathwise:steering:trigger`, `pathwise:dashboard:updates`

---

## 16. Hitless Handoff — Step by Step (the money sequence)

1. Telemetry engine emits health score < threshold → publishes `steering:trigger`.
2. Steering engine pre-computes candidate flow-table delta for healthiest alternative link.
3. Steering engine submits change proposal to digital-twin sandbox.
4. Sandbox spins up Mininet replica → runs DFS loop check → Batfish ACL/policy assertions.
5. PASSED → result published on `validation:result`.
6. Steering engine atomically pushes new flow entries via ODL/ONOS REST.
7. Session manager preserves active TCP/VoIP state across the boundary.
8. Read-back confirms flow-table state on the SDN.
9. Audit entry written (trigger score, confidence, change, timestamp, checksum).
10. `dashboard:updates` published → React dashboard animates the switch.

**Total budget: < 50 ms from trigger to flow-table commit.**

---

## 17. IBN — Natural Language → YANG/NETCONF (Examples)

| User says | Parsed intent | YANG module | Net result |
|---|---|---|---|
| "Prioritize Zoom traffic over Netflix" | `priority(high=zoom, low=netflix)` | `ietf-diffserv-classifier` + `ietf-qos-policy` | DSCP marking + queue weighting |
| "Block YouTube on the Houston site" | `block(traffic=youtube, scope=site:houston)` | Firewall ACL flow rule | Drop rule installed at site edge |
| "Limit guest WiFi to 50 Mbps" | `limit(traffic=guest-wifi, bw=50Mbps)` | Rate-limit policer | Token-bucket policer on guest VLAN |
| "Route financial traffic via fiber" | `route(traffic=financial, link=fiber)` | OF flow rule | Match + output:port(fiber) |

Ambiguous parse → error + rephrasing suggestion. Never auto-deploys an
ambiguous intent.

---

## 18. Live Demo Script (suggested for the talk)

1. **Boot the stack** — `docker compose up` (or `python run.py` + `npm start`).
2. **Login** — show RBAC redirect difference between `NETWORK_ADMIN` and `END_USER`.
3. **Health scoreboard** — show 4 links: Fiber / Satellite / 5G / Broadband, with live scores + confidence.
4. **Inject brownout** — toggle simulator to ramp latency on Fiber.
5. **Watch the prediction** — health score drops to 60 with confidence 0.92; reasoning tooltip explains why.
6. **Sandbox validates** — < 5 s "PASSED" banner.
7. **Hitless handoff fires** — VoIP test stream stays connected; flow-table delta visible in scoreboard.
8. **IBN** — type "Prioritize Zoom over Netflix on Houston" → preview YANG → confirm.
9. **App-Priority Switch (on Windows)** — tag Zoom HIGH, Netflix LOW; show real `New-NetQosPolicy` rule on the host.
10. **Audit log** — show every event with checksum.
11. **Export** — generate a PDF report of the incident.

---

## 19. Risks & Limitations (be honest in the talk)

- **Synthetic training data:** real-world deployment requires fine-tuning on the customer's own telemetry.
- **WSL2 dependency on Windows:** Mininet sandbox needs WSL2; not a barrier on Linux/macOS hosts.
- **SDN coverage:** OpenFlow 1.3+; legacy non-SDN switches need a router-level shim.
- **NLP coverage:** template + embedding approach is robust on common intents but not unrestricted free text.
- **Single-region prototype:** geo-redundant active/active is documented but not yet deployed in the prototype.

---

## 20. Roadmap

- Reinforcement-learning steering policy (replace threshold trigger with learned policy).
- Federated learning across MSP customers to improve LSTM without sharing raw telemetry.
- Native Wi-Fi 7 + private 5G first-hop telemetry.
- Compliance packs: PCI-DSS, SOC 2, GDPR data residency profiles.
- Marketplace of IBN intent templates by vertical (healthcare, retail, education).

---

## 21. Team

| Member | Role |
|---|---|
| Vineeth Reddy Kodakandla | Project manager — API, integration, DevOps |
| Meghana Nalluri | Requirements lead — ML pipeline, LSTM training |
| Bharadwaj Jakkula | Design / Test lead — React dashboard, IBN, test automation |
| Sricharitha Katta | Config / Tech lead — Mininet, Batfish, SDN clients |

---

## 22. Suggested Presentation Outline & Time Budget

Tell the LLM to produce slides that fit this rough budget. Target 30 min
core + 10 min deep-dive = 40 min ceiling.

| Block | Slides | Time |
|---|---|---|
| 1. Hook & Problem | Title, "Switching gap" story, why now | 3 min |
| 2. What is PathWise AI | One-slide pitch + core features table | 2 min |
| 3. Target users & use cases | Who benefits + UC-1…UC-6 walkthrough | 4 min |
| 4. Architecture | High-level diagram + service responsibilities | 4 min |
| 5. LSTM deep dive | Model, training, accuracy target | 3 min |
| 6. Digital twin sandbox | Why sandbox before prod + Mininet + Batfish | 3 min |
| 7. Hitless handoff sequence | 10-step money slide + < 50 ms budget | 3 min |
| 8. IBN — natural language → YANG | Examples table + ambiguity handling | 2 min |
| 9. App-Priority Switch | End-user empowerment + real OS QoS | 2 min |
| 10. Security & compliance | TLS 1.3, AES-256, RBAC, HIPAA audit | 2 min |
| 11. Tech stack | One slide | 1 min |
| 12. Differentiation vs Cisco | The comparison matrix from §5 | 3 min |
| 13. Live demo | Run the demo script from §18 | 5 min |
| 14. Testing & quality | Test matrix + coverage | 2 min |
| 15. Risks & roadmap | Honest limits + what's next | 2 min |
| 16. Team & credits | One slide | 1 min |
| 17. Q&A prep cheatsheet | Anticipated questions (below) | flex |

---

## 23. Q&A Prep — Anticipated Questions

1. **"How is this different from Cisco AI Network Analytics?"** Cisco's
   analytics is **reactive** and **vendor-locked**; we are **predictive**,
   **standards-only**, and we **sandbox-validate** every change.
2. **"What if the LSTM is wrong?"** Confidence is shown; below threshold
   we fall back to threshold-based steering. Every change goes through the
   sandbox — a wrong prediction that would introduce a loop is rejected.
3. **"How do you achieve zero packet loss?"** Pre-emptive flow-table
   update *before* the degrading link fails, plus active session-state
   preservation. The new path is hot before the old one is cold.
4. **"What about adversarial telemetry?"** Bcrypt + JWT + TLS 1.3 protect
   the control plane; tamper-evident audit log surfaces any anomalous
   actor; RBAC restricts who can push policy.
5. **"Why open source / open standards?"** Vendor lock-in is the #1
   complaint of MSPs and SMEs. Standards (OpenFlow, NETCONF, YANG) let
   customers swap hardware without re-platforming.
6. **"Performance under load?"** Designed for ≥ 100 concurrent sites,
   FastAPI async + Redis pub/sub + TimescaleDB hypertables. Load-tested
   in `tests/`.
7. **"Why LSTM and not Transformer?"** LSTM is sufficient for short
   (60-step) sequences, deploys to CPU, inference well under 1 s. A
   Transformer variant is on the roadmap for longer horizons.
8. **"Can it run on-prem?"** Yes — fully self-hostable Docker stack;
   no cloud dependency.

---

## 24. One-Sentence Pitches (for the LLM to choose from)

- "PathWise AI predicts WAN brownouts 30 seconds before they happen and
  reroutes mission-critical traffic with zero packet loss — on commodity
  hardware, with no vendor lock-in."
- "We turn SD-WAN from a reactive failover system into a predictive
  one — and we let admins speak English, not Cisco CLI."
- "PathWise AI is the open, ML-native SD-WAN controller that closes the
  switching gap."

---

*End of brief. Paste everything above into your Claude chat with the
prompt at the top and ask for the slide-by-slide deck.*

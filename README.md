<div align="center">

# 🌊 Floww Client

### Your request. Your call. Your flow.

**An AI-assisted trading experience where every proposal stays in your hands.**

[![Status](https://img.shields.io/badge/Status-Foundation%20in%20Progress-4261FF?style=for-the-badge)](#current-state)
[![Client](https://img.shields.io/badge/Floww-Client-FFFF5C?style=for-the-badge&labelColor=1E1E1E)](#what-is-floww-client)

<br />

### 🔗 Live Demo

<!-- Add the deployed client URL when it is available. -->
**Coming soon** · [Add live URL here](#)

<br />

[Integration Hub](https://github.com/web5five/Floww) · [Server Integration Issue](https://github.com/web5five/Floww_Server/issues/1)

</div>

---

## ✨ What is Floww Client?

Floww Client is the user-facing application for requesting, reviewing, and following an AI-assisted trade.

It is designed to keep the user informed and in control at every step:

**Request → Delegation → Wallet Approval → Progress → Result → Recovery**

> 🛡️ The client should make consequential actions clear, visible, and intentional.

---

## 🧭 The User Journey

| Step | Experience |
|---|---|
| 📝 **Request** | The user describes what they want to do. |
| 🤝 **Delegation** | The user reviews and confirms the mandate before work begins. |
| 🔐 **Wallet approval** | The user reviews the transaction and approves it with their wallet. |
| ⏳ **Progress** | The client shows the current state while the request is being processed. |
| ✅ **Result** | The user sees the outcome and relevant details. |
| 🧰 **Recovery** | When something fails or needs attention, the client explains what happened and what to do next. |

---

## 🚧 Current State

This repository currently contains shared agent instructions and issue/PR templates.

**The application is not implemented yet.** Application source, dependency lock and build wrapper, Docker runtime, and application CI have not been added. This repository foundation is not a working client component.

---

## 🗺️ Roadmap

The client foundation will grow into a working application through small, verifiable steps:

- [ ] Establish the application structure and supported runtime.
- [ ] Pin dependencies and provide a reproducible installation flow.
- [ ] Add placeholder-only environment variable examples.
- [ ] Build the request and mandate confirmation experience.
- [ ] Add wallet approval and transaction status screens.
- [ ] Show progress, results, and actionable recovery states.
- [ ] Add a real build and test workflow.
- [ ] Verify startup and health in the intended environment.
- [ ] Deploy the client and add its live URL above.

---

## 🧑‍💻 Starting a Component Task

1. Read [`AGENTS.md`](./AGENTS.md) and the latest shared architecture and API contract.
2. Fetch remote refs, preserve teammate work, and open a bounded issue and feature branch.
3. Pin the runtime and dependencies, and make installation reproducible.
4. Add placeholder-only environment examples; never commit secrets.
5. Add a real build/test job and verify startup and health in the intended environment.
6. Link actual results in a PR and a bilingual Confluence handoff.

---

## 🏗️ Architecture Notes

Redis, pgvector, Kafka, Eureka, and Config Server are deferred baseline services. Do not add them just to populate an empty repository. Add only the dependencies required by an implemented client feature.

Keep secrets and private team sources out of Git.

---

## 🔗 Project Links

| Resource | Link |
|---|---|
| 🌐 Integration hub | [web5five/Floww](https://github.com/web5five/Floww) |
| ⚙️ Server integration issue | [Floww_Server — Issue #1](https://github.com/web5five/Floww_Server/issues/1) |
| 🚀 Live client | **Coming soon** · [Add live URL here](#) |

---

<div align="center">

### Clear choices. Visible progress. Your flow. 🌊

</div>

# Floww Client

User request, explicit mandate confirmation, funding/approval, progress, result and recovery UX.

사용자 요청·위임 확인·지갑 승인·진행·결과·복구 화면을 담당합니다.

[Integration hub](https://github.com/web5five/Floww) · [Server integration issue](https://github.com/web5five/Floww_Server/issues/1)

## Current state / 현재 상태

This repository contains shared agent instructions and issue/PR templates. Application source, dependency lock/build wrapper, Docker runtime and application CI are not yet implemented here. This foundation is not a working component.

현재 에이전트 지침과 이슈/PR 템플릿을 준비했습니다. 앱 소스·의존성 잠금/빌드 래퍼·Docker 실행·앱 CI는 아직 구현하지 않았습니다.

## Start a component task / 작업 착수

1. Read `AGENTS.md` and the latest shared architecture/API contract.
2. Fetch remote refs; preserve teammate work. Open a bounded issue and feature branch.
3. Pin the runtime, dependencies and reproducible installation; add placeholder-only env examples.
4. Add a real build/test job and verify startup/health in the intended environment.
5. Link actual results in a PR and a bilingual Confluence handoff.

Redis, pgvector, Kafka, Eureka and Config Server are deferred baseline services. Do not add dependencies simply to populate an empty repository. Keep secrets and private team sources out of Git.

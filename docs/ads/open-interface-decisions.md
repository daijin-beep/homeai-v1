# ADS Open Interface Decisions (VAL-ADS-00)

> **Snapshot date**: 2026-05-13
> **Source of truth**: Notion Open Interface Issues (https://www.notion.so/35fa2aba639c81648706c73a657d7a34) + Contract Registry (https://www.notion.so/35fa2aba639c8109aa97e7a03e92c5d2)
> **Purpose**: Locks the cross-track ownership and interface status before any ADS production code is written. Updated by Claude Code (Track B); Codex (Track A) and GPT Pro (review) reference this file when planning batches.

## Status semantics

```
decided   — Kim 已拍板;follow Kim Decision
proposed  — GPT Pro 已给立场,等 Kim 拍板;不得绕过
pending   — 待 GPT + 实现者交互决定(无 Kim 阻塞)
blocked   — 依赖其他 issue 先解决
```

## Decision matrix

| issueId | title | owner | status | requiredBeforeBatch | currentDecision | blockingRisk |
|---|---|---|---|---|---|---|
| ADS-OI-001 | CreativeRenderSpec v0.1 freeze 字段 | Codex(主)+ Claude(反馈) | proposed | Codex Batch 09;ADS Batch 06 真实 provider 输入 | GPT 推荐方案 6.1:含 canonicalRevisionId / sceneContractId / geometryHash / layoutIntentHash? / 6 inputs URL / 5 hardConstraints | Track B fixture 阶段不阻塞;Batch 06 前必须 freeze |
| ADS-OI-002 | Scheme Page vs Room Gallery 归属 | Shared | proposed | ADS Batch 07 | GPT 推荐:Core shell 归 Codex,Room Gallery section 归 Claude Code,二者通过 RenderGalleryItem 契约集成 | ADS Batch 07 启动前必须 decided |
| ADS-OI-003 | Provider 选择决策权 | Shared(三层) | proposed | ADS Batch 05/06 | GPT 推荐三层:Claude bakeoff 执行 / Codex render contract 定义 / Kim 商业决策(成本+版权+供应商) | ADS Batch 05+ 启动前必须 decided |
| ADS-OI-004 | geometryHash 变更事件机制 | Shared | proposed | Codex 已部分实现;ADS Batch 02 + 07 | GPT 推荐:主动 invalidation event(Codex 侧已实现 baseline)+ 被动 hash check(Claude 在 RenderJob start / gallery admission 前补) | Track A 主动 invalidation 已 baseline;Track B Batch 02 起做被动 check |
| ADS-OI-005 | Bakeoff vs Real Provider phasing | Track B 内部 + Kim 优先级 | proposed | ADS Batch 05/06 | GPT 推荐路径:Batch 01-04 mock + verifier → Batch 05 bakeoff harness(stub) → Batch 06 single real provider spike → 后续 broader bakeoff | ADS Batch 05+ 启动前必须 decided |
| ADS-OI-006 | RenderProviderPolicy 数值(cost / timeout / allowlist / 版权) | Kim 专 | proposed | ADS Batch 01-02 定义 schema;Batch 06 生效 | GPT 起 schema 草案;Kim 在 Cost & Compliance Settings 填具体数值(单户成本上限 / providerTimeoutMs / allowedProviders / requireCommercialUsageClearance / blockUnknownLicenseOutputs) | Batch 01-02 仅落 schema,不阻塞;Batch 06 前必须 decided |
| ADS-OI-007 | Provider licensing / copyright gate | Kim 专 | proposed | ADS Batch 06 | GPT 推荐默认 production 策略:requireCommercialUsageClearance=true + blockUnknownLicenseOutputs=true | Batch 06 前必须 decided |
| ADS-OI-008 | RenderVerifier L1 阈值 | Track B 内部 | open | ADS Batch 03 | GPT + Claude Code 交互决定;Phase 0 用保守阈值,样板户型跑完后调优 | Batch 03 决定即可,不需 Kim |
| ADS-OI-009 | Human review queue admission 规则 | Track B 内部 + UX | open | ADS Batch 04 | GPT 推荐 A(必须人工逐项 approve)作为 Phase 0/1 默认;Phase 2 看人工成本调整 | Batch 04 决定;低风险 |
| ADS-OI-010 | RenderGalleryItem contract 字段 | Shared | open | ADS Batch 07 | GPT + Codex + Claude 交互决定;候选:renderCandidateId / imageUrl / thumbnailUrl / status / verificationBadge / providerName? / createdAt | Batch 07 启动前决定;无需 Kim |
| ADS-OI-011 | ProviderTrace 详细字段(成本 / latency / license / inputHash / outputHash 必填性) | Track B 内部 | open | ADS Batch 01 | GPT 推荐:production 环境全部必填;internal dev 允许部分先省略 | Batch 01 落 schema 时已决定:本批次按 production 字段集落 |
| ADS-OI-012 | Gallery admission 状态语义 | Shared | open | ADS Batch 07 | GPT 推荐准入:verification_pass / verification_warning + human_approved;禁入:verification_fail / human_review_required / blocked / generated(未过 verifier) | Batch 07 决定;无需 Kim |

## Track B 启动门槛核查

| 门槛 | 检查 | 状态 |
|---|---|---|
| D-029 Red Zone | scope scan 覆盖 CanonicalFloorplanRevision / SceneContract geometry / geometryHash / LayoutIntent / AnchorPlan 写禁忌 | 本批次起强制 |
| D-030 真实 provider 前置 | ADS Batch 01-04 仅 mock,本批次输出 `mockProviderAllowed=true` + `realProviderAllowed=false` | 满足 |
| OI-001 CreativeRenderSpec 字段 | Track B 用 GPT 6.1 提案字段构造 consumer fixture | VAL-01 落实 |
| OI-002~006 Kim 签字 | 未 decided,但仅影响 Batch 05+ 与 Gallery | 不阻塞 Batch 01-02 |
| OI-011 ProviderTrace 字段 | Batch 01 schema 落 production-full 字段 | VAL-01 / Batch 01 落实 |

## Scope guardrails(Track B 不可越界)

```
1. Track B 不 compile CreativeRenderSpec(由 Codex Batch 09 实现 — Track A 资产)
   Track B 仅作为 consumer:validate fixture + reject malformed input,
   且不得 mutate spec 字段。

2. Track B 不拥有完整 Scheme Page(归 Codex)。
   Track B 仅拥有 Room Gallery section(RenderGalleryItem lifecycle + admission),
   通过 RenderGalleryItem 契约对接 Scheme Page shell。

3. Track B 不挑 provider winner(Kim 商业决策)。
   Track B 跑 bakeoff、生成 provider metrics、写 ImageAdapterBenchmarkResult,
   但 final allowed providers 由 Kim 在 Cost & Compliance Settings 拍板。

4. Track B 不写 CanonicalFloorplanRevision / SceneContract geometry / geometryHash /
   LayoutIntent / AnchorPlan 任何字段(D-029)。

5. Track B 不消费旧 RenderImageSpec(`packages/contracts/src/render.ts:25-41`),
   它缺 canonicalRevisionId / geometryHash / providerTrace,由 Codex 维护其
   deprecation 路径。
```

## Real provider gates(必须全部满足才能调真实 provider)

```
1. CreativeRenderSpec ≥ freeze_candidate,关键字段齐全(D-001 + OI-001)
2. RenderVerifier L1 deterministic 检查存在并跑通(D-030 + ADS Batch 03)
3. ProviderTrace 必填字段全部实现(OI-011)
4. RenderProviderPolicy schema 定义 + 目标 provider status ≥ allowed_for_spike +
   commercialUseStatus ≠ unknown + dataRetentionStatus ≠ unknown +
   timeoutMs + maxEstimatedCostCentsPerCandidate 已设值(VAL-03 / OI-006)
5. Fail render 已被 Gallery Admission Gate 阻断(VAL-04 / OI-012)
6. Kim 已在 Cost & Compliance Settings 填妥 allowed providers / 成本上限 / 版权策略
```

机器可读形式见 `packages/ads-render/src/fixtures/ads-interface-gates.json`。

## 更新流程

1. Kim 在 Notion Open Interface Issues 对某项填 Kim Decision → 改 status 为 `decided`。
2. 同步到 Notion Decision Log(D-031 起)。
3. Track B(Claude Code)更新本文件相应行 status + currentDecision。
4. 若 status 影响 gate(realProviderAllowed 等),同步更新 `ads-interface-gates.json`。

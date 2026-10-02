---
name: openmontage-production
description: "Stage-based agentic video production patterns adapted for Aurora: pipeline manifests, stage directors, checkpoints, review gates, real-footage montage, localization and batch production."
---

# OpenMontage Production Patterns for Aurora

Use these patterns to strengthen Aurora's existing Production System.

## Pipeline stages

brief → research/assets → script → storyboard → generation → edit → review → render → derivatives → publish

## Stage contract

Every stage should declare:
- inputs
- outputs
- tools/MCP actions allowed
- success criteria
- retry policy
- checkpoint payload
- cost estimate

## Review gates

Before render:
- no missing required assets
- continuity references resolved
- duration within tolerance
- audio track present when required
- platform format valid

After render:
- ffprobe/media metadata check
- frame/sample inspection
- audio presence/levels
- caption bounds
- no black frames or accidental empty gaps
- promised deliverables exist

## Aurora rule

Do not replace Aurora's existing Production Agent, Social Studio or Video Agent. Add these patterns as shared capabilities and route through the existing systems.

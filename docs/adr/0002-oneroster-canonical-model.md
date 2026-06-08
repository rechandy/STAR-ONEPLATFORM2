# ADR-0002 — OneRoster as the canonical roster data model

**Status:** Accepted · **Date:** 2026-06-08

## Context

Every service needs rostering data (orgs, schools, classes, enrollments, users). Districts
deliver this through Clever, ClassLink, OneRoster API, SIS CSV exports, or an LMS via LTI.
Roster integration is a **core requirement**. We need one internal model that all sources
map to and all services read.

## Decision

Adopt the **1EdTech OneRoster** data model as our **canonical internal roster schema**.
Connectors translate each external source into this shape behind an anti-corruption layer.
Internal services only ever see OneRoster-shaped entities with stable canonical `sourcedId`s.

## Consequences

- **+** OneRoster is the K-12 industry standard; Clever, ClassLink, and SIS exports already
  map to it, minimizing translation and maximizing interoperability.
- **+** Standard `identifiers` enable cross-source identity matching and dedup.
- **+** New roster sources require only a new connector, not a schema change.
- **−** OneRoster is broad; we implement a pragmatic subset and extend deliberately.
- **−** Some source-specific data is lost in normalization — acceptable; quirks stay in the
  connector layer, not the canonical model.

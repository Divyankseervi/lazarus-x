# Phase 2: Existing Solutions

## Commercial and Open-Source Forensic Capabilities
Current practical capabilities generally fall into two distinct silos:
1. **Low-Level Byte Extraction (Digital Forensics):** Tools like `xsqlite` and `bring2lite` excel at carving out deleted or orphaned SQLite records from unallocated space or WAL/Journal files. They extract raw data but do not attempt to resolve relational consistency or maintain competing hypotheses if fragments contradict each other.
2. **High-Level Data Cleaning (Data Engineering):** Systems like `HoloClean` use probabilistic inference and integrity constraints to repair "dirty" data. However, they assume a fully intact underlying relational structure and operate on datasets, not fragmented binary storage artifacts.

## Existing Research Systems
- **HoloClean (University of Waterloo/Stanford):** Uses integrity constraints to build a probabilistic graphical model of the database to infer missing or erroneous values. 
- **DataComPy (Capital One):** A utility for comparing DataFrames. While not a reconstruction engine, it represents the state-of-the-art in evaluating differences between data states (useful for our evaluation phase).

## Conclusion on Existing Solutions
No existing system bridges the gap: utilizing low-level, partial forensic fragments to actively generate and evaluate *competing relational database states* via constraint-guided incremental recomputation. 

# SignalProof Evaluation Set v1

This set contains 50 synthetic Chinese feedback examples written for repository
evaluation. It contains no private customer data and is released under the same
license as this repository.

The set is deliberately small and is **not** evidence of production quality. It
tests whether the deterministic keyword baseline maps clear statements to the
five declared product themes. Ambiguous and multi-intent cases are included to
expose limitations rather than inflate a single score.

Run:

```powershell
py -3.12 scripts/run_benchmark.py
```

The command writes `baseline-report.json` with accuracy, per-label precision,
recall, F1, and every failed case.

# Final validation

| Check | Result |
|---|---|
| Server tests | 1094 passed |
| Shared tests | 440 passed |
| Client tests | 383 passed |
| Type checks | All three packages passed |
| Modified-source lint | Passed; compiler checks global names |
| Server statement coverage | 84.15% |
| Shared statement coverage | 93.10% |
| New bomb/participation/filter modules | 100% statements |
| Client global coverage gate | Existing failure: baseline 65.42%, repaired 70.59%, threshold 80% |
| Production build | Compile, types, static generation and standalone packaging verified with Windows directory junctions; lint checked separately |

Full logs are local ignored artifacts alongside this summary. The junction preload is archived for reproducibility and does not alter application configuration. Use Node's `--import` option with the preload's file URL to verify Windows packaging when ordinary symlink creation is unavailable.

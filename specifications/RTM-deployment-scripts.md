# Requirements Traceability Matrix — Deployment Scripts

| Requirement | Description | File(s) | Status |
|-------------|-------------|---------|--------|
| REQ-F-DS01 | Dev environment file | `code/scripts/.env.dev` | Passed |
| REQ-F-DS02 | Prod environment template | `code/scripts/.env.prod.example` | Passed |
| REQ-F-DS03 | Dev start script | `code/scripts/dev-start.sh` | Passed |
| REQ-F-DS04 | Prod build script | `code/scripts/prod-build.sh` | Passed |
| REQ-F-DS05 | Prod start script | `code/scripts/prod-start.sh` | Passed |
| REQ-F-DS06 | Prod deploy script | `code/scripts/prod-deploy.sh` | Passed |
| REQ-F-DS07 | systemd server service | `code/scripts/systemd/tichu-server.service` | Passed |
| REQ-F-DS08 | systemd client service | `code/scripts/systemd/tichu-client.service` | Passed |
| REQ-F-DS09 | Apache config snippet | `code/scripts/apache/tichu.conf` | Passed |
| REQ-F-DS10 | Remove old dev-start.sh | `code/dev-start.sh` (delete) | Passed |
| REQ-F-DS11 | Script composability | `code/scripts/prod-*.sh` | Passed |
| REQ-F-DS12 | Prerequisite validation | All scripts | Passed |
| REQ-F-DS13 | Setup documentation | `documentation/deployment.md` | Passed |
| REQ-NF-DS01 | Portable bash | All scripts | Passed |
| REQ-NF-DS02 | Secrets not committed | `.gitignore`, `.env.prod.example` | Passed |
| REQ-NF-DS03 | Consistent paths | All config files | Passed |
| REQ-NF-DS04 | Clear script output | All scripts | Passed |

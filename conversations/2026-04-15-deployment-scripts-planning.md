# Deployment Scripts — Planning Conversation

## Summary

Implementation plan created with 5 milestones for the deployment scripts feature.

### Milestones

1. **Environment Files & .gitignore** — .env.dev, .env.prod.example, .gitignore update
2. **Dev Start Script** — New dev-start.sh replacing old one, sources .env.dev
3. **Production Scripts** — prod-build.sh, prod-start.sh, prod-deploy.sh (composable chain)
4. **systemd & Apache Configuration** — Two service units + Apache proxy config
5. **Documentation** — deployment.md with setup guide and troubleshooting

### Key Decisions
- Plan derived directly from the approved specification and earlier planning conversation
- 5 milestones chosen to keep commits focused: env files, dev script, prod scripts, infra config, docs
- Old dev-start.sh behaviors preserved in new script with env file sourcing added
- Prod scripts form a composable chain: deploy → start → build

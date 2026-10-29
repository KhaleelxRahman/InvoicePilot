# Deployment and Release

## Status
No hosting provider or deployment is presumed configured. Select after inspecting the runtime and verifying platform compatibility.

## Hosting decision criteria
- Supported server runtime and build process
- Secure server-side environment variables
- Database connectivity and migrations
- Webhook reachability over HTTPS
- Logs/health checks
- Cost and free-tier constraints
- Reproducible rollback and environment separation

## Release steps
1. Freeze feature work and confirm core acceptance path.
2. Run tests and build using actual project scripts.
3. Scan repository and Git history for secrets.
4. Confirm `.env` files and private data are not tracked.
5. Confirm license and public repository settings.
6. Verify environment variables and Sandbox mode on host.
7. Apply migrations/seed only as documented.
8. Deploy and inspect health check/logs.
9. Test the full flow on the deployed demo, not only locally.
10. Verify webhook URL/configuration if used.
11. Test clean setup from README in a fresh environment.
12. Record exact commit and deployment URL only when real.
13. Rehearse demo and verify submission checklist.

## Rollback
Document the actual hosting platform's rollback method, database migration safety, and how to disable broken integrations without falsely presenting mock behavior as real. Do not invent platform-specific steps until the platform is selected.

## Release record
- Commit: NOT RECORDED
- Hosting: NOT SELECTED
- URL: NOT DEPLOYED
- Last test run: NOT RUN
- Known limitations: Pending project inspection

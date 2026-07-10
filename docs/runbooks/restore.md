# Runbook: restore Postgres from a backup

Backups are produced by the `postgres-backup` CronJob (enable with
`--set postgres.backup.enabled=true`). Each run writes a gzipped `pg_dump` to the
`postgres-backup` PVC as `nutrition-<YYYYmmdd-HHMMSS>.sql.gz` and prunes dumps older
than `postgres.backup.retentionDays`.

All commands assume namespace `team-password123`.

## 1. Find a dump

```bash
# List available dumps (spins up a throwaway pod that mounts the backup PVC).
kubectl -n team-password123 run backup-ls --rm -it --restart=Never \
  --image=busybox --overrides='
{"spec":{"containers":[{"name":"ls","image":"busybox","command":["ls","-lh","/backup"],
"volumeMounts":[{"name":"b","mountPath":"/backup"}]}],
"volumes":[{"name":"b","persistentVolumeClaim":{"claimName":"postgres-backup"}}]}}'
```

## 2. Trigger an on-demand backup (optional, before a risky change)

```bash
kubectl -n team-password123 create job --from=cronjob/postgres-backup backup-now
kubectl -n team-password123 logs job/backup-now -f
```

## 3. Restore

Restoring overwrites live data — stop writers first so nothing races the load.

```bash
# 3a. Scale the writers down (they reconnect automatically afterwards).
kubectl -n team-password123 scale deploy/auth-service deploy/meals-service deploy/analytics-service --replicas=0

# 3b. Stream the chosen dump straight from the backup PVC into psql in the postgres pod.
#     Replace the filename with the dump you picked in step 1.
DUMP=nutrition-20260710-030000.sql.gz
PG=$(kubectl -n team-password123 get pod -l app=postgres -o jsonpath='{.items[0].metadata.name}')

# Copy the dump out of the PVC via a helper pod, then pipe it into the DB.
kubectl -n team-password123 run restore-src --restart=Never --image=busybox \
  --overrides='{"spec":{"containers":[{"name":"c","image":"busybox","command":["sleep","3600"],
"volumeMounts":[{"name":"b","mountPath":"/backup"}]}],
"volumes":[{"name":"b","persistentVolumeClaim":{"claimName":"postgres-backup"}}]}}'
kubectl -n team-password123 cp restore-src:/backup/$DUMP /tmp/$DUMP
kubectl -n team-password123 delete pod restore-src

# 3c. Load it. gunzip locally and pipe into psql inside the postgres pod.
gunzip -c /tmp/$DUMP | kubectl -n team-password123 exec -i $PG -- \
  psql -U nutrition -d nutrition

# 3d. Bring the writers back.
kubectl -n team-password123 scale deploy/auth-service deploy/meals-service deploy/analytics-service --replicas=1
```

## 4. Verify

```bash
kubectl -n team-password123 exec -i $PG -- \
  psql -U nutrition -d nutrition -c '\dt auth.*; \dt meals.*; \dt analytics.*'
```

Row counts should match expectations for the dump's timestamp. If the HPA manages
`auth-service`, `--replicas=1` in 3d is only the floor — the HPA scales it back up.

> `pg_dump` here is a plain SQL dump of the whole `nutrition` database (all schemas:
> `auth`, `meals`, `analytics`). It is **not** point-in-time; you recover to the last
> scheduled (or on-demand) dump. For tighter RPO, lower `postgres.backup.schedule`.

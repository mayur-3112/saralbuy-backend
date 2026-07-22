# Deployment

## Environments

| | Branch | Frontend | Backend | Database |
|---|---|---|---|---|
| **Production** | `main` | Vercel (existing project) | Render (existing service) | Atlas, `saralbuy` DB |
| **Staging** | `develop` | Vercel (auto preview — no setup needed) | Render, via `render.yaml` blueprint (**setup required**, one-time) | Atlas, a **separate** DB name on the same cluster |

Both repos now have a `develop` branch, kept in sync with `main` via merge (not rebase — preserves history). CI (`.github/workflows/ci.yml`) runs on pushes/PRs to both branches.

## Frontend staging — already working, no action needed

Vercel auto-deploys a preview URL for any branch that isn't `main`, as long as the project is connected to the GitHub repo (it already is). Pushing to `develop` gets a staging frontend automatically — check the Vercel dashboard's Deployments tab for the URL once `develop` has a commit.

## Backend staging — one-time manual setup required

I can't do this part — it needs your Render account. `render.yaml` (repo root) defines the service as a Blueprint so it's a single import instead of manually recreating every setting the production service already has:

1. Render dashboard → **New** → **Blueprint**.
2. Select the `saralbuy-backend` repo, branch `develop`. Render reads `render.yaml` automatically.
3. It will prompt for the `sync: false` env vars listed in that file. At minimum, fill in:
   - `MONGODB_URI` — **use a different database name than production** (e.g. `mongodb+srv://.../saralbuy_staging` — same Atlas cluster is fine, just not the same DB).
   - `JWT_SECRET` — generate a new one, don't reuse production's.
   - `CLIENT_URL` — the Vercel preview URL for `develop` (find it in Vercel's Deployments tab after step above).
   - `ADMIN_URL` — same idea, for the admin app's staging URL if/when that exists.
   - Everything else in the file is optional — leave blank to run on safe fallbacks (dev OTP stub instead of real SMS, in-memory cache instead of Redis, local file storage instead of ImageKit).
4. Deploy. Render will build and start the staging service on its own URL.

## Using staging

Push to `develop` (or merge a feature branch into it) instead of `main` to test a change against a real, separate deployment before it reaches production. Merge `develop` → `main` when confirmed working.

```bash
git checkout develop
git merge main    # pull in anything that shipped straight to main
git push
# ...test on the staging URLs...
git checkout main
git merge develop
git push
```

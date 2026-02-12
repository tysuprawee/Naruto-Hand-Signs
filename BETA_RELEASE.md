# Beta Release Guide (Jutsu Academy)

This guide is for running a controlled Windows beta before public launch.

## 1) Beta Goals

1. Validate install + launch success rate on real user machines.
2. Validate camera reliability across common webcams/laptops.
3. Validate challenge submission, anti-cheat flow, and leaderboard integrity.
4. Collect UX issues (onboarding clarity, sign detection stability, crashes).

## 2) Beta Scope

1. Platform: Windows 10/11 (64-bit).
2. Build type: Portable self-updating package (`dist_portable/...zip`).
3. Audience: 20-100 invited testers (staged waves).
4. Duration: 5-10 days.

## 3) Pre-Beta Readiness Checklist

1. Build portable package using:
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\build_portable.ps1
```
   - release-safe env: create `.env.release` (URL + anon key only)
   - quickest start: copy `/Users/bugatti/Documents/Naruto/.env.release.example` to `.env.release`
   - never ship service-role keys in beta package
2. Confirm `APP_VERSION` in `/Users/bugatti/Documents/Naruto/src/jutsu_academy/main_pygame_shared.py` matches active `app_config` version row.
3. Confirm active version row has `url` and `checksum` for portable zip.
4. Confirm maintenance gate works:
   - active `type='maintenance'` row blocks entry and shows message.
5. Confirm update gate works:
   - mismatched version blocks entry.
6. Confirm anti-cheat path works:
   - challenge run inserts token (`issued_at` + `used_at`),
   - run appears in `challenge_run_audit`,
   - accepted run appears in `leaderboard` with `verified=true`.
7. Confirm no direct client write permissions on protected tables.
8. Smoke test with no internet: app should not hard-crash.

## 4) Beta Setup (Supabase)

1. Keep one active `version` row in `app_config`.
2. Keep `maintenance` row inactive by default.
3. Keep `challenge_mode_rules` seeded for all current jutsu.
4. Enable status channel/link in maintenance row via `url` column if used.

## 5) Tester Distribution

1. Upload portable `.zip` to a private drive/release page.
2. Testers unzip and launch with `Start-JutsuAcademy.bat`.
3. Provide testers:
   - zip link,
   - minimum specs note,
   - camera permission note,
   - issue-report form template (below).
4. Release in waves:
   - Wave 1: 10 users (24h),
   - Wave 2: +40 users,
   - Wave 3: full beta list after blockers resolved.

## 6) What Testers Should Do

1. Install and launch.
2. Open Settings:
   - select camera,
   - preview on/off test,
   - scan camera test.
3. Play Free Play (3 runs on different jutsu).
4. Play Challenge (3 scored runs).
5. Trigger at least one leaderboard submission.
6. Report FPS + camera model + lighting environment.

## 7) Issue Report Template

Use this exact template for beta reports:

```text
Build Version:
Windows Version:
Device/CPU/GPU:
Camera Model:

Issue Summary:
Repro Steps:
Expected:
Actual:
Frequency: (always / often / rare / once)

Challenge Submit Result:
Any error message shown:
Screenshot or short clip:
```

## 8) Live Ops During Beta

1. Monitor these tables every day:
   - `challenge_run_audit`
   - `leaderboard`
   - `challenge_run_tokens`
2. Check reject reasons trend (`invalid_token`, `insufficient_sign_events`, `too_fast`, `client_outdated`).
3. Tune `challenge_mode_rules` only when a pattern appears (avoid overfitting one user).
4. Use maintenance gate for emergency stop if production issue occurs.

## 9) Go / No-Go Criteria

Go to public release only if all pass:

1. Crash-free sessions >= 95% in beta sample.
2. Successful challenge submissions >= 95%.
3. No unresolved high-severity blocker (install fail, camera hard fail, submission always fails).
4. Anti-cheat path stable (tokens issued/used and audit rows created for accepted/rejected runs).
5. Update and maintenance gates confirmed working in latest build.

## 10) Fast Rollback Plan

1. Activate `maintenance` in `app_config` with message.
2. Pin a known-good portable zip link in your status channel.
3. Publish patch notes with exact fixed version.
4. Deactivate maintenance only after smoke re-test.

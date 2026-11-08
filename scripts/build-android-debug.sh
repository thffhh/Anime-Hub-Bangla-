#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
if ! command -v java >/dev/null; then echo 'Java 17 is required to build the Android APK.' >&2; exit 1; fi
if [[ -z "${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}" ]]; then echo 'Set ANDROID_HOME or ANDROID_SDK_ROOT to the Android SDK.' >&2; exit 1; fi
npm run build -w apps/web
cd apps/web
if [[ ! -d android ]]; then npx cap add android; fi
npx cap sync android
# Capacitor's template uses the much larger -all archive and a 10s timeout;
# use a mirror for the smaller binary distribution with the official SHA-256
# pinned below (the upstream GitHub release download can return HTTP 504).
node -e "const fs=require('fs');const p='android/gradle/wrapper/gradle-wrapper.properties';let s=fs.readFileSync(p,'utf8').replace(/distributionUrl=.*$/m,'distributionUrl=https\\\\://repo.huaweicloud.com/gradle/gradle-8.2.1-bin.zip').replace(/networkTimeout=\\d+/,'networkTimeout=120000');if(!s.includes('distributionSha256Sum='))s+='\\ndistributionSha256Sum=03ec176d388f2aa99defcadc3ac6adf8dd2bce5145a129659537c0874dea5ad1\\n';fs.writeFileSync(p,s)"
cd android
RUNNER_TEMP="${RUNNER_TEMP:-${TMPDIR:-/tmp}}"
chmod +x gradlew
if ! ./gradlew assembleDebug --no-daemon --stacktrace > "$RUNNER_TEMP/ahb-gradle.log" 2>&1; then
  cat "$RUNNER_TEMP/ahb-gradle.log"
  if [[ "${GITHUB_ACTIONS:-}" == 'true' ]]; then
    grep -E 'Exception|Caused by|HTTP|error|timed out|failed|FAILED' "$RUNNER_TEMP/ahb-gradle.log" | head -5 | while IFS= read -r line; do printf '::error::%s\n' "$line"; done || true
  fi
  exit 1
fi
cat "$RUNNER_TEMP/ahb-gradle.log"
printf '\nDebug APK: %s\n' "$PWD/app/build/outputs/apk/debug/app-debug.apk"

# Running and building Mise on Android from the terminal

This guide shows how to build and install a current Mise APK without asking
someone else to compile it.

## The short version

Use **Expo Go** for normal development. It reloads TypeScript and interface
changes without building or installing another APK.

```bash
cd "/Users/timothylauw/Documents/Github Repos/Mise"
npm ci
npx expo start
```

Open Expo Go on the Android device and scan the QR code. Keep the terminal
running while you test.

Use an **EAS preview build** when you need a standalone or offline test. It
includes the JavaScript bundle and does not need Metro after installation.

From the repository root:

```bash
git status --short
git pull --rebase --tags origin main
npm ci
npm run typecheck
npm test
npx eas-cli@latest build --platform android --profile preview
```

EAS prints a download link when the build finishes. Open that link on the
Android device and install the APK.

Before testing, confirm that the terminal showed the commit you expected:

```bash
git log -1 --oneline
```

For the open-data catalogue build, the expected implementation commit is at or
after `5945d56`.

## Understand the four ways to run the app

| Build | Command | Standalone | Best use |
|---|---|---:|---|
| Expo Go | `npx expo start` | No | Default workflow for TypeScript, interface, and app-logic changes |
| Expo development build | `npm run android` | No | Native development while Metro is running |
| Local release APK | `./gradlew :app:assembleRelease` | Yes | Personal offline testing from this Mac |
| EAS preview APK | `eas build --profile preview` | Yes | Recommended device testing and sharing |

The screenshot that lacked catalogue nutrition came from an older APK. Editing
the source does not update an installed app. You must build and install a new
APK after the source changes.

## Default daily workflow: Expo Go

Expo Go is the fastest way to test most Mise changes. It already contains the
native Expo modules that this project uses. Metro sends the current JavaScript
and assets to the device.

### 1. Install Expo Go once

Install **Expo Go** from Google Play on the Android device.

### 2. Open the repository

```bash
cd "/Users/timothylauw/Documents/Github Repos/Mise"
```

### 3. Update the source when needed

Check the repository before pulling:

```bash
git status --short --branch
```

When the working tree is clean, download the latest source:

```bash
git pull --rebase --tags origin main
git log -1 --oneline
```

### 4. Install dependencies when needed

Run this after the first checkout or whenever `package-lock.json` changes:

```bash
npm ci
```

You do not need to run `npm ci` for every TypeScript edit.

### 5. Start Expo

```bash
npx expo start
```

The terminal displays a QR code.

- On a physical Android device, open Expo Go and scan the QR code.
- With an Android emulator running, press `a` in the terminal.
- Press `r` in the terminal to force a reload.

Keep the computer and phone on the same network. Keep Metro running while the
app is open.

### 6. Edit and reload

Most saved TypeScript changes reload automatically. This includes changes in:

- `app/`
- `src/`
- JavaScript-backed assets and catalogue data
- SQLite queries and migrations tested inside Expo Go's own app storage

You can stop Metro with `Ctrl+C`.

### If the phone cannot reach Metro

Try tunnel mode:

```bash
npx expo start --tunnel
```

If Metro shows stale code, clear its cache:

```bash
npx expo start --clear
```

### API keys in Expo Go

You can enter a vision key inside Mise through **Settings → API key**. This is
safer than compiling a key into a build.

If `MISE_DEV_API_KEY` exists in the local `.env`, Metro may include it as the
development seed described by `app.config.ts`. Never share a build that embeds
a personal key.

### When Expo Go is enough

Use Expo Go for quick checks of:

- Screens, layout, copy, and navigation
- TypeScript business logic
- Zustand state behavior
- SQLite queries on Expo Go's own database
- Open-data catalogue selection and nutrition calculations

For the current catalogue check, open manual meal entry and confirm that
**Choose a catalogue ingredient** appears. Select **Olive oil**, enter `100`,
and choose `g`. The screen should show `884 kcal`.

### When you still need a new APK

Build a new APK when you change or need to verify:

- Files under `android/`
- Native dependencies or Expo config plugins
- Native settings in `app.config.ts`
- The Expo SDK or React Native version
- Android permissions, package identity, signing, or version numbers
- True offline behavior without Metro
- Background and app-lifecycle behavior in a standalone process
- Migration of data from an already-installed standalone Mise APK
- Installation over an older APK without losing its database

Expo Go has its own app container and database. It cannot prove that an existing
standalone Mise installation upgrades safely. Catalogue acceptance task 11.1
therefore requires an APK update. Task 11.5 also requires a standalone APK
because Expo Go depends on Metro during development.

## One-time setup

### 1. Confirm Node.js and Java

Mise requires Node.js 22.5 or newer. Its Android build uses Java 17.

```bash
node --version
java -version
```

This Mac currently has Java 17 installed through Homebrew.

### 2. Install Java 17 if it is missing

```bash
brew install openjdk@17
```

Add Java 17 to the current terminal session if `java -version` still reports a
different version:

```bash
export JAVA_HOME="/opt/homebrew/opt/openjdk@17"
export PATH="$JAVA_HOME/bin:$PATH"
```

### 3. Configure the Android command-line tools

Android Studio normally installs the SDK here on macOS:

```bash
export ANDROID_HOME="$HOME/Library/Android/sdk"
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"
```

Confirm that `adb` is available:

```bash
adb version
```

If `adb` is not on `PATH`, use its full path:

```bash
"$HOME/Library/Android/sdk/platform-tools/adb" version
```

### 4. Install project dependencies

Run this from the repository root:

```bash
npm ci
```

`npm ci` installs the exact dependency versions from `package-lock.json`.

### 5. Sign in to EAS once

```bash
npx eas-cli@latest login
npx eas-cli@latest whoami
```

The first build may ask you to create or link an EAS project. Follow that prompt
once. The existing `eas.json` already defines the Android preview profile as an
APK build.

## Recommended workflow: EAS preview APK

Use this workflow for acceptance testing and for installing newer versions over
an earlier EAS preview build.

### 1. Open the repository

```bash
cd "/Users/timothylauw/Documents/Github Repos/Mise"
```

### 2. Check for unfinished local changes

```bash
git status --short --branch
```

An empty file list means the working tree is clean. Do not build when this list
contains changes you do not understand. The uploaded build may include those
local files.

### 3. Download the latest source

```bash
git pull --rebase --tags origin main
git log -1 --oneline
```

If Git reports divergent branches, commit your intended work first. Then rebase
the local commit:

```bash
git rebase origin/main
```

### 4. Install the locked dependencies

```bash
npm ci
```

### 5. Verify the source before building

```bash
npm run typecheck
npm test
```

Do not build a release from a failing typecheck or test suite.

### 6. Protect API keys

EAS cloud builds do not use the local `.env` file as their secret source. Enter
your vision key inside the installed app through **Settings → API key**.

Do not place a personal key in a build that you plan to share. A key compiled
into an APK can be extracted by anyone who receives the file.

The USDA key used by `catalogue:build` is a developer-only build input. The app
does not need that key at runtime.

### 7. Start the APK build

```bash
npx eas-cli@latest build --platform android --profile preview
```

The `preview` profile in `eas.json` sets `android.buildType` to `apk`. The
production profile creates an Android App Bundle instead, which cannot be
sideloaded directly.

### 8. Download and install

When EAS finishes:

1. Open the printed build link.
2. Download the `.apk` on the Android device.
3. Allow installation from that browser or file manager when Android asks.
4. Choose **Update** when an older EAS preview build is already installed.

Updating should preserve the app database when both APKs use the same EAS
signing credential.

View recent builds again with:

```bash
npx eas-cli@latest build:list --platform android --limit 5
```

## Fast development workflow: build and run with Metro

Use this while changing code and testing with the computer connected.

### 1. Start an emulator or connect a phone

Enable Developer options and USB debugging on a physical phone. Then check the
connection:

```bash
adb devices
```

The device must appear with the state `device`, not `unauthorized`.

### 2. Compile, install, and start Metro

```bash
npm run android
```

This runs `expo run:android`. It compiles and installs the development build,
then serves JavaScript through Metro.

Keep that terminal open. The development build may show a connection error when
Metro stops.

This workflow is not the right way to produce an APK for offline acceptance
testing.

## Local standalone workflow: release APK on this Mac

This builds a standalone APK without EAS.

### 1. Verify the source

```bash
cd "/Users/timothylauw/Documents/Github Repos/Mise"
npm ci
npm run typecheck
npm test
```

### 2. Build the release APK

```bash
cd android
./gradlew :app:assembleRelease --console=plain
cd ..
```

The APK appears here:

```text
android/app/build/outputs/apk/release/app-release.apk
```

Confirm that the file was rebuilt recently:

```bash
stat -f '%N | %Sm | %z bytes' \
  android/app/build/outputs/apk/release/app-release.apk
```

If Gradle appears to reuse stale output, clean once and rebuild:

```bash
cd android
./gradlew clean
./gradlew :app:assembleRelease --console=plain
cd ..
```

### 3. Install through USB or an emulator

```bash
adb devices
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

Use the full `adb` path if needed:

```bash
"$HOME/Library/Android/sdk/platform-tools/adb" install -r \
  android/app/build/outputs/apk/release/app-release.apk
```

The `-r` flag replaces the installed package while preserving its data when
the signing certificate matches.

## Important: do not mix signing lanes

All current Android variants use the package name `com.mise.app`. However, EAS
and the local Gradle release may use different signing certificates.

If installation fails with this message:

```text
INSTALL_FAILED_UPDATE_INCOMPATIBLE
```

the installed APK and the new APK have different signatures. Android will not
replace one with the other.

Choose one of these responses:

- Build through the same lane that produced the installed app.
- Export any important app data before uninstalling.
- Uninstall the old app only when losing its local database is acceptable.

Do not uninstall merely to make the command succeed. Mise stores its data on
the device, so uninstalling normally removes that data.

For repeatable acceptance testing with preserved data, use EAS preview builds
consistently.

## Version numbers

Android uses two version values in `android/app/build.gradle`:

```gradle
versionCode 1
versionName "1.0.0"
```

- `versionCode` is an integer Android uses to compare builds.
- `versionName` is the user-facing version.

Increase `versionCode` before distributing a newer APK broadly. Increase
`versionName` when you want the displayed release version to change.

Example:

```gradle
versionCode 2
versionName "1.0.1"
```

Commit version changes so the APK can be traced back to its source.

## Confirm that the correct APK is installed

First, confirm the source commit before building:

```bash
git log -1 --oneline
```

Then inspect the installed package:

```bash
adb shell dumpsys package com.mise.app | grep -E 'versionCode|versionName'
```

Finally, check a visible feature from the intended commit. For open-data
catalogue testing, the manual meal screen must show **Choose a catalogue
ingredient** between Name and Quantity.

Typing `olive oil` into Name is not enough. Select **Olive oil** through that
catalogue control, enter `100`, and choose `g`. The screen should show `884
kcal`.

## Troubleshooting

### `adb: command not found`

```bash
export ANDROID_HOME="$HOME/Library/Android/sdk"
export PATH="$ANDROID_HOME/platform-tools:$PATH"
```

### No device appears under `adb devices`

- Start an Android emulator, or connect the phone by USB.
- Enable USB debugging.
- Accept the authorization dialog on the phone.
- Try a data-capable USB cable.

### `INSTALL_FAILED_UPDATE_INCOMPATIBLE`

The signatures differ. Return to the same build lane as the installed APK. Do
not uninstall until you have exported any data you need.

### The app asks for Metro

You installed a development build. Keep `npm run android` running, or install a
standalone release or EAS preview APK.

### The APK still shows old code

Check all three points:

```bash
git log -1 --oneline
stat -f '%N | %Sm | %z bytes' \
  android/app/build/outputs/apk/release/app-release.apk
adb shell dumpsys package com.mise.app | grep -E 'versionCode|versionName'
```

Then rebuild and reinstall. Merely restarting the installed app cannot load
source changes from the repository.

### Gradle cannot find Java

```bash
export JAVA_HOME="/opt/homebrew/opt/openjdk@17"
export PATH="$JAVA_HOME/bin:$PATH"
java -version
```

### EAS produces an `.aab` instead of an `.apk`

Use the preview profile exactly:

```bash
npx eas-cli@latest build --platform android --profile preview
```

The production profile intentionally creates an app bundle for a store upload.

## Repeatable release checklist

Run this checklist for each standalone test build:

```text
[ ] git status is understood
[ ] origin/main is current
[ ] the expected commit is checked out
[ ] npm ci completed
[ ] npm run typecheck passed
[ ] npm test passed
[ ] no personal API key is embedded in a shared build
[ ] the preview or release APK completed
[ ] the new APK was installed, not merely downloaded
[ ] one visible feature confirms that the new source is running
```

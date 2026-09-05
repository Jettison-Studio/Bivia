# Native development and verification

Bivia uses Expo Continuous Native Generation (CNG). `apps/player/app.json`, dependency versions, and config plugins are the native configuration source of truth. `apps/player/ios` and `apps/player/android` are generated development artifacts and are already ignored by `apps/player/.gitignore`; this also excludes nested Pods, build products, and Xcode user state. Keep the current generated iOS project for local development, but do not commit it. Apply lasting native changes through app configuration or an Expo config plugin.

## iOS: verified September 5, 2026

- Xcode 26.6, iPhone 17 Pro Simulator, iOS 26.5.
- Simulator ID: `C3881ECB-AD96-439E-A74B-572751A4C491`.
- App bundle ID: `app.bivia.mobile` (a separate installed Bivia app).
- Native build completed with **zero errors and two build warnings**.
- Home, practice introduction, five-second Bible-hint preview, four answer choices, wrong-answer penalty, correct-answer feedback, progression, and final results worked in the native app.
- Completed the five-question Fitness practice round with one wrong guess followed by the correct answer: **14 points**. The result screen showed five questions answered and 93% of available points.
- Terminated and relaunched Bivia, opened Profile, and confirmed the same Fitness result in persisted device history: **1 round / 14 practice points**. Native SQLite-backed persistence worked.
- Initial missing-module failures belonged to an incompatible Expo Go/native host. Building Bivia with its installed dependencies resolved the image picker, clipboard, and linear-gradient module availability.

Evidence: [home](native-evidence/ios-home.jpg), [Bible preview](native-evidence/ios-bible-hint.jpg), [results](native-evidence/ios-results.jpg), [history after relaunch](native-evidence/ios-persisted-history.jpg).

## Reproduce this local build

From the repository root, run a dedicated Metro server so other local projects remain untouched:

```sh
cd apps/player
npx expo start --port 8093
```

In a separate terminal in `apps/player`:

```sh
npx expo prebuild --platform ios --no-install
PATH="$PATH:/Users/lukefrederick/.gem/ruby/2.6.0/bin" RUBYOPT=-rlogger npx expo run:ios --device C3881ECB-AD96-439E-A74B-572751A4C491 --port 8093
```

The PATH/RUBYOPT additions are specific to this Mac. CocoaPods 1.15.2 was already installed in the user gem directory; its ActiveSupport dependency needed Ruby's Logger preloaded. A machine with a working `pod` command does not need this workaround. No global Ruby/gem settings were changed.

Do not combine `--port` with `--no-bundler`: Expo treats those flags as mutually exclusive. With the existing Metro server, `run:ios --port 8093` correctly skips starting another server.

Expo's final macOS Simulator-window activation failed through `osascript` on this host, after compilation and installation had succeeded. XcodeBuildMCP launched the installed app successfully. The launch arguments below pin React Native to the dedicated server even if another project uses port 8081:

```sh
xcrun simctl launch C3881ECB-AD96-439E-A74B-572751A4C491 app.bivia.mobile -RCT_jsLocation localhost:8093
```

Equivalent XcodeBuildMCP setup: use workspace `apps/player/ios/Bivia.xcworkspace`, scheme `Bivia`, the simulator ID above, bundle ID `app.bivia.mobile`, and `launch_app_sim({launchArgs:["-RCT_jsLocation","localhost:8093"]})`. If Bivia is already running, stop only `app.bivia.mobile` before relaunching with new launch arguments. Runtime logs confirmed the JavaScript bundle request went to `http://localhost:8093`.

## Android: verified September 5, 2026

The installed Pixel 8 emulator (`emulator-5554`, Android 17/API 37.1, arm64 with 16 KB pages) runs a separate `app.bivia.mobile` build. SDK/build-tools 36 and NDK `27.1.12297006` were already installed. No SDK or emulator image was downloaded.

The initial build using Android Studio's JDK 25 failed in CMake because of Java native-access restrictions. Using the already-cached Temurin **JDK 17** resolved that issue; the arm64 debug APK built successfully in 1 minute 7 seconds. Use command-local environment variables on this machine:

```sh
cd apps/player
npx expo prebuild --platform android --no-install
cd android
JAVA_HOME='/Users/lukefrederick/.gradle/jdks/eclipse_adoptium-17-aarch64-os_x.2/jdk-17.0.20.1+1/Contents/Home' ANDROID_HOME='/Users/lukefrederick/Library/Android/sdk' ./gradlew :app:assembleDebug --console=plain --max-workers=4 -PreactNativeArchitectures=arm64-v8a -PreactNativeDevServerPort=8093
```

With the Metro server on port 8093, install and launch from the repository root:

```sh
/Users/lukefrederick/Library/Android/sdk/platform-tools/adb -s emulator-5554 reverse tcp:8093 tcp:8093
/Users/lukefrederick/Library/Android/sdk/platform-tools/adb -s emulator-5554 reverse tcp:56321 tcp:56321
/Users/lukefrederick/Library/Android/sdk/platform-tools/adb -s emulator-5554 install -r apps/player/android/app/build/outputs/apk/debug/app-debug.apk
/Users/lukefrederick/Library/Android/sdk/platform-tools/adb -s emulator-5554 shell am start -n app.bivia.mobile/.MainActivity
```

Port 56321 is this project's local Supabase endpoint; forwarding makes the device's loopback URL reach the host's backend. Existing port 8081 forwarding for another project was left unchanged. Home, native bottom navigation, practice introduction, and the Bible-hint preview rendered correctly. Completed the five-question Fitness round with one wrong guess and deliberately slow answers: **9 points, five questions answered**. Force-stopped only Bivia, relaunched it, opened Profile, and confirmed **1 round / 9 practice points** persisted.

Android UIAutomator sometimes could not obtain an idle snapshot during the changing bonus countdown. The validation retried UI-tree reads and waited for stable controls; all taps used actual node bounds rather than screenshot guesses. No app crash occurred. Initial native launch had no React Native JavaScript or Android runtime errors.

**Dependency lifecycle follow-up:** After force-stopping Bivia, launching `app.bivia.mobile/.MainActivity`, and immediately opening Profile, one React development warning reported a state update before mount. LogBox identified `ContextNavigator` (`expo-router/build/ExpoRoot.js:135`) and the call stack ended at `url.then` in `expo-router/build/fork/useLinking.native.js:127:47`. The installed Expo Router 57.0.19 source invokes `onUnhandledLinking(...)` from its initial-URL promise at that line. The captured stack did not point to Bivia's profile or store functions. History still rendered and remained correct; the app did not crash. No warning suppression or dependency patch was applied. Recheck this initial-linking path with a compatible Expo Router update and production build before release. [Captured stack](native-evidence/android-router-warning.png).

Evidence: [Android home](native-evidence/android-home.png), [practice introduction](native-evidence/android-practice-intro.png), [results](native-evidence/android-results.png), [history after relaunch](native-evidence/android-persisted-history.png).

## Remaining native validation

This validates the iOS development build and the practice flow, not an App Store release. iOS ranked/authenticated flows, photo selection/upload, native sharing, universal links, physical-device network access, and release signing still require device-specific checks. Background-fetch and simulator accessibility warnings were present but did not prevent the verified flow. The web-only `outlineStyle` warning was removed from app code and was absent after relaunch.

Android and iOS JavaScript exports are separate from native builds. The native emulator debug builds above do not replace physical-device or production-release checks. Store releases require final app assets, signing, store accounts, and release configuration.

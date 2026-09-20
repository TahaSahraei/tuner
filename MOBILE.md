# Building the A Tuner Android app

The Capacitor Android project is already configured in `android/`, including microphone permission and the offline production bundle.

## One-time setup

1. Install Android Studio 2025.2.1 or newer. Its installer includes the correct JDK.
2. In Android Studio's SDK Manager, install Android SDK Platform 36 and the Android SDK build tools.
3. From the project directory, run `npm install`.

The build requires JDK 21. If Android Studio ships with Java 25, open **File > Settings > Build, Execution, Deployment > Build Tools > Gradle**, open the **Gradle JDK** menu, choose **Download JDK**, and download version **21**. The build script automatically finds JDKs installed by Android Studio as well as Microsoft, Eclipse Temurin, and common Windows installations.

The command also uses JetBrains' cache for Google Maven artifacts and Android SDK catalogs. This is configured in `android/google-maven-mirror.init.gradle` and the `SDK_TEST_BASE_URL` build environment for networks where `dl.google.com` is unavailable.

## Create a debug APK

Run:

```powershell
npm run mobile:apk
```

The installable file will be created at:

```text
android\app\build\outputs\apk\debug\app-debug.apk
```

## Open and run in Android Studio

Run:

```powershell
npm run mobile:sync
npm run mobile:open
```

Choose a connected Android phone or emulator, then press **Run**. Android will ask for microphone access the first time the tuner starts listening.

## Open and run on iOS

An iOS project is configured in `ios/`, including the microphone usage description required by iOS.
On a Mac with Xcode installed, run:

```bash
npm run mobile:sync:ios
npm run mobile:open:ios
```

Select your Apple development team in Xcode, choose an iPhone or simulator, and press **Run**. Creating a signed `.ipa` requires macOS, Xcode, and an Apple signing identity.

## Release build

In Android Studio, use **Build > Generate Signed App Bundle or APK**, choose **Android App Bundle**, and create or select your signing key. The resulting `.aab` file is the format used for Google Play.

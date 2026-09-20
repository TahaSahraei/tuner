import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

const androidDirectory = path.resolve("android");
const userProfile = process.env.USERPROFILE ?? "";
const localAppData = process.env.LOCALAPPDATA ?? path.join(userProfile, "AppData", "Local");
const programFiles = process.env.ProgramFiles ?? "C:\\Program Files";

function childDirectories(directory) {
  if (!directory || !existsSync(directory)) return [];
  try {
    return readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(directory, entry.name));
  } catch {
    return [];
  }
}

const discoveredWindowsJdks = process.platform === "win32"
  ? [
      path.join(programFiles, "Microsoft"),
      path.join(programFiles, "Eclipse Adoptium"),
      path.join(programFiles, "Java"),
      path.join(programFiles, "Zulu"),
      path.join(userProfile, ".jdks"),
      path.join(userProfile, ".gradle", "jdks"),
    ].flatMap(childDirectories)
  : [];

const javaCandidates = process.platform === "win32"
  ? [
      process.env.JAVA_HOME,
      ...discoveredWindowsJdks,
      path.join(programFiles, "Android", "Android Studio", "jbr"),
      path.join(localAppData, "Programs", "Android Studio", "jbr"),
    ]
  : process.platform === "darwin"
    ? [process.env.JAVA_HOME, "/Applications/Android Studio.app/Contents/jbr/Contents/Home"]
    : [process.env.JAVA_HOME, "/opt/android-studio/jbr"];

function inspectJava(candidate) {
  if (!candidate) return null;
  const executable = path.join(candidate, "bin", process.platform === "win32" ? "java.exe" : "java");
  if (!existsSync(executable)) return null;
  const result = spawnSync(executable, ["-version"], { encoding: "utf8" });
  const versionText = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  const match = versionText.match(/version\s+"(?:1\.)?(\d+)/i);
  const major = match ? Number(match[1]) : null;
  return major ? { home: candidate, major } : null;
}

const installedJdks = [...new Set(javaCandidates.filter(Boolean))]
  .map(inspectJava)
  .filter(Boolean);
const compatibleJdks = installedJdks
  .filter(({ major }) => major >= 17 && major <= 24)
  .sort((a, b) => Math.abs(a.major - 21) - Math.abs(b.major - 21));
const selectedJdk = compatibleJdks[0];
const javaHome = selectedJdk?.home;

if (!javaHome) {
  const detected = installedJdks.length
    ? `Detected incompatible Java version(s): ${installedJdks.map(({ major }) => major).join(", ")}.`
    : "No JDK installation was detected.";
  console.error([
    detected,
    "This project uses Gradle 8.14, which cannot run on Java 25.",
    "Install or download JDK 21, then run npm run mobile:apk again.",
  ].join("\n"));
  process.exit(1);
}

const sdkCandidates = [
  process.env.ANDROID_HOME,
  process.env.ANDROID_SDK_ROOT,
  process.platform === "win32" ? path.join(localAppData, "Android", "Sdk") : undefined,
  process.platform === "darwin" ? path.join(userProfile, "Library", "Android", "sdk") : undefined,
];
const androidSdk = sdkCandidates.find((candidate) => candidate && existsSync(candidate));

if (!androidSdk) {
  console.error([
    "The Android SDK was not found.",
    "Open Android Studio > More Actions > SDK Manager and install Android SDK Platform 36",
    "plus the Android SDK Build-Tools, then run npm run mobile:apk again.",
  ].join("\n"));
  process.exit(1);
}

console.log(`Using Java ${selectedJdk.major}: ${javaHome}`);
console.log(`Using Android SDK: ${androidSdk}`);
console.log("Using cached Google Maven and Android SDK repositories.");

const javaToolOptions = [
  process.env.JAVA_TOOL_OPTIONS,
  "-Djdk.net.unixdomain.tmpdir=C:\\codex-nonexistent-jdk-sockets",
].filter(Boolean).join(" ");

const command = process.platform === "win32" ? "cmd.exe" : "./gradlew";
const args = process.platform === "win32"
  ? ["/d", "/s", "/c", "gradlew.bat --init-script google-maven-mirror.init.gradle assembleDebug"]
  : ["--init-script", "google-maven-mirror.init.gradle", "assembleDebug"];

const result = spawnSync(command, args, {
  cwd: androidDirectory,
  stdio: "inherit",
  env: {
    ...process.env,
    JAVA_HOME: javaHome,
    ANDROID_HOME: androidSdk,
    ANDROID_SDK_ROOT: androidSdk,
    JAVA_TOOL_OPTIONS: javaToolOptions,
    SDK_TEST_BASE_URL: "https://cache-redirector.jetbrains.com/dl.google.com/android/repository/",
    PATH: `${path.join(javaHome, "bin")}${path.delimiter}${process.env.PATH ?? ""}`,
  },
});

if (result.error) {
  console.error("The Android build could not start. Open the android folder in Android Studio once, then try again.");
  throw result.error;
}

process.exit(result.status ?? 1);

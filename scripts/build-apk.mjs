/**
 * Bundle NodeMind into a local Android APK (Capacitor wrapper).
 * The built APK loads only packaged assets — no remote web host.
 *
 * Output: Android/NodeMind.apk  (folder is gitignored)
 */
import { existsSync, mkdirSync, writeFileSync, copyFileSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const androidDir = path.join(root, 'Android');
const capDir = path.join(androidDir, 'capacitor');
const apkOut = path.join(androidDir, 'NodeMind.apk');

function detectJavaHome() {
  const candidates = [
    process.env.JAVA_HOME,
    'C:\\Users\\Standard\\AppData\\Local\\Programs\\Eclipse Adoptium\\jdk-17.0.12.7-hotspot',
    'C:\\Program Files\\Android\\Android Studio\\jbr',
    'C:\\Program Files\\Eclipse Adoptium\\jdk-17.0.12.7-hotspot',
  ].filter(Boolean);
  for (const home of candidates) {
    const java = path.join(home, 'bin', process.platform === 'win32' ? 'java.exe' : 'java');
    if (existsSync(java)) return home;
  }
  return process.env.JAVA_HOME || '';
}

function detectAndroidSdk() {
  const candidates = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    path.join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk'),
    path.join(process.env.USERPROFILE || '', 'AppData', 'Local', 'Android', 'Sdk'),
    'C:\\Android\\Sdk',
  ].filter(Boolean);
  for (const sdk of candidates) {
    if (existsSync(path.join(sdk, 'platform-tools'))) return sdk;
  }
  return '';
}

function run(command, args, extraEnv = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, ...extraEnv },
    windowsHide: true,
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit ${result.status ?? 'unknown'}`);
  }
}

const javaHome = detectJavaHome();
const androidSdk = detectAndroidSdk();
if (!javaHome) throw new Error('JAVA_HOME not found. Install JDK 17.');
if (!androidSdk) throw new Error('Android SDK not found. Install Android Studio / command-line tools.');

const env = {
  VITE_BASE: '/',
  JAVA_HOME: javaHome,
  ANDROID_HOME: androidSdk,
  ANDROID_SDK_ROOT: androidSdk,
};

mkdirSync(androidDir, { recursive: true });

console.log('Building web assets for a local Capacitor origin…');
run('npm', ['run', 'build'], env);

if (!existsSync(path.join(root, 'node_modules', '@capacitor', 'cli'))) {
  throw new Error('Capacitor CLI is missing. Run npm install.');
}

if (!existsSync(path.join(capDir, 'app'))) {
  console.log('Adding the Android platform…');
  run('npx', ['cap', 'add', 'android'], env);
}

writeFileSync(
  path.join(capDir, 'local.properties'),
  `sdk.dir=${androidSdk.replace(/\\/g, '/')}\n`,
  'utf8'
);

console.log('Syncing bundled assets into the Android project…');
run('npx', ['cap', 'sync', 'android'], env);

const gradle = path.join(capDir, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew');
if (!existsSync(gradle)) throw new Error(`Gradle wrapper missing at ${gradle}`);

console.log('Assembling a debug APK (self-contained local assets)…');
const gradleResult = spawnSync(gradle, ['assembleDebug', '--no-daemon'], {
  cwd: capDir,
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, ...env },
  windowsHide: true,
});
if (gradleResult.status !== 0) {
  throw new Error('Gradle assembleDebug failed.');
}

const builtApk = path.join(capDir, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
if (!existsSync(builtApk)) throw new Error(`APK not found at ${builtApk}`);
copyFileSync(builtApk, apkOut);

let version = 'unknown';
try {
  version = JSON.parse(readFileSync(path.join(root, 'version.json'), 'utf8')).version;
} catch {
  /* ignore */
}

console.log(`Wrote ${apkOut} (NodeMind ${version}, local assets only).`);

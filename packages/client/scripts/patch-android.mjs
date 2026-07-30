// Post-`cap add android` patch: allow the app to rotate with the device.
// The android/ project is generated fresh in CI, so this runs there to make the
// orientation setting explicit (fullUser = all orientations the user permits).
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const manifest = resolve(process.cwd(), "android/app/src/main/AndroidManifest.xml");
let xml = readFileSync(manifest, "utf8");

if (xml.includes("android:screenOrientation")) {
  console.log("[patch-android] screenOrientation already set — nothing to do.");
} else {
  // Insert the attribute onto the first <activity ...> (the MainActivity).
  xml = xml.replace(/<activity\b/, `<activity\n            android:screenOrientation="fullUser"`);
  writeFileSync(manifest, xml);
  console.log("[patch-android] added android:screenOrientation=\"fullUser\" to MainActivity.");
}

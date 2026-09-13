const { execFile } = require("node:child_process");
const path = require("node:path");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);

/**
 * Give locally built macOS bundles a valid ad-hoc signature. Electron Builder
 * runs this hook before applying a configured Developer ID signature, so a
 * release build can still replace it with a notarizable distribution signature.
 */
exports.default = async function adHocSignMacApp(context) {
  if (context.electronPlatformName !== "darwin") return;

  const productFilename = context.packager.appInfo.productFilename;
  const appPath = path.join(context.appOutDir, `${productFilename}.app`);

  await execFileAsync("codesign", ["--force", "--deep", "--sign", "-", appPath]);
  console.log(`[halo-package] ad-hoc signed ${appPath}`);
};

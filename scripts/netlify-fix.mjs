import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const netlifyCmd = process.platform === "win32"
  ? join(process.env.APPDATA ?? "", "npm", "netlify.cmd")
  : "netlify";

const siteId = "da2317c0-2337-4217-8d70-b6a68d4c2aaa";

function api(method, data) {
  const args = ["api", method, "--data", JSON.stringify(data)];
  return execFileSync(netlifyCmd, args, { encoding: "utf8", shell: true });
}

console.log("Mise à jour du site Netlify...");
api("updateSite", {
  site_id: siteId,
  build_settings: {
    cmd: "npm run build",
    dir: "",
    base: "",
    provider: null,
  },
});

console.log("Liaison GitHub...");
try {
  const linkData = JSON.parse(readFileSync("netlify-link-repo.json", "utf8"));
  api("updateSite", linkData);
  console.log("Repo GitHub lié.");
} catch (e) {
  console.log("Liaison GitHub ignorée:", e.message);
}

console.log("Déclenchement build cloud...");
try {
  const build = api("createSiteBuild", { site_id: siteId, clear_cache: true });
  console.log(build);
} catch (e) {
  console.log("Build cloud non disponible, déploiement local...");
}

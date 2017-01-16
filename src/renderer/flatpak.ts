import * as path from "path";
import * as fs from "fs";

export function underFlatpak() {
  if (process.env.XDG_RUNTIME_DIR == null) {
    return false;
  }

  const flatpakInfo = path.join(process.env.XDG_RUNTIME_DIR, "flatpak-info");
  return fs.existsSync(flatpakInfo) && fs.statSync(flatpakInfo).isFile();
}

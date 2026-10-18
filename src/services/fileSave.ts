import { Capacitor } from "@capacitor/core";

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(r.error);
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.readAsDataURL(blob);
  });
}

function downloadInBrowser(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * Saves a file for the user.
 * - Web: regular download.
 * - Android/iOS: the WebView ignores <a download>, so write to the cache dir and open the share sheet
 *   (user can pick "Save to Files", Drive, mail…).
 */
export async function saveFile(filename: string, blob: Blob): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    downloadInBrowser(filename, blob);
    return;
  }

  const [{ Filesystem, Directory }, { Share }] = await Promise.all([
    import("@capacitor/filesystem"),
    import("@capacitor/share")
  ]);

  const { uri } = await Filesystem.writeFile({
    path: filename,
    data: await blobToBase64(blob),
    directory: Directory.Cache
  });

  try {
    await Share.share({ title: filename, files: [uri] });
  } catch (e) {
    // User closing the share sheet is not an error.
    if (!(e instanceof Error && /cancel/i.test(e.message))) throw e;
  }
}

export async function saveJson(filename: string, data: unknown): Promise<void> {
  await saveFile(filename, new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
}

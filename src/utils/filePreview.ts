/** Max raw file size to store as base64 in sessionStorage (survives page reload). */
export const MAX_PREVIEW_FILE_BYTES = 2 * 1024 * 1024;

export function guessMimeFromFileName(name: string): string {
  const n = name.toLowerCase();
  if (n.endsWith(".pdf")) return "application/pdf";
  if (n.endsWith(".png")) return "image/png";
  if (n.endsWith(".jpg") || n.endsWith(".jpeg")) return "image/jpeg";
  if (n.endsWith(".webp")) return "image/webp";
  if (n.endsWith(".gif")) return "image/gif";
  return "";
}

export function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => {
      const r = fr.result;
      if (typeof r === "string") resolve(r);
      else reject(new Error("Unexpected read result"));
    };
    fr.onerror = () => reject(fr.error ?? new Error("File read failed"));
    fr.readAsDataURL(file);
  });
}

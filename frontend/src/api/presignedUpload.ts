const FORBIDDEN_UPLOAD_HEADERS = new Set([
  "host",
  "content-length",
  "user-agent",
  "accept-encoding",
  "connection",
]);

function normalizeUploadHeaders(
  headers: Record<string, string>,
  file: File,
): Record<string, string> {
  const filteredHeaders: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers ?? {})) {
    const lower = key.toLowerCase();
    if (FORBIDDEN_UPLOAD_HEADERS.has(lower)) {
      continue;
    }
    filteredHeaders[key] = value;
  }
  if (!Object.keys(filteredHeaders).some((key) => key.toLowerCase() === "content-type")) {
    filteredHeaders["Content-Type"] = file.type || "application/octet-stream";
  }
  return filteredHeaders;
}

export async function uploadByPresignedUrl(
  uploadUrl: string,
  file: File,
  headers: Record<string, string>,
): Promise<void> {
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: normalizeUploadHeaders(headers, file),
    body: file,
  });

  if (!response.ok) {
    let details = "";
    try {
      const text = await response.text();
      details = text ? `: ${text.slice(0, 240)}` : "";
    } catch {
      details = "";
    }
    throw new Error(`upload failed (${response.status})${details}`);
  }
}

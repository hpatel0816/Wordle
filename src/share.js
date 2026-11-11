// Share text with the system share sheet on touch devices, otherwise copy
// it to the clipboard. Resolves to "shared" | "copied" | "cancelled" | "failed".
export async function shareOrCopy(text) {
  const touch = window.matchMedia?.("(pointer: coarse)").matches;
  if (touch && navigator.share) {
    try {
      await navigator.share({ text });
      return "shared";
    } catch (error) {
      if (error?.name === "AbortError") return "cancelled";
      // Fall back to the clipboard.
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch {
    return "failed";
  }
}

export const SHARE_MESSAGES = {
  copied: "Copied to clipboard",
  failed: "Couldn't copy. Your browser blocked clipboard access.",
};

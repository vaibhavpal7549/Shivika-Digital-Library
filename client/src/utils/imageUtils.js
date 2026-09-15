const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

/**
 * Formats image URL to handle relative uploads path vs absolute URLs vs Base64 fallback
 */
export const getImageUrl = (url) => {
  if (!url) return null;
  if (
    url.startsWith("http://") ||
    url.startsWith("https://") ||
    url.startsWith("data:image/")
  ) {
    return url;
  }
  return `${API_BASE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
};

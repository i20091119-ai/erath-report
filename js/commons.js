// js/commons.js
const COMMONS_API = "https://commons.wikimedia.org/w/api.php";
const CACHE = new Map();

export async function enrichCommonsImages(images = [], thumbWidth = 900) {
  const list = Array.isArray(images) ? images : [];
  const results = [];
  for (const img of list) {
    // 이미 URL이 정상이면 패스
    if (!img.commonsUrl || !img.commonsUrl.includes("wikimedia.org")) {
      results.push({ ...img, thumbUrl: img.commonsUrl, originalUrl: img.commonsUrl });
      continue;
    }

    // 파일명 추출
    let filename = null;
    try {
      const u = new URL(img.commonsUrl);
      if (u.pathname.includes("File:")) {
        filename = decodeURIComponent(u.pathname.split("File:")[1]);
      }
    } catch (e) {}

    if (!filename) {
      results.push({ ...img, thumbUrl: img.commonsUrl });
      continue;
    }

    // API 호출 (캐싱)
    const key = `File:${filename}`;
    if (CACHE.has(key)) {
      results.push({ ...img, ...CACHE.get(key) });
      continue;
    }

    try {
      const apiUrl = `${COMMONS_API}?action=query&titles=File:${filename}&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=${thumbWidth}&format=json&origin=*`;
      const res = await fetch(apiUrl);
      const data = await res.json();
      const page = Object.values(data.query.pages)[0];
      const ii = page?.imageinfo?.[0];
      
      if (ii) {
        const info = {
          thumbUrl: ii.thumburl,
          originalUrl: ii.url,
          credit: ii.extmetadata?.Artist?.value?.replace(/<[^>]*>?/gm, '') || "Unknown",
          license: ii.extmetadata?.LicenseShortName?.value || ""
        };
        CACHE.set(key, info);
        results.push({ ...img, ...info });
      } else {
        results.push(img);
      }
    } catch (e) {
      results.push(img);
    }
  }
  return results;
}

export function escapeHtml(text) {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
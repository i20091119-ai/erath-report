// js/commons.js
// 복잡한 기능은 다 끄고, 선생님이 준비한 사진을 그대로 쓰게 합니다.

export async function enrichCommonsImages(images = []) {
  return images.map(img => ({
    ...img,
    thumbUrl: img.commonsUrl,     
    originalUrl: img.commonsUrl, 
    descriptionUrl: "",
    credit: img.credit || "선생님 제공 자료",
    license: img.license || ""
  }));
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

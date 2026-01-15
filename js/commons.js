// js/commons.js (반드시 이 내용이어야 함!)
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
// (아래 escapeHtml 함수는 그대로 유지)
export function escapeHtml(text) { ... }

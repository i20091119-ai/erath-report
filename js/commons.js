// js/commons.js
// 외부 API를 쓰지 않고, 선생님 컴퓨터의 파일을 그대로 사용합니다.

export async function enrichCommonsImages(images = []) {
  return images.map(img => ({
    ...img,
    thumbUrl: img.commonsUrl,     // 로컬 경로 그대로 사용
    originalUrl: img.commonsUrl,  // 로컬 경로 그대로 사용
    descriptionUrl: "",
    credit: img.credit || "선생님 제공 자료", // 출처 표시
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

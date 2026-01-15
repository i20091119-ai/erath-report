// js/gallery.js
import { collection, query, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from "./firebase-init.js";

const listEl = document.getElementById("galleryList");

async function loadGallery() {
  listEl.innerHTML = `<div class="meta">작품을 불러오는 중...</div>`;
  try {
    const q = query(collection(db, "gallery"), orderBy("createdAt", "desc"), limit(50));
    const snapshot = await getDocs(q);
    
    listEl.innerHTML = "";
    if (snapshot.empty) {
      listEl.innerHTML = `<div class="meta">아직 등록된 작품이 없습니다.</div>`;
      return;
    }

    snapshot.forEach(doc => {
      const d = doc.data();
      const card = document.createElement("div");
      card.className = "card";
      card.style.margin = "0";
      card.innerHTML = `
        <div style="font-weight:800;color:#38bdf8;margin-bottom:6px;">${d.issueLabel} · ${d.countryKo}</div>
        <div class="small" style="color:#9ca3af;margin-bottom:12px;">${d.authorName} (${d.authorGrade})</div>
        <div style="font-size:14px;line-height:1.5;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;">
          ${d.reflection}
        </div>
        ${d.hasCustomImage ? '<div class="small" style="margin-top:8px;color:#22c55e;">📸 직접 찍은 사진 포함</div>' : ''}
      `;
      listEl.appendChild(card);
    });
  } catch (e) {
    listEl.innerHTML = `<div class="warn">불러오기 실패. (Firestore Rules 확인 필요)</div>`;
  }
}

loadGallery();
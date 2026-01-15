// js/gallery.js
import { collection, query, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from "./firebase-init.js";
import { escapeHtml } from "./commons.js"; // escapeHtml 재사용

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
      // 7. 갤러리 카드를 보고서 모양 그대로 렌더링
      card.className = "gallery-card"; 
      
      card.innerHTML = `
        <div class="gallery-header">지구촌 문제</div>
        <div style="text-align:center; color:#38bdf8; margin-bottom:8px; font-weight:bold;">${escapeHtml(d.issueLabel)}</div>
        
        <div style="display:flex; justify-content:center; gap:8px; color:#9ca3af; margin-bottom:8px; border-bottom:1px dashed #444; padding-bottom:4px;">
          <span>${escapeHtml(d.authorName)}</span>
          <span>${escapeHtml(d.authorGrade)}</span>
        </div>

        <div style="margin-bottom:8px;">
          <span style="color:#aaa;">관련국가:</span> <b>${escapeHtml(d.countryKo)}</b>
        </div>
        
        <div style="background:rgba(255,255,255,0.05); padding:6px; border-radius:4px; margin-bottom:8px;">
           <div style="color:#aaa; font-size:11px;">문제요약</div>
           <div>${escapeHtml(d.causeSummary || "-")}</div>
        </div>

        <div style="background:rgba(255,255,255,0.05); padding:6px; border-radius:4px;">
           <div style="color:#aaa; font-size:11px;">영향</div>
           <div style="overflow:hidden; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical;">
             ${escapeHtml(d.influence || "-")}
           </div>
        </div>
        
        ${d.hasCustomImage ? '<div style="position:absolute; top:10px; right:10px; font-size:16px;">📸</div>' : ''}
      `;
      listEl.appendChild(card);
    });
  } catch (e) {
    console.error(e);
    listEl.innerHTML = `<div class="warn">불러오기 실패.</div>`;
  }
}

loadGallery();

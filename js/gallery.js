// js/gallery.js
import { collection, query, orderBy, limit, getDocs, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from "./firebase-init.js";
import { escapeHtml } from "./commons.js";

const listEl = document.getElementById("galleryList");
const ADMIN_PASSWORD = "0228"; 

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

    snapshot.forEach(documentSnapshot => {
      const d = documentSnapshot.data();
      const docId = documentSnapshot.id; 

      const card = document.createElement("div");
      card.className = "gallery-card"; 
      
      card.innerHTML = `
        <div class="gallery-header">지구촌 문제</div>
        <button class="btn-delete" title="삭제하기">×</button> 
        
        <div style="text-align:center; color:#38bdf8; margin-bottom:8px; font-weight:bold;">${escapeHtml(d.issueLabel)}</div>
        
        <div style="display:flex; justify-content:center; gap:8px; color:#9ca3af; margin-bottom:8px; border-bottom:1px dashed #444; padding-bottom:4px;">
          <span>${escapeHtml(d.authorName)}</span>
          <span>${escapeHtml(d.authorGrade)}</span>
        </div>

        <div style="margin-bottom:8px;">
          <span style="color:#aaa;">관련국가:</span> <b>${escapeHtml(d.countryKo)}</b>
        </div>
        
        <div style="background:rgba(255,255,255,0.05); padding:8px; border-radius:4px; margin-bottom:8px;">
           <div style="color:#aaa; font-size:11px; margin-bottom:4px;">갈등 상황 분석</div>
           <div style="display:grid; grid-template-columns: 1fr 1fr; gap:6px; font-size:12px;">
             <div><span style="color:#38bdf8;">누가:</span> ${escapeHtml(d.causeWho || "-")}</div>
             <div><span style="color:#38bdf8;">무엇을:</span> ${escapeHtml(d.causeWhat || "-")}</div>
             <div><span style="color:#38bdf8;">왜:</span> ${escapeHtml(d.causeWhy || "-")}</div>
             <div><span style="color:#38bdf8;">결과는:</span> ${escapeHtml(d.causeResult || "-")}</div>
           </div>
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
        
        ${d.hasCustomImage ? '<div style="position:absolute; bottom:10px; right:10px; font-size:16px;">📸</div>' : ''}
      `;

      const delBtn = card.querySelector(".btn-delete");
      delBtn.onclick = async () => {
        const input = prompt("삭제하려면 비밀번호를 입력하세요.");
        if (input === ADMIN_PASSWORD) {
          if(confirm("정말 삭제하시겠습니까?")) {
            await deleteDoc(doc(db, "gallery", docId));
            alert("삭제되었습니다.");
            loadGallery(); 
          }
        } else if (input !== null) {
          alert("비밀번호가 틀렸습니다.");
        }
      };

      listEl.appendChild(card);
    });
  } catch (e) {
    console.error(e);
    listEl.innerHTML = `<div class="warn">불러오기 실패.</div>`;
  }
}

loadGallery();

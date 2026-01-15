// js/app.js
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from "./firebase-init.js";
import { ISSUE_KEYS, COUNTRY_BUTTONS, REF_DATA, flagUrlFromCode } from "./dataset.js";
import { enrichCommonsImages, escapeHtml } from "./commons.js";

// DOM Elements
const elIssueButtons = document.getElementById("issueButtons");
const elCountryButtons = document.getElementById("countryButtons");
const refCard = document.getElementById("refCard");
const writeCard = document.getElementById("writeCard");
const previewCard = document.getElementById("previewCard");

const refTitle = document.getElementById("refTitle");
const refMeta = document.getElementById("refMeta");
const refSources = document.getElementById("refSources");
const refNews = document.getElementById("refNews");
const refImages = document.getElementById("refImages");
const fileInput = document.getElementById("fileInput");

const btnReset = document.getElementById("btnReset");
const btnPreview = document.getElementById("btnPreview");
const btnPdf = document.getElementById("btnPdf");
const btnShareGallery = document.getElementById("btnShareGallery");
const btnRandom = document.getElementById("btnRandom");

// Inputs
const authorName = document.getElementById("authorName");
const authorGrade = document.getElementById("authorGrade");
const authorDate = document.getElementById("authorDate");
const relatedCountry = document.getElementById("relatedCountry");
const causeWho = document.getElementById("causeWho");
const causeWhat = document.getElementById("causeWhat");
const causeWhy = document.getElementById("causeWhy");
const causeResult = document.getElementById("causeResult");
const causeSummary = document.getElementById("causeSummary");
const influence = document.getElementById("influence");

const reportPreview = document.getElementById("reportPreview");
const stickerPalette = document.getElementById("stickerPalette");

let state = {
  issueKey: null,
  issueLabel: null,
  countryKo: null,
  countryEn: null,
  topic: null,
  images: [], 
  tempImageIndex: null
};

// 3. 날짜 자동 지정
authorDate.value = new Date().toISOString().split('T')[0];

function renderIssueButtons() {
  elIssueButtons.innerHTML = "";
  Object.entries(ISSUE_KEYS).forEach(([k, label]) => {
    const btn = document.createElement("button");
    btn.className = "pill";
    btn.textContent = label;
    btn.onclick = () => selectIssue(k, label);
    elIssueButtons.appendChild(btn);
  });
}

function selectIssue(k, label) {
  state.issueKey = k;
  state.issueLabel = label;
  [...elIssueButtons.children].forEach(btn => {
    btn.classList.toggle("active", btn.textContent === label);
  });
  renderCountryButtons();
  resetPanels(false);
}

function renderCountryButtons() {
  elCountryButtons.innerHTML = "";
  if (!state.issueKey) return;
  const list = COUNTRY_BUTTONS[state.issueKey] || [];
  list.forEach(c => {
    const item = document.createElement("div");
    item.className = "country";
    item.innerHTML = `
      <img src="${flagUrlFromCode(c.flagCode)}" alt="" loading="lazy" />
      <div><div class="t">${escapeHtml(c.countryKo)}</div><div class="s">${escapeHtml(c.countryEn)}</div></div>
    `;
    item.onclick = () => loadReference(state.issueKey, c.countryKo, c.countryEn);
    elCountryButtons.appendChild(item);
  });
}

async function loadReference(issueKey, countryKo, countryEn) {
  const d = REF_DATA?.[issueKey]?.[countryKo];
  if (!d) return alert("자료가 없습니다.");

  state.countryKo = countryKo;
  state.countryEn = countryEn;
  state.topic = d.topic || "";
  
  // 관련 국가 자동 입력
  relatedCountry.value = countryKo;
  
  state.images = await enrichCommonsImages((d.images || []).map(x => ({ ...x })));

  refCard.style.display = "";
  writeCard.style.display = "";
  previewCard.style.display = "none";
  refCard.scrollIntoView({ behavior: "smooth" });

  refTitle.textContent = `${state.issueLabel} · ${countryKo}`;
  refMeta.textContent = state.topic ? `주제: ${state.topic}` : "";

  const renderList = (el, list) => {
    el.innerHTML = "";
    (list || []).forEach(x => {
      const li = document.createElement("li");
      li.innerHTML = `<a href="${x.url}" target="_blank">${escapeHtml(x.title)}</a>`;
      el.appendChild(li);
    });
  };
  renderList(refSources, d.sources);
  renderList(refNews, d.news);

  renderRefImages();
}

function renderRefImages() {
  refImages.innerHTML = "";
  state.images.forEach((img, idx) => {
    const wrap = document.createElement("div");
    wrap.className = "imgcard";
    wrap.style.cursor = "pointer";
    wrap.title = "클릭해서 사진 변경";
    wrap.onclick = () => {
      state.tempImageIndex = idx;
      fileInput.click();
    };
    
    const src = img.thumbUrl || img.originalUrl || "";
    wrap.innerHTML = `
      <img src="${src}" style="width:100%;height:160px;object-fit:cover;display:block;">
      <div class="imgcap">
        <div>${escapeHtml(img.credit || "Unknown")}</div>
        <div style="color:#38bdf8;font-size:11px;">🔄 사진 변경하기</div>
      </div>
    `;
    refImages.appendChild(wrap);
  });
}

fileInput.onchange = (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) return alert("이미지가 너무 큽니다 (2MB 이하).");

  const reader = new FileReader();
  reader.onload = (ev) => {
    if (state.tempImageIndex !== null && state.images[state.tempImageIndex]) {
      state.images[state.tempImageIndex] = {
        thumbUrl: ev.target.result,
        originalUrl: ev.target.result,
        credit: "내가 고른 사진",
        isCustom: true
      };
      renderRefImages();
    }
  };
  reader.readAsDataURL(file);
  fileInput.value = "";
};

// 6. 보고서 헤더 고정 및 양식 변경
btnPreview.onclick = () => {
  if (!state.issueKey) return alert("주제를 선택하세요.");
  previewCard.style.display = "";
  
  const imgHtml = `
    <div class="images" style="margin-top:10px;">
      ${state.images.slice(0, 2).map(img => `
        <div class="imgcard">
          <img src="${img.thumbUrl}" crossorigin="anonymous" style="width:100%;display:block;">
          <div class="imgcap">${escapeHtml(img.credit)}</div>
        </div>
      `).join("")}
    </div>
  `;

  reportPreview.innerHTML = `
    <div class="report-header">지구촌 문제</div>
    <div class="report-title">${escapeHtml(state.topic)}</div>
    
    <div class="kv-grid">
      <div>작성자: <b>${escapeHtml(authorName.value)}</b></div>
      <div>학년: <b>${escapeHtml(authorGrade.value)}</b></div>
      <div>날짜: <b>${escapeHtml(authorDate.value)}</b></div>
    </div>
    
    <div style="margin-top:10px; font-size:14px;">
      관련 국가: <b>${escapeHtml(relatedCountry.value)}</b>
    </div>

    <hr style="margin:12px 0;border-top:1px solid rgba(255,255,255,0.2);">
    
    <h3>갈등 상황 분석</h3>
    <table class="report-table">
      <tr>
        <th>누가?</th>
        <th>무엇을?</th>
        <th>왜?</th>
        <th>결과는?</th>
      </tr>
      <tr>
        <td>${escapeHtml(causeWho.value)}</td>
        <td>${escapeHtml(causeWhat.value)}</td>
        <td>${escapeHtml(causeWhy.value)}</td>
        <td>${escapeHtml(causeResult.value)}</td>
      </tr>
    </table>

    <h3>문제 및 갈등 상황</h3>
    <div class="box-content">${escapeHtml(causeSummary.value)}</div>

    <h3>영향 (지구촌과 우리의 생활)</h3>
    <div class="box-content">${escapeHtml(influence.value)}</div>
    
    ${imgHtml}
  `;
  
  setTimeout(() => previewCard.scrollIntoView({ behavior: "smooth" }), 100);
};

btnPdf.onclick = async () => {
  if (!window.jspdf) return alert("PDF 라이브러리 로딩 중...");
  
  const canvas = await html2canvas(reportPreview, {
    scale: 2, useCORS: true, backgroundColor: "#0b1220"
  });
  
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF("p", "mm", "a4");
  const imgData = canvas.toDataURL("image/png");
  const imgWidth = 210;
  const pageHeight = 297;
  const imgHeight = canvas.height * imgWidth / canvas.width;
  
  let heightLeft = imgHeight;
  let position = 0;

  pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;

  while (heightLeft >= 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }
  
  pdf.save(`보고서_${state.countryKo}_${authorName.value}.pdf`);
};

btnShareGallery.onclick = async () => {
  if (!confirm("갤러리에 올릴까요?")) return;
  if (!authorName.value.trim()) return alert("이름을 입력해주세요.");

  try {
    // 7. 갤러리 저장을 위한 데이터 (보고서 내용을 그대로 저장)
    await addDoc(collection(db, "gallery"), {
      issueLabel: state.issueLabel,
      topic: state.topic,
      countryKo: relatedCountry.value || state.countryKo,
      authorName: authorName.value.trim(),
      authorGrade: authorGrade.value.trim(),
      authorDate: authorDate.value,
      
      causeWho: causeWho.value,
      causeWhat: causeWhat.value,
      causeWhy: causeWhy.value,
      causeResult: causeResult.value,
      causeSummary: causeSummary.value,
      influence: influence.value,
      
      hasCustomImage: !!state.images.find(x => x.isCustom),
      createdAt: serverTimestamp()
    });
    alert("등록되었습니다!");
    location.href = "./gallery.html";
  } catch (e) {
    console.error(e);
    alert("업로드 실패");
  }
};

btnReset.onclick = () => resetPanels(true);
function resetPanels(all) {
  if(all) { state.issueKey = null; [...elIssueButtons.children].forEach(x => x.classList.remove("active")); }
  state.countryKo = null;
  refCard.style.display = "none"; writeCard.style.display = "none"; previewCard.style.display = "none";
}

btnRandom.onclick = () => {
  const keys = Object.keys(ISSUE_KEYS);
  const rKey = keys[Math.floor(Math.random() * keys.length)];
  selectIssue(rKey, ISSUE_KEYS[rKey]);
  const countries = COUNTRY_BUTTONS[rKey];
  const rC = countries[Math.floor(Math.random() * countries.length)];
  loadReference(rKey, rC.countryKo, rC.countryEn);
};

const STICKERS = ["👍", "❤️", "⭐", "🔥", "✅", "지구지킴이", "참잘했어요", "환경보호", "💯"];
stickerPalette.innerHTML = "";
STICKERS.forEach(text => {
  const btn = document.createElement("button");
  btn.className = "sticker-btn";
  btn.textContent = text;
  btn.onclick = () => {
    const el = document.createElement("div");
    el.className = "report-sticker";
    el.textContent = text;
    if(text.length > 2) {
      el.style.cssText = "font-size:16px;font-weight:bold;padding:4px 8px;background:#fff;color:#333;border-radius:8px;border:2px solid #333;";
    }
    const w = reportPreview.offsetWidth, h = reportPreview.offsetHeight;
    el.style.left = `${Math.random()*(w*0.7) + (w*0.1)}px`;
    el.style.top = `${Math.random()*(h*0.7) + (h*0.1)}px`;
    el.style.transform = `rotate(${Math.random()*40-20}deg)`;
    el.onclick = () => { if(confirm("삭제할까요?")) el.remove(); };
    reportPreview.appendChild(el);
  };
  stickerPalette.appendChild(btn);
});

renderIssueButtons();

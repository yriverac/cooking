/* ================= modal ================= */
function modal(title, inner){
  const sc = document.createElement("div"); sc.className = "scrim";
  sc.innerHTML = `<div class="modal" role="dialog" aria-label="${esc(title.replace(/<[^>]+>/g, ""))}"><header><h2>${title}</h2><button class="iconbtn" data-close aria-label="Close">${ICON.x}</button></header><div class="body">${inner}</div></div>`;
  document.body.append(sc);
  const close = () => { sc.remove(); document.removeEventListener("keydown", onKey); };
  const onKey = e => { if (e.key === "Escape") close(); };
  sc.addEventListener("click", e => { if (e.target === sc || e.target.closest("[data-close]")) close(); });
  document.addEventListener("keydown", onKey);
  return {el: sc, close};
}

/* ================= add: choose manual or link ================= */
function renderAdd(){
  if (!S.canWrite){ view.innerHTML = `<div class="wrap" style="padding-block:40px"><div class="empty"><h3>Only the owner can add recipes</h3></div></div>`; return; }
  view.innerHTML = `<section class="wrap editor"><h1>Add a <span class="it">recipe</span></h1>
    <a class="panel" href="#new" style="text-decoration:none;color:var(--ink)"><h2>Type it in</h2><p class="muted" style="margin:6px 0 0">Add ingredients and steps one at a time. Best for family recipes.</p></a>
    <a class="panel" href="#import" style="text-decoration:none;color:var(--ink)"><h2>Import from a link</h2><p class="muted" style="margin:6px 0 0">Paste a recipe website link. Claude pulls out the ingredients, steps and photo, and you can edit everything before saving.</p></a></section>`;
}

/* ================= editor ================= */
let draft = null;
function blankDraft(){ return {id:null, title:"", category:"Dinner", source:"", servings:null, servingsUnit:"servings", prepMin:null, cookMin:null, cuisine:"", protein:"", freezer:false, fridgeDays:4, freezerMonths:3,
  photoUrl:"", photoId:"", notes:"", flags:[], equipment:[], ingredients:[{section:"", items:[]}], steps:[{section:"", items:[]}]}; }
function renderEditFor({id}){
  const r = byId(id);
  if (!r){ view.innerHTML = `<div class="wrap" style="padding-block:40px"><div class="empty"><h3>${S.loaded ? "This recipe isn't in your box" : "Opening recipe…"}</h3></div></div>`; if (!S.loaded) setTimeout(() => currentRoute().name === "edit" && route(), 1200); return; }
  renderEditor(r);
}
function renderEditor(r, prefill, note){
  if (!S.canWrite){ renderAdd(); return; }
  draft = prefill ? {...blankDraft(), ...prefill} : r ? clone(r) : blankDraft();
  if (!draft.ingredients.length) draft.ingredients = [{section:"", items:[]}];
  if (!draft.steps.length) draft.steps = [{section:"", items:[]}];
  draft._note = note || "";
  drawEditor();
}
function drawEditor(){
  const d = draft, isNew = !d.id;
  const courses = [...new Set([...COURSES, ...S.recipes.map(x => x.category).filter(Boolean), d.category].filter(Boolean))];
  const cuisines = [...new Set(["Puerto Rican","Mexican","American","Italian","Indian","French","Chinese", ...S.recipes.map(x => x.cuisine).filter(Boolean)])];
  view.innerHTML = `
  <form class="wrap editor" id="ed" autocomplete="off" novalidate>
    <div><span class="label">${isNew ? (d.source ? "Imported recipe · check everything" : "New recipe") : "Editing"}</span><h1 style="margin-top:4px">${isNew ? (d.title ? esc(d.title) : `Add a <span class="it">recipe</span>`) : esc(d.title)}</h1></div>
    ${d._note ? `<div class="banner info">${esc(d._note)}</div>` : ""}
    <div id="warns" class="stack" style="gap:8px"></div>
    <section class="panel fieldgrid">
      <label class="field full"><span>Recipe name</span><input id="f-title" value="${esc(d.title)}" placeholder="e.g. Arroz con gandules" required></label>
      <label class="field full"><span>Source link${d.source && isNew ? " (saved with the recipe)" : " (optional)"}</span><input id="f-src" type="url" inputmode="url" value="${esc(d.source)}" placeholder="https://"></label>
      <label class="field"><span>Servings</span><input id="f-serv" type="number" inputmode="decimal" min="0" step="any" value="${d.servings ?? ""}" placeholder="4"></label>
      <label class="field"><span>Serving unit</span><input id="f-sunit" value="${esc(d.servingsUnit)}" placeholder="servings, cookies…"></label>
      <label class="field"><span>Prep time (min)</span><input id="f-prep" type="number" inputmode="numeric" min="0" value="${d.prepMin ?? ""}"></label>
      <label class="field"><span>Cook time (min)</span><input id="f-cookt" type="number" inputmode="numeric" min="0" value="${d.cookMin ?? ""}"></label>
      <label class="field"><span>Course</span><select id="f-cat">${courses.map(c => `<option ${c === d.category ? "selected" : ""}>${esc(c)}</option>`).join("")}</select></label>
      <label class="field"><span>Cuisine</span><input id="f-cuis" list="cuisines" value="${esc(d.cuisine)}" placeholder="Puerto Rican"><datalist id="cuisines">${cuisines.map(c => `<option>${esc(c)}</option>`).join("")}</datalist></label>
      <label class="field"><span>Protein</span><select id="f-prot">${[...new Set([...PROTEINS, d.protein])].map(p => `<option value="${esc(p)}" ${p === d.protein ? "selected" : ""}>${esc(p || "None")}</option>`).join("")}</select></label>
      <label class="field" style="flex-direction:row;align-items:center;gap:10px;align-self:end;min-height:44px"><input type="checkbox" id="f-frz" ${d.freezer ? "checked" : ""}><span>Freezer-friendly</span></label>
      <label class="field"><span>Keeps in fridge (days)</span><input id="f-fd" type="number" inputmode="numeric" min="0" value="${d.fridgeDays ?? ""}"></label>
      <label class="field"><span>Keeps in freezer (months)</span><input id="f-fm" type="number" inputmode="numeric" min="0" value="${d.freezerMonths ?? ""}"></label>
      <div class="field full"><span>Photo</span>
        <div class="photo-pick">${thumb(d)}<div class="stack" style="gap:6px">${S.assets ? `<div class="row"><label class="btn quiet sm" for="f-photo">Upload photo</label><input id="f-photo" type="file" accept="image/*" hidden>${d.photoUrl ? `<button type="button" class="btn sm ghost" id="rmphoto">Remove</button>` : ""}</div></div>` : `<span class="muted small">Photos need the recipe box owner.</span>`}</div></div>${S.assets ? pasteZone("f-paste", "Copy a photo, then tap here and paste") : ""}</div>
    </section>
    <section class="panel"><h2>Ingredients</h2><p class="muted small" style="margin:4px 0 10px">Amount, unit, then the ingredient. Press Enter to add the next one. Pasting a list adds every line.</p><div id="ingsecs" class="stack" style="gap:10px"></div>
      <button type="button" class="btn sm ghost" id="addIngSec" style="margin-top:10px">+ Add a section (e.g. Frosting)</button></section>
    <section class="panel"><h2>Steps</h2><p class="muted small" style="margin:4px 0 10px">One step at a time. Times like “15 minutes” become timers in cook mode.</p><div id="stepsecs" class="stack" style="gap:10px"></div>
      <button type="button" class="btn sm ghost" id="addStepSec" style="margin-top:10px">+ Add a section</button></section>
    <section class="panel"><h2>Notes</h2><textarea id="f-notes" rows="4" placeholder="e.g. Serve with spicy salsa." aria-label="Notes">${esc(d.notes)}</textarea></section>
    ${!isNew ? `<section class="panel"><h2>Delete recipe</h2><div class="row" id="dz" style="margin-top:8px"><button type="button" class="btn sm ghost" id="del" style="color:var(--alert);border-color:var(--alert)">Delete this recipe</button></div></section>` : ""}
    <div class="sticky-save"><span id="saveMsg" class="muted small" style="margin-right:auto;align-self:center"></span><a class="btn quiet" href="${isNew ? "#home" : "#r-" + esc(d.id)}">Cancel</a><button class="btn" type="submit" id="saveBtn">Save recipe</button></div>
  </form>`;
  const bind = () => {
    d.title = $("#f-title").value; d.source = $("#f-src").value.trim(); d.servings = $("#f-serv").value ? +$("#f-serv").value : null; d.servingsUnit = $("#f-sunit").value.trim() || "servings";
    d.prepMin = $("#f-prep").value ? +$("#f-prep").value : null; d.cookMin = $("#f-cookt").value ? +$("#f-cookt").value : null; d.category = $("#f-cat").value; d.cuisine = $("#f-cuis").value.trim();
    d.protein = $("#f-prot").value; d.freezer = $("#f-frz").checked; d.fridgeDays = $("#f-fd").value ? +$("#f-fd").value : null; d.freezerMonths = $("#f-fm").value ? +$("#f-fm").value : null; d.notes = $("#f-notes").value;
  };
  $$("#ed input, #ed select, #ed textarea").forEach(el => { if (!el.closest("#ingsecs,#stepsecs")) el.addEventListener("input", () => { bind(); drawWarns(); }); });
  $("#f-prot").addEventListener("change", bind); $("#f-frz").addEventListener("change", bind);
  drawSecs("ing"); drawSecs("step"); drawWarns();
  $("#addIngSec").onclick = () => { draft.ingredients.push({section:"New section", items:[]}); drawSecs("ing"); };
  $("#addStepSec").onclick = () => { draft.steps.push({section:"New section", items:[]}); drawSecs("step"); };
  $("#f-photo")?.addEventListener("change", e => e.target.files[0] && setPhoto(e.target.files[0]));
  bindPasteZone($("#f-paste"), fs => setPhoto(fs[0]));
  $("#rmphoto")?.addEventListener("click", () => { bind(); d.photoUrl = ""; d.photoId = ""; drawEditor(); });
  $("#del")?.addEventListener("click", () => {
    $("#dz").innerHTML = `<span>Delete “${esc(d.title)}” for good?</span><button type="button" class="btn sm danger" id="delY">Yes, delete</button><button type="button" class="btn sm quiet" id="delN">Keep it</button>`;
    $("#delN").onclick = drawEditor;
    $("#delY").onclick = async () => { try { await S.db.collection("recipes").doc(d.id).delete(); toast("Recipe deleted"); location.hash = "#home"; } catch { toast("Couldn't delete. Try again."); } };
  });
  $("#ed").onsubmit = async e => {
    e.preventDefault(); bind();
    $$("[data-adder]").forEach(row => { const [kind, si] = row.dataset.adder.split(":"); takeAdder(kind, +si, row, false); });
    if (!d.title.trim()){ $("#saveMsg").textContent = "Give the recipe a name first."; $("#f-title").focus(); return; }
    const clean = (secs, f) => secs.map(s => ({section:(s.section||"").trim(), items:s.items.filter(f)})).filter(s => s.items.length || s.section);
    const doc = {schema:2, title:d.title.trim(), category:d.category || "Dinner", source:d.source, servings:d.servings, servingsUnit:d.servingsUnit, prepMin:d.prepMin, cookMin:d.cookMin,
      cuisine:d.cuisine, protein:d.protein, freezer:d.freezer, fridgeDays:d.fridgeDays, freezerMonths:d.freezerMonths, tags:d.tags || [], photoUrl:d.photoUrl || "", photoId:d.photoId || "",
      notes:d.notes, equipment:d.equipment || [], flags:d.flags || [], favorite:!!d.favorite, order:d.order ?? 1000, createdAt:d.createdAt || new Date().toISOString(),
      ingredients: clean(d.ingredients, i => (i.n||"").trim() || i.q != null).map(s => ({...s, items:s.items.map(i => ({q:i.q ?? null, q2:i.q2 ?? null, u:(i.u||"").trim(), n:(i.n||"").trim()}))})),
      steps: clean(d.steps, t => String(t).trim()).map(s => ({...s, items:s.items.map(t => String(t).trim())}))};
    const id = d.id || slug(doc.title);
    $("#saveBtn").disabled = true; $("#saveMsg").textContent = "Saving…";
    try { await S.db.collection("recipes").doc(id).set({...doc, updatedAt: new Date().toISOString()}); toast("Recipe saved"); location.hash = "#r-" + id; }
    catch(err){ $("#saveBtn").disabled = false; $("#saveMsg").textContent = err?.code === "quota_exceeded" ? "Storage is full. Delete a recipe to make room." : "Couldn't save. Check your connection and try again."; }
  };
}
function drawWarns(){
  const host = $("#warns"); if (!host) return;
  const r = {...draft, ingredients: draft.ingredients, steps: draft.steps};
  host.innerHTML = allergyBanner(allergensOf(r)) + meatBanner(meatsOf(r));
}
function drawSecs(kind){
  const secs = kind === "ing" ? draft.ingredients : draft.steps;
  const host = $(kind === "ing" ? "#ingsecs" : "#stepsecs");
  const multi = secs.length > 1 || secs[0]?.section;
  const ingRow = (it, si, i) => `<div class="ing-row"><input data-q="${si}:${i}" value="${it.q != null ? esc(fmtNum(it.q) + (it.q2 != null ? "-" + fmtNum(it.q2) : "")) : ""}" placeholder="Qty" aria-label="Amount" inputmode="decimal">
      <input data-u="${si}:${i}" value="${esc(it.u)}" placeholder="Unit" aria-label="Unit"><input data-n="${si}:${i}" value="${esc(it.n)}" aria-label="Ingredient">
      <span class="tools"><button type="button" class="iconbtn" data-mv="${si}:${i}:-1" aria-label="Move up">${ICON.up}</button><button type="button" class="iconbtn" data-rm="${si}:${i}" aria-label="Remove">${ICON.x}</button></span></div>`;
  host.innerHTML = secs.map((s, si) => `
    <div class="sec-edit">
      ${multi ? `<div class="row" style="flex-wrap:nowrap"><input data-sec="${si}" value="${esc(s.section)}" placeholder="Section name (optional)" style="font-weight:600"><button type="button" class="iconbtn" data-rmsec="${si}" aria-label="Remove section">${ICON.x}</button></div>` : ""}
      ${kind === "ing" ? s.items.map((it, i) => ingRow(normIng(it), si, i)).join("")
        : s.items.map((t, i) => `<div class="step-row"><span class="n">${i+1}.</span><textarea data-t="${si}:${i}" rows="2" aria-label="Step ${i+1}">${esc(t)}</textarea><span class="tools"><button type="button" class="iconbtn" data-mv="${si}:${i}:-1" aria-label="Move up">${ICON.up}</button><button type="button" class="iconbtn" data-rm="${si}:${i}" aria-label="Remove">${ICON.x}</button></span></div>`).join("")}
      ${kind === "ing" ? `<div class="ing-row" data-adder="ing:${si}"><input class="aq" placeholder="2" aria-label="New amount" inputmode="decimal"><input class="au" placeholder="cups" aria-label="New unit"><input class="an" placeholder="white rice" aria-label="New ingredient"><button type="button" class="btn sm" data-add="${si}">Add</button></div>`
        : `<div class="step-row" data-adder="step:${si}"><span class="n">${s.items.length+1}.</span><textarea class="an" rows="2" placeholder="Describe the next step" aria-label="New step"></textarea><button type="button" class="btn sm" data-add="${si}">Add</button></div>`}
    </div>`).join("");
  const parseQ = v => { v = v.trim(); if (!v) return [null, null]; const m = v.match(/^(.+?)\s*(?:-|–|to)\s*(.+)$/); return m ? [toNum(m[1]), toNum(m[2])] : [toNum(v), null]; };
  $$("[data-q]", host).forEach(el => el.oninput = () => { const [si,i] = el.dataset.q.split(":").map(Number); const [a,b] = parseQ(el.value); secs[si].items[i] = {...normIng(secs[si].items[i]), q: isFinite(a) ? a : null, q2: isFinite(b) ? b : null}; drawWarns(); });
  $$("[data-u]", host).forEach(el => el.oninput = () => { const [si,i] = el.dataset.u.split(":").map(Number); secs[si].items[i] = {...normIng(secs[si].items[i]), u: el.value}; });
  $$("[data-n]", host).forEach(el => el.oninput = () => { const [si,i] = el.dataset.n.split(":").map(Number); secs[si].items[i] = {...normIng(secs[si].items[i]), n: el.value}; drawWarns(); });
  $$("[data-t]", host).forEach(el => el.oninput = () => { const [si,i] = el.dataset.t.split(":").map(Number); secs[si].items[i] = el.value; drawWarns(); });
  $$("[data-sec]", host).forEach(el => el.oninput = () => secs[+el.dataset.sec].section = el.value);
  $$("[data-rmsec]", host).forEach(b => b.onclick = () => { const si = +b.dataset.rmsec; if (secs.length > 1){ const gone = secs.splice(si, 1)[0]; secs[Math.max(0, si-1)].items.push(...gone.items); } else secs[0].section = ""; drawSecs(kind); });
  $$("[data-rm]", host).forEach(b => b.onclick = () => { const [si,i] = b.dataset.rm.split(":").map(Number); secs[si].items.splice(i, 1); drawSecs(kind); drawWarns(); });
  $$("[data-mv]", host).forEach(b => b.onclick = () => { const [si,i,dd] = b.dataset.mv.split(":").map(Number); const a = secs[si].items, j = i + dd; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; drawSecs(kind); });
  $$("[data-adder]", host).forEach(row => {
    const si = +row.dataset.adder.split(":")[1];
    const go = () => { if (takeAdder(kind, si, row, true)){ drawSecs(kind); drawWarns(); $(`[data-adder="${kind}:${si}"] ${kind === "ing" ? ".aq" : ".an"}`, host)?.focus(); } };
    $("[data-add]", row).onclick = go;
    $$("input,textarea", row).forEach(inp => {
      inp.addEventListener("keydown", e => { if (e.key === "Enter" && (kind === "ing" || e.metaKey || e.ctrlKey)){ e.preventDefault(); go(); } });
      inp.addEventListener("paste", e => { const t = e.clipboardData?.getData("text") || ""; if (t.includes("\n")){ e.preventDefault(); const lines = t.split("\n").map(x => x.replace(/^\s*(?:[-•▢*]|\d+[.)])\s*/, "").trim()).filter(Boolean); secs[si].items.push(...(kind === "ing" ? lines.map(parseIng) : lines)); drawSecs(kind); drawWarns(); } });
    });
  });
}
function takeAdder(kind, si, row, strict){
  const secs = kind === "ing" ? draft.ingredients : draft.steps;
  if (kind === "step"){ const v = $(".an", row).value.trim(); if (!v) return false; secs[si].items.push(v); return true; }
  const q = $(".aq", row).value.trim(), u = $(".au", row).value.trim(), n = $(".an", row).value.trim();
  if (!n && !q) return false;
  const it = (!u && !n.length) ? parseIng(q) : (!q && !u ? parseIng(n) : (() => { const p = parseIng(q + " x"); return {q: p.q, q2: p.q2, u, n}; })());
  secs[si].items.push(it); return true;
}
/* photos: upload, paste, or crop from an import screenshot */
async function shrink(blob, crop){
  const bmp = await createImageBitmap(blob);
  let sx = 0, sy = 0, sw = bmp.width, sh = bmp.height;
  if (crop){ sx = Math.max(0, crop[0]*bmp.width); sy = Math.max(0, crop[1]*bmp.height); sw = Math.min(bmp.width - sx, crop[2]*bmp.width); sh = Math.min(bmp.height - sy, crop[3]*bmp.height); }
  const s = Math.min(1, 1400 / Math.max(sw, sh)); const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(sw*s)); c.height = Math.max(1, Math.round(sh*s));
  c.getContext("2d").drawImage(bmp, sx, sy, sw, sh, 0, 0, c.width, c.height);
  return await new Promise(res => c.toBlob(b => res(b || blob), "image/jpeg", .85));
}
async function uploadPhoto(file, crop){ const a = await S.assets.upload(await shrink(file, crop)); return {photoId: a.id, photoUrl: a.url}; }
async function setPhoto(file){
  const msg = $("#saveMsg"); if (msg) msg.textContent = "Uploading photo…";
  try { Object.assign(draft, await uploadPhoto(file)); drawEditor(); $("#saveMsg").textContent = "Photo added. Save to keep it."; }
  catch { if ($("#saveMsg")) $("#saveMsg").textContent = "That photo couldn't upload. Try a JPG or PNG under 20 MB."; }
}
/* copy & paste images: a paste box (long-press then Paste on phones, Cmd/Ctrl+V elsewhere), drag and drop, or paste anywhere on the page */
function clipImages(dt){
  const out = []; if (!dt) return out;
  [...(dt.items || [])].forEach(i => { if (i.kind === "file" && i.type.startsWith("image/")){ const f = i.getAsFile(); if (f) out.push(f); } });
  if (!out.length) [...(dt.files || [])].forEach(f => { if (f.type.startsWith("image/")) out.push(f); });
  return out;
}
function pastedLinkOnly(dt){ const h = dt?.getData?.("text/html") || ""; return /<img[^>]+src=/i.test(h); }
function pasteZone(id, label){ return `<div class="pastezone" id="${id}" contenteditable="true" role="button" tabindex="0" aria-label="${esc(label)}" spellcheck="false" autocorrect="off" data-label="${esc(label)}">${esc(label)}</div>`; }
function bindPasteZone(el, onFiles){
  if (!el) return;
  const reset = (t, cls) => { el.textContent = t || el.dataset.label; el.className = "pastezone" + (cls ? " " + cls : ""); };
  el.addEventListener("paste", e => { e.preventDefault(); e.stopPropagation(); const fs = clipImages(e.clipboardData);
    if (fs.length){ reset(fs.length > 1 ? `Added ${fs.length} images` : "Added", "busy"); onFiles(fs); setTimeout(() => el.isConnected && reset(), 1500); }
    else reset(pastedLinkOnly(e.clipboardData) ? "That pasted a link, not the picture. Use “Copy Image” on the photo, then paste again." : "No image on the clipboard. Copy a photo or screenshot first.", "err"); });
  el.addEventListener("beforeinput", e => { if (e.inputType !== "insertFromPaste") e.preventDefault(); });
  el.addEventListener("drop", e => { e.preventDefault(); el.classList.remove("over"); const fs = clipImages(e.dataTransfer); if (fs.length) onFiles(fs); });
  el.addEventListener("dragover", e => { e.preventDefault(); el.classList.add("over"); });
  el.addEventListener("dragleave", () => el.classList.remove("over"));
  el.addEventListener("blur", () => reset());
}
/* paste anywhere: editor sets the photo, recipe page sets the photo, import adds a screenshot */
document.addEventListener("paste", e => {
  if (e.target.closest?.(".pastezone")) return;
  const fs = clipImages(e.clipboardData); if (!fs.length) return;
  const r = currentRoute();
  if (["new","edit"].includes(r.name) && draft && S.assets){ e.preventDefault(); setPhoto(fs[0]); }
  else if (r.name === "recipe" && S.assets && S.canWrite){ e.preventDefault(); setRecipePhoto(r.id, fs[0]); }
  else if (r.name === "import" && importShots){ e.preventDefault(); importShots(fs); }
});
async function setRecipePhoto(id, file){
  const r = byId(id); if (!r) return; toast("Uploading photo…");
  try { const p = await uploadPhoto(file); await write("recipes/" + id, {...stripId(r), ...p}); toast("Photo updated"); }
  catch { toast("That photo couldn't upload. Try a JPG or PNG under 20 MB."); }
}

/* ================= import from a link ================= */
let importCtl = null, importShots = null;
function renderImport(){
  if (!S.canWrite){ renderAdd(); return; }
  view.innerHTML = `
  <section class="wrap editor">
    <div><span class="label">Import</span><h1 style="margin-top:4px">Save a recipe from a <span class="it">website</span></h1>
      <p class="muted" style="margin:8px 0 0">This app can't open other websites by itself, so you bring the page to Claude: copy its text or take screenshots. Claude reads the recipe and finds the dish photo in your screenshots, and you can edit every field before saving.</p></div>
    <div class="howto"><div><b>1</b><span>Paste the recipe link, then tap Open page.</span></div><div><b>2</b><span>On the page, select all and copy it, or take screenshots of the photo, ingredients and steps.</span></div><div><b>3</b><span>Paste or add them here and tap Read recipe.</span></div></div>
    <section class="panel stack">
      <label class="field"><span>Recipe link (required)</span><div class="row" style="flex-wrap:nowrap"><input id="im-url" type="url" inputmode="url" placeholder="https://twosleevers.com/instant-pot-butter-chicken/"><a class="btn quiet" id="im-open" target="_blank" rel="noopener" href="#">Open page</a></div></label>
      <label class="field"><span>Page text</span><textarea id="im-text" rows="8" placeholder="Paste the copied page here. Ads, menus and comments are fine."></textarea></label>
      <div class="field"><span>Screenshots (the dish photo becomes the recipe photo)</span><div class="row"><label class="btn quiet sm" for="im-img">Choose screenshots</label><input id="im-img" type="file" accept="image/*" multiple hidden></div>${pasteZone("im-paste", "Or copy screenshots, then tap here and paste")}<div id="im-imgs" class="shots"></div></div>
      <div id="im-msg"></div>
      <div class="row"><button class="btn" id="im-go">Read recipe</button><button class="btn quiet" id="im-stop" hidden>Stop</button></div>
    </section>
  </section>`;
  const url = $("#im-url"), open = $("#im-open"), msgEl = $("#im-msg");
  const validUrl = () => { try { const u = new URL(url.value.trim()); return /^https?:$/.test(u.protocol) && u.hostname.includes(".") ? u.href : null; } catch { return null; } };
  url.oninput = () => { open.href = validUrl() || "#"; };
  open.onclick = e => { if (!validUrl()){ e.preventDefault(); say("Paste the full recipe link first, starting with https://", true); url.focus(); } };
  let files = [];
  const drawShots = () => { const host = $("#im-imgs"); if (!host) return; host.querySelectorAll("img").forEach(i => URL.revokeObjectURL(i.src));
    host.innerHTML = files.map((f, i) => `<figure class="shot"><img src="${URL.createObjectURL(f)}" alt="Screenshot ${i+1}"><button type="button" class="iconbtn" data-rmshot="${i}" aria-label="Remove screenshot ${i+1}">${ICON.x}</button></figure>`).join("");
    $$("[data-rmshot]", host).forEach(b => b.onclick = () => { files.splice(+b.dataset.rmshot, 1); drawShots(); }); };
  importShots = fs => { files.push(...fs); drawShots(); toast(`${fs.length} screenshot${fs.length > 1 ? "s" : ""} added`); };
  $("#im-img").onchange = e => { importShots([...e.target.files]); e.target.value = ""; };
  bindPasteZone($("#im-paste"), importShots);
  function say(t, err, manual){ msgEl.innerHTML = `<div class="banner ${err ? "alert" : "info"}">${err ? ICON.warn : ""}<div>${esc(t)}${manual ? `<div class="row" style="margin-top:8px"><button class="btn sm" id="im-manual">Enter it manually</button></div>` : ""}</div></div>`;
    $("#im-manual")?.addEventListener("click", () => renderEditor(null, {source: validUrl() || url.value.trim()}, "Type the recipe in. The link is saved with it.")); }
  $("#im-stop").onclick = () => importCtl?.abort();
  $("#im-go").onclick = async () => {
    const src = validUrl(), text = $("#im-text").value.trim();
    if (!src){ say("Paste the recipe's link first, starting with https://. It's saved with the recipe.", true); url.focus(); return; }
    const pre = allergenHits([text.slice(0, 20000)]);
    const readLocally = why => {
      const got = text ? parseRecipeText(text, src) : null;
      if (!got){ say(`${why} The app also couldn't find an Ingredients list and Instructions in the pasted text. Copy the whole recipe card and try again, or enter it manually.`, true, true); return; }
      renderEditor(null, {...got, source: src, category: "Dinner"}, `Read from the page text (${why.replace(/\.$/, "")}). Check every field, then save.`);
    };
    if (!S.sample){
      if (!text){ say("Reading screenshots needs Claude, and this view of the app doesn't allow Claude. Paste the page text instead, or open the app in a claude.ai browser tab.", true, true); return; }
      readLocally("Claude isn't available in this view."); return;
    }
    if (!text && !files.length){ say("Paste the page text or add screenshots. Claude can't open the link by itself.", true, true); return; }
    let imgs = [];
    if (files.length){ const lim = await S.sample.limits().catch(() => null); if (!lim?.images){ say("Screenshots don't work in this view. Paste the page text instead.", true, true); return; } imgs = files.slice(0, lim.images.maxCount); }
    const prompt = `You turn a recipe web page into structured data for a personal recipe app.
Use ONLY the page text${imgs.length ? " and the screenshots" : ""}. Ignore ads, menus, comments, nutrition facts and the author's story. Never invent ingredients or steps. Keep the recipe's wording and language.
The recipe must have ONE version only: if the page offers spicy/mild or other variants, keep the main version and leave the variants out.
Reply with only one JSON object:
{"title": string, "course": "Drinks"|"Appetizers"|"Desserts"|"Dinner", "cuisine": string, "protein": ""|"Beef"|"Chicken"|"Pork"|"Turkey"|"Lamb"|"Fish"|"Shellfish"|"Beans / vegetarian"|"Eggs",
 "servings": number|null, "servingsUnit": string (e.g. "servings", "cookies"), "prepMin": number|null, "cookMin": number|null,
 "freezer": boolean (true if it freezes well), "fridgeDays": number (how many days leftovers keep in the fridge), "freezerMonths": number (0 if it doesn't freeze),
 "ingredients": [{"section": string, "items": [{"q": number|null, "q2": number|null (upper end of a range), "u": string (unit as written, or ""), "n": string (ingredient and any prep notes)}]}],
 "steps": [{"section": string, "items": [string]}],
 "notes": string,
 ${imgs.length ? `"photo": null | {"image": index of the screenshot (0-based) that shows the finished dish, "box": [left, top, width, height] as fractions 0-1 of that screenshot, tightly around the food photo only, no text]},` : ""}
 "problems": [string] (anything you couldn't read or had to guess)}
If the material has no recipe, reply {"error": "short reason"}.
Source: ${src}

PAGE TEXT:
${text.slice(0, 60000) || "(see screenshots)"}`;
    importCtl = new AbortController();
    $("#im-go").disabled = true; $("#im-stop").hidden = false; say("Reading the recipe… usually 20 to 60 seconds.");
    try {
      const j = await S.sample.json(prompt, {signal: importCtl.signal, ...(imgs.length ? {images: imgs} : {})});
      if (!j || j.error || !j.title){ say(`Couldn't find a recipe on that page${j?.error ? `: ${j.error}` : "."} Try copying the whole page again, or enter it manually.`, true, true); return; }
      const arr = v => Array.isArray(v) ? v : [];
      const num = v => (v === null || v === undefined || v === "" || !isFinite(+v)) ? null : +v;
      const ingredients = arr(j.ingredients).map(s => ({section: String(s?.section || ""), items: arr(s?.items).map(i => typeof i === "string" ? parseIng(i) : {q: num(i?.q), q2: num(i?.q2), u: String(i?.u || ""), n: String(i?.n || "")})})).filter(s => s.items.length);
      const steps = arr(j.steps).map(s => ({section: String(s?.section || ""), items: arr(s?.items).map(String)})).filter(s => s.items.length);
      if (!ingredients.length && !steps.length){ say("Claude found the page but no ingredients or steps. Enter it manually.", true, true); return; }
      const prefill = {title: String(j.title), category: COURSES.includes(j.course) ? j.course : "Dinner", cuisine: String(j.cuisine || ""), protein: String(j.protein || ""), source: src,
        servings: num(j.servings), servingsUnit: String(j.servingsUnit || "servings"), prepMin: num(j.prepMin), cookMin: num(j.cookMin), freezer: !!j.freezer, fridgeDays: num(j.fridgeDays) ?? 4, freezerMonths: num(j.freezerMonths) ?? 0,
        ingredients, steps, notes: String(j.notes || ""), flags: arr(j.problems).map(String)};
      if (j.photo && imgs[j.photo.image] && Array.isArray(j.photo.box) && S.assets){
        say("Recipe found. Saving the dish photo…");
        try { Object.assign(prefill, await uploadPhoto(imgs[j.photo.image], j.photo.box.map(Number))); } catch {}
      }
      renderEditor(null, prefill, `Imported from ${new URL(src).hostname.replace(/^www\./, "")}. Check every field, then save.${!prefill.photoUrl ? " No dish photo was found: upload or paste one if you like." : ""}`);
    } catch(e){
      const c = e?.code;
      if (c === "cancelled") say("Stopped.");
      else if (c === "not_granted" || c === "sampling_disabled" || c === "capability_disabled" || c === "capability_removed"){ if (text) readLocally("Claude isn't allowed on this page."); else say("Reading screenshots needs Claude, which isn't allowed on this page. Paste the page text instead.", true, true); }
      else if (c === "rate_limited") say("Claude is busy for you right now. Wait a minute and try again.", true, true);
      else if (c === "prompt_too_large") say("That page is too long. Copy just the recipe part and try again.", true, true);
      else if (c === "invalid_json") say("Claude's answer came back unreadable. Tap Read recipe to try again, or enter it manually.", true, true);
      else say("Couldn't read that page. Try again, or enter it manually.", true, true);
    } finally { if ($("#im-go")){ $("#im-go").disabled = false; $("#im-stop").hidden = true; } }
    if (pre.length) {} // allergy warnings show on the review form
  };
}

/*PART3*/

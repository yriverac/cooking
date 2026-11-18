/* ================= state + utils ================= */
const S = { recipes: [], loaded: false, canWrite: true, db: null, assets: null, sample: null, downloads: null, user: null,
  q: "", filter: "All", serv: {}, inv: null, freezer: null, plans: {}, week: null, planSub: null, kTab: "Pantry", kq: "" };
const COURSES = ["Breakfast","Drinks","Appetizers","Desserts","Dinner"];
const PROTEINS = ["","Beef","Chicken","Pork","Turkey","Lamb","Beans / vegetarian","Eggs"];
const TILE = {Breakfast:"--t-break",Drinks:"--t-drinks",Appetizers:"--t-app",Desserts:"--t-dess",Dinner:"--t-dinner"};
const DAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const $ = (s, el=document) => el.querySelector(s);
const $$ = (s, el=document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const view = $("#view");
const ICON = {
  search:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  up:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 15 6-6 6 6"/></svg>',
  down:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>',
  x:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  timer:'<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M9 2h6"/></svg>',
  warn:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" style="flex:none;margin-top:1px"><path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17v.5"/></svg>'
};
function toast(t){ $$(".toast").forEach(x=>x.remove()); const el = document.createElement("div"); el.className="toast"; el.setAttribute("role","status"); el.textContent=t; document.body.append(el); setTimeout(()=>el.remove(), 2800); }
function slug(t){ return (String(t).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,48) || "recipe") + "-" + Math.random().toString(36).slice(2,6); }
function uid(){ return Math.random().toString(36).slice(2,10); }
const clone = o => JSON.parse(JSON.stringify(o));
const todayISO = () => iso(new Date());
function iso(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function addDays(isoStr, n){ const d = new Date(isoStr + "T12:00:00"); d.setDate(d.getDate() + n); return iso(d); }
function addMonths(isoStr, n){ const d = new Date(isoStr + "T12:00:00"); d.setMonth(d.getMonth() + n); return iso(d); }
function niceDate(isoStr){ if (!isoStr) return ""; return new Date(isoStr + "T12:00:00").toLocaleDateString(undefined, {month:"short", day:"numeric"}); }
function daysUntil(isoStr){ return Math.round((new Date(isoStr + "T12:00:00") - new Date(todayISO() + "T12:00:00")) / 864e5); }
function mondayOf(d){ const x = new Date(d); x.setHours(12,0,0,0); x.setDate(x.getDate() - (x.getDay()+6)%7); return x; }
function store(k, v){ try { if (v === undefined){ const s = localStorage.getItem(k); return s ? JSON.parse(s) : null; } localStorage.setItem(k, JSON.stringify(v)); } catch { return null; } }

/* recipe shape (also upgrades older saved recipes) */
function normalize(r){
  const x = {...r};
  if (x.schema !== 2){
    x.ingredients = (x.ingredients||[]).map(s => ({section:s.section||"", items:(s.items||[]).map(normIng)}));
    if (typeof x.servings === "string"){ const m = x.servings.match(/^(\d+(?:\.\d+)?)\s*(.*)$/); x.servingsUnit = m ? (m[2]||"servings") : "servings"; x.servings = m ? +m[1] : null; }
    if (Array.isArray(x.notes)) x.notes = x.notes.join("\n\n");
  }
  x.ingredients = (x.ingredients||[]).map(s => ({section:s.section||"", items:(s.items||[]).map(normIng)}));
  x.steps = (x.steps||[]).map(s => ({section:s.section||"", items:(s.items||[]).map(String)}));
  x.notes = x.notes || ""; x.flags = x.flags || []; x.servingsUnit = x.servingsUnit || "servings";
  return x;
}
const allIngs = r => (r.ingredients||[]).flatMap(s => s.items||[]);
const flatSteps = r => (r.steps||[]).flatMap(s => (s.items||[]).map(t => ({section:s.section||"", text:t})));
const byId = id => S.recipes.find(r => r.id === id);
function allergensOf(r){ return allergenHits([r.title, ...allIngs(r).map(i => ingText(i)), ...flatSteps(r).map(s => s.text)]); }
function meatsOf(r){ return meatsIn(allIngs(r).map(i => ingText(i))); }
/* bundled default photos: used only when a recipe has no photo of its own */
const STOCK = /*STOCK*/{};
const photoOf = r => r.photoUrl || (r.id && STOCK[r.id]) || "";
function thumb(r){ const src = photoOf(r); return `<div class="thumb" style="background:var(${TILE[r.category] || "--t-other"})">${src ? `<img src="${esc(src)}" alt="" loading="lazy">` : `<span class="initial">${esc((r.title||"?").trim()[0] || "?")}</span>`}</div>`; }
function scaleFor(r){ const base = r.servings || 1; const cur = S.serv[r.id] ?? base; return {base, cur, k: cur / base}; }
function servLabel(r, n){ return r.servings ? `${fmtNum(n)} ${esc(r.servingsUnit || "servings")}` : `${fmtNum(n)}× batch`; }
function keepsText(r){
  const p = [];
  if (r.fridgeDays) p.push(`${r.fridgeDays} days in the fridge`);
  if (r.freezer && r.freezerMonths) p.push(`${r.freezerMonths} month${r.freezerMonths>1?"s":""} in the freezer`);
  return p.join(" · ");
}
function allergyBanner(hits){
  if (!hits.length) return "";
  return `<div class="banner alert" role="alert">${ICON.warn}<div><b>Allergy warning</b>${hits.map(h => `${esc(h.kind === "Shellfish" ? "Shellfish" : "Fish")}: “${esc(h.word)}”${h.why ? ` (${esc(h.why)})` : ""}`).join("<br>")}</div></div>`;
}
function meatBanner(meats){
  return meats.length > 1 ? `<div class="banner warn">${ICON.warn}<div><b>More than one meat</b>This recipe uses ${esc(meats.join(" and "))}. You aimed for one meat per meal.</div></div>` : "";
}

/* ================= boot + sync ================= */
let SEED = {recipes:{}, kitchen:null};
try { SEED = JSON.parse($("#seed").textContent); } catch {}
function setSync(t){ $("#sync").textContent = t; }
async function boot(){
  window.addEventListener("hashchange", route);
  route();
  const c = window.claude;
  if (!c?.use){ S.loaded = true; S.canWrite = false; setSync("Open this page in Claude to load your recipes."); route(); return; }
  const [db, user, assets, sample, downloads] = await Promise.all(["db","user","assets","sample","downloads"].map(n => c.use(n).catch(() => null)));
  Object.assign(S, {db, user, assets, sample, downloads});
  if (user){ try { const w = await user.can?.("data.write"); const own = await user.isOwner?.(); S.canWrite = (w == null) ? true : (!!w || !!own); } catch {} }
  if (!db){ S.loaded = true; S.canWrite = false; setSync("Sign in to Claude to see your recipes."); route(); return; }
  const t = setTimeout(() => setSync("Can't reach your recipe box yet. Check your connection."), 10000);
  db.collection("recipes").onSnapshot(snap => {
    S.recipes = snap.docs.map(d => normalize({id: d.id, ...d.data()})).sort((a,b) => (a.order ?? 999) - (b.order ?? 999) || String(a.title).localeCompare(b.title));
    S.loaded = true;
    if (!snap.metadata.fromCache){ clearTimeout(t); setSync(`${S.recipes.length} recipes · synced across your devices`); maybeAutoBackup(); }
    softRender();
  }, () => { clearTimeout(t); S.loaded = true; setSync("Your recipes couldn't load. Reload the page to try again."); softRender(); });
  db.doc("kitchen/inventory").onSnapshot(s => { S.inv = s.exists ? s.data() : null; S.invIdx = null; softRender(); }, () => {});
  db.doc("kitchen/freezer").onSnapshot(s => { S.freezer = s.exists ? s.data() : {meals:[]}; softRender(); }, () => {});
  subscribeWeek();
}
function softRender(){
  const r = currentRoute();
  if (["new","edit","add","import"].includes(r.name)) return;          // never wipe a form in progress
  if (cook.open) return;
  const a = document.activeElement; if (a && a.matches("input,textarea,select") && view.contains(a)) return;
  route();
}
/* queued writes: one at a time per doc */
const queues = {};
function write(path, data, msg){
  if (!S.db || !S.canWrite) { toast("Only the owner can make changes."); return Promise.resolve(); }
  queues[path] = (queues[path] || Promise.resolve()).then(() => S.db.doc(path).set({...data, updatedAt: new Date().toISOString()}))
    .catch(e => toast(e?.code === "quota_exceeded" ? "Storage is full. Delete something to make room." : (msg || "Couldn't save. Check your connection and try again.")));
  return queues[path];
}

/* ================= routing ================= */
function currentRoute(){
  const h = location.hash.replace(/^#/, ""); let m;
  if (!h || h === "home") return {name:"home"};
  if (["plan","shop","kitchen","data","new","import","add"].includes(h)) return {name:h};
  if ((m = h.match(/^edit-(.+)$/))) return {name:"edit", id:m[1]};
  if ((m = h.match(/^r-(.+)$/))) return {name:"recipe", id:m[1]};
  if ((m = h.match(/^prep-(Mon|Tue|Wed|Thu|Fri|Sat|Sun)$/))) return {name:"prep", day:m[1]};
  return {name:"home"};
}
let lastKey = "";
function route(){
  const r = currentRoute(), key = r.name + (r.id || r.day || "");
  const nav = {recipe:"home", edit:"home", prep:"plan", new:"add", import:"add"}[r.name] || r.name;
  $$("[data-nav]").forEach(a => a.toggleAttribute("aria-current", false));
  $$(`[data-nav="${nav}"]`).forEach(a => a.setAttribute("aria-current", "page"));
  $$("[data-write]").forEach(a => a.hidden = !S.canWrite);
  ({home:renderHome, recipe:renderRecipe, add:renderAdd, new:() => renderEditor(null), edit:renderEditFor, import:renderImport,
    plan:renderPlan, prep:renderPrep, shop:renderShop, kitchen:renderKitchen, data:renderData})[r.name](r);
  if (key !== lastKey){ window.scrollTo(0, 0); lastKey = key; }
}

/* ================= home: library ================= */
function renderHome(){
  const q = S.q.trim().toLowerCase();
  const cuisines = [...new Set(S.recipes.map(r => r.cuisine).filter(Boolean))].sort();
  const proteins = [...new Set(S.recipes.map(r => r.protein).filter(Boolean))].sort();
  const F = ["All", ...COURSES, "Freezer-friendly", ...cuisines, ...proteins, "Favorites", "Needs review"];
  const match = r => {
    const f = S.filter;
    if (f === "All") return true; if (f === "Favorites") return r.favorite; if (f === "Needs review") return r.flags.length;
    if (f === "Freezer-friendly") return r.freezer; return r.category === f || r.cuisine === f || r.protein === f;
  };
  let list = S.recipes.filter(match);
  if (q) list = list.filter(r => (r.title + " " + allIngs(r).map(i => i.n).join(" ") + " " + (r.cuisine||"") + " " + (r.protein||"")).toLowerCase().includes(q));
  const seedMissing = Object.keys(SEED.recipes).filter(id => !byId(id)).length;
  view.innerHTML = `
  <section class="wrap hero">
    <h1>What are we <span class="it">cooking</span> today?</h1>
    <label class="search">${ICON.search}<input id="q" type="search" placeholder="Search recipes or ingredients" value="${esc(S.q)}" aria-label="Search recipes"></label>
    <div class="filters" role="group" aria-label="Filter recipes">${F.map(f => `<button class="fbtn" data-f="${esc(f)}" aria-pressed="${S.filter===f}">${esc(f)}${f==="Needs review" ? ` · ${S.recipes.filter(r=>r.flags.length).length}` : ""}</button>`).join("")}</div>
  </section>
  <section class="wrap">
    ${!S.loaded ? `<div class="empty"><h3>Opening your recipe box…</h3></div>`
      : !S.recipes.length ? `<div class="empty"><h3>Your recipe box is empty</h3><p class="muted">${S.canWrite && S.db ? `Your ${Object.keys(SEED.recipes).length} recipes from “My Cooking Recipes” and your kitchen inventory are ready to load.` : "Add your first recipe by typing it in or importing it from a link."}</p>
          <div class="row" style="justify-content:center">${S.canWrite && S.db ? `<button class="btn" id="loadseed">Load my recipes</button>` : ""}<a class="btn ghost" href="#add">Add a recipe</a></div><p class="muted small" id="seedmsg"></p></div>`
      : list.length ? `<div class="section-head"><h2>${S.filter === "All" ? (q ? "Search results" : "All recipes") : esc(S.filter)}</h2><span class="muted small">${list.length} recipe${list.length===1?"":"s"}</span></div><div class="grid">${list.map(card).join("")}</div>`
      : `<div class="empty" style="margin-top:16px"><h3>Nothing matches</h3><p class="muted">Try another word or filter.</p><button class="btn quiet" id="clear">Show all recipes</button></div>`}
    ${S.recipes.length && seedMissing && S.canWrite ? `<p class="muted small" style="margin-top:18px">${seedMissing} recipe${seedMissing>1?"s":""} from your Word doc aren't in the box. <button class="btn sm ghost" id="loadseed">Add them</button> <span id="seedmsg"></span></p>` : ""}
  </section>`;
  const qi = $("#q");
  qi.addEventListener("input", () => { S.q = qi.value; const p = qi.selectionStart; renderHome(); const n = $("#q"); n.focus(); n.setSelectionRange(p, p); });
  $$("[data-f]").forEach(b => b.onclick = () => { S.filter = b.dataset.f; renderHome(); });
  $("#clear")?.addEventListener("click", () => { S.q = ""; S.filter = "All"; renderHome(); });
  $("#loadseed")?.addEventListener("click", loadSeed);
}
function card(r){
  const al = allergensOf(r).length, st = flatSteps(r).length, t = (r.prepMin||0) + (r.cookMin||0);
  return `<a class="card" href="#r-${esc(r.id)}">${thumb(r).replace("</div>", `<span class="badges">${al ? `<span class="chip alert">⚠ ${allergensOf(r).map(h=>h.kind).filter((v,i,a)=>a.indexOf(v)===i).join(" & ")}</span>` : ""}${r.flags.length ? `<span class="chip warn">Review</span>` : ""}${r.favorite ? `<span class="chip">★</span>` : ""}</span></div>`)}
    <div class="meta"><span class="label">${esc([r.cuisine, r.protein].filter(Boolean).join(" · ") || r.category || "Recipe")}</span><h3>${esc(r.title)}</h3>
    <span class="sub">${allIngs(r).length} ingredients${st ? ` · ${st} steps` : ""}${t ? ` · ${fmtMins(t)}` : ""}${r.freezer ? " · freezes" : ""}</span></div></a>`;
}
async function loadSeed(){
  const msg = $("#seedmsg"); $$("#loadseed").forEach(b => b.disabled = true);
  const todo = Object.entries(SEED.recipes).filter(([id]) => !byId(id)); let n = 0;
  try {
    for (const [id, d] of todo){ await S.db.collection("recipes").doc(id).set(d); n++; if (msg) msg.textContent = `Loading ${n} of ${todo.length}…`; }
    if (SEED.kitchen && !S.inv) await S.db.doc("kitchen/inventory").set(SEED.kitchen.inventory);
    if (SEED.kitchen && !(S.freezer?.meals?.length)) await S.db.doc("kitchen/freezer").set(SEED.kitchen.freezer);
    toast("Your recipes and kitchen are loaded");
  } catch { if (msg) msg.textContent = `Stopped after ${n}. Tap the button again to finish.`; $$("#loadseed").forEach(b => b.disabled = false); }
}

/* ================= recipe page ================= */
function renderRecipe({id}){
  const r = byId(id);
  if (!r){ view.innerHTML = `<div class="wrap" style="padding-block:40px"><div class="empty"><h3>${S.loaded ? "This recipe isn't in your box" : "Opening recipe…"}</h3>${S.loaded ? `<a class="btn" href="#home">Back to recipes</a>` : ""}</div></div>`; return; }
  const {base, cur, k} = scaleFor(r);
  const pk = "progress:" + id, prog = store(pk) || {ing:[], steps:[]};
  const hits = allergensOf(r), meats = meatsOf(r);
  const host = r.source ? (() => { try { return new URL(r.source).hostname.replace(/^www\./, ""); } catch { return r.source; } })() : "";
  let ii = 0, si = 0;
  const step = r.servings ? (base >= 8 ? Math.max(1, Math.round(base/4)) : 1) : .5;
  view.innerHTML = `
  <article class="wrap recipe">
    <div class="rhead">
      <div class="stack" style="gap:8px">${thumb(r)}${S.assets && S.canWrite ? `${photoOf(r) ? `<button type="button" class="btn sm quiet" id="r-crop" style="align-self:flex-start">Crop photo</button>` : ""}${pasteZone("r-paste", photoOf(r) ? "Change photo: copy one, then tap here and paste" : "Add a photo: copy one, then tap here and paste")}` : ""}</div>
      <div class="stack" style="gap:10px">
        <a href="#home" class="label" style="text-decoration:none;color:var(--accent)">← ${esc(r.category || "Recipes")}</a>
        <h1>${esc(r.title)}</h1>
        <div class="row" style="gap:6px">${[r.cuisine, r.protein].filter(Boolean).map(t => `<span class="chip">${esc(t)}</span>`).join("")}${r.freezer ? `<span class="chip leaf">Freezer-friendly</span>` : ""}${meats.length && !r.protein ? meats.map(m => `<span class="chip line">${esc(m)}</span>`).join("") : ""}</div>
        ${allergyBanner(hits)}${meatBanner(meats)}
        ${r.flags.length ? `<div class="banner warn">${ICON.warn}<div><b>Check this recipe</b><ul>${r.flags.map(f => `<li>${esc(f)}</li>`).join("")}</ul>${S.canWrite ? `<a href="#edit-${esc(r.id)}">Fix it</a>${r.flags.length ? ` · <button class="btn sm ghost" id="clearflags" style="min-height:0;padding:2px 10px">Mark as checked</button>` : ""}` : ""}</div></div>` : ""}
        <div class="facts">
          ${r.prepMin ? `<div><span class="label">Prep</span><b>${fmtMins(r.prepMin)}</b></div>` : ""}
          ${r.cookMin ? `<div><span class="label">Cook</span><b>${fmtMins(r.cookMin)}</b></div>` : ""}
          <div><span class="label">Makes</span><b>${r.servings ? servLabel(r, base) : "1 batch"}</b></div>
          ${keepsText(r) ? `<div style="grid-column:span 2"><span class="label">Keeps</span><b style="font-size:15px;font-family:var(--body)">${esc(keepsText(r))}</b></div>` : ""}
        </div>
        ${host ? `<div class="srcbox"><span class="label">Original recipe · ${esc(host)}</span>
          <div class="row" style="gap:8px"><a class="btn sm ghost" href="${esc(r.source)}" target="_blank" rel="noopener noreferrer">Open original recipe ↗</a><button class="btn sm quiet" id="copysrc" type="button">Copy link</button></div>
          <input id="srcurl" class="small" readonly value="${esc(r.source)}" aria-label="Recipe link" hidden></div>` : ""}
        <div class="row">
          ${flatSteps(r).length ? `<button class="btn" id="cook">Start cooking</button>` : ""}
          <button class="btn ghost" id="toplan">Add to meal plan</button>
          ${S.canWrite ? `<button class="btn quiet" id="fav">${r.favorite ? "★ Favorite" : "☆ Favorite"}</button><a class="btn quiet" href="#edit-${esc(r.id)}">Edit</a>` : ""}
        </div>
      </div>
    </div>
    <aside class="side"><section class="panel">
      <div class="row between"><h2>Ingredients</h2>
        <div class="stepper" role="group" aria-label="Servings"><button id="sdown" aria-label="Fewer">−</button><output id="sval">${servLabel(r, cur)}</output><button id="sup" aria-label="More">+</button></div></div>
      ${k !== 1 ? `<p class="small muted" style="margin:8px 0 0">Amounts scaled ×${fmtNum(k)}. <button class="btn sm ghost" id="sreset" style="min-height:0;padding:2px 10px">Reset</button></p>` : ""}
      ${(r.ingredients||[]).map(sec => `${sec.section ? `<div class="sec-title">${esc(sec.section)}</div>` : ""}<ul class="checks">${sec.items.map(it => { const i = ii++; const have = invHas(ingText(it));
        return `<li data-i="${i}" class="${prog.ing.includes(i) ? "done" : ""}"><span class="box"></span><span class="txt">${ingHTML(it, k)}${have ? ` <span class="chip leaf">have</span>` : ""}</span></li>`; }).join("")}</ul>`).join("") || `<p class="muted">No ingredients yet.</p>`}
      ${prog.ing.length ? `<button class="btn sm quiet" id="resetI" style="margin-top:10px">Uncheck all</button>` : ""}
    </section></aside>
    <div class="stack">
      <section class="panel">
        <div class="row between"><h2>Instructions</h2>${prog.steps.length ? `<button class="btn sm quiet" id="resetS">Reset</button>` : ""}</div>
        ${(r.steps||[]).length ? r.steps.map(sec => `${sec.section ? `<div class="sec-title">${esc(sec.section)}</div>` : ""}<ol class="steps">${sec.items.map(t => { const i = si++; const tm = findTimes(t);
          return `<li data-s="${i}" class="${prog.steps.includes(i) ? "done" : ""}"><span class="n">${i+1}</span><div>${esc(t)}${tm.length ? `<div>${tm.map(x => `<button class="timer-chip" data-timer="${x.mins}" data-label="${esc(r.title)} · ${esc(x.label)}">${ICON.timer} ${esc(x.label)}</button>`).join("")}</div>` : ""}</div></li>`; }).join("")}</ol>`).join("")
          : `<p class="muted">No steps saved yet.${S.canWrite ? ` <a href="#edit-${esc(r.id)}">Add them</a>.` : ""}</p>`}
      </section>
      ${r.notes ? `<section class="panel"><h2>Notes</h2><p class="notes" style="margin:6px 0 0">${esc(r.notes)}</p></section>` : ""}
      ${(r.equipment||[]).length ? `<section class="panel"><h2>Equipment</h2><ul>${r.equipment.map(e => `<li>${esc(e)}</li>`).join("")}</ul></section>` : ""}
    </div>
  </article>`;
  const save = () => store(pk, prog);
  $$("[data-i]").forEach(li => li.onclick = () => { const i = +li.dataset.i, a = prog.ing.indexOf(i); a < 0 ? prog.ing.push(i) : prog.ing.splice(a, 1); li.classList.toggle("done"); save(); });
  $$("[data-s]").forEach(li => li.onclick = e => { if (e.target.closest("[data-timer]")) return; const i = +li.dataset.s, a = prog.steps.indexOf(i); a < 0 ? prog.steps.push(i) : prog.steps.splice(a, 1); li.classList.toggle("done"); save(); });
  $$("[data-timer]").forEach(b => b.onclick = e => { e.stopPropagation(); startTimer(+b.dataset.timer, b.dataset.label); });
  $("#sup").onclick = () => { S.serv[id] = cur + step; renderRecipe({id}); };
  $("#sdown").onclick = () => { S.serv[id] = Math.max(step, cur - step); renderRecipe({id}); };
  $("#sreset")?.addEventListener("click", () => { delete S.serv[id]; renderRecipe({id}); });
  $("#resetS")?.addEventListener("click", () => { prog.steps = []; save(); renderRecipe({id}); });
  $("#resetI")?.addEventListener("click", () => { prog.ing = []; save(); renderRecipe({id}); });
  $("#cook")?.addEventListener("click", () => openCook(recipeCookItems(r, k), r.title, {r, k}));
  $("#toplan").onclick = () => openPlanAdd(r.id);
  bindPasteZone($("#r-paste"), fs => setRecipePhoto(r.id, fs[0]));
  $("#r-crop")?.addEventListener("click", async () => { try { setRecipePhoto(r.id, await blobFromUrl(photoOf(r))); } catch { toast("Couldn't open that photo to crop. Paste it again instead."); } });
  $("#fav")?.addEventListener("click", () => write("recipes/" + r.id, {...stripId(r), favorite: !r.favorite}));
  $("#copysrc")?.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(r.source); toast("Link copied. Paste it in a new tab."); }
    catch { const i = $("#srcurl"); i.hidden = false; i.focus(); i.select(); toast("Press ⌘C (or Copy) to copy the link."); }
  });
  $("#clearflags")?.addEventListener("click", () => write("recipes/" + r.id, {...stripId(r), flags: []}));
}
function stripId(r){ const {id, ...rest} = r; return rest; }
function ingHTML(it, k){ const i = normIng(it); const q = i.q != null ? fmtNum(i.q*k) + (i.q2 != null ? "–" + fmtNum(i.q2*k) : "") : ""; const rest = ingText({...i, q:null, q2:null}, k);
  return `${q ? `<span class="qty">${esc(q)}</span> ` : ""}${esc(rest)}`; }

/* ================= cook mode (big text, one step at a time, screen stays awake) ================= */
const cook = { open:false, items:[], idx:0, lock:null, side:true, ctx:null, title:"" };
function recipeCookItems(r, k){ const st = flatSteps(r); return st.map((s, i) => ({kicker: s.section, text: s.text, n: i+1, of: st.length, r, k})); }
function openCook(items, title, ctx){
  if (!items.length){ toast("Nothing to cook yet: add steps first."); return; }
  Object.assign(cook, {items, idx: 0, open: true, title, ctx});
  const el = document.createElement("div"); el.className = "cook"; el.id = "cookmode"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Cook mode");
  document.body.append(el); document.body.style.overflow = "hidden"; document.body.classList.add("cooking");
  wake(); drawCook(); document.addEventListener("keydown", cookKeys);
}
function closeCook(){ cook.open = false; $("#cookmode")?.remove(); document.body.style.overflow = ""; document.body.classList.remove("cooking"); document.removeEventListener("keydown", cookKeys); try { cook.lock?.release(); } catch {} cook.lock = null; route(); }
function cookKeys(e){ if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); move(1); } else if (e.key === "ArrowLeft") move(-1); else if (e.key === "Escape") closeCook(); }
function move(d){ cook.idx = Math.max(0, Math.min(cook.items.length - 1, cook.idx + d)); drawCook(); }
async function wake(){ try { cook.lock = await navigator.wakeLock?.request("screen"); cook.lock?.addEventListener?.("release", () => { cook.awake = false; $("#awake") && ($("#awake").textContent = ""); }); cook.awake = !!cook.lock; } catch { cook.awake = false; } $("#awake") && ($("#awake").textContent = cook.awake ? "Screen stays on" : ""); }
document.addEventListener("visibilitychange", () => { if (cook.open && document.visibilityState === "visible") wake(); });
function drawCook(){
  const el = $("#cookmode"); if (!el) return;
  const s = cook.items[cook.idx], last = cook.idx === cook.items.length - 1;
  const r = s.r, k = s.k || 1, tm = findTimes(s.text);
  el.innerHTML = `
    <div class="cook-top">
      <button class="iconbtn" id="cx" aria-label="Close cook mode">${ICON.x}</button>
      <div class="ttl"><span class="label">${esc(s.group || "Cook mode")} · ${cook.idx+1}/${cook.items.length}</span><div>${esc(s.title || cook.title)}</div></div>
      <span class="awake" id="awake">${cook.awake ? "Screen stays on" : ""}</span>
      ${r ? `<button class="btn sm quiet" id="ti">${cook.side ? "Hide" : "Show"} ingredients</button>` : ""}
    </div>
    <div class="bar"><i style="width:${(cook.idx+1)/cook.items.length*100}%"></i></div>
    <div class="cook-body" style="${r && cook.side ? "" : "grid-template-columns:minmax(0,1fr)"}">
      <div class="cook-step">
        ${s.kicker ? `<span class="kicker">${esc(s.kicker)}</span>` : ""}
        ${s.n ? `<span class="num">Step ${s.n} of ${s.of}</span>` : ""}
        <div class="ctext">${esc(s.text)}</div>
        ${s.sub ? `<div class="muted" style="font-size:18px">${esc(s.sub)}</div>` : ""}
        ${tm.length ? `<div class="row">${tm.map(t => `<button class="btn ghost" data-timer="${t.mins}" data-label="${esc(s.title || cook.title)} · ${esc(t.label)}">${ICON.timer} Start ${esc(t.label)} timer</button>`).join("")}</div>` : ""}
        ${last ? `<p class="it" style="font-size:24px;margin:8px 0 0">¡Buen provecho! That's the last step.</p>` : ""}
      </div>
      ${r && cook.side ? `<aside class="cook-ings"><h2 style="font-size:20px">Ingredients${k !== 1 ? ` ×${fmtNum(k)}` : ""}</h2>
        ${(r.ingredients||[]).map(sec => `${sec.section ? `<div class="sec-title">${esc(sec.section)}</div>` : ""}<ul class="checks">${sec.items.map(it => `<li><span class="box"></span><span class="txt">${ingHTML(it, k)}</span></li>`).join("")}</ul>`).join("")}</aside>` : ""}
    </div>
    <div class="cook-foot"><button class="btn quiet" id="cp" ${cook.idx === 0 ? "disabled" : ""}>← Back</button>${last ? `<button class="btn" id="cdone">Finish</button>` : `<button class="btn" id="cn">Next →</button>`}</div>`;
  $("#cx").onclick = closeCook; $("#cp").onclick = () => move(-1);
  $("#cn")?.addEventListener("click", () => move(1)); $("#cdone")?.addEventListener("click", () => { if (cook.ctx?.onDone) cook.ctx.onDone(); closeCook(); });
  $("#ti")?.addEventListener("click", () => { cook.side = !cook.side; drawCook(); });
  $$(".cook-ings li", el).forEach(li => li.onclick = () => li.classList.toggle("done"));
  $$("[data-timer]", el).forEach(b => b.onclick = () => startTimer(+b.dataset.timer, b.dataset.label));
  let x0 = null; const body = $(".cook-step", el);
  body.addEventListener("touchstart", e => x0 = e.touches[0].clientX, {passive:true});
  body.addEventListener("touchend", e => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 60) move(dx < 0 ? 1 : -1); x0 = null; });
}

/* ================= timers + alarm ================= */
/* The alarm is made two ways so it still sounds when the browser is strict:
   1. Web Audio beeps scheduled ahead for the exact end time (plays on time even if the page's clock is throttled).
   2. A looping <audio> element with a generated alarm sound, unlocked on the tap that starts the timer
      (more reliable in Safari, and with audioSession "playback" it is not muted by the iPhone silent switch). */
const timers = [];
const alarm = {
  ctx: null, el: null, url: null,
  wav(){
    if (this.url) return this.url;
    const rate = 22050, len = Math.round(rate * 1.6), data = new Int16Array(len);
    // three bright beeps (two tones each), then a short pause; loops seamlessly
    [[0, .16], [.22, .38], [.44, .60]].forEach(([a, b]) => {
      for (let i = Math.round(a*rate); i < Math.round(b*rate); i++){
        const t = i / rate, env = Math.min(1, (t - a) * 200, (b - t) * 200);
        data[i] = Math.round(0.75 * 32767 * env * (Math.sign(Math.sin(2*Math.PI*988*t)) * .6 + Math.sin(2*Math.PI*1976*t) * .4));
      }
    });
    const buf = new ArrayBuffer(44 + len*2), v = new DataView(buf), w = (o, s) => [...s].forEach((c, i) => v.setUint8(o+i, c.charCodeAt(0)));
    w(0, "RIFF"); v.setUint32(4, 36 + len*2, true); w(8, "WAVE"); w(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, rate, true); v.setUint32(28, rate*2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, "data"); v.setUint32(40, len*2, true);
    new Int16Array(buf, 44).set(data);
    return this.url = URL.createObjectURL(new Blob([buf], {type: "audio/wav"}));
  },
  /* call from a tap: lets the page play sound later */
  unlock(){
    try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch {}
    try { this.ctx = this.ctx || new (window.AudioContext || window.webkitAudioContext)(); this.ctx.resume?.(); } catch {}
    try {
      if (!this.el){ this.el = new Audio(this.wav()); this.el.loop = true; this.el.preload = "auto"; this.el.setAttribute("playsinline", ""); }
      if (this.el.paused && !this.ringing){ this.el.muted = true; const p = this.el.play(); p?.then(() => { if (!this.ringing){ this.el.pause(); this.el.currentTime = 0; } this.el.muted = false; }).catch(() => { this.el.muted = false; }); }
    } catch {}
  },
  /* schedule ~60 s of beeps at the timer's end time */
  schedule(t){
    this.cancel(t); const c = this.ctx; if (!c || t.paused != null) return;
    const at = c.currentTime + Math.max(0, (t.end - Date.now()) / 1000);
    const out = c.createGain(); out.gain.value = .5; out.connect(c.destination); t.nodes = out;
    for (let k = 0; k < 38; k++) [0, .22, .44].forEach(d => {
      const s = at + k*1.6 + d, o = c.createOscillator(), g = c.createGain();
      o.type = "square"; o.frequency.value = 988; o.connect(g); g.connect(out);
      g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(1, s + .005); g.gain.setValueAtTime(1, s + .15); g.gain.linearRampToValueAtTime(0, s + .16);
      o.start(s); o.stop(s + .17);
    });
    t.nodesUntil = t.end + 60000;
  },
  cancel(t){ if (t.nodes){ try { t.nodes.disconnect(); } catch {} t.nodes = null; } },
  ring(){
    this.ringing = true;
    try { this.ctx?.resume?.(); } catch {}
    if (this.el){ this.el.muted = false; this.el.volume = 1; if (this.el.paused) this.el.play().catch(() => {}); }
    try { navigator.vibrate?.([400, 200, 400, 200, 400]); } catch {}
  },
  quiet(){ this.ringing = false; if (this.el && !this.el.paused){ this.el.pause(); this.el.currentTime = 0; } },
  test(){ this.unlock(); if (this.el){ this.el.currentTime = 0; this.el.play().catch(() => toast("Your browser blocked the sound. Tap the page once, then try again.")); setTimeout(() => { if (!timers.some(t => t.ring)) this.quiet(); }, 3200); } }
};
function startTimer(mins, label){
  alarm.unlock();
  const t = {id: uid(), end: Date.now() + mins*60000, label, ring: false, paused: null};
  timers.push(t); alarm.schedule(t);
  toast(`Timer set: ${fmtMins(mins)}. Keep your volume up.`); drawTimers();
}
function stopTimer(t){ alarm.cancel(t); const i = timers.indexOf(t); if (i >= 0) timers.splice(i, 1); if (!timers.some(x => x.ring)) alarm.quiet(); }
let timerSig = "";
function timeLeft(t){ const left = t.paused != null ? t.paused : Math.max(0, t.end - Date.now()); const h = Math.floor(left/36e5), m = Math.floor(left/6e4)%60, s = Math.floor(left/1e3)%60;
  return `${h ? h + ":" + String(m).padStart(2,"0") : m}:${String(s).padStart(2,"0")}`; }
function drawTimers(){
  const host = $("#timers");
  // rebuild only when timers are added, removed, paused or start ringing; otherwise just update the clock text (keeps buttons steady to tap)
  const sig = timers.map(t => t.id + (t.ring ? "r" : t.paused != null ? "p" : "")).join(",");
  if (sig === timerSig){ timers.forEach(t => { const el = host.querySelector(`[data-id="${t.id}"] b`); if (el && !t.ring) el.textContent = timeLeft(t); }); return; }
  timerSig = sig;
  host.innerHTML = timers.map(t => `<div class="timer ${t.ring ? "ring" : ""}" data-id="${t.id}" role="${t.ring ? "alert" : "timer"}"><div><b>${t.ring ? "Time's up!" : timeLeft(t)}</b><small>${esc(t.label)}</small></div>
      ${t.ring ? `<button data-act="x" class="stopbtn" aria-label="Stop alarm">Stop</button>` : `<button data-act="t" aria-label="Test the alarm sound" title="Test sound">🔔</button><button data-act="p" aria-label="${t.paused != null ? "Resume" : "Pause"} timer">${t.paused != null ? "▶" : "❚❚"}</button><button data-act="x" aria-label="Cancel timer">✕</button>`}</div>`).join("");
  $$(".timer", host).forEach(el => el.onclick = e => { const b = e.target.closest("button"); if (!b) return; const t = timers.find(x => x.id === el.dataset.id); if (!t) return;
    alarm.unlock();
    if (b.dataset.act === "x") stopTimer(t);
    else if (b.dataset.act === "t") alarm.test();
    else if (t.paused != null){ t.end = Date.now() + t.paused; t.paused = null; alarm.schedule(t); }
    else { t.paused = Math.max(0, t.end - Date.now()); alarm.cancel(t); }
    drawTimers(); });
}
function tickTimers(){
  if (!timers.length) return;
  timers.forEach(t => {
    // the scheduled beeps cover a throttled page; once the page notices, it switches to the looping alarm
    if (t.paused == null && !t.ring && Date.now() >= t.end){ t.ring = true; alarm.cancel(t); }
    if (t.ring) alarm.ring();
  });
  drawTimers();
}
setInterval(tickTimers, 1000);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") tickTimers(); });
/* any tap keeps sound allowed (Safari can suspend audio while the page sits idle) */
document.addEventListener("pointerdown", () => { if (timers.some(t => !t.ring && t.paused == null)) { try { alarm.ctx?.resume?.(); } catch {} } }, {passive: true});

/*PART2*/
boot();

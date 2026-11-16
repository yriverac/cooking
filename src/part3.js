/* ================= inventory matching ================= */
const STAPLE = /^(salt|sal|pepper|pimienta|black pepper|salt and pepper|sal y pimienta)$|^(hot |cold |warm |boiling )?(water|agua|ice|hielo)\b/i;
const AMBIG = new Set("sauce milk powder juice wine cheese cream beans paste brown seasoning mix drink container sausage sausages flour sugar oil leaves seed sticks".split(" "));
const STOPW = new Set("and or the of with for from a an de la el los las y con en sin to taste large small medium fresh dried ground whole chopped minced diced sliced optional cup cups tbsp tsp oz lb lbs can cans jar jars bag bags box boxes pack packets packet many possibly check if full is seen about organic extra lean light chunk kirkland goya great value".split(" "));
const ES = {sal:"salt",ajo:"garlic",ajos:"garlic",cebolla:"onion",arroz:"rice",aceite:"oil",pimienta:"pepper",azucar:"sugar",huevo:"egg",huevos:"eggs",vinagre:"vinegar",laurel:"bay leaves",canela:"cinnamon",comino:"cumin",cominos:"cumin",clavos:"cloves",oregano:"oregano",tomate:"tomato",tomates:"tomatoes",jitomates:"tomatoes",mantequilla:"butter",harina:"flour",leche:"milk",papas:"potatoes",tomillo:"thyme",carne:"beef",vaca:"beef",puerco:"pork",cerdo:"pork",pollo:"chicken",muslitos:"chicken"};
function keysOf(name){
  const out = [];
  lc(String(name).replace(/\([^)]*\)/g, " ")).split(/ and | or |,|\//).forEach(part => {
    const ws = part.trim().split(" ").filter(w => w.length > 2 && !STOPW.has(w)); if (!ws.length) return;
    out.push(ws.slice(-2).join(" ")); const last = ws[ws.length-1]; if (!AMBIG.has(last)) out.push(last);
  });
  return out;
}
function normLine(line){ let l = lc(line); const extra = l.trim().split(" ").map(w => ES[w]).filter(Boolean); return extra.length ? l + extra.join(" ") + " " : l; }
function matchKeys(line, keys){ const l = normLine(line); return keys.some(k => l.includes(" " + k + " ") || l.includes(" " + k + "s ") || (k.endsWith("s") && l.includes(" " + k.slice(0,-1) + " "))); }
function invIndex(){
  if (S.invIdx) return S.invIdx;
  const ok = new Set(), cart = new Set(), need = new Set(), t = todayISO();
  (S.inv?.items || []).forEach(i => { if (i.bestBy && i.bestBy < t) return; keysOf(i.name).forEach(k => ok.add(k)); });
  (S.inv?.cart || []).forEach(i => keysOf(i.name).forEach(k => cart.add(k)));
  (S.inv?.needs || []).forEach(i => need.add(lc(i.name).trim()));
  const generic = new Set(); (S.inv?.items || []).forEach(i => { if (i.bestBy && i.bestBy < t) return; const w = lc(i.name.replace(/\([^)]*\)/g, "")).trim().split(" "); generic.add(w[w.length-1]); });
  return S.invIdx = {ok:[...ok], cart:[...cart], need:[...need], generic};
}
function invHas(line){ if (!S.inv) return false; const I = invIndex(); if (matchKeys(line, I.need)) return false; if (matchKeys(line, I.ok)) return true;
  const base = lc(normIng(line).n.replace(/\([^)]*\)/g, "").split(",")[0]).trim(); return !base.includes(" ") && (I.generic.has(base) || I.generic.has(base.replace(/s$/, ""))); }
function cartHas(line){ return !!S.inv && matchKeys(line, invIndex().cart); }
function saveInv(mut){ const p = clone(S.inv || {items:[], needs:[], cart:[], equipment:[]}); mut(p); S.inv = p; S.invIdx = null; route(); return write("kitchen/inventory", p, "Couldn't save your kitchen. Try again."); }
function saveFreezer(mut){ const p = clone(S.freezer || {meals:[]}); p.meals = p.meals || []; mut(p); S.freezer = p; route(); return write("kitchen/freezer", p); }

/* ================= weekly plan ================= */
function weekKey(){ return S.week || (S.week = iso(mondayOf(new Date()))); }
function planOf(){ return S.plans[weekKey()] || {items:[], prepDone:{}, shopChecked:{}, extras:[], forceBuy:{}}; }
function subscribeWeek(){
  const k = weekKey(); if (!S.db || S.planSubKey === k) return;
  S.planSub?.(); S.planSubKey = k;
  S.planSub = S.db.doc("plans/" + k).onSnapshot(s => { S.plans[k] = {items:[], prepDone:{}, shopChecked:{}, extras:[], forceBuy:{}, ...(s.exists ? s.data() : {})}; softRender(); }, () => {});
}
function savePlan(mut){ const k = weekKey(); const p = clone(planOf()); mut(p); S.plans[k] = p; route(); return write("plans/" + k, p, "Couldn't save your plan. Try again."); }
function dayDate(day){ return addDays(weekKey(), DAYS.indexOf(day)); }
function shiftWeek(n){ S.week = addDays(weekKey(), 7*n); subscribeWeek(); route(); }
function weekLabel(){ const s = weekKey(), e = addDays(s, 6); return `${niceDate(s)} – ${niceDate(e)}`; }
function entryScale(e, r){ return r.servings ? e.servings / r.servings : e.servings; }

function openPlanAdd(recipeId, day){
  if (!S.canWrite){ toast("Only the owner can change the plan."); return; }
  let pick = recipeId || null, mode = "cook", chosen = new Set(day ? [day] : []), serv = null;
  const m = modal(recipeId ? `Plan <span class="it">${esc(byId(recipeId)?.title || "")}</span>` : `Add to the <span class="it">plan</span>`, `<div id="pa"></div>`);
  const draw = (q = $("#pa-q", m.el)?.value || "") => {
    const r = pick && byId(pick); if (r && serv == null) serv = r.servings || 1;
    const list = S.recipes.filter(x => x.title.toLowerCase().includes(q.toLowerCase())).slice(0, 60);
    $("#pa", m.el).innerHTML = `
      ${recipeId ? "" : `<input id="pa-q" type="search" placeholder="Search recipes" value="${esc(q)}" aria-label="Search recipes"><div style="max-height:34vh;overflow:auto" class="stack" role="listbox">${list.map(x => `<button class="pick" data-pick="${esc(x.id)}" aria-pressed="${x.id === pick}">${thumb(x)}<span style="min-width:0"><b>${esc(x.title)}</b><br><span class="muted small">${esc([x.cuisine, x.protein].filter(Boolean).join(" · "))}${allergensOf(x).length ? " · ⚠ allergy" : ""}</span></span></button>`).join("") || `<p class="muted">No recipes match.</p>`}</div>`}
      ${r ? `<div class="stack" style="gap:10px">
        ${allergyBanner(allergensOf(r))}
        <div class="row between"><span class="label">Servings</span><div class="stepper"><button id="pa-d" aria-label="Fewer">−</button><output>${servLabel(r, serv)}</output><button id="pa-u" aria-label="More">+</button></div></div>
        <div><span class="label">Type</span><div class="row" style="margin-top:6px"><button class="btn sm ${mode === "prep" ? "" : "quiet"}" data-mode="prep">Prep day (batch cook)</button><button class="btn sm ${mode === "cook" ? "" : "quiet"}" data-mode="cook">Cook day (cook fresh)</button></div></div>
        <div><span class="label">Day${mode === "cook" ? "s" : ""}</span><div class="row" style="margin-top:6px;gap:6px">${DAYS.map(d => `<button class="btn sm ${chosen.has(d) ? "" : "quiet"}" data-day="${d}">${d} ${new Date(dayDate(d) + "T12:00:00").getDate()}</button>`).join("")}</div></div>
        <button class="btn" id="pa-add" ${chosen.size ? "" : "disabled"}>Add to ${weekLabel()}</button></div>` : `<p class="muted small">Pick a recipe.</p>`}`;
    $("#pa-q", m.el)?.addEventListener("input", e => { const p = e.target.selectionStart; draw(e.target.value); const n = $("#pa-q", m.el); n.focus(); n.setSelectionRange(p, p); });
    $$("[data-pick]", m.el).forEach(b => b.onclick = () => { pick = b.dataset.pick; serv = null; draw(); });
    const step = r && r.servings ? (r.servings >= 8 ? Math.round(r.servings/4) : 1) : .5;
    $("#pa-u", m.el)?.addEventListener("click", () => { serv += step; draw(); });
    $("#pa-d", m.el)?.addEventListener("click", () => { serv = Math.max(step, serv - step); draw(); });
    $$("[data-mode]", m.el).forEach(b => b.onclick = () => { mode = b.dataset.mode; if (mode === "prep" && chosen.size > 1) chosen = new Set([[...chosen][0]]); draw(); });
    $$("[data-day]", m.el).forEach(b => b.onclick = () => { const d = b.dataset.day; if (mode === "prep") chosen = new Set([d]); else chosen.has(d) ? chosen.delete(d) : chosen.add(d); draw(); });
    $("#pa-add", m.el)?.addEventListener("click", () => { savePlan(p => chosen.forEach(d => p.items.push({uid: uid(), id: pick, servings: serv, day: d, mode}))); toast(`Added to ${[...chosen].join(", ")}`); m.close(); });
  };
  draw();
}
function renderPlan(){
  subscribeWeek();
  const p = planOf(), items = p.items.filter(e => byId(e.id));
  const prepDays = DAYS.filter(d => items.some(e => e.day === d && e.mode === "prep"));
  const totalServ = items.reduce((n, e) => n + (byId(e.id).servings ? e.servings : 0), 0);
  view.innerHTML = `
  <section class="wrap" style="padding-block:18px 40px">
    <span class="label">Weekly meal plan</span>
    <h1 style="margin-top:4px">Cook once, <span class="it">eat all week.</span></h1>
    <div class="row between" style="margin-top:12px"><div class="weeknav"><button class="iconbtn" id="wp" aria-label="Previous week">‹</button><b>${weekLabel()}</b><button class="iconbtn" id="wn" aria-label="Next week">›</button></div>
      ${weekKey() !== iso(mondayOf(new Date())) ? `<button class="btn sm quiet" id="wt">This week</button>` : ""}</div>
    <div class="panel row between" style="margin-top:14px">
      <div><b style="font-family:var(--display);font-size:22px">${items.length}</b> <span class="muted">meals planned${totalServ ? ` · ${fmtNum(totalServ)} servings` : ""}</span></div>
      <div class="row">${prepDays.map(d => `<a class="btn sm" href="#prep-${d}">Open ${d} prep day</a>`).join("")}${S.canWrite ? `<button class="btn sm ghost" id="addp">+ Add recipe</button>` : ""}<a class="btn sm quiet" href="#shop">Shopping list</a></div>
    </div>
    <div class="days stack" style="margin-top:14px">
      ${DAYS.map(d => { const es = items.filter(e => e.day === d), date = dayDate(d);
        return `<div class="day ${date === todayISO() ? "today" : ""}"><h3>${d} <span class="muted" style="font-weight:500;letter-spacing:0">${niceDate(date)}</span></h3>
        ${es.map(e => { const r = byId(e.id), al = allergensOf(r), meats = meatsOf(r), keep = [];
          if (e.mode === "prep"){ if (r.fridgeDays) keep.push(`Fridge: eat by ${niceDate(addDays(date, r.fridgeDays))}`); if (r.freezer && r.freezerMonths) keep.push(`Freezer: until ${niceDate(addMonths(date, r.freezerMonths))}`); else if (!r.freezer) keep.push("Not freezer-friendly"); }
          return `<div class="pl"><a href="#r-${esc(r.id)}">${esc(r.title)}</a>
            <div class="row">${S.canWrite ? `<span class="mode" role="group" aria-label="Type"><button data-mode="${e.uid}:prep" aria-pressed="${e.mode === "prep"}">Prep</button><button data-mode="${e.uid}:cook" aria-pressed="${e.mode === "cook"}">Cook</button></span>
              <span class="mini-step"><button data-sv="${e.uid}:-1" aria-label="Fewer servings">−</button><span>${servLabel(r, e.servings)}</span><button data-sv="${e.uid}:1" aria-label="More servings">+</button></span>
              <button class="btn sm quiet" data-rm="${e.uid}" aria-label="Remove ${esc(r.title)}">✕</button>` : `<span class="chip">${e.mode === "prep" ? "Prep" : "Cook"}</span><span class="small">${servLabel(r, e.servings)}</span>`}</div>
            ${keep.length ? `<span class="small muted">${esc(keep.join(" · "))}</span>` : ""}
            <div class="row" style="gap:4px">${al.length ? `<span class="chip alert">⚠ ${esc([...new Set(al.map(h => h.kind))].join(" & "))}</span>` : ""}${meats.length > 1 ? `<span class="chip warn">${esc(meats.join(" + "))}</span>` : meats.map(x => `<span class="chip line">${esc(x)}</span>`).join("")}</div></div>`; }).join("")}
        ${S.canWrite ? `<button class="btn sm ghost" data-addday="${d}">+ Add</button>` : ""}
        ${es.some(e => e.mode === "prep") ? `<a class="btn sm" href="#prep-${d}">Prep-day checklist</a>` : ""}</div>`; }).join("")}
    </div>
  </section>`;
  $("#wp").onclick = () => shiftWeek(-1); $("#wn").onclick = () => shiftWeek(1);
  $("#wt")?.addEventListener("click", () => { S.week = iso(mondayOf(new Date())); subscribeWeek(); route(); });
  $("#addp")?.addEventListener("click", () => openPlanAdd());
  $$("[data-addday]").forEach(b => b.onclick = () => openPlanAdd(null, b.dataset.addday));
  $$("[data-rm]").forEach(b => b.onclick = () => savePlan(p => p.items = p.items.filter(e => e.uid !== b.dataset.rm)));
  $$("[data-mode]").forEach(b => b.onclick = () => { const [u, m] = b.dataset.mode.split(":"); savePlan(p => p.items.find(e => e.uid === u).mode = m); });
  $$("[data-sv]").forEach(b => b.onclick = () => { const [u, d] = b.dataset.sv.split(":"); savePlan(p => { const e = p.items.find(x => x.uid === u), r = byId(e.id); const st = r.servings ? (r.servings >= 8 ? Math.round(r.servings/4) : 1) : .5; e.servings = Math.max(st, e.servings + st * +d); }); });
}

/* ================= prep day: one ordered checklist ================= */
function buildPrep(day){
  const es = planOf().items.filter(e => e.day === day && e.mode === "prep" && byId(e.id)).map(e => ({e, r: byId(e.id), k: entryScale(e, byId(e.id))}));
  es.sort((a, b) => ((b.r.prepMin||0) + (b.r.cookMin||0)) - ((a.r.prepMin||0) + (a.r.cookMin||0)));
  const groups = [], used = new Set();
  const lead = [], heat = {}, chop = {};
  es.forEach(({r}) => flatSteps(r).forEach((s, i) => {
    const key = r.id + ":" + i;
    if (LEAD_RE.test(s.text) && i < 3){ lead.push({text: s.text, who: r.title}); used.add(key); return; }
    const m = s.text.match(PREHEAT_RE);
    if (m && s.text.length < 140){ const t = `${m[2]}°${(m[3]||"F").toUpperCase()}`; (heat[t] = heat[t] || []).push(r.title); used.add(key); }
  }));
  es.forEach(({r, k}) => allIngs(r).forEach(it => { const line = ingText(it, k), b = prepBase(line); if (b) (chop[b] = chop[b] || []).push({line, who: r.title}); }));
  if (lead.length) groups.push({key:"lead", title:"Start these first", why:"They need time to marinate, chill or soak while you do everything else.", items: lead.map(x => ({text: x.text, who: x.who}))});
  const heats = Object.entries(heat);
  if (heats.length) groups.push({key:"heat", title:"Heat the oven", why: heats.length > 1 ? "Bake the lower temperature first, then turn it up." : "One preheat covers every recipe below.", items: heats.sort((a,b) => parseInt(a[0]) - parseInt(b[0])).map(([t, who]) => ({text: `Preheat the oven to ${t}`, who: [...new Set(who)].join(" · ")}))});
  const chops = Object.entries(chop);
  if (chops.length) groups.push({key:"chop", title:"Chop and measure everything at once", why:"Do all the cutting together so the board and knife come out once.", items: chops.map(([b, list]) => ({text: `${b}: ${list.map(x => x.line).join("; ")}`, who: [...new Set(list.map(x => x.who))].join(" · ")}))});
  es.forEach(({r, k, e}) => {
    const st = flatSteps(r).map((s, i) => ({...s, i})).filter(s => !used.has(r.id + ":" + s.i));
    if (st.length) groups.push({key:"r-" + e.uid, title: r.title, why: `${servLabel(r, e.servings)}${r.prepMin || r.cookMin ? ` · about ${fmtMins((r.prepMin||0) + (r.cookMin||0))}` : ""}`, r, k, items: st.map(s => ({text: s.text, who: s.section}))});
  });
  if (es.length) groups.push({key:"pack", title:"Pack, label and store", why:"Label each container with the dish and the date.", items: es.map(({r, e}) => {
    const date = dayDate(day), bits = [];
    if (r.fridgeDays) bits.push(`fridge until ${niceDate(addDays(date, r.fridgeDays))}`);
    if (r.freezer && r.freezerMonths) bits.push(`freezer until ${niceDate(addMonths(date, r.freezerMonths))}`);
    return {text: `Portion ${r.title} (${servLabel(r, e.servings)}). Keeps: ${bits.join(", ") || "eat soon"}.`, who: r.freezer ? "Freezer-friendly" : "Fridge only", freeze: r.freezer ? {r, e} : null};
  })});
  return {es, groups};
}
function renderPrep({day}){
  subscribeWeek();
  const {es, groups} = buildPrep(day), p = planOf(), done = p.prepDone || {};
  const all = groups.flatMap(g => g.items.map((it, i) => g.key + ":" + i)), n = all.filter(k => done[k]).length;
  const allAl = es.flatMap(({r}) => allergensOf(r).map(h => ({...h, r: r.title})));
  view.innerHTML = `
  <section class="wrap" style="padding-block:18px 40px">
    <a class="label" href="#plan" style="text-decoration:none;color:var(--accent)">← Meal plan</a>
    <h1 style="margin-top:6px">${day} <span class="it">prep day</span></h1>
    <p class="muted" style="margin:6px 0 0">${niceDate(dayDate(day))} · ${es.length} recipe${es.length === 1 ? "" : "s"} · ${n} of ${all.length} done</p>
    ${allAl.length ? `<div style="margin-top:12px">${allergyBanner(allAl)}</div>` : ""}
    ${!es.length ? `<div class="empty" style="margin-top:16px"><h3>No prep recipes on ${day}</h3><p class="muted">In the plan, set a recipe to Prep on this day.</p><a class="btn" href="#plan">Go to the plan</a></div>` : `
    <div class="row" style="margin-top:14px"><button class="btn" id="pgo">Step by step</button>${n ? `<button class="btn quiet" id="preset">Uncheck all</button>` : ""}</div>
    <div class="stack" style="margin-top:16px">
      ${groups.map((g, gi) => `<section class="panel prep-group"><h3><span class="k">${gi+1}</span>${esc(g.title)}</h3><p class="muted small" style="margin:2px 0 6px">${esc(g.why)}</p>
        <ul class="checks">${g.items.map((it, i) => { const key = g.key + ":" + i; return `<li data-k="${esc(key)}" class="${done[key] ? "done" : ""}"><span class="box"></span><span class="txt">${esc(it.text)}${it.who ? `<span class="who">${esc(it.who)}</span>` : ""}
          ${findTimes(it.text).map(t => `<button class="timer-chip" data-timer="${t.mins}" data-label="${esc(g.title)} · ${esc(t.label)}">${ICON.timer} ${esc(t.label)}</button>`).join("")}
          ${it.freeze && S.canWrite ? `<button class="btn sm ghost" data-freeze="${esc(it.freeze.e.uid)}" style="margin-top:6px">Add to freezer log</button>` : ""}</span></li>`; }).join("")}</ul></section>`).join("")}
    </div>`}
  </section>`;
  $$("[data-k]").forEach(li => li.onclick = e => { if (e.target.closest("button")) return; if (!S.canWrite) { li.classList.toggle("done"); return; } const k = li.dataset.k; savePlan(p => { p.prepDone = p.prepDone || {}; if (p.prepDone[k]) delete p.prepDone[k]; else p.prepDone[k] = true; }); });
  $$("[data-timer]").forEach(b => b.onclick = e => { e.stopPropagation(); startTimer(+b.dataset.timer, b.dataset.label); });
  $("#preset")?.addEventListener("click", () => savePlan(p => p.prepDone = {}));
  $$("[data-freeze]").forEach(b => b.onclick = e => { e.stopPropagation(); const it = es.find(x => x.e.uid === b.dataset.freeze); freezeDialog(it.r, it.e.servings, dayDate(day)); });
  $("#pgo")?.addEventListener("click", () => {
    const items = groups.flatMap(g => g.items.map(it => ({group: g.title, title: g.r ? g.r.title : g.title, kicker: it.who, text: it.text, r: g.r, k: g.k})));
    openCook(items, `${day} prep day`, {});
  });
}
function freezeDialog(r, servings, date){
  const m = modal(`Freeze <span class="it">${esc(r.title)}</span>`, `
    <label class="field"><span>Portions</span><input id="fz-p" type="number" inputmode="numeric" min="1" value="${Math.round(servings) || 1}"></label>
    <label class="field"><span>Frozen on</span><input id="fz-d" type="date" value="${date || todayISO()}"></label>
    <p class="muted small" id="fz-u"></p><button class="btn" id="fz-go">Add to freezer</button>`);
  const upd = () => { $("#fz-u", m.el).textContent = `Use by ${niceDate(addMonths($("#fz-d", m.el).value || todayISO(), r.freezerMonths || 3))} (${r.freezerMonths || 3} months).`; };
  $("#fz-d", m.el).oninput = upd; upd();
  $("#fz-go", m.el).onclick = () => { const d = $("#fz-d", m.el).value || todayISO();
    saveFreezer(f => f.meals.push({id: uid(), recipeId: r.id, name: r.title, portions: +$("#fz-p", m.el).value || 1, frozenOn: d, useBy: addMonths(d, r.freezerMonths || 3), note: ""})); toast("Added to the freezer"); m.close(); };
}

/* ================= shopping list: plan minus kitchen, by store section ================= */
function shoppingRows(){
  const p = planOf(), agg = new Map();
  p.items.forEach(e => { const r = byId(e.id); if (!r) return; const k = entryScale(e, r);
    allIngs(r).forEach(raw => { const i = normIng(raw); const base = lc(i.n.replace(/\([^)]*\)/g, "").split(",")[0]).trim(); if (!base || STAPLE.test(base)) return;
      const key = base + "|" + unitKey(i.u); const cur = agg.get(key) || {key, base, name: i.n.replace(/\s*\([^)]*\)/g, "").split(",")[0].trim(), u: i.u, q: 0, hasQ: true, from: new Set()};
      if (i.q != null && cur.hasQ) cur.q += i.q * k; else if (i.q == null) cur.hasQ = false; cur.from.add(r.title); agg.set(key, cur); }); });
  return [...agg.values()].map(x => ({key: x.key, text: [x.hasQ && x.q ? fmtNum(x.q) : "", x.u, x.name].filter(Boolean).join(" "), name: x.name, from: [...x.from], sec: sectionOf(x.name)}));
}
function renderShop(){
  subscribeWeek();
  const p = planOf(), rows = shoppingRows(), chk = p.shopChecked || {}, force = p.forceBuy || {};
  const have = rows.filter(r => invHas(r.name) && !force[r.key]), buy = rows.filter(r => !have.includes(r));
  const extras = (p.extras || []).map(x => ({key: "x:" + x.id, text: x.name, name: x.name, from: ["Added by you"], sec: sectionOf(x.name), extra: x.id}));
  const needs = (S.inv?.needs || []).map(x => ({key: "n:" + x.id, text: x.name, name: x.name, from: ["Out of stock in your kitchen"], sec: sectionOf(x.name), need: x.id}));
  const all = [...buy, ...extras, ...needs];
  const bySec = {}; all.forEach(r => (bySec[r.sec] = bySec[r.sec] || []).push(r));
  const left = all.filter(r => !chk[r.key]).length, got = all.filter(r => chk[r.key]);
  const li = r => `<li data-c="${esc(r.key)}" class="${chk[r.key] ? "done" : ""}"><span class="box"></span><span class="txt">${esc(r.text)}${cartHas(r.name) ? ` <span class="chip">in Walmart cart</span>` : ""}<span class="from">${esc(r.from.join(" · "))}</span></span></li>`;
  view.innerHTML = `
  <section class="wrap" style="padding-block:18px 40px">
    <span class="label">Shopping list · ${weekLabel()}</span>
    <h1 style="margin-top:4px">${left ? `${left} thing${left === 1 ? "" : "s"} to <span class="it">buy</span>` : all.length ? `All <span class="it">done</span>` : `Nothing to <span class="it">buy</span> yet`}</h1>
    <p class="muted" style="margin:6px 0 0">Made from this week's meal plan, minus what's already in your kitchen. Sorted by store section.</p>
    <div class="row" style="margin-top:12px">${got.length && S.canWrite ? `<button class="btn sm" id="putaway">Put ${got.length} checked item${got.length === 1 ? "" : "s"} in the kitchen</button>` : ""}${Object.keys(chk).length && S.canWrite ? `<button class="btn sm quiet" id="unc">Uncheck all</button>` : ""}<a class="btn sm ghost" href="#plan">Edit plan</a></div>
    ${!rows.length && !extras.length && !needs.length ? `<div class="empty" style="margin-top:16px"><h3>Plan some meals first</h3><p class="muted">Recipes you add to this week's plan fill this list, scaled to your servings.</p><a class="btn" href="#plan">Open the plan</a></div>` : `
    <div class="panel shop" style="margin-top:14px">${SECTION_ORDER.filter(s => bySec[s]).map(s => `<div class="shop-sec"><h3>${esc(s)} <span class="muted">${bySec[s].filter(r => !chk[r.key]).length}</span></h3><ul class="checks">${bySec[s].map(li).join("")}</ul></div>`).join("") || `<p class="muted">Everything is already in your kitchen.</p>`}</div>`}
    ${S.canWrite ? `<form class="row" id="exf" style="margin-top:12px;flex-wrap:nowrap"><input id="ex" placeholder="Add something else (e.g. coffee filters)" aria-label="Add an item"><button class="btn">Add</button></form>` : ""}
    ${have.length ? `<details class="have" style="margin-top:16px"><summary>Already in your kitchen (${have.length})</summary><p class="muted small">These match items in your inventory. Tap Need it if you're running low.</p>
      <ul class="checks">${have.map(r => `<li style="cursor:default"><span class="txt">${esc(r.text)}<span class="from">${esc(r.from.join(" · "))}</span></span>${S.canWrite ? `<button class="btn sm quiet" data-force="${esc(r.key)}">Need it</button>` : ""}</li>`).join("")}</ul></details>` : ""}
  </section>`;
  $$("[data-c]").forEach(el => el.onclick = () => { const k = el.dataset.c; el.classList.toggle("done"); if (!S.canWrite) return; savePlan(p => { p.shopChecked = p.shopChecked || {}; if (p.shopChecked[k]) delete p.shopChecked[k]; else p.shopChecked[k] = true; }); });
  $$("[data-force]").forEach(b => b.onclick = () => savePlan(p => { p.forceBuy = p.forceBuy || {}; p.forceBuy[b.dataset.force] = true; }));
  $("#unc")?.addEventListener("click", () => savePlan(p => p.shopChecked = {}));
  $("#exf")?.addEventListener("submit", e => { e.preventDefault(); const v = $("#ex").value.trim(); if (!v) return; savePlan(p => (p.extras = p.extras || []).push({id: uid(), name: v})); setTimeout(() => $("#ex")?.focus(), 0); });
  $("#putaway")?.addEventListener("click", () => {
    const locOf = sec => ["Meat","Produce","Dairy & eggs"].includes(sec) ? "Fridge" : sec === "Frozen" ? "Freezer" : "Pantry";
    saveInv(inv => { got.forEach(r => { inv.items.push({id: uid(), name: r.name, qty: r.text !== r.name ? r.text.replace(r.name, "").trim() : "", loc: locOf(r.sec), section: r.sec, bestBy: ""}); if (r.need) inv.needs = inv.needs.filter(n => n.id !== r.need); }); });
    savePlan(p => { got.forEach(r => { delete p.shopChecked[r.key]; if (r.extra) p.extras = p.extras.filter(x => x.id !== r.extra); }); });
    toast("Added to your kitchen");
  });
}

/* ================= kitchen: inventory, freezer, what can I make ================= */
let editing = null;
function expiry(i){ if (!i.bestBy) return null; const d = daysUntil(i.bestBy); return d < 0 ? "expired" : d <= 3 ? "soon" : null; }
function canMake(){
  if (!S.inv) return [];
  return S.recipes.map(r => { const ings = allIngs(r).map(i => ingText(i)).filter(l => !STAPLE.test(lc(normIng(l).n).trim())); if (ings.length < 2) return null;
    const missing = ings.filter(l => !invHas(l)); return {r, have: ings.length - missing.length, n: ings.length, f: (ings.length - missing.length) / ings.length, missing}; })
    .filter(Boolean).filter(x => !allergensOf(x.r).length).sort((a, b) => b.f - a.f || a.missing.length - b.missing.length).slice(0, 8);
}
function renderKitchen(){
  const inv = S.inv;
  if (!inv){ view.innerHTML = `<section class="wrap" style="padding-block:30px"><div class="empty"><h3>${S.loaded ? "Your kitchen inventory is empty" : "Opening your kitchen…"}</h3><p class="muted">Track what's in your pantry, fridge and freezer so the shopping list only shows what you need.</p>
    ${S.canWrite && S.loaded ? `<div class="row" style="justify-content:center">${SEED.kitchen ? `<button class="btn" id="kseed">Load my inventory</button>` : ""}<button class="btn ghost" id="kblank">Start empty</button></div>` : ""}</div></section>`;
    $("#kseed")?.addEventListener("click", () => { saveInv(p => Object.assign(p, clone(SEED.kitchen.inventory))); if (!(S.freezer?.meals?.length)) saveFreezer(f => f.meals = clone(SEED.kitchen.freezer.meals)); });
    $("#kblank")?.addEventListener("click", () => saveInv(() => {})); return; }
  const tabs = ["Pantry","Fridge","Freezer","Freezer meals","To buy","Equipment"];
  const tab = S.kTab, q = S.kq.toLowerCase();
  const items = (inv.items || []).filter(i => (i.loc || "Pantry") === tab && (!q || i.name.toLowerCase().includes(q)));
  const expired = (inv.items || []).filter(i => expiry(i) === "expired"), soon = (inv.items || []).filter(i => expiry(i) === "soon");
  const fz = (S.freezer?.meals || []);
  const sug = canMake();
  const W = S.canWrite;
  const row = i => { const ex = expiry(i), al = allergenHits([i.name]);
    if (editing === i.id) return `<div class="inv-row"><div class="inv-edit"><input id="e-n" value="${esc(i.name)}" aria-label="Name" class="full" style="grid-column:1/-1"><input id="e-q" value="${esc(i.qty || "")}" placeholder="Quantity" aria-label="Quantity"><input id="e-b" type="date" value="${esc(i.bestBy || "")}" aria-label="Best by">
      <select id="e-l" aria-label="Location">${["Pantry","Fridge","Freezer"].map(l => `<option ${l === (i.loc||"Pantry") ? "selected" : ""}>${l}</option>`).join("")}</select>
      <div class="row"><button class="btn sm" id="e-save">Save</button><button class="btn sm quiet" id="e-x">Cancel</button><button class="btn sm ghost" id="e-del" style="color:var(--alert);border-color:var(--alert)">Delete</button></div></div></div>`;
    return `<div class="inv-row ${ex === "expired" ? "expired" : ""}"><div style="min-width:0"><div class="nm">${esc(i.name)}</div><div class="qt">${[i.qty, i.bestBy ? `best by ${niceDate(i.bestBy)}` : "", i.section].filter(Boolean).map(esc).join(" · ")}</div>
      <div class="row" style="gap:4px;margin-top:2px">${ex === "expired" ? `<span class="chip alert">Expired</span>` : ex === "soon" ? `<span class="chip warn">Use soon</span>` : ""}${al.length ? `<span class="chip alert">⚠ ${esc(al[0].kind)}</span>` : ""}</div></div>
      ${W ? `<div class="act"><button data-out="${i.id}">Out</button><button data-edit="${i.id}">Edit</button></div>` : ""}</div>`; };
  let body = "";
  if (["Pantry","Fridge","Freezer"].includes(tab)){
    const bySec = {}; items.forEach(i => (bySec[i.section || sectionOf(i.name)] = bySec[i.section || sectionOf(i.name)] || []).push(i));
    body = `${W ? `<form class="panel fieldgrid" id="addinv"><input class="full" id="ai-n" placeholder="Add to ${tab.toLowerCase()} (e.g. Roma tomatoes)" aria-label="Item name" style="grid-column:1/-1"><input id="ai-q" placeholder="Quantity" aria-label="Quantity"><input id="ai-b" type="date" aria-label="Best by (optional)" title="Best by (optional)"><button class="btn" style="grid-column:1/-1">Add item</button></form>` : ""}
      ${SECTION_ORDER.filter(s => bySec[s]).map(s => `<section class="panel"><div class="sec-title" style="margin-top:0">${esc(s)} · ${bySec[s].length}</div>${bySec[s].map(row).join("")}</section>`).join("") || `<p class="muted">Nothing here${q ? " matches" : " yet"}.</p>`}
      ${tab === "Freezer" && fz.length ? `<p class="muted small">Prepped meals are under <button class="btn sm ghost" data-tab="Freezer meals">Freezer meals</button></p>` : ""}`;
  } else if (tab === "Freezer meals"){
    body = `<p class="muted small" style="margin:0">Meals you've batch-cooked and frozen. Add them from a prep day, or here.</p>
      ${fz.length ? fz.map(f => { const r = byId(f.recipeId), d = f.useBy ? daysUntil(f.useBy) : null;
        return `<section class="panel"><div class="row between"><div style="min-width:0"><b style="font-family:var(--display);font-size:18px">${esc(f.name)}</b><div class="small muted">${f.frozenOn ? `Frozen ${niceDate(f.frozenOn)}` : "Freeze date not set"}${f.useBy ? ` · use by ${niceDate(f.useBy)}` : ""}</div>${f.note ? `<div class="small">${esc(f.note)}</div>` : ""}
          <div class="row" style="gap:4px;margin-top:4px">${d != null && d < 0 ? `<span class="chip alert">Past use-by</span>` : d != null && d <= 14 ? `<span class="chip warn">Use within ${d} days</span>` : ""}${r?.fridgeDays ? `<span class="chip line">Thawed: ${r.fridgeDays} days in fridge</span>` : ""}</div></div>
          <div class="stack" style="align-items:flex-end;gap:6px"><b style="font-size:24px;font-family:var(--display)">${f.portions ?? "?"}</b><span class="small muted">portions</span></div></div>
          ${W ? `<div class="row" style="margin-top:8px"><button class="btn sm" data-eat="${f.id}">Ate one</button><button class="btn sm quiet" data-fedit="${f.id}">Edit</button><button class="btn sm ghost" data-fdel="${f.id}">Remove</button></div>` : ""}</section>`; }).join("") : `<div class="empty"><h3>Nothing in the freezer log</h3></div>`}
      ${W ? `<button class="btn ghost" id="fzadd">+ Log a frozen meal</button>` : ""}`;
  } else if (tab === "To buy"){
    const lst = (title, key, hint) => `<section class="panel"><h2>${title}</h2><p class="muted small" style="margin:2px 0 6px">${hint}</p>${(inv[key] || []).map(x => `<div class="inv-row"><div class="nm">${esc(x.name)}${x.qty ? ` <span class="qt">${esc(x.qty)}</span>` : ""}</div>${W ? `<div class="act">${key === "cart" ? `<button data-gotcart="${x.id}">Arrived</button>` : ""}<button data-rml="${key}:${x.id}">Remove</button></div>` : ""}</div>`).join("") || `<p class="muted">Nothing here.</p>`}
      ${W ? `<form class="row" data-addl="${key}" style="margin-top:8px;flex-wrap:nowrap"><input placeholder="Add an item" aria-label="Add an item"><button class="btn sm">Add</button></form>` : ""}</section>`;
    body = lst("Out of stock", "needs", "These show up on every shopping list until you buy them.") + lst("Walmart cart", "cart", "Already in your online cart. Tap Arrived to move it into the kitchen.");
  } else {
    body = `<section class="panel">${(inv.equipment || []).map((e, i) => `<div class="inv-row"><div class="nm">${esc(e)}</div>${W ? `<div class="act"><button data-rmeq="${i}">Remove</button></div>` : ""}</div>`).join("")}
      ${W ? `<form class="row" id="addeq" style="margin-top:8px;flex-wrap:nowrap"><input placeholder="Add equipment" aria-label="Add equipment"><button class="btn sm">Add</button></form>` : ""}</section>`;
  }
  view.innerHTML = `
  <section class="wrap" style="padding-block:18px 40px">
    <span class="label">Kitchen</span><h1 style="margin-top:4px">What's in the <span class="it">kitchen</span></h1>
    ${expired.length ? `<div class="banner alert" style="margin-top:12px">${ICON.warn}<div><b>${expired.length} expired item${expired.length > 1 ? "s" : ""}</b>${expired.map(i => esc(i.name)).join(", ")}</div></div>` : ""}
    ${soon.length ? `<div class="banner warn" style="margin-top:8px">${ICON.warn}<div><b>Use soon</b>${soon.map(i => `${esc(i.name)} (${niceDate(i.bestBy)})`).join(", ")}</div></div>` : ""}
    ${sug.length ? `<div class="section-head"><h2>What can I make?</h2><span class="muted small">From what you have, no shellfish or fish</span></div>
      <div class="stack" style="gap:8px">${sug.slice(0, 5).map(x => `<a class="sug" href="#r-${esc(x.r.id)}">${thumb(x.r)}<div style="min-width:0;flex:1"><b style="font-family:var(--display)">${esc(x.r.title)}</b><div class="muted small">${x.missing.length ? `Need ${x.missing.length}: ${esc(x.missing.slice(0, 3).map(l => normIng(l).n.split(",")[0]).join(", "))}${x.missing.length > 3 ? "…" : ""}` : "You have everything"}</div><div class="meter"><i style="width:${Math.round(x.f*100)}%"></i></div></div></a>`).join("")}</div>` : ""}
    <div class="section-head"><h2>Inventory</h2>${["Pantry","Fridge","Freezer"].includes(tab) ? `<input id="kq" type="search" placeholder="Find an item" value="${esc(S.kq)}" style="max-width:240px" aria-label="Find an item">` : ""}</div>
    <div class="seg" role="tablist">${tabs.map(t => `<button class="fbtn" role="tab" data-tab="${t}" aria-pressed="${t === tab}">${t}${["Pantry","Fridge","Freezer"].includes(t) ? ` · ${(inv.items || []).filter(i => (i.loc || "Pantry") === t).length}` : t === "Freezer meals" ? ` · ${fz.length}` : ""}</button>`).join("")}</div>
    <div class="stack" style="margin-top:12px">${body}</div>
  </section>`;
  $$("[data-tab]").forEach(b => b.onclick = () => { S.kTab = b.dataset.tab; editing = null; renderKitchen(); });
  const kq = $("#kq"); kq?.addEventListener("input", () => { S.kq = kq.value; const p = kq.selectionStart; renderKitchen(); const n = $("#kq"); n.focus(); n.setSelectionRange(p, p); });
  $("#addinv")?.addEventListener("submit", e => { e.preventDefault(); const n = $("#ai-n").value.trim(); if (!n) return; const it = {id: uid(), name: n, qty: $("#ai-q").value.trim(), loc: tab, section: sectionOf(n), bestBy: $("#ai-b").value};
    if (allergenHits([n]).length) toast("Heads up: that item contains fish or shellfish.");
    saveInv(p => p.items.push(it)); setTimeout(() => $("#ai-n")?.focus(), 0); });
  $$("[data-edit]").forEach(b => b.onclick = () => { editing = b.dataset.edit; renderKitchen(); $("#e-n")?.focus(); });
  $$("[data-out]").forEach(b => b.onclick = () => { const it = inv.items.find(i => i.id === b.dataset.out); saveInv(p => { p.items = p.items.filter(i => i.id !== it.id); p.needs = p.needs || []; p.needs.push({id: uid(), name: it.name}); }); toast(`${it.name} moved to To buy`); });
  $("#e-x")?.addEventListener("click", () => { editing = null; renderKitchen(); });
  $("#e-save")?.addEventListener("click", () => { const id = editing; editing = null; saveInv(p => { const i = p.items.find(x => x.id === id); i.name = $("#e-n").value.trim() || i.name; i.qty = $("#e-q").value.trim(); i.bestBy = $("#e-b").value; i.loc = $("#e-l").value; i.section = sectionOf(i.name); }); });
  $("#e-del")?.addEventListener("click", () => { const id = editing; editing = null; saveInv(p => p.items = p.items.filter(x => x.id !== id)); });
  $$("[data-eat]").forEach(b => b.onclick = () => saveFreezer(f => { const m = f.meals.find(x => x.id === b.dataset.eat); if (m.portions == null) { m.portions = 0; return; } m.portions = Math.max(0, m.portions - 1); if (!m.portions) f.meals = f.meals.filter(x => x.id !== m.id); }));
  $$("[data-fdel]").forEach(b => b.onclick = () => saveFreezer(f => f.meals = f.meals.filter(x => x.id !== b.dataset.fdel)));
  $$("[data-fedit]").forEach(b => b.onclick = () => { const f0 = fz.find(x => x.id === b.dataset.fedit); const m = modal("Edit frozen meal", `
      <label class="field"><span>Name</span><input id="fe-n" value="${esc(f0.name)}"></label><label class="field"><span>Portions</span><input id="fe-p" type="number" inputmode="numeric" min="0" value="${f0.portions ?? ""}"></label>
      <label class="field"><span>Frozen on</span><input id="fe-d" type="date" value="${esc(f0.frozenOn || "")}"></label><label class="field"><span>Use by</span><input id="fe-u" type="date" value="${esc(f0.useBy || "")}"></label><button class="btn" id="fe-go">Save</button>`);
    $("#fe-d", m.el).oninput = () => { const r = byId(f0.recipeId); if ($("#fe-d", m.el).value) $("#fe-u", m.el).value = addMonths($("#fe-d", m.el).value, r?.freezerMonths || 3); };
    $("#fe-go", m.el).onclick = () => { saveFreezer(f => { const x = f.meals.find(y => y.id === f0.id); x.name = $("#fe-n", m.el).value; x.portions = $("#fe-p", m.el).value === "" ? null : +$("#fe-p", m.el).value; x.frozenOn = $("#fe-d", m.el).value; x.useBy = $("#fe-u", m.el).value; x.note = x.portions != null && x.frozenOn ? "" : x.note; }); m.close(); }; });
  $("#fzadd")?.addEventListener("click", () => { const m = modal("Log a frozen meal", `<div class="stack" style="max-height:50vh;overflow:auto">${S.recipes.filter(r => r.freezer).map(r => `<button class="pick" data-fz="${esc(r.id)}">${thumb(r)}<b>${esc(r.title)}</b></button>`).join("")}</div>`);
    $$("[data-fz]", m.el).forEach(b => b.onclick = () => { m.close(); const r = byId(b.dataset.fz); freezeDialog(r, r.servings || 4, todayISO()); }); });
  $$("[data-addl]").forEach(f => f.onsubmit = e => { e.preventDefault(); const v = $("input", f).value.trim(); if (!v) return; const k = f.dataset.addl; saveInv(p => (p[k] = p[k] || []).push({id: uid(), name: v})); });
  $$("[data-rml]").forEach(b => b.onclick = () => { const [k, id] = b.dataset.rml.split(":"); saveInv(p => p[k] = p[k].filter(x => x.id !== id)); });
  $$("[data-gotcart]").forEach(b => b.onclick = () => saveInv(p => { const x = p.cart.find(c => c.id === b.dataset.gotcart); p.cart = p.cart.filter(c => c.id !== x.id); const sec = sectionOf(x.name); p.items.push({id: uid(), name: x.name, qty: x.qty || "", loc: ["Meat","Produce","Dairy & eggs"].includes(sec) ? "Fridge" : sec === "Frozen" ? "Freezer" : "Pantry", section: sec, bestBy: ""}); }));
  $$("[data-rmeq]").forEach(b => b.onclick = () => saveInv(p => p.equipment.splice(+b.dataset.rmeq, 1)));
  $("#addeq")?.addEventListener("submit", e => { e.preventDefault(); const v = $("input", e.target).value.trim(); if (v) saveInv(p => (p.equipment = p.equipment || []).push(v)); });
}

/* ================= backup + export ================= */
function snapshot(){ return {app: "sazon-sugar", version: 2, exportedAt: new Date().toISOString(), recipes: Object.fromEntries(S.recipes.map(r => [r.id, stripId(r)])), inventory: S.inv, freezer: S.freezer, plans: S.plans}; }
async function listBackups(){ try { const s = await S.db.collection("backups").get(); return s.docs.map(d => ({id: d.id, ...d.data()})).sort((a, b) => b.id.localeCompare(a.id)); } catch { return []; } }
async function backupNow(silent){
  if (!S.db || !S.canWrite) return false;
  const snap = snapshot(), body = JSON.stringify(snap);
  if (body.length > 250000){ if (!silent) toast("Too much data for an in-app backup. Use Export instead."); return false; }
  const id = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
  try {
    await S.db.collection("backups").doc(id).set({createdAt: snap.exportedAt, recipeCount: S.recipes.length, data: body});
    const all = await listBackups(); for (const b of all.slice(6)) await S.db.collection("backups").doc(b.id).delete();
    if (!silent) toast("Backup saved"); return true;
  } catch { if (!silent) toast("Backup failed. Try again."); return false; }
}
let autoChecked = false;
async function maybeAutoBackup(){
  if (autoChecked || !S.canWrite || !S.recipes.length) return; autoChecked = true;
  const all = await listBackups(); const last = all[0]?.createdAt;
  if (!last || (Date.now() - new Date(last)) > 7 * 864e5) backupNow(true);
}
async function restore(data){
  if (!data || data.app !== "sazon-sugar" || !data.recipes) throw new Error("not ours");
  for (const [id, r] of Object.entries(data.recipes)) await S.db.collection("recipes").doc(id).set(r);
  if (data.inventory) await S.db.doc("kitchen/inventory").set(data.inventory);
  if (data.freezer) await S.db.doc("kitchen/freezer").set(data.freezer);
}
async function renderData(){
  const old = S.recipes.filter(r => r.schema !== 2 && SEED.recipes[r.id]);
  view.innerHTML = `
  <section class="wrap editor">
    <span class="label">Your data</span><h1 style="margin-top:4px">Backup &amp; <span class="it">export</span></h1>
    <p class="muted" style="margin:0">Your recipes, plan and kitchen live in this app's hosted database, so every device you sign in on sees the same data. Nothing is kept only in one browser.</p>
    <section class="panel stack"><h2>Export</h2><p class="muted small" style="margin:0">One JSON file with every recipe, your kitchen inventory, freezer log and meal plans.</p>
      <div class="row"><button class="btn" id="exp">Download JSON export</button><button class="btn quiet" id="expc">Copy JSON</button></div><div id="expmsg" class="small muted"></div></section>
    <section class="panel stack"><h2>Backups</h2><p class="muted small" style="margin:0">A backup is saved automatically once a week (the last 6 are kept). You can also back up now.</p>
      ${S.canWrite ? `<div class="row"><button class="btn" id="bk">Back up now</button></div>` : ""}<div id="bklist" class="muted small">Loading backups…</div></section>
    ${S.canWrite ? `<section class="panel stack"><h2>Restore from a file</h2><p class="muted small" style="margin:0">Pick a JSON export. Recipes with the same name are replaced; others stay.</p><div class="row"><label class="btn quiet" for="rf">Choose file</label><input type="file" id="rf" accept="application/json,.json" hidden></div><div id="rfmsg"></div></section>` : ""}
    ${old.length && S.canWrite ? `<section class="panel stack"><h2>Update starter recipes</h2><p class="muted small" style="margin:0">${old.length} recipes were loaded in the old format. Update them to the new format with times, tags and parsed amounts. Your favorites and photos are kept.</p><button class="btn" id="upg">Update ${old.length} recipes</button></section>` : ""}
    <section class="panel"><h2>Preferences</h2><ul class="small" style="margin:6px 0 0;padding-left:18px"><li>Shellfish allergy and no fish: recipes, imports and kitchen items that contain them are flagged. That includes hidden sources like Worcestershire and Caesar dressing (anchovies) and oyster sauce.</li><li>One meat per meal: recipes with more than one meat get a warning.</li><li>Paid services or API keys: none are used.</li></ul></section>
  </section>`;
  const json = () => JSON.stringify(snapshot(), null, 2);
  $("#exp").onclick = async () => { const f = `sazon-sugar-${todayISO()}.json`;
    if (!S.downloads){ $("#expmsg").textContent = "Downloads aren't available in this view. Use Copy JSON instead."; return; }
    try { await S.downloads.save({filename: f, data: json()}); $("#expmsg").textContent = `Saved ${f}`; } catch(e){ $("#expmsg").textContent = e?.code === "dismissed" || e?.code === "declined" ? "Download cancelled." : "Couldn't start the download. Use Copy JSON instead."; } };
  $("#expc").onclick = async () => { try { await navigator.clipboard.writeText(json()); $("#expmsg").textContent = "Copied. Paste it into a note or file to keep it."; } catch { $("#expmsg").innerHTML = `<textarea rows="6" readonly>${esc(json())}</textarea>`; $("#expmsg textarea").select(); } };
  $("#bk")?.addEventListener("click", async () => { await backupNow(); renderData(); });
  $("#rf")?.addEventListener("change", async e => { const f = e.target.files[0]; if (!f) return; const box = $("#rfmsg");
    try { const data = JSON.parse(await f.text()); const n = Object.keys(data.recipes || {}).length;
      box.innerHTML = `<div class="banner warn">${ICON.warn}<div>Restore ${n} recipes${data.inventory ? ", your kitchen" : ""}${data.freezer ? " and freezer log" : ""} from ${esc(f.name)}? This replaces what's there now.<div class="row" style="margin-top:8px"><button class="btn sm" id="rfy">Restore</button><button class="btn sm quiet" id="rfn">Cancel</button></div></div></div>`;
      $("#rfn").onclick = () => box.innerHTML = ""; $("#rfy").onclick = async () => { box.textContent = "Restoring…"; try { await restore(data); box.textContent = "Restored."; } catch { box.textContent = "Restore stopped part way. Try again."; } };
    } catch { box.innerHTML = `<div class="banner alert">That file isn't a Sazón & Sugar export.</div>`; } });
  $("#upg")?.addEventListener("click", async () => { const b = $("#upg"); b.disabled = true; let n = 0;
    try { for (const r of old){ const s = SEED.recipes[r.id]; await S.db.collection("recipes").doc(r.id).set({...s, favorite: !!r.favorite, photoUrl: r.photoUrl || "", photoId: r.photoId || ""}); n++; b.textContent = `Updating ${n} of ${old.length}…`; } toast("Recipes updated"); }
    catch { b.disabled = false; b.textContent = "Try again"; } });
  if (S.db){ const all = await listBackups(); const host = $("#bklist"); if (!host) return;
    host.innerHTML = all.length ? all.map(b => `<div class="inv-row"><div><div class="nm">${esc(new Date(b.createdAt).toLocaleString(undefined, {dateStyle: "medium", timeStyle: "short"}))}</div><div class="qt">${b.recipeCount} recipes</div></div>${S.canWrite ? `<div class="act"><button data-rs="${esc(b.id)}">Restore</button></div>` : ""}</div>`).join("") : "No backups yet.";
    $$("[data-rs]").forEach(btn => btn.onclick = async () => { if (btn.dataset.sure !== "1"){ btn.dataset.sure = "1"; btn.textContent = "Tap again to restore"; return; } btn.textContent = "Restoring…"; try { await restore(JSON.parse(all.find(x => x.id === btn.dataset.rs).data)); btn.textContent = "Restored"; } catch { btn.textContent = "Failed"; } }); }
  else $("#bklist").textContent = "Sign in to Claude to see backups.";
}

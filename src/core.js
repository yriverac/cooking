/* ---------- core: pure helpers (also used by the seed script) ---------- */
const UF = {"¼":.25,"½":.5,"¾":.75,"⅓":1/3,"⅔":2/3,"⅛":.125,"⅜":.375,"⅝":.625,"⅞":.875};
const NUM_RE = "(?:\\d+\\s+(?:and\\s+)?\\d+\\/\\d+|\\d+\\s*[¼½¾⅓⅔⅛⅜⅝⅞]|\\d+\\/\\d+|\\d+(?:[.,]\\d+)?|[¼½¾⅓⅔⅛⅜⅝⅞])";
const QTY_RE = new RegExp(`^(${NUM_RE})(?:\\s*(?:-|–|to|a)\\s*(${NUM_RE}))?`, "i");
function toNum(s){
  s = String(s).trim().replace(",", ".").replace(/\s+and\s+/, " ");
  let m;
  if ((m = s.match(/^(\d+)\s+(\d+)\/(\d+)$/))) return +m[1] + m[2]/m[3];
  if ((m = s.match(/^(\d+)\s*([¼½¾⅓⅔⅛⅜⅝⅞])$/))) return +m[1] + UF[m[2]];
  if ((m = s.match(/^(\d+)\/(\d+)$/))) return m[1]/m[2];
  if (UF[s] != null) return UF[s];
  return parseFloat(s);
}
function fmtNum(n){
  if (n == null || !isFinite(n)) return "";
  if (n >= 20) return String(Math.round(n));
  const whole = Math.floor(n + 1e-9), frac = n - whole;
  const F = [[0,""],[.125,"⅛"],[.25,"¼"],[1/3,"⅓"],[.375,"⅜"],[.5,"½"],[.625,"⅝"],[2/3,"⅔"],[.75,"¾"],[.875,"⅞"],[1,""]];
  let best = F[0], d = 9;
  for (const f of F){ const dd = Math.abs(frac - f[0]); if (dd < d){ d = dd; best = f; } }
  if (d > .04) return String(+n.toFixed(2));
  const w = best[0] === 1 ? whole + 1 : whole;
  return ((w ? String(w) : "") + best[1]) || "0";
}
/* unit words as written -> canonical key used to add amounts together */
const UNITS = {
  cup:"cup",cups:"cup",c:"cup",taza:"cup",tazas:"cup",tasa:"cup",
  tablespoon:"tbsp",tablespoons:"tbsp",tbsp:"tbsp",tbsps:"tbsp",tbs:"tbsp",tbl:"tbsp",cucharada:"tbsp",cucharadas:"tbsp",
  teaspoon:"tsp",teaspoons:"tsp",tsp:"tsp",tsps:"tsp",cucharadita:"tsp",cucharaditas:"tsp",
  ounce:"oz",ounces:"oz",oz:"oz",onza:"oz",onzas:"oz",
  pound:"lb",pounds:"lb",lb:"lb",lbs:"lb",libra:"lb",libras:"lb",
  gram:"g",grams:"g",g:"g",gr:"g",gramos:"g",kilogram:"kg",kilograms:"kg",kg:"kg",
  ml:"ml",milliliter:"ml",milliliters:"ml",millilitre:"ml",l:"l",liter:"l",liters:"l",litre:"l",litres:"l",
  can:"can",cans:"can",lata:"can",latas:"can",jar:"jar",jars:"jar",
  clove:"clove",cloves:"clove",diente:"clove",dientes:"clove",
  package:"package",packages:"package",paquete:"package",paquetes:"package",pkg:"package",box:"box",boxes:"box",
  stick:"stick",sticks:"stick",pinch:"pinch",pinches:"pinch",pizca:"pinch",piscas:"pinch",pisca:"pinch",
  bunch:"bunch",ramo:"bunch",slice:"slice",slices:"slice",sheet:"sheet",sheets:"sheet",
  bag:"bag",bags:"bag",gallon:"gallon",gallons:"gallon",quart:"quart",quarts:"quart",pint:"pint",pints:"pint",
  sprig:"sprig",sprigs:"sprig",dozen:"dozen",docenas:"dozen",docena:"dozen",tapitas:"capful",tapita:"capful",
  cubos:"cube",cubo:"cube",cube:"cube",cubes:"cube",hoja:"leaf",envelope:"envelope",envelopes:"envelope",
  brick:"brick",bricks:"brick",splash:"splash",handful:"handful",
};
function parseIng(raw){
  let s = String(raw ?? "").replace(/[▢☐]/g, "").replace(/^\s*(?:[-•*]|\d+[.)]\s)\s*/, "").replace(/\s+/g, " ").trim();
  const out = {q:null, q2:null, u:"", n:s};
  s = s.replace(/^(una?|one)\s+/i, "1 ").replace(/^(media|medio|half)\s+/i, "½ ");
  out.n = s;
  let m = s.match(QTY_RE);
  if (!m){
    // "Clavos 1 tsp" / "Tomillo1/8 tsp": amount written after the name
    const t = s.match(new RegExp(`^(.+?)\\s*(${NUM_RE})\\s*([a-zA-Z]+)\\.?$`));
    if (t && UNITS[t[3].toLowerCase()] && isFinite(toNum(t[2]))) return {q: toNum(t[2]), q2: null, u: t[3], n: t[1].trim()};
    return out;
  }
  const q = toNum(m[1]); if (!isFinite(q)) return out;
  out.q = q; out.q2 = m[2] ? toNum(m[2]) : null;
  let rest = s.slice(m[0].length);
  const um = rest.match(/^\s*([a-záéíóúñ]+)\.?(?=[\s,(]|$)/i);
  if (um && UNITS[um[1].toLowerCase()]){ out.u = um[1]; rest = rest.slice(um[0].length); }
  else { const gm = rest.match(/^(g|kg|ml|oz|lb|lbs|tbsp|tsp)\b\.?/i); if (gm){ out.u = gm[1]; rest = rest.slice(gm[0].length); } }
  rest = rest.trim();
  // "50 g / 1.75oz butter" or "0.75 litres / 3 cups / beef broth": keep the other measure in brackets
  const alt = []; let am;
  while ((am = rest.match(/^\/\s*([\d¼½¾⅓⅔][\d.,\/¼½¾⅓⅔ ]*\s*[a-zA-Z]+\.?)\s*/))){ alt.push(am[1].trim()); rest = rest.slice(am[0].length); }
  rest = rest.replace(/^\/\s*/, "");
  out.n = rest.replace(/^\s*(?:of|de)\s+/i, "").trim() + (alt.length ? ` (${alt.join(", ")})` : "");
  return out;
}
function normIng(i){ return typeof i === "string" ? parseIng(i) : {q: i.q ?? null, q2: i.q2 ?? null, u: i.u || "", n: i.n || ""}; }
function ingText(i, k=1){
  i = normIng(i);
  const qs = i.q != null ? fmtNum(i.q*k) + (i.q2 != null ? "–" + fmtNum(i.q2*k) : "") : "";
  let n = i.n;
  if (k !== 1) n = n.replace(/\(([^)]*)\)/g, (all, inner) => "(" + inner.replace(/(\d+(?:\.\d+)?)(\s*)(g|grams|ml|oz|cups?|lbs?|tbsps?|tsp|kg)\b/gi, (x, num, sp, u) => fmtNum(+num * k) + sp + u) + ")");
  return [qs, i.u, n].filter(Boolean).join(" ");
}
function unitKey(u){ return UNITS[String(u||"").toLowerCase()] || String(u||"").toLowerCase(); }

/* words */
function lc(s){ return " " + String(s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[’']s\b/g,"").replace(/[^a-z0-9ñ\s]/g," ").replace(/\s+/g," ") + " "; }
function hasWord(text, w){ return lc(text).includes(" " + w + " "); }
function hasAny(text, list){ const t = lc(text); return list.find(w => t.includes(" " + w + " ")) || null; }

/* allergies: shellfish allergy + no fish */
const SHELLFISH = ["shrimp","shrimps","prawn","prawns","crab","crabs","lobster","lobsters","scallop","scallops","clam","clams","mussel","mussels","oyster","oysters","squid","calamari","octopus","crawfish","crayfish","langostino","langostinos","camaron","camarones","langosta","cangrejo","jueyes","pulpo","calamar","calamares","almeja","almejas","mejillon","mejillones","ostra","ostras","shellfish","mariscos"];
const FISH = ["fish","salmon","tuna","cod","bacalao","bacalaitos","tilapia","anchovy","anchovies","sardine","sardines","halibut","trout","mahi","snapper","catfish","haddock","pollock","atun","pescado","salmon","dashi","bonito","swordfish","mackerel","herring"];
const HIDDEN_FISH = {worcestershire:"Worcestershire sauce usually contains anchovies", caesar:"Caesar dressing usually contains anchovies"};
function allergenHits(texts){
  const hits = [];
  texts.forEach(t => {
    const s = hasAny(t, SHELLFISH); if (s) hits.push({kind:"Shellfish", word:s.trim(), line:t});
    const f = hasAny(t, FISH); if (f && !/ fish sauce /.test(lc(t)) ) hits.push({kind:"Fish", word:f.trim(), line:t});
    if (/ fish sauce /.test(lc(t))) hits.push({kind:"Fish", word:"fish sauce", line:t});
    Object.entries(HIDDEN_FISH).forEach(([w, why]) => { if (hasWord(t, w)) hits.push({kind:"Fish", word:w, line:t, why}); });
  });
  const seen = new Set(); return hits.filter(h => { const k = h.kind + h.word; if (seen.has(k)) return false; seen.add(k); return true; });
}

/* meats: aim for one meat per meal */
const MEATS = {
  Beef:["beef","steak","steaks","sirloin","res","vaca","brisket","chuck"],
  Chicken:["chicken","pollo","muslitos","muslos","drumsticks","thighs","pechuga"],
  Pork:["pork","puerco","cerdo","pernil","chorizo","bacon","ham","jamon","spam","tocino","carnitas"],
  Turkey:["turkey","pavo"], Lamb:["lamb","cordero"], Goat:["goat","cabro","chivo"],
};
const NOT_MEAT = /\b(broth|stock|bouillon|caldo|cubito|consom|flavou?r|seasoning)\b/i;
function meatsIn(lines){
  const found = new Set();
  lines.forEach(t => { if (NOT_MEAT.test(t)) return; for (const [m, ws] of Object.entries(MEATS)) if (hasAny(t, ws)) found.add(m); });
  return [...found];
}

/* store sections for the shopping list and the kitchen */
const SECTIONS = [
  ["Meat", ["beef","steak","steaks","sirloin","chicken","pollo","muslitos","pork","puerco","cerdo","pernil","chorizo","bacon","ham","jamon","spam","turkey","sausage","sausages","carne","res","vaca","lamb","nuggets"]],
  ["Produce", ["onion","onions","cebolla","garlic","ajo","ajos","tomato","tomatoes","tomate","tomates","jitomates","tomatillos","potato","potatoes","papas","pepper","peppers","pimiento","chile","chiles","serrano","serranos","jalapeno","jalapenos","lettuce","avocado","avocados","cilantro","parsley","perejil","thyme","rosemary","lemon","lemons","lime","limes","limon","china","orange","banana","bananas","strawberries","blackberries","berries","mango","mangos","mushrooms","shallot","ginger","celery","carrot","carrots","cabbage","corn husks","husks","scallion","scallions","green onions","spinach","kale","fruit","apple","apples","plantain","platanos","recao","culantro"]],
  ["Dairy & eggs", ["milk","leche","butter","mantequilla","cream","crema","cheese","queso","yogurt","egg","eggs","huevo","huevos","yolk","yolks","whites","sour cream","buttermilk","ghee","margarine","lactaid","half and half"]],
  ["Bakery & tortillas", ["bread","buns","tortilla","tortillas","plantillas","rolls","bagel","croissant","pita"]],
  ["Frozen", ["frozen","ice cream","puff pastry","pastry"]],
  ["Baking", ["flour","harina","sugar","azucar","baking","yeast","cornstarch","cocoa","chocolate","chips","morsels","vanilla","extract","sprinkles","food coloring","coloring","powdered","confectioners","cake mix","marshmallows","coconut flakes","oats","oatmeal","molasses","honey","nuts","walnuts","pecans","almonds","cashews","liners","gelatin"]],
  ["Spices & seasonings", ["salt","sal","pepper","pimienta","oregano","cumin","comino","cominos","paprika","cinnamon","canela","cloves","clavos","garam","masala","turmeric","coriander","bay","laurel","adobo","sazon","seasoning","chili powder","cayenne","nutmeg","allspice","achiote","annatto","tomillo","methi","fenugreek","cardamom","cardamoms","espresso powder","sesame seeds"]],
  ["Canned & jarred", ["can","canned","lata","latas","beans","gandules","pigeon","chickpeas","tomato sauce","salsa tomate","tomato paste","passata","coconut milk","coconut cream","evaporated","condensed","broth","stock","caldo","bouillon","tuna","olives","capers","roasted red peppers","marinara","sofrito","recaito","jam","jelly","corn","pineapple"]],
  ["Pasta, rice & grains", ["rice","arroz","pasta","spaghetti","macaroni","noodles","lasagna","penne","cavatappi","quinoa","masa","maseca","cornmeal","harina de maiz","oats","couscous","breadcrumbs","panko","crumbs","potatoes flakes"]],
  ["Condiments & sauces", ["ketchup","mayonnaise","mayo","mayonesa","mustard","soy sauce","oyster sauce","worcestershire","teriyaki","bbq","barbecue","hot sauce","sriracha","sweet chili","dressing","vinaigrette","salsa","chipotle","nutella","peanut butter","cheez whiz","sauerkraut"]],
  ["Oils & vinegars", ["oil","aceite","vinegar","vinagre","cooking spray","pam","crisco","shortening","wine","vino","cooking wine"]],
  ["Drinks & coffee", ["coffee","cafe","juice","jugo","rum","ron","soda","water","agua de coco","tea","pedialyte"]],
  ["Snacks", ["cookies","oreo","crackers","chips","popcorn","creme pies","gamesa"]],
];
const SECTION_ORDER = SECTIONS.map(s => s[0]).concat(["Other"]);
const SECTION_RULES = [
  [/\b(lemon|lemons|lime|limes|limon)\b/, "Produce"],
  [/\b(broth|stock|bouillon|caldo|consomme)\b/, "Canned & jarred"],
  [/\b(vienna|spam|tuna|condensed|evaporated|dry milk|coconut (milk|cream))\b/, "Canned & jarred"],
  [/\b(ice cream|frozen|nuggets|puff pastry)\b/, "Frozen"],
  [/\b(tortillas?|plantillas|buns|bread(?! flour)|bakery)\b/, "Bakery & tortillas"],
  [/\b(powder|seasoning|dried|flakes|ground (cumin|ginger|cinnamon|cloves)|black pepper|peppercorns|tomillo|thyme|rosemary|bay leaf|bay leaves)\b/, "Spices & seasonings"],
  [/\b(vinegar|vinagre|cooking spray|cooking wine)\b/, "Oils & vinegars"],
  [/\b(juice|jugo|coffee|cafe|pedialyte)\b(?!.* of )/, "Drinks & coffee"],
  [/\b(flour|harina|cornstarch|coconut|crumbs)\b/, "Baking"],
  [/\b(mashed potatoes)\b/, "Pasta, rice & grains"],
  [/\b(country crock|margarine)\b/, "Dairy & eggs"],
  [/\b(soup)\b/, "Canned & jarred"],
];
function sectionOf(name){
  const t = lc(name);
  for (const [re, sec] of SECTION_RULES) if (re.test(t)) return sec;
  // phrase-first checks so "tomato sauce" is canned, not produce
  for (const [sec, ws] of SECTIONS) for (const w of ws) if (w.includes(" ") && t.includes(" " + w + " ")) return sec;
  for (const [sec, ws] of SECTIONS) for (const w of ws) if (!w.includes(" ") && t.includes(" " + w + " ")) return sec;
  return "Other";
}

/* timers inside a step */
function findTimes(text){
  const out = []; const re = /(\d+(?:[.,]\d+)?)(?:\s*(?:-|–|to|a)\s*(\d+(?:[.,]\d+)?))?\s*(hours?|hrs?|horas?|hr|minutes?|mins?|minutos?|min)\b/gi; let m;
  while ((m = re.exec(String(text)))){
    const unit = /^h/i.test(m[3]) ? 60 : 1;
    const lo = parseFloat(m[1].replace(",", "."));
    const mins = lo*unit;
    if (mins > 0 && mins <= 48*60) out.push({mins, label: m[0].trim()});
  }
  return out.slice(0,3);
}
function fmtMins(m){ if (!m) return ""; m = Math.round(m); const h = Math.floor(m/60), r = m%60; return h ? `${h} hr${r ? ` ${r} min` : ""}` : `${r} min`; }

/* prep-day helpers */
const PREP_WORDS = ["diced","dice","chopped","chop","minced","mince","sliced","slice","grated","grate","crushed","crush","peeled","cubed","cut","julienned","shredded","halved","quartered","zested","zest","juiced","juice of","finely","thinly","picada","picado","picadas","molido","rallado","cortado","cortados","trozos","pelado"];
const PREP_BASES = ["onion","onions","cebolla","garlic","ajo","ajos","tomato","tomatoes","tomates","jitomates","tomatillos","pepper","peppers","pimiento","chile","chiles","serrano","serranos","jalapeno","cilantro","parsley","perejil","mushrooms","shallot","ginger","celery","carrot","carrots","potatoes","potato","papas","strawberries","walnuts","pecans","nuts","lemon","lime","chocolate","cabbage","lettuce","avocado","thyme"];
const BASE_NAME = {onions:"Onions",onion:"Onions",cebolla:"Onions",garlic:"Garlic",ajo:"Garlic",ajos:"Garlic",tomato:"Tomatoes",tomatoes:"Tomatoes",tomates:"Tomatoes",jitomates:"Tomatoes",tomatillos:"Tomatillos",pepper:"Peppers",peppers:"Peppers",pimiento:"Peppers",chile:"Chiles",chiles:"Chiles",serrano:"Chiles",serranos:"Chiles",jalapeno:"Chiles",cilantro:"Herbs",parsley:"Herbs",perejil:"Herbs",thyme:"Herbs",mushrooms:"Mushrooms",shallot:"Onions",ginger:"Ginger",celery:"Celery",carrot:"Carrots",carrots:"Carrots",potatoes:"Potatoes",potato:"Potatoes",papas:"Potatoes",strawberries:"Strawberries",walnuts:"Nuts",pecans:"Nuts",nuts:"Nuts",lemon:"Citrus",lime:"Citrus",chocolate:"Chocolate",cabbage:"Cabbage",lettuce:"Lettuce",avocado:"Avocado"};
function prepBase(line){
  line = String(line).replace(/\([^)]*\)/g, " ").split(/\bor\b/)[0];
  if (!hasAny(line, PREP_WORDS)) return null;
  const b = hasAny(line, PREP_BASES); return b ? BASE_NAME[b.trim()] : null;
}
const LEAD_RE = /\b(overnight|marinate|marinar|marinade|refrigerate for|chill|soak|thaw|rest overnight|2 noches|noches)\b/i;
const PREHEAT_RE = /\b(preheat|pre-heat|precalentar)\b[^.]*?(\d{3})\s*°?\s*(?:degrees\s*)?\(?\s*(f|c)?/i;

if (typeof module !== "undefined") module.exports = {toNum, fmtNum, parseIng, normIng, ingText, unitKey, allergenHits, meatsIn, sectionOf, SECTION_ORDER, findTimes, fmtMins, prepBase, LEAD_RE, PREHEAT_RE, lc, hasAny};

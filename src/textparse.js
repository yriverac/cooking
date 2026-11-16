/* ---------- read a recipe out of copied page text, no Claude needed ---------- */
const H_ING = /^(ingredients?|ingredientes|what you('| wi)ll need)\s*:?\s*$/i;
const H_STEP = /^(instructions?|directions?|method|steps|preparation|how to make( it)?|instrucciones|preparaci[oó]n|procedimiento)\s*:?\s*$/i;
const H_END = /^(notes?|recipe notes|tips|nutrition( facts| information)?|video|did you make this|equipment|course|cuisine|keyword|calories|author|rate this recipe|share|pin|reviews?|comments?|leave a (comment|review)|you may also like|related|more recipes|storage|faq|notas)\b/i;
const H_NOTES = /^(notes?|recipe notes|tips|notas)\s*:?\s*$/i;
const JUNK = /^(▢|☐|\s)*$|^(print|pin|save|jump to recipe|rate|review|servings?|prep time|cook time|total time|calories|course|cuisine|keyword|author|yield|units?|us customary|metric|1x|2x|3x|cups?|grams?|video|play|x)\s*:?\s*$|^\d+x$|^(advertisement|ad)$/i;
function cleanLine(l){ return String(l).replace(/[▢☐✓✔•●▪]/g, "").replace(/^\s*(?:[-*]|\d+[.)])\s+/, "").replace(/\s+/g, " ").trim(); }
function titleFromUrl(u){ try { const p = new URL(u).pathname.split("/").filter(Boolean).pop() || ""; return p.replace(/\.(html?|php)$/, "").replace(/[-_]+/g, " ").replace(/\b\w/g, c => c.toUpperCase()).trim(); } catch { return ""; } }
function readMinutes(text, label){
  const m = text.match(new RegExp(label + "\\s*:?\\s*(?:(\\d+)\\s*(?:hours?|hrs?|h)\\s*)?(?:(\\d+)\\s*(?:minutes?|mins?|m)\\b)?", "i"));
  if (!m || (!m[1] && !m[2])) return null; return (+(m[1]||0))*60 + (+(m[2]||0));
}
function parseRecipeText(text, url){
  const lines = String(text).split(/\r?\n/).map(l => l.trim());
  // recipe cards usually come last, so use the last Ingredients heading that has a steps heading after it
  let ingAt = -1, stepAt = -1;
  for (let i = lines.length - 1; i >= 0; i--){
    if (H_ING.test(cleanLine(lines[i]))){
      const s = lines.findIndex((l, j) => j > i && H_STEP.test(cleanLine(l)));
      if (s > i && s - i > 2){ ingAt = i; stepAt = s; break; }
    }
  }
  if (ingAt < 0) return null;
  // sections: a short line without numbers that ends with ":" or is Title Case and followed by items
  const isSection = (l, next) => l.length < 40 && !/\d/.test(l) && (/:$/.test(l) || (/^(for (the )?)/i.test(l))) && !!next;
  const ingredients = [{section:"", items:[]}];
  for (let i = ingAt + 1; i < stepAt; i++){
    const l = cleanLine(lines[i]); if (!l || JUNK.test(l)) continue;
    if (H_END.test(l) && !/^equipment/i.test(l)) continue;
    if (isSection(l, lines[i+1])){ ingredients.push({section: l.replace(/:$/, ""), items: []}); continue; }
    ingredients[ingredients.length-1].items.push(parseIng(l));
  }
  const steps = [{section:"", items:[]}], notes = [];
  let i = stepAt + 1, inNotes = false;
  for (; i < lines.length; i++){
    const l = cleanLine(lines[i]); if (!l || JUNK.test(l)) continue;
    if (H_NOTES.test(l)){ inNotes = true; continue; }
    if (H_END.test(l) && !H_NOTES.test(l)){ if (inNotes || steps.some(s => s.items.length)) break; else continue; }
    if (inNotes){ notes.push(l); if (notes.length > 12) break; continue; }
    if (isSection(l, lines[i+1]) || (/^[A-Z][A-Za-z &]+:$/.test(l))){ steps.push({section: l.replace(/:$/, ""), items: []}); continue; }
    if (l.length < 4) continue;
    steps[steps.length-1].items.push(l);
  }
  const ing = ingredients.filter(s => s.items.length), st = steps.filter(s => s.items.length);
  if (!ing.length) return null;
  const head = lines.slice(0, ingAt).join("\n");
  const sv = head.match(/(?:servings|serves|yield|makes)\s*:?\s*(\d+)\s*([a-z]*)/i);
  const flags = ["Read from the page text without Claude. Check the amounts, steps and section headings."];
  if (!st.length) flags.push("No steps were found. Add them, or paste the page again including the instructions.");
  return {title: titleFromUrl(url), ingredients: ing, steps: st, notes: notes.join("\n"),
    servings: sv ? +sv[1] : null, servingsUnit: sv && sv[2] && !/^(servings?|people|x)$/i.test(sv[2]) ? sv[2] : "servings",
    prepMin: readMinutes(head, "prep(?:aration)? time"), cookMin: readMinutes(head, "cook(?:ing)? time"), flags};
}

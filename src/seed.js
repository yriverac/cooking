const C=require('./core.js');const fs=require('fs');
const src=JSON.parse(fs.readFileSync('../data/recipes-from-doc.json'));
src.push({id:"creamy-meat-lasagna",title:"Creamy Meat Lasagna",category:"Dinner",source:"",servings:"12 squares",
ingredients:[{section:"",items:["2 to 2.5 lb ground beef, thawed","1 large onion, diced","6 to 8 garlic cloves, minced","½ cup red cooking wine (a large splash)","2 jars Rao’s marinara (24 oz each)","1 tbsp oregano","1 tbsp garlic powder","1 tsp paprika","Adobo, to taste","Salt and pepper, to taste","12 lasagna noodles (2 layers per pan), or 18 for three layers","1 to 1½ cups shredded Mexican cheese"]},
 {section:"Creamy layer",items:["16 oz cream cheese (2 bricks)","½ cup Lactaid milk or crema","1 cup grated Parmesan (or garlic parmesan seasoning plus extra salt)","1 egg","1 tsp garlic powder","Salt and pepper, to taste"]}],
steps:[{section:"",items:["Noodles: Boil in salted water until just shy of al dente, about 8 minutes. Rinse with cool water and lay flat on oiled foil.","Meat sauce: Brown the beef in a large skillet. Add the onion and cook until soft, then the garlic for 2 minutes. Pour in the wine and cook down 2 to 3 minutes. Season with adobo, oregano, garlic powder, paprika, salt and pepper. Add the marinara and simmer 15 minutes.","Creamy layer: Beat the cream cheese with the milk, Parmesan, egg, garlic powder, salt and pepper until smooth.","Assemble: Preheat oven to 375°F. In each pan: thin layer of sauce, noodles, sauce, creamy layer, noodles, sauce, creamy layer, then noodles and sauce. Top with shredded cheese.","Bake: Cover with foil for 30 minutes. Uncover and bake 10 to 15 more minutes until bubbling and lightly browned.","Rest 15 minutes before cutting."]}],
notes:["Makes two 9-inch square pans.","Freezing: Cool, cut into 6 squares per pan, and wrap individually. Freeze up to 3 months. Reheat from frozen at 350°F covered for about 30 minutes, or microwave with a splash of water."]});
// metadata: [cuisine, protein, freezer, fridgeDays, freezerMonths, prepMin, cookMin]
const M={
"coquito-tradicional":["Puerto Rican","",true,7,3,10,0],"coquito-de-nutella":["Puerto Rican","",true,7,3,10,0],"strawberry-lemonade":["American","",false,5,0,15,0],
"sorullitos":["Puerto Rican","",true,3,3,20,20],"strawberry-jam":["American","",true,14,6,10,20],"strawberry-shortcake-cake":["American","",false,3,0,40,22],
"banana-chocolate-chip-muffins":["American","",true,4,3,null,null],"brown-butter-chocolate-chip-nut-cookies-instagram":["American","",true,5,3,30,12],
"brown-butter-chocolate-chip-nut-cookies":["American","",true,5,3,30,11],"untitled-coconut-recipe":["Puerto Rican","",true,5,3,10,0],
"cream-cheese-danishes":["American","",false,3,0,40,18],"cake-box-cookies-and-cream-cookies":["American","",true,5,3,10,12],"cookies-and-cream-cookies":["American","",true,5,3,20,12],
"red-velvet-cookies":["American","",true,3,3,20,12],"red-velvet-cupcakes":["American","",true,2,2,20,25],"cream-cheese-frosting":["American","",true,4,2,10,0],"brownies":["American","",true,4,3,15,30],
"butter-chicken":["Indian","Chicken",true,4,3,null,null],"arroz-con-gandules":["Puerto Rican","",true,4,3,null,null],"sirloin-steak-with-creamy-mushroom-sauce":["American","Beef",false,3,0,10,20],
"pernil-puertorriqueno":["Puerto Rican","Pork",true,4,3,30,360],"ensalada-de-coditos":["Puerto Rican","Pork",false,4,0,20,15],"muslitos-estilo-abuela-zory":["Puerto Rican","Chicken",true,4,3,15,45],
"bacalaitos":["Puerto Rican","Fish",false,2,0,null,null],"french-onion-soup":["French","",true,4,4,10,85],"salsa-verde":["Mexican","",true,5,3,5,20],"al-pastor":["Mexican","Pork",true,4,3,30,60],
"birria":["Mexican","Beef",true,4,3,30,75],"arroz-mexicano":["Mexican","",true,4,3,null,null],"queso-del-pais":["Puerto Rican","",false,5,0,5,15],"creamy-meat-lasagna":["Italian","Beef",true,4,3,30,55]};
const now=new Date().toISOString();const out={};const report=[];
src.forEach((r,i)=>{const m=M[r.id];if(!m)throw r.id;
 const flags=[];
 // servings
 let sv=null,su="servings";const sm=String(r.servings||"").match(/^(\d+(?:\.\d+)?)(?:\s*-\s*\d+)?\s*(.*)$/);
 if(sm){sv=+sm[1];su=(sm[2]||"servings").trim();} else flags.push("Servings weren't in the doc. Add them to scale amounts.");
 const ingredients=(r.ingredients||[]).map(s=>({section:s.section||"",items:s.items.map(t=>C.parseIng(t))}));
 const noQty=ingredients.flatMap(s=>s.items).filter(x=>x.q==null&&!/to taste|a gusto|optional|al gusto|for garnish/i.test(x.n)&&!/^(sal|salt|pimienta|pepper|adobo|or[eé]gano|aceite|oil|agua|water|salt and pepper|aceite de ma[ií]z)\b/i.test(x.n)).map(x=>x.n);
 if(noQty.length) flags.push(`No amount for: ${noQty.slice(0,6).join(", ")}${noQty.length>6?` and ${noQty.length-6} more`:""}`);
 const nSteps=(r.steps||[]).reduce((a,s)=>a+s.items.length,0);
 if(!nSteps) flags.push("No instructions in the doc.");
 if(!ingredients.length) flags.push("No ingredients in the doc.");
 let notes=(r.notes||[]).filter(n=>!/^mild\.?$/i.test(n));
 if(r.id==="untitled-coconut-recipe") flags.push("The doc titled this as a cookie recipe, but the ingredients are a coconut drink or dessert. Give it the right name.");
 if(r.id==="butter-chicken"){ flags.push("Transcribed from screenshots in the doc. Double-check amounts."); notes=notes.filter(n=>!/Transcribed from screenshots/.test(n)); }
 
 const tags=[m[0],m[1],m[2]?"Freezer-friendly":""].filter(Boolean);
 out[r.id]={schema:2,title:r.title,category:r.category,source:r.source||"",servings:sv,servingsUnit:su,prepMin:m[5],cookMin:m[6],
  cuisine:m[0],protein:m[1],freezer:m[2],fridgeDays:m[3],freezerMonths:m[4],tags:[],
  ingredients,steps:(r.steps||[]).map(s=>({section:s.section||"",items:s.items})),notes:notes.join("\n\n"),equipment:r.equipment||[],
  photoUrl:"",photoId:"",favorite:false,flags,order:i,createdAt:now,updatedAt:now};
 report.push(`${r.id}: serv=${sv} ${su} | flags=${flags.length}`);
});
fs.writeFileSync('../data/recipes.json',JSON.stringify(out));
console.log(report.join('\n'));
// sample parse check
for(const id of ['creamy-meat-lasagna','arroz-con-gandules','french-onion-soup','birria']) out[id].ingredients.flatMap(s=>s.items).slice(0,8).forEach(x=>console.log('  ',JSON.stringify(x)));
const all=Object.values(out);
console.log('allergens:',all.map(r=>[r.title,C.allergenHits(r.ingredients.flatMap(s=>s.items).map(i=>C.ingText(i)))].filter(Boolean)).filter(x=>x[1].length).map(x=>x[0]+': '+x[1].map(h=>h.word).join(',')).join(' | '));
console.log('meats:',all.map(r=>r.title+'='+C.meatsIn(r.ingredients.flatMap(s=>s.items).map(i=>C.ingText(i))).join('+')).filter(x=>!x.endsWith('=')).join(' | '));

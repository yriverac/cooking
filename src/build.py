import json,re
core=open('core.js').read().split('if (typeof module')[0]+open('textparse.js').read()
app=open('app.js').read().replace('/*PART2*/', open('part2.js').read().replace('/*PART3*/', open('part3.js').read()))
seed={"recipes":json.load(open('../data/recipes.json')),"kitchen":json.load(open('../data/kitchen.json'))}
html=open('shell.html').read()
html=html.replace('/*SEED*/', json.dumps(seed,ensure_ascii=False).replace('</','<\\/')).replace('/*CORE*/', core).replace('/*APP*/', app)
open('../app/index.html','w').write(html)
open('all.js','w').write('(() => {"use strict";\n'+core+app+'\n})();')
print(len(html))

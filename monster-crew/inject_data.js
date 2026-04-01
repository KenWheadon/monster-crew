const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const dataJson = fs.readFileSync('data.json', 'utf8');

const injection = `<script id="game-data" type="application/json">\n${dataJson}\n</script>\n<script>`;

const newHtml = html.replace('<script>', injection).replace(
    /const response = await fetch\('data\.json'\);\s*const data = await response\.json\(\);/,
    "const data = JSON.parse(document.getElementById('game-data').textContent);"
);

fs.writeFileSync('index.html', newHtml, 'utf8');
console.log('Data injection complete.');

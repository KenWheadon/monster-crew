const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/g);
// The first one is now the JSON data block!
// Wait! inject_data.js appended <script id="game-data" type="application/json"> ... </script>\n<script> ... </script>
// So the actual JS is the SECOND script block!
for (const scriptTag of scriptMatch) {
    if (scriptTag.includes('function startGame()') || scriptTag.includes('let MONSTER_REGISTRY')) {
        let code = scriptTag.replace('<script>', '').replace('</script>', '');
        fs.writeFileSync('test_script.js', code);
    }
}
require('child_process').execSync('node -c test_script.js', { stdio: 'inherit' });

import os

html_path = 'index.html'
with open(html_path, 'r', encoding='utf-8') as f:
    html = f.read()

# 1. Add Ship Hub & Area Map HTML to game container
newUI = r"""
    <!-- NEW SHIP HUB & AREA MAP OVERLAYS -->
    <div id="ship-hub-view" style="display: none; position: absolute; width: 100%; height: 100%; z-index: 4000; background: url('images/bg-title.jpg') center/cover; flex-direction: column; align-items: center; justify-content: center; backdrop-filter: blur(10px);">
        <h1 style="color: var(--gold-color); font-size: 3em; margin-bottom: 30px; text-shadow: 0 0 20px rgba(0,0,0,1);">SHIP HUB</h1>
        <div id="hub-areas" style="display: flex; gap: 20px; flex-wrap: wrap; justify-content: center; max-width: 900px;"></div>
        <button class="btn-sec" onclick="openStore()" style="position: absolute; bottom: 30px; left: 30px; font-size: 1.5em; padding: 15px 30px;">UPGRADES</button>
        <button class="btn-sec" onclick="openGallery()" style="position: absolute; bottom: 30px; right: 30px; font-size: 1.5em; padding: 15px 30px;">GALLERY</button>
        <div class="trophy-counter" style="position: absolute; top: 15px; right: 30px;">
             🏆 <span id="hub-trophy-count">0</span>
        </div>
    </div>

    <div id="area-map-view" style="display: none; position: absolute; width: 100%; height: 100%; z-index: 4100; background: #000; overflow: hidden;">
        <div id="area-map-bg" style="position: absolute; width:100%; height:100%; background-size: cover; background-position: center; opacity: 0.4;"></div>
        <h2 id="area-map-title" style="position: absolute; top: 15px; left: 30px; color: var(--gold-color); z-index: 10; font-size: 2.5em; text-shadow: 0 0 10px #000;">AREA MAP</h2>
        <div id="area-map-nodes" style="position: absolute; width: 100%; height: 100%; z-index: 5;"></div>
        <button class="btn-sec" onclick="returnToHub()" style="position: absolute; top: 20px; right: 30px; z-index: 10; font-size: 1.2em;">Return to Hub</button>
    </div>
    
    <!-- NODE EVENT MODAL -->
    <div id="node-event-modal" class="modal" style="z-index: 5000;">
        <div class="modal-content text-center" style="max-width: 600px; padding: 30px;">
            <h2 id="node-event-title" style="color:var(--gold-color); font-size: 2em; margin-bottom: 20px;">NODE EVENT</h2>
            <div id="node-event-body" style="min-height: 150px; display: flex; justify-content: center; align-items: center; flex-direction: column; gap: 20px; color: white;"></div>
            <button class="btn-main" onclick="closeNodeEvent()" style="margin-top: 30px; width: 100%; font-size: 1.2em;">LEAVE NODE</button>
        </div>
    </div>
"""

if 'id="ship-hub-view"' not in html:
    html = html.replace('<div id="game-container">', '<div id="game-container">' + newUI)

# 2. Add Item Equipment UI
itemHUD = r"""
    <div id="item-hud" style="display: flex; align-items: center; gap: 10px; margin-left: 15px; background: rgba(0,0,0,0.5); padding: 5px 15px; border-radius: 20px; border: 1px solid var(--gold-color); cursor: pointer;" onclick="unequipItemPreview()">
        <span style="font-size: 0.8em; color: #aaa;">ITEM:</span>
        <span id="equipped-item-icon" style="font-size: 1.2em;">None</span>
    </div>
"""
if 'id="item-hud"' not in html:
    html = html.replace('<div style="display: flex; align-items: center; margin-left: auto;">', '<div style="display: flex; align-items: center; margin-left: auto;">' + itemHUD)

# 3. Add Globals
if 'let ITEMS_REGISTRY = []' not in html:
    html = html.replace('let KEYWORDS_REGISTRY = {};', 'let KEYWORDS_REGISTRY = {};\n        let ITEMS_REGISTRY = [];\n        let AREAS_REGISTRY = [];\n        let currentRun = { equippedItem: null, visitedNodes: [], currentArea: null, bossDefeated: false };')

if 'ITEMS_REGISTRY = data.items' not in html:
    html = html.replace('KEYWORDS_REGISTRY = data.keywords || {};', 'KEYWORDS_REGISTRY = data.keywords || {};\n                ITEMS_REGISTRY = data.items || [];\n                AREAS_REGISTRY = data.areas || [];')

# 4. Hub Logic Replacement
hubLogic = r"""
        function startGame() {
            document.getElementById('title-screen').style.display = 'none';
            enterShipHub();
        }

        function enterShipHub() {
            document.getElementById('area-map-view').style.display = 'none';
            document.getElementById('battle-view').style.display = 'none';
            document.getElementById('shop-phase').style.display = 'none';
            document.getElementById('ship-hub-view').style.display = 'flex';
            
            if (document.getElementById('hub-trophy-count')) {
                document.getElementById('hub-trophy-count').innerText = metaProgress.trophies;
            }

            const container = document.getElementById('hub-areas');
            container.innerHTML = '';
            
            let unlockedCount = metaProgress.unlockedCharacters.length;
            
            AREAS_REGISTRY.forEach((area, index) => {
                let isUnlocked = index <= unlockedCount;
                
                const btn = document.createElement('div');
                btn.style.width = '200px';
                btn.style.height = '150px';
                btn.style.background = isUnlocked ? `url('${area.background}') center/cover` : '#222';
                btn.style.border = isUnlocked ? '3px solid var(--gold-color)' : '3px solid #444';
                btn.style.borderRadius = '15px';
                btn.style.display = 'flex';
                btn.style.flexDirection = 'column';
                btn.style.justifyContent = 'center';
                btn.style.alignItems = 'center';
                btn.style.cursor = isUnlocked ? 'pointer' : 'not-allowed';
                btn.style.boxShadow = isUnlocked ? '0 0 20px rgba(0,0,0,0.8)' : 'none';
                btn.style.filter = isUnlocked ? 'none' : 'grayscale(1)';
                
                btn.innerHTML = `
                    <div style="background: rgba(0,0,0,0.7); padding: 10px; border-radius: 10px; text-align: center;">
                        <h3 style="margin:0; color: ${isUnlocked ? 'var(--gold-color)' : '#666'};">${area.name}</h3>
                        ${!isUnlocked ? '<span style="color:#e74c3c; font-size: 0.8em;">LOCKED</span>' : '<span style="color:#2ecc71; font-size: 0.8em;">OPEN</span>'}
                    </div>
                `;
                
                if (isUnlocked) {
                    btn.onclick = () => loadAreaMap(area.id);
                }
                container.appendChild(btn);
            });
        }
        
        function loadAreaMap(areaId) {
            document.getElementById('ship-hub-view').style.display = 'none';
            document.getElementById('area-map-view').style.display = 'block';
            const area = AREAS_REGISTRY.find(a => a.id === areaId);
            currentRun.currentArea = area;
            currentRun.visitedNodes = []; 
            currentRun.bossDefeated = false;
            
            // Default character context required for old systems
            let baseChar = CHARACTERS.find(c => c.id === 'vance');
            state.character = baseChar;
            state.hp = 2;
            state.gold = 3;
            state.round = 1;
            state.squad = [null, null, null, null, null];
            state.shopSize = 3;
            state.characters = [
                { id: baseChar.id, name: baseChar.name, icon: baseChar.icon, hp: 2, gold: 3, squad: state.squad }
            ];
            
            document.getElementById('area-map-bg').style.backgroundImage = `url('${area.background}')`;
            document.getElementById('area-map-title').innerText = area.name;
            const nodesContainer = document.getElementById('area-map-nodes');
            nodesContainer.innerHTML = '';
            
            // Draw connections
            const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            svg.style.position = 'absolute';
            svg.style.width = '100%';
            svg.style.height = '100%';
            svg.style.zIndex = '1';
            nodesContainer.appendChild(svg);
            
            area.nodes.forEach(node => {
                if (node.branchTo) {
                    node.branchTo.forEach(targetId => {
                        const target = area.nodes.find(n => n.id === targetId);
                        if (target) {
                            const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
                            line.setAttribute("x1", node.x + 30);
                            line.setAttribute("y1", node.y + 30);
                            line.setAttribute("x2", target.x + 30);
                            line.setAttribute("y2", target.y + 30);
                            line.setAttribute("stroke", "rgba(255, 215, 0, 0.4)");
                            line.setAttribute("stroke-width", "4");
                            svg.appendChild(line);
                        }
                    });
                }
                
                const btn = document.createElement('div');
                btn.id = 'node-' + node.id;
                btn.style.position = 'absolute';
                btn.style.left = node.x + 'px';
                btn.style.top = node.y + 'px';
                btn.style.width = '60px';
                btn.style.height = '60px';
                btn.style.borderRadius = '50%';
                btn.style.background = '#222';
                btn.style.border = '3px solid #fff';
                btn.style.display = 'flex';
                btn.style.justifyContent = 'center';
                btn.style.alignItems = 'center';
                btn.style.fontSize = '1.5em';
                btn.style.cursor = 'pointer';
                btn.style.zIndex = '10';
                btn.style.transition = '0.3s';
                
                // Icon mapping
                let icon = '❓';
                if (node.type === 'monster_shop') icon = '🛒';
                if (node.type === 'genetic_library') icon = '🧬';
                if (node.type === 'item_shop') icon = '💍';
                if (node.type === 'crew_quarters') icon = '👥';
                if (node.type === 'armory') icon = '⚔️';
                if (node.type === 'boss') icon = '💀';
                
                btn.innerHTML = icon;
                btn.onclick = () => visitNode(node);
                nodesContainer.appendChild(btn);
            });
        }
        
        function visitNode(node) {
            const btn = document.getElementById('node-' + node.id);
            if (currentRun.visitedNodes.includes(node.id)) {
                showToast("Already visited!");
                return;
            }
            
            currentRun.visitedNodes.push(node.id);
            btn.style.background = 'var(--gold-color)';
            btn.style.borderColor = 'var(--text-color)';
            
            if (node.type === 'boss') {
                triggerBossFight(currentRun.currentArea.captainId);
            } else if (node.type === 'monster_shop') {
                openNodeEvent("MONSTER SHOP", "Spend gold to hire crew.", () => {
                    document.getElementById('area-map-view').style.display = 'none';
                    document.getElementById('shop-phase').style.display = 'flex';
                    refreshShop();
                    updateUI();
                });
            } else if (node.type === 'item_shop') {
                triggerItemShop();
            } else if (node.type === 'genetic_library') {
                triggerGeneticLibrary();
            } else if (node.type === 'armory') {
                triggerArmory();
            } else if (node.type === 'crew_quarters') {
                triggerCrewQuarters();
            }
        }
        
        function openNodeEvent(title, desc, action) {
            document.getElementById('node-event-title').innerText = title;
            document.getElementById('node-event-body').innerHTML = `<p style="font-size:1.2em;">${desc}</p>`;
            
            const actionBtn = document.createElement('button');
            actionBtn.className = 'btn-main';
            actionBtn.innerText = 'ENTER';
            actionBtn.style.background = '#2ecc71';
            actionBtn.onclick = () => { closeNodeEvent(); action(); };
            document.getElementById('node-event-body').appendChild(actionBtn);
            
            document.getElementById('node-event-modal').style.display = 'flex';
        }

        function closeNodeEvent() {
            document.getElementById('node-event-modal').style.display = 'none';
        }
        
        function returnToHub() {
            document.getElementById('area-map-view').style.display = 'none';
            enterShipHub();
        }

        function triggerItemShop() {
            document.getElementById('node-event-title').innerText = "ITEM SHOP";
            let h = '<p>Purchase an item (Max 1 equipped).</p><div style="display:flex; gap:10px;">';
            
            // pick 2 random items
            let shuffled = [...ITEMS_REGISTRY].sort(()=>0.5-Math.random()).slice(0, 2);
            shuffled.forEach(item => {
                h += `
                    <div style="border:2px solid #555; padding:15px; border-radius:10px; width: 140px; background: rgba(0,0,0,0.5);">
                        <div style="font-size:2em;">${item.icon}</div>
                        <h4>${item.name}</h4>
                        <p style="font-size:0.8em; height:40px;">${item.desc}</p>
                        <button class="btn-sec" onclick="equipItem('${item.id}', 3)" style="margin-top:10px;">BUY (3 <img src='images/win-icon.png' class='icon-img'>)</button>
                    </div>
                `;
            });
            h += '</div>';
            document.getElementById('node-event-body').innerHTML = h;
            document.getElementById('node-event-modal').style.display = 'flex';
        }
        
        function triggerGeneticLibrary() {
            let owned = state.squad.filter(m => m);
            if (owned.length === 0) {
                openNodeEvent("GENETIC LIBRARY", "You have no monsters to clone!", () => {});
                return;
            }
            let clone = owned[Math.floor(Math.random() * owned.length)];
            let newClone = { ...clone, instId: Math.random() };
            let emptyIdx = state.squad.findIndex(m => !m);
            if (emptyIdx !== -1) {
                state.squad[emptyIdx] = newClone;
                openNodeEvent("GENETIC LIBRARY", `Cloned ${clone.name}!`, () => {});
            } else {
                openNodeEvent("GENETIC LIBRARY", `Cloned ${clone.name}, but squad is full!`, () => {});
            }
        }
        
        function triggerArmory() {
            let item = ITEMS_REGISTRY[Math.floor(Math.random() * ITEMS_REGISTRY.length)];
            openNodeEvent("ARMORY", `Found ${item.name}!`, () => { equipItem(item.id, 0); });
        }
        
        function triggerCrewQuarters() {
            let humans = MONSTER_REGISTRY.filter(m => m.type === 'Human' && metaProgress.unlockedCards.includes(m.id));
            if (humans.length === 0) humans = [MONSTER_REGISTRY.find(m => m.id === 'h1')];
            let recruit = humans[Math.floor(Math.random() * humans.length)];
            let emptyIdx = state.squad.findIndex(m => !m);
            if (emptyIdx !== -1) {
                state.squad[emptyIdx] = { ...recruit, instId: Math.random() };
                openNodeEvent("CREW QUARTERS", `Recruited ${recruit.name}!`, () => {});
            } else {
                openNodeEvent("CREW QUARTERS", `Met ${recruit.name}, but squad is full!`, () => {});
            }
        }

        function equipItem(itemId, cost) {
            if (state.gold < cost) {
                showToast("Not enough gold!");
                return;
            }
            state.gold -= cost;
            const item = ITEMS_REGISTRY.find(i => i.id === itemId);
            if (item) {
                currentRun.equippedItem = item;
                document.getElementById('equipped-item-icon').innerText = item.icon;
                showToast(`Equipped ${item.name}!`);
                closeNodeEvent();
                updateUI();
            }
        }
        
        function unequipItemPreview() {
            if (currentRun.equippedItem) {
                showToast(`Currently Equipped: ${currentRun.equippedItem.name}`);
            }
        }

        function triggerBossFight(captainId) {
            const boss = CHARACTERS.find(c => c.id === captainId);
            state.currentOpponent = {
                id: boss.id,
                name: boss.name,
                icon: boss.icon,
                squad: [] 
            };
            
            const bossCrews = CREWS_REGISTRY.filter(c => c.type === boss.type && c.minRound >= 5);
            const chosenCrew = bossCrews.length > 0 ? bossCrews[Math.floor(Math.random() * bossCrews.length)] : CREWS_REGISTRY[0];
            
            if (chosenCrew) {
                state.currentOpponent.squad = chosenCrew.monsters.map(id => {
                    const m = MONSTER_REGISTRY.find(m => m.id === id);
                    return m ? { ...m, cAtk: m.atk, cHp: m.hp, instId: Math.random() } : null;
                });
            }
            
            document.getElementById('area-map-view').style.display = 'none';
            document.getElementById('shop-phase').style.display = 'none';
            document.getElementById('battle-view').style.display = 'flex';
            
            updateUI();
            executeBattle(); 
        }

        function executeBattle() {
"""

html = html.replace("function startGame() {", hubLogic + "\n// [Skipped old] function OLD_startGame() {")


# 5. Fix unlocking checks in getAvailableMonsters
unlocksLogic = r"""
        function getAvailableMonsters(tier) {
            return MONSTER_REGISTRY.filter(m => {
                if (m.tier !== tier) return false;
                if (m.id === 'h1') return true; // Crew always unlocked
                
                const isCardUnlocked = metaProgress.unlockedCards.includes(m.id);
                if (!isCardUnlocked) return false;

                const matchingCaptain = CHARACTERS.find(c => c.type === m.type);
                if (matchingCaptain && metaProgress.unlockedCharacters.includes(matchingCaptain.id)) {
                    return true;
                }
                return matchingCaptain ? false : true;
            });
        }
"""
import re
html = re.sub(r"function getAvailableMonsters\(tier\) \{[\s\S]*?\}", unlocksLogic.strip(), html, count=1)


# 6. Apply Item combat logic hooks
itemCombatHookSetup = r"""
        function executeBattle() {
            // Apply Equippable Item Combat Hooks
            if (currentRun.equippedItem) {
                const item = currentRun.equippedItem;
                if (item.effect === 'surviveHitBuff') {
                    // Handled inside takeDamage or clash
                }
            }
"""
html = html.replace('function executeBattle() {', itemCombatHookSetup)


# 7. Add Battle Victory hooking (return to hub)
winHook = r"""
                if (state.currentOpponent) {
                    let capId = state.currentOpponent.id;
                    if (!metaProgress.unlockedCharacters.includes(capId)) {
                        metaProgress.unlockedCharacters.push(capId);
                        showToast(`Unlocked Captain: ${state.currentOpponent.name}!`);
                    }
                }
                setTimeout(() => {
                    document.getElementById('battle-result-modal').style.display = 'flex';
                    document.getElementById('battle-result-title').innerText = 'BOSS DEFEATED!';
                    document.getElementById('battle-result-desc').innerText = `Trophies +10\nDefeated ${state.currentOpponent.name}!`;
                    metaProgress.trophies += 10;
                    saveProgress();
                }, 1000);
"""
html = html.replace("document.getElementById('battle-result-modal').style.display = 'flex';", winHook)

# 8. Hide the old "Fight!" footer and just replace it with "Return" in node map
# We just hide it initially, and when they enter the shop node, they see it, but we rename it to "Return to Area Map"
footerUpdate = r"""
                document.getElementById('shop-phase').style.display = 'none';
                document.getElementById('area-map-view').style.display = 'block';
"""
html = html.replace("startBattle()", "document.getElementById('shop-phase').style.display='none'; document.getElementById('area-map-view').style.display='block';")

with open(html_path, 'w', encoding='utf-8') as f:
    f.write(html)
"""

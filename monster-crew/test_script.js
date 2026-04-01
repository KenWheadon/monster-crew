
        let MONSTER_REGISTRY = [];
        let UPGRADES_REGISTRY = [];
        let TIER_NAMES = [];
        let TIER_COLORS = {};
        let SHOP_LEVEL_WEIGHTS = [];
        let CHARACTERS = [];
        let CREWS_REGISTRY = [];
        let KEYWORDS_REGISTRY = {};
        let ITEMS_REGISTRY = [];
        let AREAS_REGISTRY = [];
        let currentRun = { equippedItem: null, visitedNodes: [], currentArea: null, bossDefeated: false };

        function getKeywordDefaultValue(effectBase) {
            return (KEYWORDS_REGISTRY[effectBase] || {}).default || 0;
        }

        function getEffectDescription(monster) {
            if (!monster.effect) return "";
            let base = monster.effect.split(":")[0];
            if (base.startsWith("Aura")) base = "Aura";
            
            let kw = KEYWORDS_REGISTRY[base];
            if (!kw || !kw.template) return monster.effect;
            
            let valStr = monster.effect.split(":")[1] || "";
            let vals = valStr.split("/");
            let text = kw.template;
            
            text = text.replace(/\{X\}/g, vals[0] || kw.default || 0);
            text = text.replace(/\{Y\}/g, vals[1] || vals[0] || kw.default || 0);
            text = text.replace(/\{Type\}/g, monster.type);
            
            if (base === "Aura") {
                if (monster.effect.toLowerCase().includes("hp")) {
                    text = text.replace(/\{Y\}/g, "HP");
                } else {
                    text = text.replace(/\{Y\}/g, "Attack");
                }
            }
            return text;
        }

        async function loadData() {
            try {
                const data = JSON.parse(document.getElementById('game-data').textContent);
                MONSTER_REGISTRY = data.monsters;
                UPGRADES_REGISTRY = data.upgrades;
                TIER_NAMES = data.tierNames;
                TIER_COLORS = data.tierColors;
                SHOP_LEVEL_WEIGHTS = data.shopLevelWeights;
                CHARACTERS = data.characters;
                CREWS_REGISTRY = data.crews || [];
                KEYWORDS_REGISTRY = data.keywords || {};
                ITEMS_REGISTRY = data.items || [];
                AREAS_REGISTRY = data.areas || [];
                
                MONSTER_REGISTRY.forEach(m => {
                    m.effectDesc = getEffectDescription(m);
                });
            } catch (error) {
                console.error("Error loading data.json:", error);
            }
        }




        let metaProgress = {
            trophies: 0,
            unlockedCards: ["h1"],
            unlockedCharacters: ["vance"],
            heroWins: {},   // [heroId]: total wins against them
            heroFights: {}, // [heroId]: total fights against them
            runsFinished: 0,
            tutorialRewardSeen: false,
            purchasedUpgrades: [],
            achievements: {}
        };

        let combatSpeed = 1;
        function setCombatSpeed(speed) {
            combatSpeed = speed;
            document.querySelectorAll('.speed-btn').forEach(btn => {
                btn.classList.toggle('active', parseFloat(btn.innerText) === speed);
            });
            logHistory(`Combat speed set to ${speed}x`);
        }

        let runStats = {
            buys: { Human: 0, Beast: 0, Genetic: 0, Mech: 0, Nature: 0, Cosmic: 0 },
            sells: { Human: 0, Beast: 0, Genetic: 0, Mech: 0, Nature: 0, Cosmic: 0 },
            merges: 0,
            effectTriggers: { Honor: 0, Anger: 0, Weak: 0, Extra: 0, Team: 0, Solo: 0, Twin: 0, Cheap: 0 },
            maxGold: 0,
            tokensSummoned: 0,
            trophiesEarned: 0
        };

        const ACHIEVEMENT_DEFINITIONS = [
            { id: "first_win", name: "First Voyage", desc: "Win your first game.", check: (s, win) => win },
            { id: "shop_regular", name: "Shop Regular", desc: "Buy 100 cards across all runs.", check: (s) => false, isMeta: true }, // Meta achievements handled separately
            { id: "vance_human_buys", name: "Crew's Best Friend", desc: "Buy 20 Humans in one run.", check: (s) => s.buys.Human >= 20 },
            { id: "mrat_beast_sells", name: "Rat Pack Leader", desc: "Sell 15 Beasts in one run.", check: (s) => s.sells.Beast >= 15 },
            { id: "pete_nature_deaths", name: "Thorny Revenge", desc: "Trigger Weak 20 times in one game.", check: (s) => s.effectTriggers.Weak >= 20 },
            { id: "pancake_tokens", name: "Pancake Stack", desc: "Summon 30 tokens in one run.", check: (s) => s.tokensSummoned >= 30 },
            { id: "brain_merges", name: "Gene Splicer", desc: "Perform 10 merges in one run.", check: (s) => s.merges >= 10 },
            { id: "dread_anger", name: "Dread Awakening", desc: "Trigger Anger 20 times in one game.", check: (s) => s.effectTriggers.Anger >= 20 }
        ];

        function loadProgress() {
            const saved = localStorage.getItem('monster_crew_progress');
            if (saved) {
                const parsed = JSON.parse(saved);
                metaProgress = { ...metaProgress, ...parsed };
                // Ensure legacy support
                if (!metaProgress.heroWins) metaProgress.heroWins = {};
                if (!metaProgress.heroFights) metaProgress.heroFights = {};
                if (metaProgress.runsFinished === undefined) metaProgress.runsFinished = 0;
                if (metaProgress.tutorialRewardSeen === undefined) metaProgress.tutorialRewardSeen = false;
                if (!metaProgress.unlockedCards) metaProgress.unlockedCards = ["h1"];
                if (!metaProgress.unlockedCharacters) metaProgress.unlockedCharacters = ["vance"];
            }
            updateTrophyDisplay();
            checkOnboarding();
            checkTutorial();
        }

        function checkTutorial() {
            // If they finished run 1 and haven't seen the reward modal yet
            if (metaProgress.runsFinished >= 1 && !metaProgress.tutorialRewardSeen) {
                // Free gift: Recruit!
                const cards = new Set(metaProgress.unlockedCards || ["h1"]);
                cards.add("h1b");
                metaProgress.unlockedCards = Array.from(cards);
                
                // Show the modal (already in HTML)
                const modal = document.getElementById('tutorial-reward-modal');
                if (modal) modal.style.display = 'flex';
                
                // Add pulse effect to Store button to guide the user
                const storeBtns = document.querySelectorAll('button[onclick="openStore()"]');
                storeBtns.forEach(btn => btn.classList.add('pulse'));
            }
        }

        function dismissTutorialReward() {
            metaProgress.tutorialRewardSeen = true;
            saveProgress();
            const modal = document.getElementById('tutorial-reward-modal');
            if (modal) modal.style.display = 'none';
            openStore();
        }

        function checkOnboarding() {
            const isFirstRun = metaProgress.runsFinished === 0;
            const defaultView = document.getElementById('title-default-view');
            const onboardingView = document.getElementById('title-onboarding-view');
            
            if (isFirstRun && CHARACTERS) {
                defaultView.style.display = 'none';
                onboardingView.style.display = 'flex';
                
                const vance = CHARACTERS.find(c => c.id === 'vance');
                if (vance) {
                    document.getElementById('onboarding-char-preview').innerHTML = `
                        <div class="char-icon" style="margin: 0 auto 10px;">${vance.icon}</div>
                        <div style="font-weight: bold; font-size: 1.2em;">${vance.name}</div>
                        <div style="font-size: 0.9em; color: #ccc; margin-top: 5px;">${vance.desc}</div>
                    `;
                }
            } else {
                defaultView.style.display = 'block';
                onboardingView.style.display = 'none';
            }
        }

        function saveProgress() {
            localStorage.setItem('monster_crew_progress', JSON.stringify(metaProgress));
            updateTrophyDisplay();
        }

        function updateTrophyDisplay() {
            if (document.getElementById('main-trophy-count'))
                document.getElementById('main-trophy-count').innerText = metaProgress.trophies;
            if (document.getElementById('store-trophy-count'))
                document.getElementById('store-trophy-count').innerText = metaProgress.trophies;
            if (document.getElementById('selection-trophy-count'))
                document.getElementById('selection-trophy-count').innerText = metaProgress.trophies;

            // Updated Progress Bar logic
            const milestones = [10, 25, 50, 100, 250, 500, 1000];
            const currentTrophies = metaProgress.trophies;
            let nextMilestone = milestones.find(m => m > currentTrophies) || milestones[milestones.length-1] + 500;
            let prevMilestone = milestones[milestones.indexOf(nextMilestone)-1] || 0;
            
            const progress = ((currentTrophies - prevMilestone) / (nextMilestone - prevMilestone)) * 100;
            const fill = document.getElementById('trophy-progress-fill');
            const label = document.getElementById('trophy-next-milestone-label');
            
            if (label) label.innerText = `NEXT REWARD AT ${nextMilestone} 🏆 (${nextMilestone - currentTrophies} LEFT)`;
            
            // Onboarding Tips
            const tipEl = document.getElementById('onboarding-tip');
            if (tipEl) {
                if (state.round === 1) tipEl.innerText = "TIP: Buy 'Team' cards to buff your squad! Try for 3 of a kind to Merge!";
                else if (state.round === 3) tipEl.innerText = "TIP: New effects discovered! Look for 'Twin' and 'Extra' cards now.";
                else if (state.round === 5) tipEl.innerText = "TIP: Tactical round! Use 'Weak' to permanently nerf opponent crews.";
                else tipEl.innerText = "";
            }
        }

        function addTestTrophies() {
            metaProgress.trophies += 100;
            saveProgress();
            logHistory("DEBUG: Gained 100 Trophies via Test Button");
            renderCharacterSelection();
        }





        let battleHistory = [];

        function logHistory(msg) {
            const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            battleHistory.push(`[${time}] ${msg}`);
            if (battleHistory.length > 200) battleHistory.shift(); // Cap logs
        }

        function openHistory() {
            const container = document.getElementById('history-content');
            container.innerHTML = battleHistory.length === 0 ? '<div style="color:#666; text-align:center;">No history recorded yet.</div>' : 
                battleHistory.map(log => `<div>${log}</div>`).join('');
            document.getElementById('history-modal').style.display = 'flex';
            container.scrollTop = container.scrollHeight;
        }

        function closeHistory() {
            document.getElementById('history-modal').style.display = 'none';
        }

        function clearHistory() {
            battleHistory = [];
            openHistory();
        }

        let state = {
            round: 1, gold: 5, hp: 10, 
            shopLevel: 1,
            squad: [null, null, null, null, null],
            shop: [null, null, null],
            squadSize: 5,
            shopSize: 3,
            isPaused: false,
            currentlyInspecting: null,
            character: null,
            characters: null,
            currentOpponent: null
        };



        function renderCharacterSelection() {
            const list = document.getElementById('character-list');
            list.innerHTML = '';
            CHARACTERS.forEach(char => {
                const isUnlocked = metaProgress.unlockedCharacters.includes(char.id);
                const fights = metaProgress.heroFights[char.id] || 0;
                const wins = metaProgress.heroWins[char.id] || 0;
                
                // Formula: 1000 - (fights * 50) - (wins * 50)
                const cost = Math.max(0, 1000 - (fights * 50) - (wins * 50));
                const canAfford = metaProgress.trophies >= cost;

                const div = document.createElement('div');
                div.className = `char-card ${isUnlocked ? '' : 'locked'}`;
                
                let progressText = "";
                if (!isUnlocked) {
                    progressText = `
                        <div style="font-size: 0.85em; margin-top: 10px; color: var(--gold-color);">
                            STATS: ${fights} FIGHTS / ${wins} WINS
                        </div>
                        <div class="item-price ${canAfford ? '' : 'disabled'}" onclick="unlockCharacterFromSelection(event, '${char.id}', ${cost})" style="margin-top: 10px; padding: 10px; font-size: 1em;">
                            UNLOCK: 🏆 ${cost}
                        </div>
                    `;
                }

                div.innerHTML = `
                    <div class="char-icon" style="${isUnlocked ? '' : 'filter: grayscale(1) opacity(0.5);'}">${char.icon}</div>
                    <div class="char-title">${char.name} ${isUnlocked ? '' : '🔒'}</div>
                    <div class="char-desc">${isUnlocked ? char.desc : "Unlock this character to lead your crew!"}</div>
                    ${progressText}
                `;
                if (isUnlocked) div.onclick = () => selectCharacter(char);
                else div.style.cursor = 'default';
                list.appendChild(div);
            });
        }

        function unlockCharacterFromSelection(event, id, cost) {
            event.stopPropagation();
            if (metaProgress.trophies >= cost && !metaProgress.unlockedCharacters.includes(id)) {
                metaProgress.trophies -= cost;
                metaProgress.unlockedCharacters.push(id);
                saveProgress();
                renderCharacterSelection();
                showToast("Character Unlocked!");
            } else if (metaProgress.trophies < cost) {
                showToast("Not enough trophies!");
            }
        }

                function startGame() {
            document.getElementById("title-screen").style.display = "none";
            enterShipHub();
        }
        function enterShipHub() {
            document.getElementById("area-map-view").style.display = "none";
            document.getElementById("battle-view").style.display = "none";
            document.getElementById("shop-phase").style.display = "none";
            document.getElementById("ship-hub-view").style.display = "flex";
            if (document.getElementById("hub-trophy-count")) {
                document.getElementById("hub-trophy-count").innerText = metaProgress.trophies;
            }
            const container = document.getElementById("hub-areas");
            container.innerHTML = "";
            let unlockedCount = metaProgress.unlockedCharacters.length;
            AREAS_REGISTRY.forEach((area, index) => {
                let isUnlocked = index <= unlockedCount;
                const btn = document.createElement("div");
                btn.style.width = "200px";
                btn.style.height = "150px";
                btn.style.background = isUnlocked ? "url('" + area.background + "') center/cover" : "#222";
                btn.style.border = isUnlocked ? "3px solid var(--gold-color)" : "3px solid #444";
                btn.style.borderRadius = "15px";
                btn.style.display = "flex";
                btn.style.flexDirection = "column";
                btn.style.justifyContent = "center";
                btn.style.alignItems = "center";
                btn.style.cursor = isUnlocked ? "pointer" : "not-allowed";
                btn.style.boxShadow = isUnlocked ? "0 0 20px rgba(0,0,0,0.8)" : "none";
                btn.style.filter = isUnlocked ? "none" : "grayscale(1)";
                btn.innerHTML = "<div style='background: rgba(0,0,0,0.7); padding: 10px; border-radius: 10px; text-align: center;'><h3 style='margin:0; color:" + (isUnlocked ? "var(--gold-color)" : "#666") + ";'>" + area.name + "</h3>" + (!isUnlocked ? "<span style='color:#e74c3c; font-size: 0.8em;'>LOCKED</span>" : "<span style='color:#2ecc71; font-size: 0.8em;'>OPEN</span>") + "</div>";
                if (isUnlocked) {
                    btn.onclick = () => loadAreaMap(area.id);
                }
                container.appendChild(btn);
            });
        }
        function loadAreaMap(areaId) {
            document.getElementById("ship-hub-view").style.display = "none";
            document.getElementById("area-map-view").style.display = "block";
            const area = AREAS_REGISTRY.find(a => a.id === areaId);
            currentRun.currentArea = area;
            currentRun.visitedNodes = []; 
            currentRun.bossDefeated = false;
            let baseChar = CHARACTERS.find(c => c.id === "vance");
            state.character = baseChar;
            state.hp = 2;
            state.gold = 3;
            state.round = 1;
            state.squad = [null, null, null, null, null];
            state.shopSize = 3;
            state.characters = [
                { id: baseChar.id, name: baseChar.name, icon: baseChar.icon, hp: 2, gold: 3, squad: state.squad }
            ];
            document.getElementById("area-map-bg").style.backgroundImage = "url('" + area.background + "')";
            document.getElementById("area-map-title").innerText = area.name;
            const nodesContainer = document.getElementById("area-map-nodes");
            nodesContainer.innerHTML = "";
            const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            svg.style.position = "absolute";
            svg.style.width = "100%";
            svg.style.height = "100%";
            svg.style.zIndex = "1";
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
                const btn = document.createElement("div");
                btn.id = "node-" + node.id;
                btn.style.position = "absolute";
                btn.style.left = node.x + "px";
                btn.style.top = node.y + "px";
                btn.style.width = "60px";
                btn.style.height = "60px";
                btn.style.borderRadius = "50%";
                btn.style.background = "#222";
                btn.style.border = "3px solid #fff";
                btn.style.display = "flex";
                btn.style.justifyContent = "center";
                btn.style.alignItems = "center";
                btn.style.fontSize = "1.5em";
                btn.style.cursor = "pointer";
                btn.style.zIndex = "10";
                btn.style.transition = "0.3s";
                let icon = "❓";
                if (node.type === "monster_shop") icon = "🛒";
                if (node.type === "genetic_library") icon = "🧬";
                if (node.type === "item_shop") icon = "💍";
                if (node.type === "crew_quarters") icon = "👥";
                if (node.type === "armory") icon = "⚔️";
                if (node.type === "boss") icon = "💀";
                btn.innerHTML = icon;
                btn.onclick = () => visitNode(node);
                nodesContainer.appendChild(btn);
            });
        }
        function visitNode(node) {
            const btn = document.getElementById("node-" + node.id);
            if (currentRun.visitedNodes.includes(node.id)) {
                showToast("Already visited!");
                return;
            }
            currentRun.visitedNodes.push(node.id);
            btn.style.background = "var(--gold-color)";
            btn.style.borderColor = "var(--text-color)";
            if (node.type === "boss") {
                triggerBossFight(currentRun.currentArea.captainId);
            } else if (node.type === "monster_shop") {
                openNodeEvent("MONSTER SHOP", "Spend gold to hire crew.", () => {
                    document.getElementById("area-map-view").style.display = "none";
                    document.getElementById("shop-phase").style.display = "flex";
                    refreshShop();
                    updateUI();
                });
            } else if (node.type === "item_shop") {
                triggerItemShop();
            } else if (node.type === "genetic_library") {
                triggerGeneticLibrary();
            } else if (node.type === "armory") {
                triggerArmory();
            } else if (node.type === "crew_quarters") {
                triggerCrewQuarters();
            }
        }
        function openNodeEvent(title, desc, action) {
            document.getElementById("node-event-title").innerText = title;
            document.getElementById("node-event-body").innerHTML = "<p style='font-size:1.2em;'>" + desc + "</p>";
            const actionBtn = document.createElement("button");
            actionBtn.className = "btn-main";
            actionBtn.innerText = "ENTER";
            actionBtn.style.background = "#2ecc71";
            actionBtn.onclick = () => { closeNodeEvent(); action(); };
            document.getElementById("node-event-body").appendChild(actionBtn);
            document.getElementById("node-event-modal").style.display = "flex";
        }
        function closeNodeEvent() {
            document.getElementById("node-event-modal").style.display = "none";
        }
        function returnToHub() {
            document.getElementById("area-map-view").style.display = "none";
            enterShipHub();
        }
        function triggerItemShop() {
            document.getElementById("node-event-title").innerText = "ITEM SHOP";
            let h = "<p>Purchase an item (Max 1 equipped).</p><div style='display:flex; gap:10px;'>";
            let shuffled = [...ITEMS_REGISTRY].sort(()=>0.5-Math.random()).slice(0, 2);
            shuffled.forEach(item => {
                h += "<div style='border:2px solid #555; padding:15px; border-radius:10px; width: 140px; background: rgba(0,0,0,0.5);'>";
                h += "<div style='font-size:2em;'>" + item.icon + "</div>";
                h += "<h4>" + item.name + "</h4>";
                h += "<p style='font-size:0.8em; height:40px;'>" + item.desc + "</p>";
                h += "<button class='btn-sec' onclick='equipItem(\"" + item.id + "\", 3)' style='margin-top:10px;'>BUY (3 ゴールド)</button>";
                h += "</div>";
            });
            h += "</div>";
            document.getElementById("node-event-body").innerHTML = h;
            document.getElementById("node-event-modal").style.display = "flex";
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
                openNodeEvent("GENETIC LIBRARY", "Cloned " + clone.name + "!", () => {});
            } else {
                openNodeEvent("GENETIC LIBRARY", "Cloned " + clone.name + ", but squad is full!", () => {});
            }
        }
        function triggerArmory() {
            let item = ITEMS_REGISTRY[Math.floor(Math.random() * ITEMS_REGISTRY.length)];
            openNodeEvent("ARMORY", "Found " + item.name + "!", () => { equipItem(item.id, 0); });
        }
        function triggerCrewQuarters() {
            let humans = MONSTER_REGISTRY.filter(m => m.type === "Human" && metaProgress.unlockedCards.includes(m.id));
            if (humans.length === 0) humans = [MONSTER_REGISTRY.find(m => m.id === "h1")];
            let recruit = humans[Math.floor(Math.random() * humans.length)];
            let emptyIdx = state.squad.findIndex(m => !m);
            if (emptyIdx !== -1) {
                state.squad[emptyIdx] = { ...recruit, instId: Math.random() };
                openNodeEvent("CREW QUARTERS", "Recruited " + recruit.name + "!", () => {});
            } else {
                openNodeEvent("CREW QUARTERS", "Met " + recruit.name + ", but squad is full!", () => {});
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
                document.getElementById("equipped-item-icon").innerText = item.icon;
                showToast("Equipped " + item.name + "!");
                closeNodeEvent();
                updateUI();
            }
        }
        function unequipItemPreview() {
            if (currentRun.equippedItem) {
                showToast("Currently Equipped: " + currentRun.equippedItem.name);
            }
        }
        function triggerBossFight(captainId) {
            const boss = CHARACTERS.find(c => c.id === captainId);
            state.currentOpponent = { id: boss.id, name: boss.name, icon: boss.icon, squad: [] };
            const bossCrews = CREWS_REGISTRY.filter(c => c.type === boss.type && c.minRound >= 5);
            const chosenCrew = bossCrews.length > 0 ? bossCrews[Math.floor(Math.random() * bossCrews.length)] : CREWS_REGISTRY[0];
            if (chosenCrew) {
                state.currentOpponent.squad = chosenCrew.monsters.map(id => {
                    const m = MONSTER_REGISTRY.find(m => m.id === id);
                    return m ? { ...m, cAtk: m.atk, cHp: m.hp, instId: Math.random() } : null;
                });
            }
            document.getElementById("area-map-view").style.display = "none";
            document.getElementById("shop-phase").style.display = "none";
            document.getElementById("battle-view").style.display = "flex";
            updateUI();
            executeBattle();
        }
// [Skipped old] function OLD_startGame() {
            const isFirstTime = metaProgress.runsFinished === 0;
            
            if (isFirstTime) {
                document.getElementById('title-screen').style.display = 'none';
                const vance = CHARACTERS.find(c => c.id === 'vance');
                selectCharacter(vance);
            } else {
                document.getElementById('title-screen').style.display = 'none';
                document.getElementById('character-select-modal').style.display = 'flex';
                updateTrophyDisplay();
                renderCharacterSelection();
            }
        }

        function selectCharacter(char) {
            state.character = char;
            
            // HP Overhaul: Everyone starts with 2 HP
            let startHP = 2;
            let startGold = 5;

            if (metaProgress.purchasedUpgrades.includes("gold_1")) startGold += 5;
            if (metaProgress.purchasedUpgrades.includes("gold_2")) startGold += 10;
            // HP meta-upgrades disabled or scaled for faster play?
            // User said "everyone starts with 2 hp", so we ignore hp upgrades for now.

            state.hp = startHP;
            state.gold = startGold;
            state.round = 1;
            state.squadSize = 5;
            state.shopSize = 3;
            state.squad = [null, null, null, null, null];
            state.shop = [null, null, null];
            
            // Reset Run Stats
            runStats = {
                buys: { Human: 0, Beast: 0, Genetic: 0, Mech: 0, Nature: 0, Cosmic: 0 },
                sells: { Human: 0, Beast: 0, Genetic: 0, Mech: 0, Nature: 0, Cosmic: 0 },
                merges: 0,
                effectTriggers: { Honor: 0, Anger: 0, Weak: 0, Extra: 0, Team: 0, Solo: 0, Twin: 0, Cheap: 0, Shield: 0, Thorn: 0 },
                maxGold: 0,
                tokensSummoned: 0,
                trophiesEarned: 0
            };

            const isFirstRun = metaProgress.runsFinished === 0;
            const startingRoster = isFirstRun ? 
                CHARACTERS.filter(c => c.id === 'vance' || c.id === 'mrat') : 
                CHARACTERS;

            state.characters = startingRoster.map(c => ({
                id: c.id,
                name: c.name,
                icon: c.icon,
                typeWeights: c.typeWeights,
                hp: 2, // AI starts with 2 HP
                gold: startGold,
                squad: [null, null, null, null, null]
            }));

            // Sync players starting stats to the state copy
            const myChar = state.characters.find(c => c.id === char.id);
            myChar.hp = state.hp;
            myChar.gold = state.gold;

            document.getElementById('character-select-modal').style.display = 'none';
            refreshShop();
            simulateAITurns();
            updateUI();
        }

        let battleData = { ally: [], enemy: [] };

        /**
         * CORE ENGINE
         */
        /**
         * TUTORIAL & GLOSSARY
         */
        function openGlossary() { 
            const glossaryContent = document.getElementById('glossary-content');
            if (glossaryContent.innerHTML.trim() === '') {
                for (const key in KEYWORDS_REGISTRY) {
                    const kw = KEYWORDS_REGISTRY[key];
                    const p = document.createElement('p');
                    p.innerHTML = `<b style="color: ${kw.color || 'white'};">${key}:</b> ${kw.desc}`;
                    glossaryContent.appendChild(p);
                }
            }
            document.getElementById('glossary-modal').style.display = 'flex'; 
        }
        function closeGlossary() { document.getElementById('glossary-modal').style.display = 'none'; }

        let tutorialStep = 0;
        const tutorialSteps = [
            { title: "BUILD YOUR CREW", text: "Buy cards from the shop to build your squad. Each card has a Type and a unique Effect!" },
            { title: "SYNERGIES", text: "Cards of the same type often buff each other. Watch your Squad Summary Bar for active synergies!" },
            { title: "POWER UP", text: "Collect 3 of the same card to merge them into a higher level version with combined stats!" },
            { title: "FIGHT!", text: "Once you're ready, click 'Fight!' to battle an opponent. If you win, you'll earn trophies and progress!" }
        ];

        function checkTutorial() {
            if (!localStorage.getItem('monster_crew_tutorial_seen')) {
                showTutorial();
            }
        }

        function showTutorial() {
            tutorialStep = 0;
            updateTutorialStep();
            document.getElementById('tutorial-overlay').style.display = 'flex';
        }

        function nextTutorial() {
            tutorialStep++;
            if (tutorialStep >= tutorialSteps.length) {
                document.getElementById('tutorial-overlay').style.display = 'none';
                localStorage.setItem('monster_crew_tutorial_seen', 'true');
            } else {
                updateTutorialStep();
            }
        }

        function updateTutorialStep() {
            const step = tutorialSteps[tutorialStep];
            document.getElementById('tutorial-title').innerText = step.title;
            document.getElementById('tutorial-text').innerText = step.text;
        }

        async function init() {
            await loadData();
            loadProgress();
            updateUI();
            checkTutorial(); // Check tutorial on start
        }

        function syncToSquad(clonedMonster, stat, amount, side = 'ally', source = 'Combat Effect') {
            if (!clonedMonster || !clonedMonster.instId) return;
            
            // Update the clone for the inspector during battle
            if (!clonedMonster.modifiers) clonedMonster.modifiers = [];
            clonedMonster.modifiers.push({ name: source, atk: stat === 'atk' ? amount : 0, hp: stat === 'hp' ? amount : 0 });

            let squad = null;
            if (side === 'ally') squad = state.squad;
            else if (side === 'enemy' && state.currentOpponent) {
                let ai = state.characters.find(c => c.id === state.currentOpponent.id);
                if (ai) squad = ai.squad;
            }
            if (squad) {
                const original = squad.find(s => s && s.instId === clonedMonster.instId);
                if (original) {
                    original[stat] += amount;
                    if (original[stat] < 1) original[stat] = 1; // Min stat is 1
                    
                    // Track permanent modifiers from battle (e.g. Weak effect)
                    if (!original.modifiers) original.modifiers = [];
                    original.modifiers.push({ name: source, atk: stat === 'atk' ? amount : 0, hp: stat === 'hp' ? amount : 0 });

                    // Sync combat properties if they exist
                    if (stat === 'atk') original.cAtk = original.atk;
                    if (stat === 'hp') original.cHp = original.hp;
                }
            }
        }

        function scaleEffectValue(effectStr, level) {
            if (!effectStr) return "";
            // Regex to find numbers after : or / (e.g. Team:1, Extra:1/1, Weak:1)
            // We want to multiply these values by the level
            return effectStr.replace(/(\d+)/g, (match) => {
                return parseInt(match) * level;
            });
        }

        function scaleEffectDesc(descStr, level) {
            if (!descStr) return "";
            return descStr.replace(/\+(\d+)/g, (match, val) => {
                return "+" + (parseInt(val) * level);
            });
        }

        function getWeightedRandomTier(level) {
            const idx = Math.min(level - 1, SHOP_LEVEL_WEIGHTS.length - 1);
            const weights = SHOP_LEVEL_WEIGHTS[idx];
            
            const rand = Math.random() * 100;
            let sum = 0;
            for (let i = 0; i < 5; i++) {
                sum += weights[i];
                if (rand <= sum) return TIER_NAMES[i];
            }
            return "E";
        }

        function getMonsterForShop(tier, shopper = state.character) {
            let pool = getAvailableMonsters(tier);
            if (pool.length === 0) {
                // Fallback to previous tiers if current tier is empty
                let idx = TIER_NAMES.indexOf(tier);
                while (idx > 0 && pool.length === 0) {
                    idx--;
                    tier = TIER_NAMES[idx];
                    pool = getAvailableMonsters(tier);
                }
            }
            if (pool.length === 0) return null;

            if (!shopper || !shopper.typeWeights || shopper.typeWeights === "equal") {
                return pool[Math.floor(Math.random() * pool.length)];
            }

            // Type-First Selection for more robust archetypes
            // 1. Identify which types are actually in this tier's pool
            const availableTypes = [...new Set(pool.map(m => m.type))];
            
            // 2. Get shopper weights for these specific types
            let typeWeights = {};
            let totalWeight = 0;
            availableTypes.forEach(t => {
                let w = shopper.typeWeights[t] || 10;
                typeWeights[t] = w;
                totalWeight += w;
            });

            // 3. Roll for type
            let rand = Math.random() * totalWeight;
            let sum = 0;
            let selectedType = availableTypes[0];
            for (let t of availableTypes) {
                sum += typeWeights[t];
                if (rand <= sum) {
                    selectedType = t;
                    break;
                }
            }

            // 4. Pick random monster of that type from the tier pool
            const typePool = pool.filter(m => m.type === selectedType);
            if (typePool.length === 0) return pool[Math.floor(Math.random() * pool.length)]; // Final fallback
            
            return typePool[Math.floor(Math.random() * typePool.length)];
        }

                function getAvailableMonsters(tier) {
            return MONSTER_REGISTRY.filter(m => {
                if (m.tier !== tier) return false;
                if (m.id === "h1") return true;
                const isCardUnlocked = metaProgress.unlockedCards.includes(m.id);
                if (!isCardUnlocked) return false;
                const matchingCaptain = CHARACTERS.find(c => c.type === m.type);
                if (matchingCaptain && metaProgress.unlockedCharacters.includes(matchingCaptain.id)) {
                    return true;
                }
                return matchingCaptain ? false : true;
            });
        }

        function simulateAITurns() {
            if (!state.characters || !CREWS_REGISTRY.length) return;
            state.characters.forEach(ai => {
                if (ai.id === state.character?.id || ai.hp <= 0) return;
                
                // Get archetype from registry
                const charData = CHARACTERS.find(c => c.id === ai.id);
                const charType = charData ? charData.type : "Any";

                // Filter possible crews based on round and type
                let possibleCrews = CREWS_REGISTRY.filter(c => 
                    c.minRound <= state.round && 
                    (c.type === charType || c.type === "Any")
                );
                
                if (possibleCrews.length === 0) {
                    possibleCrews = CREWS_REGISTRY.filter(c => c.minRound <= state.round);
                }
                
                if (possibleCrews.length > 0) {
                    // Pick the highest level crews available for this round
                    let highestMinRound = Math.max(...possibleCrews.map(c => c.minRound));
                    let bestCrews = possibleCrews.filter(c => c.minRound === highestMinRound);
                    
                    const chosenCrew = bestCrews[Math.floor(Math.random() * bestCrews.length)];
                    
                    // Build squad from crew list
                    ai.squad = chosenCrew.monsters.map(id => {
                        const baseMonster = MONSTER_REGISTRY.find(m => m.id === id);
                        if (baseMonster) {
                            return { 
                                ...baseMonster, 
                                cAtk: baseMonster.atk, 
                                cHp: baseMonster.hp,
                                instId: Math.random() 
                            };
                        }
                        return null;
                    }).slice(0, 5); 
                    
                    // Maintain standard 5-slot squad
                    while (ai.squad.length < 5) ai.squad.push(null);
                    
                    logHistory(`AI ${ai.name} deployed crew: ${chosenCrew.name}`);
                }
            });
        }


        function refreshShop() {
            // JUICE: Reroll animation
            const slots = document.querySelectorAll('#shop-view-slots .slot');
            slots.forEach((s, i) => {
                s.style.animation = 'none';
                void s.offsetWidth;
                s.style.animation = `popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) ${i * 0.05}s forwards`;
            });

            state.shop = Array(state.shopSize).fill(null).map(() => {
                let tier = getWeightedRandomTier(state.round);
                let selectedMonster = getMonsterForShop(tier);
                return selectedMonster ? { ...selectedMonster, instId: Math.random() } : null;
            });
            updateUI();
        }

        function rerollShop() {
            if (state.gold >= 1) {
                state.gold--;
                logHistory("Rerolled Shop (Cost: 1 Gold)");
                refreshShop();
            }
        }

        function expandSquad() {
            const cost = state.squadSize === 5 ? 15 : (state.squadSize === 6 ? 20 : 25);
            if (state.gold >= cost && state.squadSize < 8) {
                state.gold -= cost;
                state.squadSize++;
                state.squad.push(null);
                logHistory(`Expanded Team capacity to ${state.squadSize} (Cost: ${cost} Gold)`);
                updateUI();
            }
        }

        function expandShop() {
            const cost = state.shopSize === 3 ? 10 : 15;
            if (state.gold >= cost && state.shopSize < 5) {
                state.gold -= cost;
                state.shopSize++;
                
                // Add new slot to shop
                let tier = getWeightedRandomTier(state.round);
                let selectedMonster = getMonsterForShop(tier);
                if (selectedMonster) {
                    state.shop.push({ ...selectedMonster, instId: Math.random() });
                }
                
                logHistory(`Expanded Shop capacity to ${state.shopSize} (Cost: ${cost} Gold)`);
                updateUI();
            }
        }

        /**
         * INSPECTOR & MODAL LOGIC
         */
        function inspectSlot(type, index, element) {
            const monster = type === 'shop' ? state.shop[index] : state.squad[index];
            if (!monster) return;

            openInspector(monster, type, index, element);
        }

        function openInspector(monster, type, index, element) {
            state.currentlyInspecting = { monster, type, index };
            state.isPaused = true;

            const lvl = monster.level || 1;
            const atk = monster.cAtk !== undefined ? monster.cAtk : monster.atk;
            const hp = monster.cHp !== undefined ? monster.cHp : monster.hp;

            // Fill Front
            document.getElementById('ins-front-level').innerText = `${lvl}`;
            document.getElementById('ins-front-image').src = monster.image;
            document.getElementById('ins-front-tier').innerText = monster.tier || "E";
            document.getElementById('ins-front-tier').style.background = TIER_COLORS[monster.tier] || "#b0bec5";
            document.getElementById('ins-front-atk').innerHTML = `⚔️ ${atk}`;
            document.getElementById('ins-front-hp').innerHTML = `<img src="images/hp.png" class="icon-img"> ${hp}`;

            // Fill Back
            document.getElementById('ins-type').innerText = monster.type;
            document.getElementById('ins-name').innerText = monster.name;
            document.getElementById('ins-image').src = monster.image;
            document.getElementById('ins-atk').innerText = atk;
            document.getElementById('ins-hp').innerText = hp;
            document.getElementById('ins-effect').innerText = monster.effectDesc;
            document.getElementById('ins-flavor').innerText = `"${monster.flavor}"`;

            // Active Modifiers Section
            const modifierContainer = document.getElementById('ins-modifiers-list');
            if (modifierContainer) {
                modifierContainer.innerHTML = '';
                const allMods = [...(monster.modifiers || []), ...(monster.tempModifiers || [])];
                
                if (allMods.length === 0) {
                    modifierContainer.innerHTML = '<div style="color:#666; font-style:italic;">No active modifiers</div>';
                } else {
                    // Group similar modifiers
                    const grouped = {};
                    allMods.forEach(m => {
                        const key = m.name;
                        if (!grouped[key]) grouped[key] = { atk: 0, hp: 0, count: 0 };
                        grouped[key].atk += m.atk || 0;
                        grouped[key].hp += m.hp || 0;
                        grouped[key].count++;
                    });

                    Object.keys(grouped).forEach(name => {
                        const m = grouped[name];
                        const div = document.createElement('div');
                        div.style.display = 'flex';
                        div.style.justifyContent = 'space-between';
                        div.style.padding = '4px 0';
                        div.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
                        
                        const statText = [];
                        if (m.atk !== 0) statText.push(`<span class="c-atk">${m.atk > 0 ? '+' : ''}${m.atk}⚔️</span>`);
                        if (m.hp !== 0) statText.push(`<span class="c-hp">${m.hp > 0 ? '+' : ''}${m.hp}❤</span>`);
                        
                        div.innerHTML = `
                            <span style="color:#eee; font-size:0.9em">${name}${m.count > 1 ? ` (x${m.count})` : ''}</span>
                            <span>${statText.join(' ')}</span>
                        `;
                        modifierContainer.appendChild(div);
                    });
                }
            }
            const buyBtn = document.getElementById('ins-buy-btn');
            const sacBtn = document.getElementById('ins-sac-btn');
            const mergeBtn = document.getElementById('ins-merge-btn');

            let totalDiscount = state.squad.filter(m => m !== null).reduce((sum, m) => {
                if (m.effect && m.effect.startsWith("Cheap:")) {
                    return sum + parseInt(m.effect.split(":")[1]);
                }
                return sum;
            }, 0);
            let currentCost = type === 'shop' ? Math.max(0, monster.cost - totalDiscount) : monster.cost;

            buyBtn.style.display = type === 'shop' ? 'block' : 'none';
            buyBtn.innerHTML = `BUY (${currentCost}<img src="images/win-icon.png" class="icon-img">)`;
            buyBtn.onclick = (e) => buyMonster(index, e);
            
            if (type === 'shop' && state.gold < currentCost) {
                buyBtn.classList.add('btn-disabled');
            } else {
                buyBtn.classList.remove('btn-disabled');
            }

            sacBtn.style.display = type === 'squad' ? 'block' : 'none';
            sacBtn.onclick = () => sacrificeMonster(index);

            let canMerge = false;
            let mergeTargets = [];
            let neededForMerge = (monster.effect === "Twin") ? 1 : 2;
            if (type === 'squad') {
                for (let i = 0; i < state.squad.length; i++) {
                    const m = state.squad[i];
                    if (m && m.id === monster.id && (m.level || 1) === lvl && i !== index) {
                        mergeTargets.push(i);
                    }
                }
                if (mergeTargets.length >= neededForMerge) canMerge = true;
            }
            // Hiding manual merge button as merging is now automatic
            mergeBtn.style.display = 'none'; 
            mergeBtn.onclick = () => mergeMonster(index, mergeTargets.slice(0, neededForMerge));

            const synergyHint = document.getElementById('ins-synergy-hint');
            if (synergyHint) {
                const sameTypeInSquad = state.squad.filter(s => s && s.type === monster.type).length;
                if (monster.effect && monster.effect.startsWith("Team:")) {
                    const x = parseInt(monster.effect.split(":")[1]);
                    synergyHint.innerText = `SYNERGY: Will trigger on ${sameTypeInSquad} allies → +${x * sameTypeInSquad} ATK total!`;
                    synergyHint.style.display = 'block';
                } else if (monster.effect && monster.effect.startsWith("Anger:")) {
                    synergyHint.innerText = `SYNERGY: Deaths will trigger buffs for your ${state.squad.filter(s=>s).length} allies!`;
                    synergyHint.style.display = 'block';
                } else {
                    synergyHint.style.display = 'none';
                }
            }

            // Animation
            const inspector = document.getElementById('inspector');
            const inner = document.getElementById('inspector-inner');
            
            inspector.style.display = 'flex';
            inspector.style.opacity = '0';
            
            if (element) {
                const rect = element.getBoundingClientRect();
                const scaleX = rect.width / 450;
                const tx = (rect.left + rect.width / 2) - (window.innerWidth / 2);
                const ty = (rect.top + rect.height / 2) - (window.innerHeight / 2);
                
                inner.style.transition = 'none';
                inner.style.transform = `translate(${tx}px, ${ty}px) scale(${scaleX}) rotateY(0deg)`;
                
                // Force reflow
                void inner.offsetWidth;
            } else {
                inner.style.transition = 'none';
                inner.style.transform = 'scale(0.5) rotateY(0deg)';
                void inner.offsetWidth;
            }
            
            inspector.style.transition = 'opacity 0.3s';
            inspector.style.opacity = '1';
            
            inner.style.transition = 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)';
            inner.style.transform = 'translate(0, 0) scale(1) rotateY(180deg)';
        }

        function closeInspector() {
            const inspector = document.getElementById('inspector');
            const inner = document.getElementById('inspector-inner');
            
            inspector.style.opacity = '0';
            inner.style.transform = 'scale(0.8) rotateY(180deg)';
            
            setTimeout(() => {
                inspector.style.display = 'none';
                state.isPaused = false;
                state.currentlyInspecting = null;
            }, 300);
        }

        function buyMonster(index, event) {
            const monster = state.shop[index];
            if (!monster) return;
            let totalDiscount = state.squad.filter(m => m !== null).reduce((sum, m) => {
                if (m.effect && m.effect.startsWith("Cheap:")) {
                    return sum + parseInt(m.effect.split(":")[1]);
                }
                return sum;
            }, 0);
            let currentCost = Math.max(0, monster.cost - totalDiscount);
            if (state.gold >= currentCost) {
                const emptyIdx = state.squad.indexOf(null);
                if (emptyIdx !== -1) {
                    state.gold -= currentCost;
                    state.squad[emptyIdx] = { ...monster, cAtk: Math.max(1, monster.atk), cHp: monster.hp };
                    state.shop[index] = null;
                    
                    runStats.buys[monster.type] = (runStats.buys[monster.type] || 0) + 1;

                    // Captain Vance Power
                    if (state.character && state.character.id === 'vance' && monster.type === 'Human') {
                        logHistory(`Captain Vance: Resonance triggered by buying ${monster.name}.`);
                        state.squad.forEach((m, idx) => {
                            if (m && m.type === 'Human') {
                                m.atk += 1; m.hp += 1;
                                if (m.cAtk !== undefined) m.cAtk += 1;
                                if (m.cHp !== undefined) m.cHp += 1;
                                showFloatingStat(idx, 'squad', '+1/+1', 'var(--gold-color)');
                                if (!m.modifiers) m.modifiers = [];
                                m.modifiers.push({ name: 'Captain Vance (Resonance)', atk: 1, hp: 1 });
                                logHistory(`- ${m.name} (Slot ${idx+1}) gained +1/+1 (new stats: ${m.atk}/${m.hp})`);
                            }
                        });
                    }

                    // === RECRUIT / ONBUY EFFECT ===
                    if (monster.effect && monster.effect.startsWith("Recruit:")) {
                        const val = parseInt(monster.effect.split(":")[1]) || getKeywordDefaultValue("Recruit") || 2;
                        const bought = state.squad[emptyIdx];
                        bought.atk += val;
                        bought.hp += val;
                        if (bought.cAtk !== undefined) bought.cAtk += val;
                        if (bought.cHp !== undefined) bought.cHp += val;
                        
                        logHistory(`Recruit effect: ${monster.name} gained +${val}/+${val} on buy!`);
                        showFloatingStat(emptyIdx, 'squad', `+${val}/+${val}`, 'var(--gold-color)');
                    }

                    createParticleBurst(event ? {x: event.clientX, y: event.clientY} : null, 'var(--gold-color)', 15);
                    animateGoldCollection(event ? {x: event.clientX, y: event.clientY} : null);
                    
                    closeInspector();
                    updateUI();

                    // Check for automatic merge
                    checkAutoMerge();
                } else { 
                    showToast("Squad full!", event); 
                }
            } else { 
                showToast("not enough money", event); 
            }
        }

        function sacrificeMonster(index) {
            const sacrificed = state.squad[index];
            if (!sacrificed) return;

            // JUICE: Particle burst before removal
            const slot = document.querySelectorAll('#squad-view .slot')[index];
            const rect = slot.getBoundingClientRect();
            createParticleBurst({x: rect.left + rect.width/2, y: rect.top + rect.height/2}, 'var(--health-color)', 20);

            state.squad[index] = null;
            state.gold += 1; 
            animateGoldCollection({x: rect.left + rect.width/2, y: rect.top + rect.height/2});
            logHistory(`Sacrificed ${sacrificed.name} (Slot ${index+1}) for 1 Gold.`);
            
            if (state.character && state.character.id === 'mrat' && sacrificed.type === 'Beast') {
                logHistory(`Captain Massive Rat: Scavenge triggered by sacrificing ${sacrificed.name}.`);
                state.squad.forEach((m, idx) => {
                    if (m && m.type === 'Beast') {
                        m.atk += 1; m.hp += 1;
                        if (m.cAtk !== undefined) m.cAtk += 1;
                        if (m.cHp !== undefined) m.cHp += 1;
                        showFloatingStat(idx, 'squad', '+1/+1', 'var(--beast-color)');
                        if (!m.modifiers) m.modifiers = [];
                        m.modifiers.push({ name: 'Captain Massive Rat (Scavenge)', atk: 1, hp: 1 });
                        logHistory(`- ${m.name} (Slot ${idx+1}) gained +1/+1 (new stats: ${m.atk}/${m.hp})`);
                    }
                });
            }
            
            triggerDeathEffect(sacrificed, 'shop');

            closeInspector();
            updateUI();
        }

        function checkAutoMerge() {
            for (let i = 0; i < state.squad.length; i++) {
                const m = state.squad[i];
                if (!m) continue;
                
                const needed = (m.effect === "Twin") ? 1 : 2;
                let targets = [];
                for (let j = 0; j < state.squad.length; j++) {
                    if (i !== j && state.squad[j] && state.squad[j].id === m.id && (state.squad[j].level || 1) === (m.level || 1)) {
                        targets.push(j);
                    }
                }
                
                if (targets.length >= needed) {
                    mergeMonster(i, targets.slice(0, needed));
                    return true; // Re-check in case of chain merges
                }
            }
            return false;
        }

        function mergeMonster(index, targets) {
            const mainMonster = state.squad[index];
            const squadSlots = document.querySelectorAll('#squad-view .slot');
            const mainSlot = squadSlots[index];
            const mainRect = mainSlot.getBoundingClientRect();

            let bonusAtk = 0;
            let bonusHp = 0;
            
            targets.forEach(tIdx => {
                const target = state.squad[tIdx];
                bonusAtk += target.atk;
                bonusHp += target.hp;
                
                // JUICE: Fly target toward main with swirl
                const targetSlot = squadSlots[tIdx];
                const targetRect = targetSlot.getBoundingClientRect();
                
                // Create a clone for the animation
                const clone = targetSlot.cloneNode(true);
                clone.className = 'merging-swirl';
                clone.style.left = targetRect.left + 'px';
                clone.style.top = targetRect.top + 'px';
                
                // Calculate relative movement
                const tx = mainRect.left - targetRect.left;
                const ty = mainRect.top - targetRect.top;
                clone.style.setProperty('--tx', `${tx}px`);
                clone.style.setProperty('--ty', `${ty}px`);
                
                document.body.appendChild(clone);
                setTimeout(() => clone.remove(), 800);
                
                state.squad[tIdx] = null;
            });

            // Wait for animation to finish before updating stats and showing burst
            setTimeout(() => {
                mainMonster.atk += bonusAtk;
                mainMonster.hp += bonusHp;
                mainMonster.level = (mainMonster.level || 1) + 1;
                
                // Track Merge Modifiers
                if (!mainMonster.modifiers) mainMonster.modifiers = [];
                mainMonster.modifiers.push({ name: 'Merged Stats', atk: bonusAtk, hp: bonusHp });

                // Scale Effect Values
                const originalEffect = mainMonster.effect;
                mainMonster.effect = scaleEffectValue(mainMonster.effect, mainMonster.level);
                mainMonster.effectDesc = scaleEffectDesc(mainMonster.effectDesc, mainMonster.level);

                showEffectAt(mainRect.left + mainRect.width/2, mainRect.top + mainRect.height/2, 'LEVEL UP!', 'var(--gold-color)');
                logHistory(`Merged into Level ${mainMonster.level} ${mainMonster.name}. Gained +${bonusAtk}/+${bonusHp}. Effect scaled!`);
                
                runStats.merges++;

                if (state.character && state.character.id === 'brain') {
                    const oldAtk = mainMonster.atk;
                    const oldHp = mainMonster.hp;
                    const bonusA = Math.floor(mainMonster.atk * 0.5);
                    const bonusH = Math.floor(mainMonster.hp * 0.5);
                    mainMonster.atk += bonusA;
                    mainMonster.hp += bonusH;
                    mainMonster.modifiers.push({ name: 'Captain Brain Power (50% Boost)', atk: bonusA, hp: bonusH });
                    logHistory(`Captain Brain Power: Stats increased by 50% on merge (${oldAtk}/${oldHp} -> ${mainMonster.atk}/${mainMonster.hp})`);
                }

                mainMonster.cAtk = Math.max(1, mainMonster.atk);
                mainMonster.cHp = mainMonster.hp;
                
                createParticleBurst({x: mainRect.left + mainRect.width/2, y: mainRect.top + mainRect.height/2}, 'var(--gold-color)', 40);
                updateUI();
                
                // Chain check for further merges (e.g. three lvl 2s merge into lvl 3)
                checkAutoMerge();
            }, 800);

            // Immediate clearing of slots to prevent double-merging while animating
            updateUI(); 
        }

        /**
         * BATTLE SYSTEM
         */
        function startBattle() {
            if (state.squad.every(s => s === null)) return alert("Need a squad!");
            
            document.getElementById('battle-view').style.display = 'flex';
            document.getElementById('shop-phase').style.display = 'none';
            document.getElementById('controls').style.display = 'none';

            let opponents = state.characters ? state.characters.filter(c => c.id !== state.character?.id && c.hp > 0) : [];
            if (opponents.length > 0) {
                state.currentOpponent = opponents[Math.floor(Math.random() * opponents.length)];
                logHistory(`--- Battle Start: Round ${state.round} vs ${state.currentOpponent.name} ---`);
            } else {
                state.currentOpponent = null;
                logHistory(`--- Battle Start: Round ${state.round} (No Opponent) ---`);
            }

            const combatInfo = document.getElementById('combat-info');
            if (combatInfo) {
                if (state.currentOpponent) {
                    combatInfo.innerHTML = `
                        <h2 style="color: var(--gold-color); text-shadow: 2px 2px 0 #000; margin: 0 0 5px 0;">VS ${state.currentOpponent.name}</h2>
                        <div style="font-size: 1.5em; color: var(--health-color); font-weight: bold; text-shadow: 1px 1px 0 #000;">
                            ${state.currentOpponent.icon} <img src="images/hp.png" class="icon-img"> ${state.currentOpponent.hp}
                        </div>
                    `;
                    combatInfo.style.display = 'block';
                } else {
                    combatInfo.style.display = 'none';
                }
            }

            // Clone squad and generate enemies with guaranteed numeric stats
            battleData.ally = state.squad.filter(s => s !== null).map(s => ({ 
                ...s, 
                cHp: Number(s.hp) || 1, 
                cAtk: Number(s.atk) || 1,
                hp: Number(s.hp) || 1,
                atk: Number(s.atk) || 1,
                fights: 0
            }));
            
            if (state.currentOpponent) {
                let op = state.characters.find(c => c.id === state.currentOpponent.id);
                if (op && op.squad) {
                    // Filter out nulls and ensure numeric stats
                    battleData.enemy = op.squad.filter(s => s !== null).map(s => ({ 
                        ...s, 
                        cHp: Number(s.hp) || 1, 
                        cAtk: Number(s.atk) || 1,
                        hp: Number(s.hp) || 1,
                        atk: Number(s.atk) || 1,
                        fights: 0
                    }));
                } else {
                    battleData.enemy = [];
                }
            } else {
                battleData.enemy = [];
            }

            renderBattle();
            applyStartOfBattleEffects();
            setTimeout(battleStep, 1000 / combatSpeed);
        }

        function applyStartOfBattleEffects() {
            // Apply Ally Effects
            battleData.ally.forEach(m => {
                // Team: +X/0 to each other friendly card that shares a type.
                if (m.effect && m.effect.startsWith("Team:")) {
                    const x = parseInt(m.effect.split(":")[1]);
                    battleData.ally.forEach(other => {
                        if (other !== m && other.type === m.type) {
                            other.cAtk += x;
                            syncToSquad(other, 'atk', x, 'ally', `Team (${m.name})`);
                            logHistory(`Effect: Ally Team (${m.name}) -> ${other.name} gains +${x} Atk (Total: ${other.cAtk})`);
                        }
                    });
                }
                // Solo: +X/+X if there are no friendly cards sharing its type.
                if (m.effect && m.effect.startsWith("Solo:")) {
                    const x = parseInt(m.effect.split(":")[1]);
                    const othersOfSameType = battleData.ally.filter(other => other !== m && other.type === m.type);
                    if (othersOfSameType.length === 0) {
                        m.cAtk += x;
                        m.cHp += x;
                        syncToSquad(m, 'atk', x, 'ally', 'Solo Synergy');
                        syncToSquad(m, 'hp', x, 'ally', 'Solo Synergy');
                        logHistory(`Effect: Ally Solo (${m.name}) -> Gains +${x}/+${x} (Total: ${m.cAtk}/${m.cHp})`);
                    }
                }
                // Inner Dread Power: Cosmics gain +2/+0 at start of combat.
                if (state.character && state.character.id === 'dread' && m.type === 'Cosmic') {
                    m.cAtk += 2;
                    syncToSquad(m, 'atk', 2, 'ally', 'Captain Inner Dread');
                    logHistory(`Captain Inner Dread: Ally ${m.name} gains +2 Atk (Total: ${m.cAtk})`);
                }
                
                // Initialize Shield
                if (m.effect === "Shield") m.hasShield = true;
            });

            // Apply Enemy Effects
            battleData.enemy.forEach(m => {
                // Team: +X/0 to each other friendly card that shares a type.
                if (m.effect && m.effect.startsWith("Team:")) {
                    const x = parseInt(m.effect.split(":")[1]);
                    battleData.enemy.forEach(other => {
                        if (other !== m && other.type === m.type) {
                            other.cAtk += x;
                            syncToSquad(other, 'atk', x, 'enemy', `Team (${m.name})`);
                            logHistory(`Effect: Enemy Team (${m.name}) -> ${other.name} gains +${x} Atk (Total: ${other.cAtk})`);
                        }
                    });
                }
                // Solo: +X/+X if there are no friendly cards sharing its type.
                if (m.effect && m.effect.startsWith("Solo:")) {
                    const x = parseInt(m.effect.split(":")[1]);
                    const othersOfSameType = battleData.enemy.filter(other => other !== m && other.type === m.type);
                    if (othersOfSameType.length === 0) {
                        m.cAtk += x;
                        m.cHp += x;
                        syncToSquad(m, 'atk', x, 'enemy', 'Solo Synergy');
                        syncToSquad(m, 'hp', x, 'enemy', 'Solo Synergy');
                        logHistory(`Effect: Enemy Solo (${m.name}) -> Gains +${x}/+${x} (Total: ${m.cAtk}/${m.cHp})`);
                    }
                }
                // AI Inner Dread check
                if (state.currentOpponent && state.currentOpponent.id === 'dread' && m.type === 'Cosmic') {
                    m.cAtk += 2;
                    syncToSquad(m, 'atk', 2, 'enemy', 'Captain Inner Dread');
                    logHistory(`Captain Inner Dread: Enemy ${m.name} gains +2 Atk (Total: ${m.cAtk})`);
                }
                
                // Initialize Shield
                if (m.effect === "Shield") m.hasShield = true;
            });

            applyAuraEffects();
            renderBattle();
        }

        function applyAuraEffects() {
            // 1. Remove Previous Aura from all surviving participants
            [...battleData.ally, ...battleData.enemy].forEach(m => {
                if (m.auraAtk) { m.cAtk -= m.auraAtk; m.auraAtk = 0; }
                if (m.auraHp) { m.cHp -= m.auraHp; m.auraHp = 0; }
            });

            // 2. Re-calculate NEW Aura
            // Ally side
            battleData.ally.forEach((m, i) => {
                if (!m.effect || !m.effect.startsWith("Aura:")) return;
                const parts = m.effect.split(":");
                const val = parseInt(parts[1]) || getKeywordDefaultValue("Aura") || 1;
                const isHp = parts[0].toLowerCase().includes("hp") || m.effect.toLowerCase().includes("aura (hp)");
                
                const applyToIdx = (idx) => {
                    const target = battleData.ally[idx];
                    if (!target) return;
                    if (isHp) { target.cHp += val; target.auraHp = (target.auraHp || 0) + val; }
                    else { target.cAtk += val; target.auraAtk = (target.auraAtk || 0) + val; }
                };

                if (i > 0) applyToIdx(i - 1);
                if (i < battleData.ally.length - 1) applyToIdx(i + 1);
            });
            
            // Enemy side
            battleData.enemy.forEach((m, i) => {
                if (!m.effect || !m.effect.startsWith("Aura:")) return;
                const parts = m.effect.split(":");
                const val = parseInt(parts[1]) || getKeywordDefaultValue("Aura") || 1;
                const isHp = parts[0].toLowerCase().includes("hp") || m.effect.toLowerCase().includes("aura (hp)");

                const applyToIdx = (idx) => {
                    const target = battleData.enemy[idx];
                    if (!target) return;
                    if (isHp) { target.cHp += val; target.auraHp = (target.auraHp || 0) + val; }
                    else { target.cAtk += val; target.auraAtk = (target.auraAtk || 0) + val; }
                };

                if (i > 0) applyToIdx(i - 1);
                if (i < battleData.enemy.length - 1) applyToIdx(i + 1);
            });

            // Check if anyone died from losing an aura? (Unlikely to happen often, but safe to check)
            // But handleDeathsAndContinue will catch it in the next loop.
        }

        function battleStep() {
            if (state.isPaused) {
                setTimeout(battleStep, 100);
                return;
            }

            if (battleData.ally.length === 0 || battleData.enemy.length === 0) {
                endBattle();
                return;
            }

            // --- TARGET SELECTION (Taunt) ---
            const aIdx = battleData.ally.findIndex(m => m.effect === "Taunt");
            const eIdx = battleData.enemy.findIndex(m => m.effect === "Taunt");
            const aActualIdx = aIdx !== -1 ? aIdx : 0;
            const eActualIdx = eIdx !== -1 ? eIdx : 0;

            const a = battleData.ally[aActualIdx];
            const e = battleData.enemy[eActualIdx];

            const allyLine = document.getElementById('ally-line');
            const enemyLine = document.getElementById('enemy-line');
            const allySlot = allyLine.children[aActualIdx];
            const enemySlot = enemyLine.children[eActualIdx];

            // --- START OF CLASH EFFECTS ---
            // Regen
            if (a.effect && a.effect.startsWith("Regen:")) {
                const x = parseInt(a.effect.split(":")[1]);
                const heal = Math.min(a.hp - a.cHp, x);
                if (heal > 0) {
                    a.cHp += heal;
                    showFloatingStat(aActualIdx, 'ally-line', `+${heal}`, 'var(--nature-color)');
                    logHistory(`${a.name} Regens ${heal} HP.`);
                }
            }
            if (e.effect && e.effect.startsWith("Regen:")) {
                const x = parseInt(e.effect.split(":")[1]);
                const heal = Math.min(e.hp - e.cHp, x);
                if (heal > 0) {
                    e.cHp += heal;
                    showFloatingStat(eActualIdx, 'enemy-line', `+${heal}`, 'var(--nature-color)');
                    logHistory(`${e.name} Regens ${heal} HP.`);
                }
            }

            // Poison
            if (a.poisoned) {
                a.cHp -= a.poisoned;
                showFloatingStat(aActualIdx, 'ally-line', `-${a.poisoned} POISON`, 'var(--genetic-color)');
                logHistory(`${a.name} takes ${a.poisoned} Poison damage.`);
            }
            if (e.poisoned) {
                e.cHp -= e.poisoned;
                showFloatingStat(eActualIdx, 'enemy-line', `-${e.poisoned} POISON`, 'var(--genetic-color)');
                logHistory(`${e.name} takes ${e.poisoned} Poison damage.`);
            }
            
            // Death check from start-of-clash effects
            if (a.cHp <= 0 || e.cHp <= 0) {
                renderBattle();
                setTimeout(() => handleDeathsAndContinue(aActualIdx, eActualIdx), 500);
                return;
            }

            // --- CLASH CALCULATIONS ---
            const aMomentum = 1 + (a.fights || 0) * 0.5;
            const eMomentum = 1 + (e.fights || 0) * 0.5;
            let aDmgBase = Math.floor(a.cAtk * aMomentum);
            let eDmgBase = Math.floor(e.cAtk * eMomentum);

            if (a.fights > 0 && allySlot) {
                const rect = allySlot.getBoundingClientRect();
                showEffectAt(rect.left + rect.width/2, rect.top + rect.height/2, `MOMENTUM x${aMomentum.toFixed(1)}`, 'var(--gold-color)');
            }
            if (e.fights > 0 && enemySlot) {
                const rect = enemySlot.getBoundingClientRect();
                showEffectAt(rect.left + rect.width/2, rect.top + rect.height/2, `MOMENTUM x${eMomentum.toFixed(1)}`, 'var(--gold-color)');
            }

            // CRIT
            let aCrit = false, eCrit = false;
            if (a.effect && a.effect.startsWith("Crit:")) {
                const chance = parseInt(a.effect.split(":")[1]) || getKeywordDefaultValue("Crit") || 25;
                if (Math.random() * 100 < chance) {
                    aDmgBase *= 2;
                    aCrit = true;
                }
            }
            if (e.effect && e.effect.startsWith("Crit:")) {
                const chance = parseInt(e.effect.split(":")[1]) || getKeywordDefaultValue("Crit") || 25;
                if (Math.random() * 100 < chance) {
                    eDmgBase *= 2;
                    eCrit = true;
                }
            }

            // ECHO (repeat attack prep)
            let aEcho = false, eEcho = false;
            if (a.effect && a.effect.startsWith("Echo:")) {
                const chance = parseInt(a.effect.split(":")[1]) || getKeywordDefaultValue("Echo") || 30;
                if (Math.random() * 100 < chance) aEcho = true;
            }
            if (e.effect && e.effect.startsWith("Echo:")) {
                const chance = parseInt(e.effect.split(":")[1]) || getKeywordDefaultValue("Echo") || 30;
                if (Math.random() * 100 < chance) eEcho = true;
            }

            const finalDmgToA = Math.floor(eDmgBase * aMomentum);
            const finalDmgToE = Math.floor(aDmgBase * eMomentum);

            logHistory(`Combat: ${a.name}${aCrit ? ' (CRIT!)':''} (${aDmgBase}/${a.cHp}) vs ${e.name}${eCrit ? ' (CRIT!)':''} (${eDmgBase}/${e.cHp})`);

            // --- ANIMATIONS ---
            const speedFact = 1 / combatSpeed;
            createProjectile(allySlot, enemySlot, a.type);
            setTimeout(() => createProjectile(enemySlot, allySlot, e.type), 200 * speedFact);

            setTimeout(() => {
                if (allySlot) allySlot.classList.add('clash-right');
                if (enemySlot) enemySlot.classList.add('clash-left');

                setTimeout(() => {
                    // Visual Damage
                    showFloatingStat(aActualIdx, 'ally-line', `-${finalDmgToA}`, 'var(--health-color)');
                    showFloatingStat(eActualIdx, 'enemy-line', `-${finalDmgToE}`, 'var(--health-color)');
                    
                    document.getElementById('battle-view').classList.add('shake');
                    setTimeout(() => document.getElementById('battle-view').classList.remove('shake'), 200 * speedFact);

                    // Shield
                    let dmgToA = finalDmgToA;
                    if (a.hasShield) { dmgToA = 0; a.hasShield = false; showEffect('ally-line', 'BLOCKED', 'var(--human-color)'); }
                    let dmgToE = finalDmgToE;
                    if (e.hasShield) { dmgToE = 0; e.hasShield = false; showEffect('enemy-line', 'BLOCKED', 'var(--human-color)'); }

                    // Hit-Shake
                    [ {slot: allySlot, dmg: dmgToA}, {slot: enemySlot, dmg: dmgToE} ].forEach(obj => {
                        if (obj.dmg > 0 && obj.slot) {
                            const cardElement = obj.slot.querySelector('.card');
                            if (cardElement) {
                                cardElement.classList.add('hit-shake');
                                setTimeout(() => cardElement.classList.remove('hit-shake'), 300);
                            }
                        }
                    });

                    // Vampire
                    if (dmgToE > 0 && a.effect && a.effect.startsWith("Vampire:")) {
                        const x = parseInt(a.effect.split(":")[1]);
                        const heal = Math.min(a.hp - a.cHp, x);
                        if (heal > 0) { a.cHp += heal; showFloatingStat(aActualIdx, 'ally-line', `+${heal} VAMP`, 'var(--health-color)'); }
                    }
                    if (dmgToA > 0 && e.effect && e.effect.startsWith("Vampire:")) {
                        const x = parseInt(e.effect.split(":")[1]);
                        const heal = Math.min(e.hp - e.cHp, x);
                        if (heal > 0) { e.cHp += heal; showFloatingStat(eActualIdx, 'enemy-line', `+${heal} VAMP`, 'var(--health-color)'); }
                    }

                    // Poison Apply
                    if (dmgToE > 0 && a.effect && a.effect.startsWith("Poison:")) {
                        const x = parseInt(a.effect.split(":")[1]);
                        e.poisoned = (e.poisoned || 0) + x;
                        if (enemySlot) {
                            const rect = enemySlot.getBoundingClientRect();
                            showEffectAt(rect.left, rect.top, 'POISONED', 'var(--genetic-color)');
                        }
                    }
                    if (dmgToA > 0 && e.effect && e.effect.startsWith("Poison:")) {
                        const x = parseInt(e.effect.split(":")[1]);
                        a.poisoned = (a.poisoned || 0) + x;
                        if (allySlot) {
                            const rect = allySlot.getBoundingClientRect();
                            showEffectAt(rect.left, rect.top, 'POISONED', 'var(--genetic-color)');
                        }
                    }

                    // Thorn
                    if (dmgToA > 0 && a.effect && a.effect.startsWith("Thorn:")) {
                        const x = parseInt(a.effect.split(":")[1]);
                        e.cHp -= x; showEffect('enemy-line', `-${x} THORN`, 'var(--health-color)');
                    }
                    if (dmgToE > 0 && e.effect && e.effect.startsWith("Thorn:")) {
                        const x = parseInt(e.effect.split(":")[1]);
                        a.cHp -= x; showEffect('ally-line', `-${x} THORN`, 'var(--health-color)');
                    }

                    // Apply Final Damage
                    a.cHp -= dmgToA;
                    e.cHp -= dmgToE;

                    // ECHO Repeat Attack
                    if (aEcho && a.cHp > 0 && e.cHp > 0) {
                        logHistory(`ECHO! ${a.name} attacks again!`);
                        showEffect('ally-line', 'ECHO!', '#f1c40f');
                        e.cHp -= dmgToE; // Deal same damage again (or should it be aDmgBase?)
                        // User plan said: "e.cHp -= aDmg" where aDmg was the calculated damage.
                        // In my code, finalDmgToE was the damage e takes from a.
                        // Wait, finalDmgToE already includes e's Momentum (Glass Cannon penalty).
                        // Let's use finalDmgToE.
                        showFloatingStat(eActualIdx, 'enemy-line', `-${finalDmgToE}`, '#f1c40f');
                    }
                    if (eEcho && e.cHp > 0 && a.cHp > 0) {
                        logHistory(`ECHO! ${e.name} attacks again!`);
                        showEffect('enemy-line', 'ECHO!', '#f1c40f');
                        a.cHp -= finalDmgToA;
                        showFloatingStat(aActualIdx, 'ally-line', `-${finalDmgToA}`, '#f1c40f');
                    }

                    logHistory(`Result: ${a.name} HP -> ${a.cHp}, ${e.name} HP -> ${e.cHp}`);

                    const delay = (a.cHp <= 0 || e.cHp <= 0) ? 500 * speedFact : 0;
                    if (a.cHp <= 0 && allySlot) allySlot.classList.add('defeated');
                    if (e.cHp <= 0 && enemySlot) enemySlot.classList.add('defeated');

                    if (a.cHp > 0) a.fights++;
                    if (e.cHp > 0) e.fights++;

                    setTimeout(() => handleDeathsAndContinue(aActualIdx, eActualIdx), delay);

                }, 500 * speedFact);
            }, 400 * speedFact);

        }

        function handleDeathsAndContinue(aIdx, eIdx) {
            const speedFact = 1 / combatSpeed;
            let deadAllies = [];
            let deadEnemies = [];

            // FIX: Check LastStand BEFORE filtering out dead units
            battleData.ally.forEach(m => {
                if (m.cHp <= 0) {
                    if (m.effect === 'LastStand' && !m.lastStandUsed) {
                        m.cHp = 1;
                        m.lastStandUsed = true;
                        logHistory(`LASTSTAND: ${m.name} refuses to die! (1 HP left)`);
                        showEffect('ally-line', 'LAST STAND!', 'var(--health-color)');
                    } else {
                        deadAllies.push(m);
                    }
                }
            });
            battleData.enemy.forEach(m => {
                if (m.cHp <= 0) {
                    if (m.effect === 'LastStand' && !m.lastStandUsed) {
                        m.cHp = 1;
                        m.lastStandUsed = true;
                        logHistory(`LASTSTAND: ${m.name} refuses to die! (1 HP left)`);
                        showEffect('enemy-line', 'LAST STAND!', 'var(--health-color)');
                    } else {
                        deadEnemies.push(m);
                    }
                }
            });

            battleData.ally = battleData.ally.filter(m => m.cHp > 0);
            battleData.enemy = battleData.enemy.filter(m => m.cHp > 0);

            if (deadAllies.length > 0) createParticleBurst(null, 'var(--health-color)', 20);
            if (deadEnemies.length > 0) createParticleBurst(null, 'var(--gold-color)', 20);

            renderBattle();

            deadAllies.forEach(dead => triggerDeathEffect(dead, 'battle', 'ally'));
            deadEnemies.forEach(dead => triggerDeathEffect(dead, 'battle', 'enemy'));
            
            applyAuraEffects();
            renderBattle();

            // Next step check
            if (battleData.ally.length > 0 && battleData.enemy.length > 0) {
                setTimeout(battleStep, 800 * speedFact);
            } else {
                endBattle();
            }
        }

        function triggerDeathEffect(deadMonster, context, side = 'ally') {
            if (!deadMonster) return;

            const targets = (context === 'battle') 
                ? (side === 'ally' ? battleData.ally : battleData.enemy)
                : state.squad.filter(m => m !== null);
            
            // BOUNTY - only award gold if the monster was on the player's side (or sold)
            if (deadMonster.effect && deadMonster.effect.startsWith("Bounty:") && side === 'ally') {
                const gold = parseInt(deadMonster.effect.split(":")[1]) || 2;
                state.gold += gold;
                runStats.effectTriggers.Bounty = (runStats.effectTriggers.Bounty || 0) + 1;
                logHistory(`BOUNTY: +${gold} gold from ${deadMonster.name}`);
                animateGoldCollection(null);
            }

            // LASTSTAND is now handled in handleDeathsAndContinue before filtering
            // This block is kept as a no-op safety check.
            if (context === 'battle' && deadMonster.effect === "LastStand" && !deadMonster.lastStandUsed) {
                return; // Shouldn't reach here; handled upstream
            }
            
            // FURY: On ally death, gain stats (also sync to base stats for persistence)
            targets.forEach((m, idx) => {
                if (m && m.cHp > 0 && m.effect && m.effect.startsWith("Fury:")) {
                    const x = parseInt(m.effect.split(":")[1]);
                    m.cAtk += x; m.cHp += x;
                    if (context === 'battle') {
                        showFloatingStat(idx, side + '-line', `+${x}/+${x} FURY`, 'var(--beast-color)');
                        syncToSquad(m, 'atk', x, side, `Fury (${deadMonster.name})`);
                        syncToSquad(m, 'hp', x, side, `Fury (${deadMonster.name})`);
                    }
                }
            });

            // Honor: 0/+X to other friendly cards on death.
            if (deadMonster.effect && deadMonster.effect.startsWith("Honor:")) {
                const x = parseInt(deadMonster.effect.split(":")[1]);
                runStats.effectTriggers.Honor++;
                logHistory(`Effect: Honor (${deadMonster.name} death) -> Friendly units gain +${x} HP.`);
                targets.forEach(m => {
                    if (context === 'battle') {
                        m.cHp += x;
                        syncToSquad(m, 'hp', x, side, `Honor (${deadMonster.name})`);
                        logHistory(`- ${m.name} HP: ${m.cHp - x} -> ${m.cHp}`);
                    } else {
                        m.hp += x;
                        if (!m.modifiers) m.modifiers = [];
                        m.modifiers.push({ name: `Honor (${deadMonster.name})`, atk: 0, hp: x });
                    }
                });
                if (context === 'battle') showEffect(side === 'ally' ? 'ally-line' : 'enemy-line', `+${x} HP`, 'var(--nature-color)');
            }

            // Anger: +X/0 to other friendly cards on death.
            if (deadMonster.effect && deadMonster.effect.startsWith("Anger:")) {
                const x = parseInt(deadMonster.effect.split(":")[1]);
                runStats.effectTriggers.Anger++;
                logHistory(`Effect: Anger (${deadMonster.name} death) -> Friendly units gain +${x} Atk.`);
                targets.forEach(m => {
                    if (context === 'battle') {
                        m.cAtk += x;
                        syncToSquad(m, 'atk', x, side, `Anger (${deadMonster.name})`);
                        logHistory(`- ${m.name} Atk: ${m.cAtk - x} -> ${m.cAtk}`);
                    } else {
                        m.atk += x;
                        if (!m.modifiers) m.modifiers = [];
                        m.modifiers.push({ name: `Anger (${deadMonster.name})`, atk: x, hp: 0 });
                    }
                });
                if (context === 'battle') showEffect(side === 'ally' ? 'ally-line' : 'enemy-line', `+${x} ATK`, 'var(--beast-color)');
            }

            // Weak: -X/-X to enemy random card.
            if (deadMonster.effect && deadMonster.effect.startsWith("Weak:") && context === 'battle' && enemies.length > 0) {
                const x = parseInt(deadMonster.effect.split(":")[1]);
                runStats.effectTriggers.Weak++;
                const randEnemy = enemies[Math.floor(Math.random() * enemies.length)];
                logHistory(`Effect: Weak (${deadMonster.name} death) -> Enemy ${randEnemy.name} loses -${x}/-${x}.`);
                randEnemy.cAtk = Math.max(1, randEnemy.cAtk - x);
                randEnemy.cHp = Math.max(1, randEnemy.cHp - x); 
                
                // Subtractions are now permanent as per request
                syncToSquad(randEnemy, 'atk', -x, side === 'ally' ? 'enemy' : 'ally', `Weak (${deadMonster.name})`);
                syncToSquad(randEnemy, 'hp', -x, side === 'ally' ? 'enemy' : 'ally', `Weak (${deadMonster.name})`);
                logHistory(`- ${randEnemy.name} stats: ${randEnemy.cAtk + x}/${randEnemy.cHp + x} -> ${randEnemy.cAtk}/${randEnemy.cHp}`);

                showEffect(side === 'ally' ? 'enemy-line' : 'ally-line', `-${x}/-${x}`, 'var(--health-color)');
            }

            // Extra: Spawn a X/X on death.
            if (deadMonster.effect && deadMonster.effect.startsWith("Extra:") && context === 'battle') {
                const stats = deadMonster.effect.split(":")[1].split("/");
                const x = parseInt(stats[0]);
                const y = parseInt(stats[1]);
                const spawn = { 
                    id: "spawn", name: "Token", image: "images/token.png", type: "Cosmic", effectDesc:"A small rift of horror.",
                    atk: x, hp: y, cAtk: x, cHp: y, tier: "E", effectDesc: "Spawned token." 
                };
                runStats.tokensSummoned++;
                logHistory(`Effect: Extra (${deadMonster.name} death) -> Spawned ${spawn.name} (${x}/${y}).`);
                if (side === 'ally') battleData.ally.push(spawn);
                else battleData.enemy.push(spawn);
            }

            // Snappy Pete Power: Nature get +0/+1 when a Nature dies.
            const currentCaptain = (context === 'battle' && side === 'enemy') ? state.currentOpponent : state.character;
            if (currentCaptain && currentCaptain.id === 'pete' && deadMonster.type === 'Nature') {
                logHistory(`Captain Snappy Pete: Nature Pulse triggered by ${deadMonster.name} death.`);
                targets.forEach(m => {
                    if (m.type === 'Nature') {
                        if (context === 'battle') {
                            m.cHp += 1;
                            syncToSquad(m, 'hp', 1, side, 'Captain Snappy Pete');
                            logHistory(`- ${m.name} HP: ${m.cHp - 1} -> ${m.cHp}`);
                        } else {
                            m.hp += 1;
                            if (!m.modifiers) m.modifiers = [];
                            m.modifiers.push({ name: 'Snappy Pete (Nature Pulse)', atk: 0, hp: 1 });
                        }
                    }
                });
            }

            // Pancake Power: Mech summon a 1/1 cosmic card on death.
            if (currentCaptain && currentCaptain.id === 'pancake' && deadMonster.type === 'Mech') {
                if (context === 'battle') {
                    const spawn = { 
                        id: "spawn_cosmic", name: "Nano Spider", image: "images/spider.png", type: "Cosmic", 
                        atk: 1, hp: 1, cAtk: 1, cHp: 1, tier: "E", effectDesc: "Spawned by Pancake." 
                    };
                    logHistory(`Captain Pancake: Mech Scrap triggered -> Spawned ${spawn.name} (1/1).`);
                    if (side === 'ally') battleData.ally.push(spawn);
                    else battleData.enemy.push(spawn);
                }
            }
        }

        function endBattle() {
            const draw = battleData.ally.length === 0 && battleData.enemy.length === 0;
            const win = battleData.ally.length > 0;
            
            // TRACKING FOR UNLOCKS
            if (state.currentOpponent) {
                const opId = state.currentOpponent.id;
                metaProgress.heroFights[opId] = (metaProgress.heroFights[opId] || 0) + 1;
                if (win) {
                    metaProgress.heroWins[opId] = (metaProgress.heroWins[opId] || 0) + 1;
                }
                saveProgress();
            }

            // FIX: Pre-calculate hpChange here so it's always defined for display logic below
            const wager = Math.floor(state.round * 1.5) || 1;
            const hpChange = wager;

            // COMBAT REWARDS: 1 for Participation, +1 for Win
            metaProgress.trophies += 1;
            runStats.trophiesEarned += 1;
            if (win) {
                metaProgress.trophies += 1;
                runStats.trophiesEarned += 1;
                logHistory(`Combat End: WON! +2 Trophies (Combat + Win!)`);
            } else if (draw) {
                logHistory(`Combat End: DRAW. +1 Trophy (Combat Participated)`);
            } else {
                logHistory(`Combat End: DEFEAT. +1 Trophy (Combat Participated)`);
            }

            // HP change already calculated above (hpChange = wager)

            if (draw) {
                logHistory(`--- Battle End: DRAW (No HP change) ---`);
            } else if (!win) {
                state.hp -= hpChange;
                if (state.hp <= 0) state.hp = 0;
                logHistory(`--- Battle End: DEFEAT (-${hpChange} Player HP) ---`);
                
                if (state.characters) {
                    let pChar = state.characters.find(c => c.id === state.character.id);
                    if (pChar) pChar.hp = state.hp;
                }
            } else {
                state.hp += hpChange;
                logHistory(`--- Battle End: RECOVERY (+${hpChange} Player HP) ---`);
                
                if (state.characters) {
                    let pChar = state.characters.find(c => c.id === state.character.id);
                    if (pChar) pChar.hp = state.hp;
                }

                if (state.currentOpponent) {
                    logHistory(`--- Battle End: VICTORY (-${hpChange} ${state.currentOpponent.name} HP) ---`);
                    
                    let op = state.characters.find(c => c.id === state.currentOpponent.id);
                    if (op) {
                        op.hp -= hpChange;
                        if (op.hp <= 0) op.hp = 0;
                    }
                }
            }
            
            if (state.characters) {
                let bystanders = state.characters.filter(c => c.id !== state.character?.id && c.id !== (state.currentOpponent ? state.currentOpponent.id : '') && c.hp > 0);
                for (let i = 0; i < bystanders.length; i += 2) {
                    if (i + 1 < bystanders.length) {
                        let c1 = bystanders[i];
                        let c2 = bystanders[i+1];
                        let wagerAmount = Math.floor(state.round * 0.75) || 1;
                        if (Math.random() < 0.5) {
                            c1.hp += wagerAmount;
                            c2.hp -= wagerAmount;
                        } else {
                            c2.hp += wagerAmount;
                            c1.hp -= wagerAmount;
                        }
                        if (c1.hp < 0) c1.hp = 0;
                        if (c2.hp < 0) c2.hp = 0;
                    }
                }
            }

            const isPlayerDead = state.hp <= 0;
            let aliveOthers = state.characters ? state.characters.filter(c => c.id !== state.character?.id && c.hp > 0) : [];
            const areOthersDead = aliveOthers.length === 0;

            // FIX: The run ends if EITHER the player is dead OR all opponents are dead.
            // Previously, winning the final round would fall into the wrong branch.
            const isRunOver = isPlayerDead || areOthersDead;

            const modal = document.getElementById('battle-result-modal');
            const title = document.getElementById('battle-result-title');
            const desc = document.getElementById('battle-result-desc');
            const btn = modal.querySelector('button');
            modal.style.display = 'flex';

            if (isRunOver) {
                title.innerText = isPlayerDead ? (areOthersDead ? "PYRRHIC VICTORY" : "GAME OVER") : "CHAMPION!";
                title.style.color = isPlayerDead ? 'var(--health-color)' : 'var(--gold-color)';
                
                state.characters.sort((a,b) => b.hp - a.hp);
                let placement = state.characters.findIndex(c => c.id === state.character.id) + 1;
                let totalPlayers = state.characters.length;

                // PLACEMENT REWARDS
                let placementTrophies = (totalPlayers - placement + 1);
                if (placement === 1) placementTrophies += 5;
                if (placement === 2) placementTrophies += 3;
                if (placement === 3) placementTrophies += 2;
                
                metaProgress.trophies += placementTrophies;
                runStats.trophiesEarned += placementTrophies;
                
                // Onboarding check: Mark first run as finished
                metaProgress.runsFinished = (metaProgress.runsFinished || 0) + 1;
                saveProgress();

                desc.innerHTML = `You finished in ${placement}${getPlacementSuffix(placement)} place.<br>
                    <div style="margin-top:15px; font-size: 1.2em; color:var(--gold-color)">
                        +${placementTrophies} 🏆 Completion Bonus<br>
                        <b>Total Run Trophies: ${runStats.trophiesEarned} 🏆</b>
                    </div>`;
                
                btn.innerText = "MAIN MENU";
                btn.onclick = () => location.reload();
                if (!isPlayerDead) createCoinShower();
            } else {
                // Round continues — give gold and advance round
                const earnedGold = 10 + Math.floor(state.round / 2);
                state.gold += earnedGold;
                state.round++;
                state.shopLevel = Math.min(state.round, 10);
                
                if (state.characters) {
                    state.characters.forEach(ai => { if (ai.hp > 0) ai.gold += earnedGold; });
                }

                if (draw) {
                    title.innerText = "DRAW";
                    title.style.color = 'var(--gold-color)';
                    desc.innerHTML = `Stalemate! Both squads were wiped.<br>You earned ${earnedGold} Gold.`;
                } else if (!win) {
                    title.innerText = "DEFEAT";
                    title.style.color = 'var(--health-color)';
                    desc.innerHTML = `You lost the round!<br>You lost ${hpChange} HP.`;
                } else {
                    title.innerText = "VICTORY!";
                    title.style.color = 'var(--gold-color)';
                    desc.innerHTML = `You won the round!<br>You earned ${earnedGold} Gold.`;
                }
                btn.innerText = "CONTINUE";
                btn.onclick = closeBattleResult;
            }

            // Achievement Check
            const isWin = areOthersDead && !isPlayerDead;
            ACHIEVEMENT_DEFINITIONS.forEach(ach => {
                if (!metaProgress.achievements[ach.id]) {
                    if (ach.check(runStats, isWin)) {
                        metaProgress.achievements[ach.id] = true;
                        metaProgress.trophies += 5;
                        runStats.trophiesEarned += 5;
                        showAchievementToast(ach.name);
                    }
                }
            });
            saveProgress();
        }

        function showAchievementToast(name) {
            const toast = document.createElement('div');
            toast.innerHTML = `<div style="color:var(--gold-color);font-size:0.8em">ACHIEVEMENT UNLOCKED</div><div>${name}</div>`;
            toast.style.position = 'fixed';
            toast.style.bottom = '20px';
            toast.style.right = '20px';
            toast.style.background = 'rgba(0,0,0,0.9)';
            toast.style.color = 'white';
            toast.style.padding = '15px 25px';
            toast.style.borderRadius = '10px';
            toast.style.border = '2px solid var(--gold-color)';
            toast.style.zIndex = '8000';
            toast.style.fontWeight = 'bold';
            toast.style.animation = 'popIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 4000);
        }

        function getPlacementSuffix(n) {
            if (n === 1) return "st";
            if (n === 2) return "nd";
            if (n === 3) return "rd";
            return "th";
        }

        function createCoinShower() {
            for (let i = 0; i < 50; i++) {
                setTimeout(() => {
                    const coin = document.createElement('div');
                    coin.className = 'coin-particle';
                    coin.style.left = Math.random() * 100 + 'vw';
                    coin.style.animationDuration = (Math.random() * 1 + 1.5) + 's';
                    document.body.appendChild(coin);
                    setTimeout(() => coin.remove(), 2500);
                }, Math.random() * 1000);
            }
        }

        function closeBattleResult() {
            document.getElementById('battle-result-modal').style.display = 'none';
            document.getElementById('battle-view').style.display = 'none';
            document.getElementById('shop-phase').style.display = 'flex';
            document.getElementById('controls').style.display = 'flex';
            
            // JUICE: Round Income animation
            const income = 10 + Math.floor(state.round / 2);
            showFloatingStat(1, 'player-gold', `+${income} GOLD`, 'var(--gold-color)');
            createCoinBurst(income);

            refreshShop();
            simulateAITurns();
            updateUI();
        }

        function createCoinBurst(amount) {
            const goldEl = document.getElementById('player-gold');
            const rect = goldEl.getBoundingClientRect();
            for(let i=0; i<Math.min(amount, 15); i++) {
                setTimeout(() => {
                    createParticleBurst({x: rect.left + rect.width/2, y: rect.bottom + 20}, 'var(--gold-color)', 5);
                }, i * 50);
            }
        }

        /**
         * VISUALS
         */
        function showToast(msg, event) {
            const toast = document.createElement('div');
            toast.innerText = msg;
            toast.style.position = 'fixed';
            toast.style.background = 'rgba(0,0,0,0.8)';
            toast.style.color = 'var(--health-color)';
            toast.style.padding = '10px 20px';
            toast.style.borderRadius = '10px';
            toast.style.border = '2px solid var(--health-color)';
            toast.style.zIndex = '5000';
            toast.style.pointerEvents = 'none';
            toast.style.fontWeight = 'bold';
            toast.style.fontSize = '1.2em';
            toast.style.animation = 'floatUpToast 1.5s forwards';
            
            if (event && event.clientX) {
                toast.style.left = event.clientX + 'px';
                toast.style.top = event.clientY + 'px';
                toast.style.transform = 'translate(-50%, -100%)';
            } else {
                toast.style.left = '50%';
                toast.style.top = '50%';
                toast.style.transform = 'translate(-50%, -50%)';
            }
            
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 1500);
        }

        function showEffect(containerId, text, color) {
            const container = document.getElementById(containerId);
            if (!container) return;
            const rect = container.children[0]?.getBoundingClientRect() || container.getBoundingClientRect();
            showEffectAt(rect.left + rect.width / 2, rect.top + rect.height / 2, text, color);
        }

        function showEffectAt(x, y, text, color) {
            const el = document.createElement('div');
            el.className = 'floating-text';
            el.style.left = x + 'px';
            el.style.top = y + 'px';
            el.style.color = color || 'white';
            el.style.fontSize = '2.5em';
            el.style.textShadow = '0 0 10px rgba(0,0,0,0.8), 0 0 5px ' + color;
            el.innerText = text;
            document.body.appendChild(el);
            setTimeout(() => el.remove(), 1000);
        }

        function animateGoldCollection(sourcePos) {
            if (!sourcePos) return;
            const goldEl = document.getElementById('player-gold');
            if (!goldEl) return;
            const target = goldEl.getBoundingClientRect();
            
            for (let i = 0; i < 5; i++) {
                setTimeout(() => {
                    const coin = document.createElement('div');
                    coin.style.position = 'fixed';
                    coin.style.left = sourcePos.x + 'px';
                    coin.style.top = sourcePos.y + 'px';
                    coin.style.width = '15px';
                    coin.style.height = '15px';
                    coin.style.background = 'var(--gold-color)';
                    coin.style.borderRadius = '50%';
                    coin.style.boxShadow = '0 0 10px gold';
                    coin.style.zIndex = '9999';
                    coin.style.transition = 'all 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
                    document.body.appendChild(coin);
                    
                    // Force reflow
                    void coin.offsetWidth;
                    
                    coin.style.left = (target.left + target.width / 2) + 'px';
                    coin.style.top = (target.top + target.height / 2) + 'px';
                    coin.style.transform = 'scale(0.5)';
                    coin.style.opacity = '0';
                    
                    setTimeout(() => coin.remove(), 700);
                }, i * 100);
            }
        }

        function createVictoryConfetti() {
            for (let i = 0; i < 100; i++) {
                const conf = document.createElement('div');
                conf.style.position = 'fixed';
                conf.style.width = '10px';
                conf.style.height = '10px';
                conf.style.background = ['#f1c40f', '#e67e22', '#e74c3c', '#3498db', '#2ecc71'][Math.floor(Math.random()*5)];
                conf.style.left = Math.random() * 100 + 'vw';
                conf.style.top = '-10px';
                conf.style.zIndex = '9999';
                conf.style.borderRadius = '2px';
                conf.style.transition = `transform ${Math.random()*3+2}s linear, top ${Math.random()*3+2}s linear`;
                document.body.appendChild(conf);
                
                setTimeout(() => {
                    conf.style.top = '110vh';
                    conf.style.transform = `rotate(${Math.random()*1000}deg) translateX(${Math.random()*100-50}px)`;
                }, 10);
                
                setTimeout(() => conf.remove(), 5000);
            }
        }

        function calculateEffectiveStats(squad) {
            if (!squad) return [];
            let result = squad.map(m => m ? { ...m, atk: m.atk, hp: m.hp, tempModifiers: [] } : null);

            result.forEach((m, i) => {
                if (!m) return;
                // TEAM: +X/0 to EACH OTHER friendly card of same type
                if (m.effect && m.effect.startsWith("Team:")) {
                    const x = parseInt(m.effect.split(":")[1]);
                    result.forEach((other, j) => {
                        if (other && i !== j && other.type === m.type) {
                            other.atk += x;
                            other.tempModifiers.push({ name: `${m.name}'s Team Effect`, atk: x, hp: 0 });
                        }
                    });
                }
                // SOLO: +X/+X if no OTHER friendly cards share type
                if (m.effect && m.effect.startsWith("Solo:")) {
                    const x = parseInt(m.effect.split(":")[1]);
                    const othersOfSameType = result.filter((other, j) => other && i !== j && other.type === m.type);
                    if (othersOfSameType.length === 0) {
                        m.atk += x;
                        m.hp += x;
                        m.tempModifiers.push({ name: `Solo Synergy`, atk: x, hp: x });
                    }
                }
            });
            return result;
        }

        function updateUI() {
            document.getElementById('id-round-display') ? document.getElementById('id-round-display').innerText = `ROUND ${state.round}` : null;
            if (document.getElementById('round-display')) document.getElementById('round-display').innerText = `ROUND ${state.round}`;
            document.getElementById('shop-level-num').innerText = state.shopLevel;
            if (document.getElementById('player-hp')) {
                const hpEl = document.getElementById('player-hp');
                hpEl.innerHTML = `<img src="images/hp.png" class="icon-img"> ${Math.max(0, state.hp)}`;
                if (state.hp <= 3 && state.hp > 0) hpEl.classList.add('low-hp');
                else hpEl.classList.remove('low-hp');
            }
            document.getElementById('player-gold').innerHTML = `<img src="images/bag1.png" class="coin-bag icon-img" style="transform: scale(1.5); margin-right: 5px;"> <img src="images/win-icon.png" class="icon-img"> ${state.gold}`;

            updateTrophyDisplay();

            // Calculate squad with passives
            const effectiveSquad = calculateEffectiveStats(state.squad);

            updateSquadSummary(effectiveSquad);
            updateBattlePreview();

            // Render Squad Slots Dynamically
            const squadContainer = document.getElementById('squad-view');
            squadContainer.innerHTML = '';
            for (let i = 0; i < state.squadSize; i++) {
                const slot = document.createElement('div');
                slot.className = 'slot';
                const effectiveMonster = effectiveSquad[i];
                slot.onclick = () => {
                    if (effectiveMonster) openInspector(effectiveMonster, 'squad', i, slot);
                };
                
                // Drag & Drop Reordering
                slot.draggable = true;
                slot.ondragstart = (e) => {
                    e.dataTransfer.setData('text/plain', i);
                    slot.style.opacity = '0.5';
                };
                slot.ondragend = () => {
                    slot.style.opacity = '1';
                };
                slot.ondragover = (e) => {
                    e.preventDefault();
                    slot.classList.add('drag-over');
                };
                slot.ondragleave = () => {
                    slot.classList.remove('drag-over');
                };
                slot.ondrop = (e) => {
                    e.preventDefault();
                    slot.classList.remove('drag-over');
                    const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
                    if (fromIndex !== i) {
                        // Swap monsters in squad
                        const temp = state.squad[i];
                        state.squad[i] = state.squad[fromIndex];
                        state.squad[fromIndex] = temp;
                        logHistory(`Reordered Squad: Slot ${fromIndex+1} moved to Slot ${i+1}`);
                        updateUI();
                    }
                };

                renderCard(slot, effectiveSquad[i]);
                squadContainer.appendChild(slot);
            }

            // Render Shop Slots Dynamically
            const shopSlotsContainer = document.getElementById('shop-view-slots');
            shopSlotsContainer.innerHTML = '';
            state.shop.forEach((m, i) => {
                const slot = document.createElement('div');
                slot.className = 'slot';
                slot.onclick = () => inspectSlot('shop', i, slot);
                slot.oncontextmenu = (e) => { buyMonster(i, e); return false; };
                renderCard(slot, m, true);
                
                // Highlight discounted cards
                if (m) {
                    let totalDiscount = state.squad.filter(sm => sm !== null).reduce((sum, sm) => {
                        if (sm.effect && sm.effect.startsWith("Cheap:")) return sum + parseInt(sm.effect.split(":")[1]);
                        return sum;
                    }, 0);
                    if (totalDiscount > 0 && m.cost > 0) {
                        const cardDiv = slot.querySelector('.card');
                        if (cardDiv) cardDiv.classList.add('card-glow-green');
                        const costDiv = slot.querySelector('.card-cost');
                        if (costDiv) costDiv.style.color = '#2ecc71';
                    }
                }
                shopSlotsContainer.appendChild(slot);
            });

            // Update Expansion Buttons
            const squadBtn = document.getElementById('btn-expand-squad');
            const hasSquadUpgrade = metaProgress.purchasedUpgrades.includes("squad_expansion");
            if (state.squadSize < 8 && hasSquadUpgrade) {
                const cost = state.squadSize === 5 ? 15 : (state.squadSize === 6 ? 20 : 25);
                squadBtn.style.display = 'block';
                squadBtn.innerHTML = `Expand Team (${state.squadSize} -> ${state.squadSize+1}) <br> ${cost}<img src="images/win-icon.png" class="icon-img" style="width:1em">`;
                squadBtn.classList.toggle('btn-disabled', state.gold < cost);
            } else {
                squadBtn.style.display = 'none';
            }

            const shopBtn = document.getElementById('btn-expand-shop');
            const hasShopUpgrade = metaProgress.purchasedUpgrades.includes("shop_expansion");
            if (state.shopSize < 5 && hasShopUpgrade) {
                const cost = state.shopSize === 3 ? 10 : 15;
                shopBtn.style.display = 'block';
                shopBtn.innerHTML = `Expand Shop (${state.shopSize} -> ${state.shopSize+1}) <br> ${cost}<img src="images/win-icon.png" class="icon-img" style="width:1em">`;
                shopBtn.classList.toggle('btn-disabled', state.gold < cost);
            } else {
                shopBtn.style.display = 'none';
            }

            // Render Drawer Summary
            if (state.characters && document.getElementById('drawer-leaderboard-summary')) {
                const summary = document.getElementById('drawer-leaderboard-summary');
                summary.innerHTML = '';
                
                // Get all players, sort by HP (desc)
                const sorted = [...state.characters].sort((a, b) => b.hp - a.hp);
                
                const myChar = state.characters.find(c => c.id === state.character?.id);
                const others = sorted.filter(c => c.id !== state.character?.id);
                const leader = others[0]; // Highest excluding player

                const renderSummaryItem = (c, label) => {
                    const isDead = c.hp <= 0;
                    const hpText = isDead ? '<span class="dead-text">DEAD</span>' : `<img src="images/hp.png" class="icon-img"> ${c.hp}`;
                    return `
                        <div class="drawer-char ${c.id === myChar?.id ? 'is-player' : ''} ${isDead ? 'dead' : ''}" style="margin-bottom: 5px; padding: 5px;">
                            <div style="font-size: 0.6em; color: var(--gold-color); text-transform: uppercase;">${label}</div>
                            <div class="drawer-icon" style="font-size: 1.5em; margin: 0;">
                                ${c.icon}
                                <div class="skull-overlay">💀</div>
                            </div>
                            <span class="drawer-name" style="font-size: 0.6em;">${c.name}</span>
                            <div class="drawer-hp" style="font-size: 0.8em;">${hpText}</div>
                        </div>
                    `;
                };

                if (leader) summary.innerHTML += renderSummaryItem(leader, 'Leader');
                if (myChar) summary.innerHTML += renderSummaryItem(myChar, 'You');
            }
        }

        function openLobby() {
            const list = document.getElementById('full-lobby-list');
            list.innerHTML = '';
            
            // Sort by HP
            const sorted = [...state.characters].sort((a,b) => b.hp - a.hp);
            
            sorted.forEach((c, idx) => {
                const isPlayer = state.character && c.id === state.character.id;
                const isDead = c.hp <= 0;
                const hpText = isDead ? '<span class="dead-text">DEAD</span>' : `HP: ${c.hp}`;
                
                const item = document.createElement('div');
                item.style.display = 'flex';
                item.style.alignItems = 'center';
                item.style.padding = '10px';
                item.style.background = isPlayer ? 'rgba(255,215,0,0.1)' : 'rgba(255,255,255,0.05)';
                item.style.border = isPlayer ? '1px solid var(--gold-color)' : '1px solid #444';
                item.style.borderRadius = '10px';
                item.style.gap = '15px';
                item.style.opacity = isDead ? '0.5' : '1';
                
                item.innerHTML = `
                    <div style="font-size: 1.2em; font-weight: bold; width: 30px; color: ${idx === 0 ? 'var(--gold-color)' : '#888'}">#${idx + 1}</div>
                    <div style="font-size: 2em;">${c.icon}</div>
                    <div style="flex: 1; text-align: left;">
                        <div style="font-weight: bold; color: ${isPlayer ? 'var(--gold-color)' : 'white'}">${c.name} ${isPlayer ? '(YOU)' : ''}</div>
                        <div style="font-size: 0.8em; color: #aaa;">${c.hp > 0 ? 'Competing...' : 'Eliminated'}</div>
                    </div>
                    <div style="font-weight: bold; color: var(--health-color);">${hpText}</div>
                `;
                list.appendChild(item);
            });
            
            document.getElementById('lobby-modal').style.display = 'flex';
        }

        function closeLobby() {
            document.getElementById('lobby-modal').style.display = 'none';
        }

        function updateSquadSummary(effectiveSquad) {
            let totalAtk = 0;
            let totalHp = 0;
            let typeCounts = {};

            effectiveSquad.forEach(m => {
                if (m) {
                    totalAtk += m.atk;
                    totalHp += m.hp;
                    typeCounts[m.type] = (typeCounts[m.type] || 0) + 1;
                }
            });

            document.getElementById('total-squad-atk').innerText = totalAtk;
            document.getElementById('total-squad-hp').innerText = totalHp;

            const synergyContainer = document.getElementById('squad-type-synergies');
            synergyContainer.innerHTML = '';

            const typeIcons = {
                Beast: '🐾', Human: '👥', Genetic: '🧬', Mech: '⚙️', Nature: '🌿', Cosmic: '✨'
            };

            Object.keys(typeCounts).forEach(type => {
                const count = typeCounts[type];
                const badge = document.createElement('div');
                badge.className = `type-badge ${count >= 2 ? 'active' : ''}`;
                badge.style.color = `var(--${type.toLowerCase()}-color)`;
                badge.innerHTML = `${typeIcons[type]} ${count} ${type}`;
                synergyContainer.appendChild(badge);
            });

            const captainBox = document.getElementById('captain-passive-reminder');
            if (state.character) {
                captainBox.innerHTML = `
                    <div style="font-size: 1.5em;">${state.character.icon}</div>
                    <div style="flex: 1;">
                        <div style="font-weight: bold; color: var(--gold-color);">${state.character.name}</div>
                        <div style="font-size: 0.8em; opacity: 0.8;">${state.character.desc}</div>
                    </div>
                `;
            }
        }

        function updateBattlePreview() {
            const preview = document.getElementById('battle-preview-section');
            let opponents = state.characters ? state.characters.filter(c => c.id !== state.character?.id && c.hp > 0) : [];
            
            if (opponents.length === 0) {
                preview.style.display = 'none';
                return;
            }

            // In this version, we don't know EXACTLY who we fight until we click Fight, 
            // but we can show a "Potential Opponent" or the most dangerous one.
            // For now, let's just pick a random one to "tease".
            const teaserOpponent = opponents[0]; // Just show the top one or random
            
            const winProb = calculateWinProbability(state.squad, teaserOpponent);
            
            preview.style.display = 'flex';
            preview.innerHTML = `
                <div style="font-weight: bold; color: var(--text-color);">UPCOMING:</div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 1.2em;">${teaserOpponent.icon}</span>
                    <span style="font-weight: bold;">${teaserOpponent.name}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 10px;flex-direction:column">
                    <span style="font-size: 0.8em; opacity: 0.7;">WIN CHANCE:</span>
                    <div class="win-chance-bar">
                        <div class="win-chance-fill" style="width: ${winProb}%"></div>
                    </div>
                    <span style="font-weight: bold; width: 40px;">${winProb}%</span>
                </div>
            `;
        }

        function calculateWinProbability(playerSquad, opponent) {
            if (!opponent || !playerSquad) return 50;
            
            const playerStats = playerSquad.filter(m => m).reduce((acc, m) => ({ atk: acc.atk + m.atk, hp: acc.hp + m.hp }), { atk: 0, hp: 0 });
            const enemyStats = opponent.squad.filter(m => m).reduce((acc, m) => ({ atk: acc.atk + m.atk, hp: acc.hp + m.hp }), { atk: 0, hp: 0 });
            
            const playerPower = playerStats.atk + playerStats.hp;
            const enemyPower = enemyStats.atk + enemyStats.hp;
            
            if (playerPower === 0 && enemyPower === 0) return 50;
            if (playerPower === 0) return 0;
            if (enemyPower === 0) return 100;

            const ratio = playerPower / (playerPower + enemyPower);
            return Math.floor(ratio * 100);
        }

        function renderCard(slot, m, isShop = false) {
            slot.innerHTML = '';
            slot.classList.toggle('filled', !!m);
            // Remove old type classes
            ["Beast", "Human", "Genetic", "Mech", "Nature", "Cosmic"].forEach(t => slot.classList.remove(t));
            if (!m) return;
            if (m.type) slot.classList.add(m.type);

            const lvl = m.level || 1;
            const tierStr = m.tier || "E";
            const tierColor = TIER_COLORS[tierStr] || "#b0bec5";
            let totalDiscount = state.squad.filter(sm => sm !== null).reduce((sum, sm) => {
                if (sm.effect && sm.effect.startsWith("Cheap:")) {
                    return sum + parseInt(sm.effect.split(":")[1]);
                }
                return sum;
            }, 0);
            let currentCost = isShop ? Math.max(0, m.cost - totalDiscount) : m.cost;
            
            // Add indicator if player can afford it
            if (isShop && state.gold >= currentCost) {
                slot.classList.add('can-afford');
            } else {
                slot.classList.remove('can-afford');
            }

            slot.innerHTML = `
                ${isShop ? `<div class="card-cost" style="${state.gold < currentCost ? 'color: #e74c3c; border-color: #e74c3c;' : ''}">${currentCost}<img src="images/win-icon.png" class="icon-img" style="width:1em;height:1em;"></div>` : ''}
                <div class="card-tier" style="background: ${tierColor};">${tierStr}</div>
                <div class="card-level">${lvl}</div>
                <div class="card">
                    <img src="${m.image}" alt="${m.name}" class="card-image">
                    <div class="card-stats">
                        <span class="c-atk">⚔️ ${m.atk}</span>
                        <span class="c-hp"><img src="images/hp.png" class="icon-img"> ${m.hp}</span>
                    </div>
                </div>
            `;
        }

        function renderBattle() {
            const allyLine = document.getElementById('ally-line');
            const enemyLine = document.getElementById('enemy-line');
            allyLine.innerHTML = ''; enemyLine.innerHTML = '';

            battleData.ally.forEach(m => {
                const div = document.createElement('div');
                div.className = 'slot filled';
                div.onclick = function() {
                    // Custom inspect for battle
                    inspectMonsterOnly(m, this);
                }
                renderCard(div, { ...m, atk: m.cAtk, hp: m.cHp });
                allyLine.appendChild(div);
            });

            battleData.enemy.forEach(m => {
                const div = document.createElement('div');
                div.className = 'slot filled';
                div.onclick = function() {
                    inspectMonsterOnly(m, this);
                }
                renderCard(div, { ...m, atk: m.cAtk, hp: m.cHp });
                enemyLine.appendChild(div);
            });
        }

        function openShopLevelPopup() {
            const modal = document.getElementById('shop-level-modal');
            const card = document.getElementById('shop-flip-card');
            const level = state.shopLevel;
            
            document.getElementById('popup-shop-level').innerText = level;
            card.classList.remove('flipped');
            
            // Populate Front
            const container = document.getElementById('tier-chances-container');
            container.innerHTML = '';
            
            const idx = Math.min(level - 1, SHOP_LEVEL_WEIGHTS.length - 1);
            const weights = SHOP_LEVEL_WEIGHTS[idx];
            
            TIER_NAMES.forEach((name, i) => {
                const weight = weights[i];
                const color = TIER_COLORS[name];
                
                const row = document.createElement('div');
                row.className = 'chance-row';
                row.innerHTML = `
                    <div class="chance-label" style="color: ${color}">${name}</div>
                    <div class="chance-bar-bg">
                        <div class="chance-bar-fill" style="width: 0%; background: ${color}"></div>
                    </div>
                    <div class="chance-pct">${weight}%</div>
                `;
                container.appendChild(row);
                
                // Animate bar
                setTimeout(() => {
                    const bar = row.querySelector('.chance-bar-fill');
                    if (bar) bar.style.width = weight + '%';
                }, 100 + i * 50);
            });
            
            // Populate Back Table
            const tbody = document.getElementById('full-weights-table');
            tbody.innerHTML = '';
            SHOP_LEVEL_WEIGHTS.forEach((rowWeights, i) => {
                const tr = document.createElement('tr');
                if (i + 1 === level) tr.className = 'current-level';
                tr.innerHTML = `<td>${i + 1}</td>` + rowWeights.map(w => `<td>${w}%</td>`).join('');
                tbody.appendChild(tr);
            });

            modal.style.display = 'flex';
            
            // Flip Animation on open
            card.style.transform = 'rotateY(-180deg)';
            setTimeout(() => {
                card.style.transition = 'transform 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
                card.style.transform = 'rotateY(0deg)';
            }, 10);
        }

        function closeShopLevelPopup() {
            const modal = document.getElementById('shop-level-modal');
            modal.style.display = 'none';
        }

        function inspectMonsterOnly(m, element) {
            openInspector(m, 'battle', null, element);
        }

        function openStore() {
            renderStore();
            document.getElementById('store-modal').style.display = 'flex';
        }

        function closeStore() {
            document.getElementById('store-modal').style.display = 'none';
        }

        function openGallery() {
            renderGallery();
            document.getElementById('gallery-modal').style.display = 'flex';
        }

        function closeGallery() {
            document.getElementById('gallery-modal').style.display = 'none';
        }

        function renderGallery() {
            const grid = document.getElementById('gallery-grid');
            grid.innerHTML = '';
            
            // Sort by tier (S=0, A=1, B=2...) then Name
            const sortedMonsters = [...MONSTER_REGISTRY].sort((a, b) => {
                const tiers = "SABCD E";
                let tA = tiers.indexOf(a.tier) !== -1 ? tiers.indexOf(a.tier) : 99;
                let tB = tiers.indexOf(b.tier) !== -1 ? tiers.indexOf(b.tier) : 99;
                if(tA !== tB) return tA - tB;
                return a.name.localeCompare(b.name);
            });

            sortedMonsters.forEach(m => {
                const isUnlocked = !m.locked || metaProgress.unlockedCards.includes(m.id);
                const tierColor = TIER_COLORS[m.tier || "E"] || "#b0bec5";
                
                const div = document.createElement('div');
                div.className = 'gallery-item';
                div.onclick = function() {
                    this.classList.toggle('flipped');
                };

                if (isUnlocked) {
                    div.innerHTML = `
                        <div class="gallery-item-inner">
                            <div class="gallery-card-front">
                                <div class="tier" style="background: ${tierColor}">${m.tier || "E"}</div>
                                <img src="${m.image}" alt="${m.name}">
                                <div class="name">${m.name}</div>
                            </div>
                            <div class="gallery-card-back">
                                <div>
                                    <div class="type">${m.type}</div>
                                    <div class="name" style="font-weight: bold; font-size: 1.4em; color: white;">${m.name}</div>
                                </div>
                                <div class="stats">
                                    <span class="c-atk">⚔️ ${m.atk}</span>
                                    <span class="c-hp"><img src="images/hp.png" class="icon-img" style="width: 1em;"> ${m.hp}</span>
                                </div>
                                <div class="effect">${m.effectDesc || ''}</div>
                                <div class="flavor">"${m.flavor || ''}"</div>
                            </div>
                        </div>
                    `;
                } else {
                    div.innerHTML = `
                        <div class="gallery-item-inner">
                            <div class="gallery-card-front" style="filter: grayscale(1); opacity: 0.5; border-color: #555;">
                                <div class="tier" style="background: #555">?</div>
                                <img src="images/demon.png" alt="Locked" style="opacity: 0.3;">
                                <div class="name">LOCKED</div>
                            </div>
                            <div class="gallery-card-back" style="border-color: #555;">
                                <div style="display:flex; justify-content:center; align-items:center; height:100%; color: #888; font-size: 1.2em;">
                                    Unlock in Upgrades Store
                                </div>
                            </div>
                        </div>
                    `;
                    div.onclick = null; // Do not flip locked cards
                }
                grid.appendChild(div);
            });
        }

        function renderStore() {
            const charUpgradesGrid = document.getElementById('char-upgrades-grid');
            const cardUnlocksGrid = document.getElementById('card-unlocks-grid');
            const charUnlocksGrid = document.getElementById('char-unlocks-grid');
            
            charUpgradesGrid.innerHTML = '';
            cardUnlocksGrid.innerHTML = '';
            charUnlocksGrid.innerHTML = '';
            
            // Render Character Unlocks
            CHARACTERS.forEach(char => {
                const isUnlocked = metaProgress.unlockedCharacters.includes(char.id);
                if (char.id === 'vance' || isUnlocked) return; // Don't show in store if unlocked

                const fights = metaProgress.heroFights[char.id] || 0;
                const wins = metaProgress.heroWins[char.id] || 0;
                const cost = Math.max(0, 1000 - (fights * 50) - (wins * 50));
                const canAfford = metaProgress.trophies >= cost;
                
                const div = document.createElement('div');
                div.className = `shop-item`;
                div.innerHTML = `
                    <div class="item-icon">${char.icon}</div>
                    <div class="item-name">${char.name}</div>
                    <div class="item-desc">${char.desc}<br><small>(${fights} Fights, ${wins} Wins)</small></div>
                    <div class="item-price ${canAfford ? '' : 'disabled'}" onclick="unlockCharacter('${char.id}', ${cost})">🏆 ${cost}</div>
                `;
                charUnlocksGrid.appendChild(div);
            });

            // Render Character Upgrades
            UPGRADES_REGISTRY.forEach(upg => {
                const isPurchased = metaProgress.purchasedUpgrades.includes(upg.id);
                const canAfford = metaProgress.trophies >= upg.price;
                
                const div = document.createElement('div');
                div.className = `shop-item ${isPurchased ? 'purchased' : ''}`;
                div.innerHTML = `
                    <div class="item-icon">${upg.icon}</div>
                    <div class="item-name">${upg.name}</div>
                    <div class="item-desc">${upg.desc}</div>
                    ${isPurchased ? '<div class="item-purchased">PURCHASED</div>' : 
                    `<div class="item-price ${canAfford ? '' : 'disabled'}" onclick="buyUpgrade('${upg.id}', ${upg.price})">🏆 ${upg.price}</div>`}
                `;
                charUpgradesGrid.appendChild(div);
            });
            
            // Render Card Unlocks (Filter by character ownership)
            MONSTER_REGISTRY.filter(m => m.locked).forEach(card => {
                const isUnlocked = metaProgress.unlockedCards.includes(card.id);
                if (isUnlocked) return;

                const parentChar = CHARACTERS.find(c => c.type === card.type);
                const isParentUnlocked = parentChar ? metaProgress.unlockedCharacters.includes(parentChar.id) : true;
                const canAfford = metaProgress.trophies >= card.unlockPrice;
                
                const div = document.createElement('div');
                div.className = `shop-item ${isParentUnlocked ? '' : 'disabled'}`;
                let unlockText = `<div class="item-price ${canAfford && isParentUnlocked ? '' : 'disabled'}" onclick="unlockCard('${card.id}', ${card.unlockPrice})">🏆 ${card.unlockPrice}</div>`;
                if (!isParentUnlocked) {
                    unlockText = `<div style="font-size: 0.8em; color: #e74c3c; margin-top: 10px;">LOCKED: Unlock ${parentChar ? parentChar.name : card.type + ' Hero'} First</div>`;
                }

                div.innerHTML = `
                    <img src="${card.image}" class="item-image" style="${isParentUnlocked ? '' : 'filter: grayscale(1); opacity: 0.5;'}">
                    <div class="item-name">${card.name}</div>
                    <div class="item-desc">${card.effectDesc}</div>
                    ${unlockText}
                `;
                cardUnlocksGrid.appendChild(div);
            });
            
            updateTrophyDisplay();
        }

        function buyUpgrade(id, price) {
            if (metaProgress.trophies >= price && !metaProgress.purchasedUpgrades.includes(id)) {
                metaProgress.trophies -= price;
                metaProgress.purchasedUpgrades.push(id);
                saveProgress();
                renderStore();
            }
        }

        function unlockCard(id, price) {
            const card = MONSTER_REGISTRY.find(m => m.id === id);
            const parentChar = CHARACTERS.find(c => c.type === (card ? card.type : ''));
            const isParentUnlocked = parentChar ? metaProgress.unlockedCharacters.includes(parentChar.id) : true;

            if (!isParentUnlocked) {
                showToast(`Unlock ${parentChar ? parentChar.name : card.type + ' Hero'} first!`);
                return;
            }

            if (metaProgress.trophies >= price && !metaProgress.unlockedCards.includes(id)) {
                metaProgress.trophies -= price;
                metaProgress.unlockedCards.push(id);
                saveProgress();
                renderStore();
                showToast("Card Unlocked!");
            } else if (metaProgress.trophies < price) {
                showToast("Not enough trophies!");
            }
        }

        function unlockCharacter(id, price) {
            if (metaProgress.trophies >= price && !metaProgress.unlockedCharacters.includes(id)) {
                metaProgress.trophies -= price;
                metaProgress.unlockedCharacters.push(id);
                saveProgress();
                renderStore();
            }
        }

        function openCredits() {
            document.getElementById('credits-modal').style.display = 'flex';
        }

        function closeCredits() {
            document.getElementById('credits-modal').style.display = 'none';
        }

        /**
         * JUICY VISUAL EFFECTS
         */
        function showFloatingStat(index, containerId, text, color) {
            let container;
            if (containerId === 'squad') container = document.getElementById('squad-view');
            else container = document.getElementById(containerId);
            
            if (!container) return;
            const target = container.children[index];
            if (!target) return;

            const rect = target.getBoundingClientRect();
            const el = document.createElement('div');
            el.className = 'floating-stat';
            el.innerText = text;
            el.style.color = color;
            el.style.left = (rect.left + rect.width / 2) + 'px';
            el.style.top = (rect.top + rect.height / 2) + 'px';
            el.style.fontSize = '2em';
            el.style.textShadow = '0 0 10px rgba(0,0,0,0.8)';
            el.style.position = 'fixed';
            
            document.body.appendChild(el);
            setTimeout(() => el.remove(), 1200);
        }

        function createParticleBurst(pos, color, count = 10) {
            const centerX = pos ? pos.x : window.innerWidth / 2;
            const centerY = pos ? pos.y : window.innerHeight / 2;

            for (let i = 0; i < count; i++) {
                const p = document.createElement('div');
                p.style.position = 'fixed';
                p.style.width = '6px';
                p.style.height = '6px';
                p.style.background = color;
                p.style.borderRadius = '50%';
                p.style.left = centerX + 'px';
                p.style.top = centerY + 'px';
                p.style.zIndex = '10000';
                p.style.pointerEvents = 'none';
                
                const angle = Math.random() * Math.PI * 2;
                const speed = 2 + Math.random() * 5;
                const vx = Math.cos(angle) * speed;
                const vy = Math.sin(angle) * speed;
                
                document.body.appendChild(p);
                
                let life = 1;
                const anim = () => {
                    life -= 0.02;
                    if (life <= 0) {
                        p.remove();
                        return;
                    }
                    p.style.left = parseFloat(p.style.left) + vx + 'px';
                    p.style.top = parseFloat(p.style.top) + vy + 'px';
                    p.style.opacity = life;
                    requestAnimationFrame(anim);
                };
                requestAnimationFrame(anim);
            }
        }

        function createProjectile(fromEl, toEl, type) {
            if (!fromEl || !toEl) return;
            const fromRect = fromEl.getBoundingClientRect();
            const toRect = toEl.getBoundingClientRect();

            const p = document.createElement('div');
            p.style.position = 'fixed';
            p.style.width = '20px';
            p.style.height = '6px';
            p.style.borderRadius = '3px';
            p.style.zIndex = '500';
            p.style.pointerEvents = 'none';
            p.style.background = `var(--${type.toLowerCase()}-color)`;
            p.style.boxShadow = `0 0 10px var(--${type.toLowerCase()}-color)`;

            const startX = fromRect.left + fromRect.width / 2;
            const startY = fromRect.top + fromRect.height / 2;
            const endX = toRect.left + toRect.width / 2;
            const endY = toRect.top + toRect.height / 2;

            p.style.left = startX + 'px';
            p.style.top = startY + 'px';
            
            const angle = Math.atan2(endY - startY, endX - startX);
            p.style.transform = `rotate(${angle}rad)`;

            document.body.appendChild(p);
            
            const duration = 400 / combatSpeed;
            const startTime = Date.now();

            const anim = () => {
                const now = Date.now();
                const progress = (now - startTime) / duration;
                if (progress >= 1) {
                    p.remove();
                    createParticleBurst({x: endX, y: endY}, `var(--${type.toLowerCase()}-color)`, 8);
                    return;
                }
                p.style.left = startX + (endX - startX) * progress + 'px';
                p.style.top = startY + (endY - startY) * progress + 'px';
                requestAnimationFrame(anim);
            };
            requestAnimationFrame(anim);
        }

        init();
    
const fs = require('fs');

const dataStr = fs.readFileSync('data.json', 'utf8');
const data = JSON.parse(dataStr);

data.keywords = {
    "Team": { "color": "var(--gold-color)", "desc": "Stats to allies of same type at start of battle.", "template": "TEAM: +{X}/0 to each other friendly {Type}." },
    "Shield": { "color": "#3498db", "desc": "Blocks the first damage instance.", "template": "SHIELD: Blocks the first instance of damage." },
    "Thorn": { "color": "#e74c3c", "desc": "Damage back to attacker when hit.", "template": "THORN: Deal {X} damage back when hit." },
    "Anger": { "color": "var(--beast-color)", "desc": "Attack to allies when this dies.", "template": "ANGER: +{X}/0 to other friendly cards on death." },
    "Honor": { "color": "var(--nature-color)", "desc": "HP to allies when this dies.", "template": "HONOR: 0/+{X} to other friendly cards on death." },
    "Twin": { "color": "var(--human-color)", "desc": "Only 1 duplicate needed to Merge.", "template": "TWIN: Merge with 2 instead of 3." },
    "Vampire": { "color": "var(--health-color)", "desc": "Heal on hit (up to max HP).", "template": "VAMPIRE: Heal up to {X} HP on hit." },
    "Fury": { "color": "var(--beast-color)", "desc": "Gain stats when an ally dies.", "template": "FURY: Gain +{X}/+{X} when a friendly card dies." },
    "Taunt": { "color": "#3498db", "desc": "Enemies MUST attack this unit first.", "template": "TAUNT: Enemies MUST attack this unit first." },
    "Poison": { "color": "var(--genetic-color)", "desc": "Deals damage over time each clash.", "template": "POISON: Deals {X} damage over time each clash." },
    "Regen": { "color": "var(--nature-color)", "desc": "Heals at start of each clash.", "template": "REGEN: Heals {X} HP at the start of each clash." },
    "Extra": { "color": "var(--cosmic-color)", "desc": "Spawns token on death.", "template": "EXTRA: Spawn a {X}/{Y} on death." },
    "Weak": { "color": "var(--health-color)", "desc": "Nerf random enemy permanently on death.", "template": "WEAK: -{X}/-{X} to enemy random card on death." },
    "Solo": { "color": "var(--genetic-color)", "desc": "Start-of-battle buff if unique type.", "template": "SOLO: +{X}/+{X} if there are no other {Type}s." },
    "Crit": { "color": "var(--gold-color)", "desc": "Attacks have {X}% chance to deal double damage.", "template": "CRIT: Attacks have {X}% chance to deal double damage.", "default": 25 },
    "Echo": { "color": "#e74c3c", "desc": "After attacking, {X}% chance to attack again immediately.", "template": "ECHO: After attacking, {X}% chance to attack again immediately.", "default": 30 },
    "Recruit": { "color": "var(--human-color)", "desc": "When bought: gain +{X}/+{X}.", "template": "RECRUIT: When bought: gain +{X}/+{X}.", "default": 2 },
    "Aura": { "color": "var(--mech-color)", "desc": "Adjacent allies gain +{X} {Y}.", "template": "AURA: Adjacent allies gain +{X} {Y}." },
    "Bounty": { "color": "var(--gold-color)", "desc": "When this dies (or is sold): gain {X} gold.", "template": "BOUNTY: When this dies (or is sold): gain {X} gold." },
    "LastStand": { "color": "var(--health-color)", "desc": "If this would die, survive with 1 HP once per combat.", "template": "LASTSTAND: Survive with 1 HP once per combat." },
    "Cheap": { "color": "var(--gold-color)", "desc": "-{X} to cost in shop.", "template": "CHEAP: -{X} to cost in shop." }
};

if (data.monsters) {
    data.monsters.forEach(m => {
        if (m.effectDesc) {
            delete m.effectDesc;
        }
    });
}

fs.writeFileSync('data.json', JSON.stringify(data, null, 2));
console.log('Updated data.json successfully.');

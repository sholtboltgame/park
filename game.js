import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getAuth, signInAnonymously, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-analytics.js";

// ARKA PLAN MÜZİĞİ
const bgMusic = new Audio('sholtboltmenu.mp3');
bgMusic.loop = true;
bgMusic.volume = 0.4; // Ses seviyesi %40

let firebaseConfig;
if (typeof __firebase_config !== 'undefined') {
    firebaseConfig = JSON.parse(__firebase_config);
} else {
    firebaseConfig = {
        apiKey: "AIzaSyCqsyFZGtgEdUY9iQ-dlovN5r1CkyLyPIU",
        authDomain: "sholboltgame.firebaseapp.com",
        projectId: "sholboltgame",
        storageBucket: "sholboltgame.firebasestorage.app",
        messagingSenderId: "853037432924",
        appId: "1:853037432924:web:334055b440c1a974002699",
        measurementId: "G-5DFTRVFYGQ"
    };
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
let analytics;
try { analytics = getAnalytics(app); } catch(e) { console.log("Analytics not supported in this env"); }

const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

const initAuth = async () => {
    try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
            await signInWithCustomToken(auth, __initial_auth_token);
        } else {
            await signInAnonymously(auth);
        }
        console.log("Connected to Game Server");
    } catch (error) {
        console.error("Auth Error", error);
    }
};
initAuth();

let currentUserDoc = null;
let isGuest = true;

window.refreshLeaderboardUI = async () => {
    const list = document.getElementById('leaderboardList');
    const t = TRANSLATIONS[SETTINGS.language];
    list.innerHTML = `<tr><td colspan="3" style="text-align:center; color:#aaa; padding:20px;">${t.lb_loading || 'LOADING...'}</td></tr>`;
    
    const top10 = await window.getTop10Scores();
    
    list.innerHTML = '';
    if (top10.length === 0) {
        list.innerHTML = `<tr><td colspan="3" style="text-align:center; color:#aaa; padding:20px;">${t.lb_no_scores || 'NO SCORES YET'}</td></tr>`;
    } else {
        top10.forEach((item, index) => {
            const tr = document.createElement('tr');
            tr.className = 'lb-row';
            let rankColor = "#fff";
            if(index===0) rankColor="#ffd700";
            if(index===1) rankColor="#c0c0c0";
            if(index===2) rankColor="#cd7f32";
            
            tr.innerHTML = `
                <td class="lb-rank" style="color:${rankColor}">#${index + 1}</td>
                <td class="lb-name">${item.name.toUpperCase()}</td>
                <td class="lb-score">${item.score.toLocaleString()}</td>
            `;
            list.appendChild(tr);
        });
    }
}

window.addScore = async (username, score) => {
    if(!username || isGuest) return; 
    try {
        if (!auth.currentUser) await initAuth();
        const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'highscores', username);
        const docSnap = await getDoc(docRef);
        let shouldUpdate = true;
        
        if (docSnap.exists()) {
            const currentData = docSnap.data();
            if (currentData.score >= score) {
                shouldUpdate = false;
            }
        }
        
        if (shouldUpdate) {
            await setDoc(docRef, {
                score: Number(score),
                timestamp: new Date().toISOString()
            });
            if(document.getElementById('leaderboardModal').style.display === 'flex') {
                window.refreshLeaderboardUI();
            }
        }
    } catch(e) {
        console.error("Error saving score:", e);
    }
}

window.getTop10Scores = async () => {
    try {
        if (!auth.currentUser) await initAuth();
        const colRef = collection(db, 'artifacts', appId, 'public', 'data', 'highscores');
        const snapshot = await getDocs(colRef);
        let scores = [];
        snapshot.forEach(doc => { scores.push({ name: doc.id, ...doc.data() }); });
        scores.sort((a, b) => b.score - a.score);
        return scores.slice(0, 10);
    } catch (e) { return []; }
}

window.toggleLeaderboard = async function() {
    const modal = document.getElementById('leaderboardModal');
    if (modal.style.display === 'flex') {
        modal.style.display = 'none';
    } else {
        if(GAME.isStoreOpen) window.toggleShop();
        if(GAME.isWeaponStoreOpen) window.toggleInventory();
        if(GAME.isProfileOpen) window.toggleProfile();
        if(GAME.isSettingsOpen) window.toggleSettings();
        if(GAME.isPromoOpen) window.togglePromo();
        
        modal.style.display = 'flex';
        window.refreshLeaderboardUI();
    }
}

window.handleRegister = async () => {
    const user = document.getElementById('authUsername').value.trim().toLowerCase();
    const pass = document.getElementById('authPassword').value;
    const status = document.getElementById('authStatus');
    
    if(!user || !pass) { status.innerText = "ENTER USERNAME & PASSWORD"; return; }
    if(user.length < 3) { status.innerText = "USERNAME TOO SHORT"; return; }
    
    status.style.color = "#eab308";
    status.innerText = "CONNECTING...";
    
    try {
        if (!auth.currentUser) await initAuth(); 
        const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'accounts', user);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            status.style.color = "#ef4444";
            status.innerText = "USERNAME TAKEN";
        } else {
            await setDoc(docRef, {
                password: btoa(pass), 
                saveData: defaultGame,
                createdAt: new Date().toISOString()
            });
            status.style.color = "#22c55e";
            status.innerText = "REGISTERED! PLEASE LOGIN.";
        }
    } catch(e) {
        console.error(e);
        status.style.color = "#ef4444";
        status.innerText = "SERVER ERROR (TRY GUEST)";
    }
}

window.handleLogin = async () => {
    const user = document.getElementById('authUsername').value.trim().toLowerCase();
    const pass = document.getElementById('authPassword').value;
    const status = document.getElementById('authStatus');
    
    if(!user || !pass) { status.innerText = "ENTER USERNAME & PASSWORD"; return; }
    
    status.style.color = "#eab308";
    status.innerText = "LOGGING IN...";
    
    try {
        if (!auth.currentUser) await initAuth();

        const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'accounts', user);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            const data = docSnap.data();
            if(data.password === btoa(pass)) {
                currentUserDoc = user;
                isGuest = false;
                if(data.saveData) {
                    GAME = { ...defaultGame, ...data.saveData };
                    // Safe guard for old saves
                    if(!GAME.modeLevels) GAME.modeLevels = {classic:1, reflex:1, hostage:1, defense:1};
                    // Backwards compatibility for patches
                    if(!GAME.ownedPatches) GAME.ownedPatches = ['patch_ops'];
                    if(!GAME.currentPatch) GAME.currentPatch = 'patch_ops';
                    
                    SETTINGS.language = GAME.settings.lang || 'en';
                    SETTINGS.resolution = GAME.settings.res || 'auto'; 
                    SETTINGS.graphics = GAME.settings.gfx || 'high';
                }
                
                document.getElementById('authModal').style.display = 'none';
                document.getElementById('lobbyScreen').style.display = 'flex';
                updateCloudStatus("ONLINE: " + user.toUpperCase(), "#22c55e");
                initGameUI();
            } else {
                status.style.color = "#ef4444";
                status.innerText = "WRONG PASSWORD";
            }
        } else {
            status.style.color = "#ef4444";
            status.innerText = "USER NOT FOUND";
        }
    } catch(e) {
        console.error(e);
        status.style.color = "#ef4444";
        status.innerText = "CONNECTION FAILED";
    }
}

window.handleGuest = () => {
    isGuest = true;
    currentUserDoc = null;
    try { 
        let saved = JSON.parse(localStorage.getItem('glock_classic_save'));
        if(saved) {
             GAME = { ...defaultGame, ...saved };
             if(!GAME.modeLevels) GAME.modeLevels = {classic:1, reflex:1, hostage:1, defense:1};
             // Backwards compatibility for patches
             if(!GAME.ownedPatches) GAME.ownedPatches = ['patch_ops'];
             if(!GAME.currentPatch) GAME.currentPatch = 'patch_ops';
        }
    } catch(e) {}
    
    document.getElementById('authModal').style.display = 'none';
    document.getElementById('lobbyScreen').style.display = 'flex';
    updateCloudStatus("GUEST MODE (LOCAL ONLY)", "#fbbf24");
    initGameUI();
}

function updateCloudStatus(text, color) {
    document.getElementById('cloudText').innerText = text;
    document.getElementById('cloudIndicator').style.background = color;
}

window.saveGame = async function() {
    GAME.settings = { lang: SETTINGS.language, res: SETTINGS.resolution, gfx: SETTINGS.graphics };
    const dataToSave = { ...GAME, state: 'lobby', isPaused: false, isPromoOpen: false };
    try { localStorage.setItem('glock_classic_save', JSON.stringify(dataToSave)); } catch(e) {}
    
    if(!isGuest && currentUserDoc) {
        try {
            const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'accounts', currentUserDoc);
            await setDoc(docRef, { saveData: dataToSave }, { merge: true });
            const ind = document.getElementById('cloudIndicator');
            ind.style.boxShadow = "0 0 10px #22c55e";
            setTimeout(() => ind.style.boxShadow = "none", 500);
        } catch(e) { console.error("Cloud Save Fail", e); }
    }
}

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const gameContainer = document.getElementById('gameContainer');

const ui = {
    lobbyScreen: document.getElementById('lobbyScreen'),
    mainMenu: document.getElementById('mainMenu'),
    selectedModeDisplay: document.getElementById('selectedModeDisplay'),
    menuDmgLevel: document.getElementById('menuDmgLevel'),
    menuBalance: document.getElementById('menuBalance'),
    hudElements: document.querySelectorAll('.hud-element'),
    hostagePanel: document.getElementById('hostagePanel'), 
    hitCountDisplay: document.getElementById('hitCountDisplay'), 
    ammoCount: document.getElementById('ammoCount'), ammoBar: document.getElementById('ammoBar'),
    levelText: document.getElementById('levelText'), scoreDisplay: document.getElementById('scoreDisplay'),
    coinDisplay: document.getElementById('coinDisplay'), notify: document.getElementById('levelNotify'),
    storeModal: document.getElementById('storeModal'), storeList: document.getElementById('storeSkinsList'),
    weaponModal: document.getElementById('weaponModal'), weaponList: document.getElementById('weaponList'),
    profileModal: document.getElementById('profileModal'),
    timerDisplay: document.getElementById('timerDisplay'), rankTitle: document.getElementById('rankTitle'),
    currentRankIcon: document.getElementById('currentRankIcon'), rankSub: document.getElementById('rankSub'),
    weaponLevelText: document.getElementById('weaponLevelText'), rankInfoModal: document.getElementById('rankInfoModal'),
    rankListContainer: document.getElementById('rankListContainer'), gunName: document.getElementById('gunNameDisplay'),
    tutorialOverlay: document.getElementById('tutorialOverlay'), tutObjective: document.getElementById('tut-objective-text'),
    rankPanel: document.getElementById('rankPanel'), rankModalContent: document.getElementById('rankModalContent'),
    rankProgressBar: document.getElementById('rankProgressBar'), rankProgressText: document.getElementById('rankProgressText'),
    exitModal: document.getElementById('exitModal'),
    settingsModal: document.getElementById('settingsModal'),
    resSelect: document.getElementById('resSelect'), gfxSelect: document.getElementById('gfxSelect'), langSelect: document.getElementById('langSelect'),
    promoModal: document.getElementById('promoModal'), promoInput: document.getElementById('promoInput'), promoResult: document.getElementById('promoResult'),
    leaderboardModal: document.getElementById('leaderboardModal'),
    menuRankWidget: document.querySelector('.menu-rank-widget'),
    menuRankIcon: document.getElementById('menuRankIcon'),
    menuRankName: document.getElementById('menuRankName'),
    devConsole: document.getElementById('devConsole'),
    consoleLog: document.getElementById('consoleLog'),
    consoleInput: document.getElementById('consoleInput')
};

let width, height;
const GRAVITY = 0.6;
let menuRotation = 0; 
let mouse = { x: 0, y: 0 };
const UPGRADE = { active: false, phase: 0, timer: 0, boxY: -100, boxScale: 1, glow: 0, particles: [] };

const SETTINGS = { language: 'en', resolution: 'auto', graphics: 'high' };

const TRANSLATIONS = {
    tr: {
        lobby_header: "SHOLTBOLT", lobby_sub: "OPERASYON SEÇİMİ",
        tag_hard: "ZOR", tag_timed: "ZAMANLI", tag_standard: "STANDART", tag_locked: "KİLİTLİ", tag_survival: "HAYATTA KAL",
        mode_reflex_title: "REFLEX OPS", mode_reflex_desc: "Hedefler aniden belirir ve kaybolur. Sadece en hızlılar hayatta kalır.",
        mode_hostage_title: "REHİNE KRİZİ", mode_hostage_desc: "Market baskını! 25 saniyede düşmanları temizle ve rehineyi kurtar.",
        mode_classic_title: "KARGO SAVUNMASI", mode_classic_desc: "Klasik oyun modu. Düşen kargo sandıklarını yok et ve puan kazan.",
        mode_defense_title: "SAVUNMA HATTI", mode_defense_desc: "Kutular saldırıyor! Sana temas etmeden hepsini yok et.",
        mode_range_title: "POLİGON", mode_range_desc: "Haraketli hedefler. Keskin nişancı eğitimi için ideal. (Yakında)",
        mode_comp_title: "REKABETÇİ", mode_comp_desc: "Sıralamalı maçlar. 5v5 Simülasyonu. (Yakında)",
        tut_reflex: "Kırmızı hedefler aniden belirir. Süre bitmeden vur!",
        tut_hostage: "REHİNEYİ KURTARMAK İÇİN HEPSİNİ VUR!",
        tut_classic: "Blokları yok et, para kazan ve silahını güçlendir.",
        tut_defense: "DÜŞMANLAR YAKLAŞIYOR! TEMAS ETMEDEN VUR!",
        msg_timeup: "SÜRE BİTTİ!", msg_level_clear: "BÖLÜM GEÇİLDİ!", msg_all_saved: "TÜM REHİNELER KURTARILDI!", msg_saved: "REHİNE KURTARILDI!",
        msg_breach: "SINIR İHLALİ! YARALANDIN!", 
        msg_wave: "DALGA",
        leaderboard_title: "LİDERLİK TABLOSU", leaderboard_desc: "En İyi Operatörler", lb_operator: "OPERATÖR", lb_loading: "VERİLER YÜKLENİYOR...", lb_no_scores: "HENÜZ SKOR YOK",
        buy: "SATIN AL", equip: "KUŞAN", equipped: "KUŞANILDI", next_rank: "SONRAKİ",
        msg_score_saved: "SKOR KAYDEDİLDİ",
        resolution_label: "ÇÖZÜNÜRLÜK", tut_mouse: "Nişan almak için <span style='color:#eab308'>DOKUN</span> veya <span style='color:#eab308'>FARE</span> kullan.",
        rank_private: "ER", rank_trigger: "TETİKÇİ", rank_chief: "OPERASYON ŞEFİ", rank_general: "GENERAL",
        collection: "MAĞAZA", collection_desc: "Silah ve Skin Satın Al", inventory_desc: "Ekipmanlarını Yönet",
        shop_title: "MAĞAZA", section_weapons: "SİLAHLAR", section_skins: "KAPLAMALAR", owned: "SAHİP OLUNDU",
        section_patches: "YAMALAR", patch_tr: "TÜRK BAYRAĞI", patch_us: "ABD BAYRAĞI", patch_ops: "ÖZEL HAREKAT"
    },
    en: {
        lobby_header: "SHOLTBOLT", lobby_sub: "SELECT OPERATION",
        tag_hard: "HARD", tag_timed: "TIMED", tag_standard: "STANDARD", tag_locked: "LOCKED", tag_survival: "SURVIVAL",
        mode_reflex_title: "REFLEX OPS", mode_reflex_desc: "Targets appear and vanish instantly. Only the fastest survive.",
        mode_hostage_title: "HOSTAGE CRISIS", mode_hostage_desc: "Market raid! Eliminate hostiles and save the hostage in 25s.",
        mode_classic_title: "CARGO DEFENSE", mode_classic_desc: "Classic mode. Destroy dropping crates and earn points.",
        mode_defense_title: "DEFENSE LINE", mode_defense_desc: "Enemies are rushing! Don't let them touch you.",
        mode_range_title: "SHOOTING RANGE", mode_range_desc: "Moving targets. Sniper training. (Coming Soon)",
        mode_comp_title: "COMPETITIVE", mode_comp_desc: "Ranked matches. 5v5 Simulation. (Coming Soon)",
        tut_reflex: "Red targets appear suddenly. Hit them before time runs out!",
        tut_hostage: "SHOOT THEM ALL TO SAVE THE HOSTAGE!",
        tut_classic: "Destroy blocks, earn cash, and upgrade weapon.",
        tut_defense: "ENEMIES INCOMING! DON'T LET THEM TOUCH YOU!",
        msg_timeup: "TIME UP!", msg_level_clear: "LEVEL CLEARED!", msg_all_saved: "ALL HOSTAGES RESCUED!", msg_saved: "HOSTAGE SAVED!",
        msg_breach: "BREACH DETECTED! MISSION FAILED!",
        msg_wave: "WAVE",
        leaderboard_title: "LEADERBOARD", leaderboard_desc: "Top Operators", lb_operator: "OPERATOR", lb_loading: "LOADING DATA...", lb_no_scores: "NO SCORES YET",
        buy: "BUY", equip: "EQUIP", equipped: "EQUIPPED", next_rank: "NEXT",
        msg_score_saved: "SCORE SAVED",
        resolution_label: "RESOLUTION", tut_mouse: "Use <span style='color:#eab308'>TOUCH</span> or <span style='color:#eab308'>MOUSE</span> to aim.",
        rank_private: "PRIVATE", rank_trigger: "TRIGGER", rank_chief: "OPS CHIEF", rank_general: "GENERAL",
        collection: "STORE", collection_desc: "Buy Weapons & Skins", inventory_desc: "Manage Your Gear",
        shop_title: "STORE", section_weapons: "WEAPONS", section_skins: "SKINS", owned: "OWNED",
        section_patches: "PATCHES", patch_tr: "TURKISH FLAG", patch_us: "US FLAG", patch_ops: "SPEC OPS"
    }
};

const WEAPONS = {
    'glock': { name: 'Glock 19 Gen 5', capacity: 15, damage: 1.0, reloadTime: 1200, price: 0, desc: "Standard Issue. Reliable." },
    'beretta': { name: 'Beretta 92FS', capacity: 15, damage: 1.15, reloadTime: 1400, price: 2500, desc: "Legendary 9mm. High Accuracy." },
    'canik': { name: 'Canik TP9 SF', capacity: 18, damage: 1.05, reloadTime: 1100, price: 5600, desc: "Turkish Perfection." },
    'magnum': { name: 'Desert Eagle', capacity: 8, damage: 2.5, reloadTime: 1800, price: 9500, desc: "Hand Cannon. Pure Power." },
    'fn57': { name: 'FN Five-seveN', capacity: 20, damage: 1.1, reloadTime: 1100, price: 11000, desc: "20 Rounds. Armor Piercing." },
    'mpt55': { name: 'MPT-55', capacity: 30, damage: 1.4, reloadTime: 2200, price: 18000, desc: "National Infantry Rifle. 5.56mm." }
};

const PATCHES = {
    'patch_ops': { id: 'patch_ops', nameKey: 'patch_ops', price: 0, desc: "Standard Issue." },
    'patch_tr': { id: 'patch_tr', nameKey: 'patch_tr', price: 5000, desc: "Round Fabric Patch." },
    'patch_us': { id: 'patch_us', nameKey: 'patch_us', price: 5000, desc: "Round Fabric Patch." }
};

const MEDALS = [
    { id: 'recruit', name: 'Recruit', desc: 'Destroy your first target.', icon: '🎯', check: (g) => g.stats.totalBlocks > 0 },
    { id: 'rich', name: 'Rich', desc: 'Amass 10,000 $.', icon: '💰', check: (g) => g.coins >= 10000 },
    { id: 'veteran', name: 'Veteran', desc: 'Reach Level 10.', icon: '🎖️', check: (g) => g.level >= 10 },
    { id: 'sniper', name: 'Sniper', desc: 'Hit Streak 50.', icon: '👁️', check: (g) => g.hitStreak >= 50 },
    { id: 'glock_master', name: 'Glock Master', desc: 'Use Glock for 1 hour.', icon: '🔫', check: (g) => (g.weaponUsage['glock'] || 0) > 3600000 },
    { id: 'collector', name: 'Collector', desc: 'Own 5 Weapons.', icon: '🎒', check: (g) => g.ownedWeapons.length >= 5 },
    { id: 'terminator', name: 'Terminator', desc: 'Destroy 1000 Targets.', icon: '💀', check: (g) => g.stats.totalBlocks >= 1000 }
];

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX"];

// DYNAMIC RANK SYSTEM GENERATION
const RANK_CATEGORIES = [
    { id: 'private', baseName: "rank_private", color: "#06b6d4", startLvl: 1, endLvl: 9, reward: 0 },
    { id: 'trigger', baseName: "rank_trigger", color: "#eab308", startLvl: 10, endLvl: 18, reward: 2000 },
    { id: 'chief',   baseName: "rank_chief",   color: "#f59e0b", startLvl: 19, endLvl: 27, reward: 5000 },
    { id: 'general', baseName: "rank_general", color: "#ef4444", startLvl: 28, endLvl: 9999, reward: 10000 }
];

const RANK_SYSTEM = [];
RANK_CATEGORIES.forEach((cat, idx) => {
    if(cat.id !== 'general') {
        for(let i=0; i<9; i++) {
             RANK_SYSTEM.push({
                 id: cat.id, tier: i, min: cat.startLvl + i, max: cat.startLvl + i, 
                 color: cat.color, baseNameKey: cat.baseName, reward: (i===0 && idx>0) ? cat.reward : (i>0 ? 500 : 0)
             });
        }
    } else {
        for(let i=0; i<9; i++) {
            RANK_SYSTEM.push({
                 id: cat.id, tier: i, min: cat.startLvl + i, max: cat.startLvl + i, 
                 color: cat.color, baseNameKey: cat.baseName, reward: (i===0) ? cat.reward : 1000
             });
        }
        RANK_SYSTEM.push({
             id: cat.id, tier: 9, min: cat.startLvl + 9, max: 9999,
             color: cat.color, baseNameKey: cat.baseName, reward: 1000
        });
    }
});

const SKINS = {
    'skin_black': { id: 'skin_black', name: 'Factory New', price: 0, type: 'gun', color: '#1a1a1a', slideColor: '#2d2d2d' },
    'skin_silver': { id: 'skin_silver', name: 'Platinum Plated', price: 2000, type: 'gun', color: '#1a1a1a', slideColor: '#e0e0e0' },
    'skin_gold': { id: 'skin_gold', name: 'Gold Arabesque', price: 3000, type: 'gun', color: '#2a2a2a', slideColor: '#ffd700' },
    'skin_fade': { id: 'skin_fade', name: 'Marble Fade', price: 4000, type: 'gun', color: '#111', slideColor: 'fade' },
    'skin_turkish': { id: 'skin_turkish', name: 'Crimson Flag', price: 5000, type: 'gun', color: '#e30a17', slideColor: '#e30a17' },
    'skin_usa': { id: 'skin_usa', name: 'Stars & Stripes', price: 6000, type: 'gun', color: '#3c3b6e', slideColor: '#b22234' },
    'skin_chrome': { id: 'skin_chrome', name: 'Chromium', price: 7000, type: 'gun', color: '#1a1a1a', slideColor: '#e8e8e8' },
    'skin_camo': { id: 'skin_camo', name: 'Digital Camo', price: 3500, type: 'gun', color: '#3f4e38', slideColor: '#2c3327' },
    'skin_mpt_wrapped': { id: 'skin_mpt_wrapped', name: 'Wasteland Wrap', price: 8500, type: 'gun', color: '#4a4036', slideColor: '#5d5045' },
    'skin_mpt_forest': { id: 'skin_mpt_forest', name: 'Forest Mesh', price: 6000, type: 'gun', color: '#2d3a28', slideColor: '#3a4a35' },
    'skin_mpt_branches': { id: 'skin_mpt_branches', name: 'Deep Forest Ghillie', price: 9500, type: 'gun', color: '#3e2723', slideColor: '#4e342e' },
    'skin_mpt_autumn': { id: 'skin_mpt_autumn', name: 'Autumn Stalker', price: 9200, type: 'gun', color: '#5d4037', slideColor: '#795548' },
    'silencer_default': { id: 'silencer_default', name: 'Standard Suppressor', price: 0, type: 'silencer', color: '#222' },
    'silencer_gold': { id: 'silencer_gold', name: 'Golden Suppressor', price: 6300, type: 'silencer', color: '#ffd700' }
};

const defaultGame = {
    level: 1, maxLevel: 9999, state: 'lobby', mode: 'classic', score: 0, coins: 150, 
    wallHP: 0, isStoreOpen: false, isWeaponStoreOpen: false, isRankInfoOpen: false, isProfileOpen: false, isSettingsOpen: false, reloadCost: 50,
    isPromoOpen: false,
    ownedSkins: ['skin_black', 'silencer_default'], 
    ownedWeapons: ['glock'],
    ownedPatches: ['patch_ops'],
    currentWeapon: 'glock',
    currentSkin: 'skin_black', currentSilencer: 'silencer_default',
    currentPatch: 'patch_ops',
    timer: 0, maxTime: 0, lastTime: 0, weaponLevel: 1, hitStreak: 0,
    stats: { totalScore: 0, totalBlocks: 0 },
    hostagesSaved: 0, totalHostages: 6,
    targetsHit: 0,
    weaponUsage: {},
    unlockedMedals: [],
    redeemedCodes: [],
    modeLevels: { classic: 1, reflex: 1, hostage: 1, defense: 1 },
    isPaused: false,
    settings: { lang: 'en', res: 'auto', gfx: 'high' }
};

let GAME = JSON.parse(JSON.stringify(defaultGame));

const GUN = {
    x: 0, y: 0, angle: 0, recoilX: 0, recoilAngle: 0, slideOffset: 0, lastShot: 0, ammo: 15, maxAmmo: 15, reloading: false,
    attachments: { scope: false, silencer: false, laser: false }
};

if (WEAPONS[GAME.currentWeapon]) GUN.maxAmmo = WEAPONS[GAME.currentWeapon].capacity;
GUN.ammo = GUN.maxAmmo;

let bullets = [], particles = [], shells = [], magazines = [], wallBlocks = [], reflexTargets = [];
let defenseEnemies = [];
let containerRect = null;
let currentFullRankName = "";
let flashTimer=0, flashPos={x:0, y:0};
let reflexSpawnTimer = 0;
let defenseSpawnTimer = 0;

const HITMAN_ANIM = { active: false, timer: 0, alpha: 0 };
const RANK_UP_ANIM = { active: false, timer: 0, text: "", subText: "", rewardText: "" };

window.selectMode = function(modeName) {
    GAME.mode = modeName;
    GAME.modeLevels[modeName] = 1;
    GAME.level = 1;
    
    ui.lobbyScreen.style.display = 'none';
    ui.mainMenu.style.display = 'flex';
    let t = TRANSLATIONS[SETTINGS.language];
    let modeTitle = t.mode_classic_title;
    if(modeName === 'reflex') modeTitle = t.mode_reflex_title;
    if(modeName === 'hostage') modeTitle = t.mode_hostage_title;
    if(modeName === 'defense') modeTitle = t.mode_defense_title;
    ui.selectedModeDisplay.innerText = "MODE: " + modeTitle;
    GAME.state = 'menu';
    updateRankUI();
    updateMenuStats(); 
    SoundSys.buy();
}

window.backToLobby = function() {
    ui.mainMenu.style.display = 'none';
    ui.lobbyScreen.style.display = 'flex';
    GAME.state = 'lobby';
    SoundSys.buy();
}

window.startGameFromMenu = function() {
    ui.mainMenu.style.display = 'none';
    ui.hudElements.forEach(el => el.style.display = 'flex');
    GAME.state = 'tutorial';
    
    // Müzik kontrolü: Maça girerken durdur
    bgMusic.pause();
    bgMusic.currentTime = 0;

    ui.tutorialOverlay.style.display = 'flex';
    const t = TRANSLATIONS[SETTINGS.language];

    ui.hostagePanel.style.display = 'none';

    if(GAME.mode === 'reflex') {
        ui.tutObjective.innerText = t.tut_reflex;
        ui.tutObjective.style.color = "#ef4444";
    } else if (GAME.mode === 'hostage') {
        GAME.hostagesSaved = 0;
        renderHostageUI();
        ui.hostagePanel.style.display = 'flex'; 
        ui.tutObjective.innerText = t.tut_hostage;
        ui.tutObjective.style.color = "#facc15";
    } else if (GAME.mode === 'defense') {
        ui.tutObjective.innerText = t.tut_defense;
        ui.tutObjective.style.color = "#ef4444";
    } else {
        ui.tutObjective.innerText = t.tut_classic;
        ui.tutObjective.style.color = "#22c55e";
    }
    
    SoundSys.buy();
}

function renderHostageUI() {
    ui.hostagePanel.innerHTML = '';
    for(let i=0; i<GAME.totalHostages; i++) {
        const isSaved = i < GAME.hostagesSaved;
        const div = document.createElement('div');
        div.className = `hostage-icon ${isSaved ? 'saved' : ''}`;
        div.innerHTML = `<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M12 14c-6.1 0-8 4-8 4v2h16v-2s-1.9-4-8-4z"/></svg>`;
        ui.hostagePanel.appendChild(div);
    }
}

window.closeTutorial = function() {
    ui.tutorialOverlay.style.display = 'none';
    startLevel(GAME.level); 
    GAME.state = 'playing';
    GAME.lastTime = Date.now();
    SoundSys.resume();
}

window.openExitModal = function() {
    GAME.isPaused = true;
    ui.exitModal.style.display = 'flex';
    SoundSys.blip();
}

window.closeExitModal = function() {
    GAME.isPaused = false;
    ui.exitModal.style.display = 'none';
    GAME.lastTime = Date.now();
}

window.confirmExit = function() {
    closeExitModal();
    const t = TRANSLATIONS[SETTINGS.language];
    if (!isGuest && currentUserDoc) {
        window.addScore(currentUserDoc, GAME.stats.totalScore);
        ui.notify.innerText = t.msg_score_saved;
        ui.notify.style.color = "#22c55e";
        ui.notify.style.opacity = 1;
        setTimeout(() => { ui.notify.style.opacity = 0; }, 2000);
    }
    GAME.state = 'menu';
    
    // Müzik kontrolü: Menüye dönerken başlat
    bgMusic.play().catch(e => console.log("Music resume failed", e));

    ui.hudElements.forEach(el => el.style.display = 'none');
    ui.mainMenu.style.display = 'flex';
    bullets = []; particles = []; shells = []; magazines = []; wallBlocks = []; reflexTargets = []; defenseEnemies = [];
    updateMenuStats(); 
    window.saveGame();
    SoundSys.buy();
}

window.toggleConsole = function() {
    if(ui.devConsole.style.display === 'flex') {
        ui.devConsole.style.display = 'none';
    } else {
        ui.devConsole.style.display = 'flex';
        ui.consoleInput.focus();
    }
}

window.consoleLog = function(msg, type='normal') {
    const p = document.createElement('div');
    if(type==='success') p.className = 'log-success';
    if(type==='error') p.className = 'log-error';
    if(type==='info') p.className = 'log-info';
    p.innerText = "> " + msg;
    ui.consoleLog.appendChild(p);
    ui.consoleLog.scrollTop = ui.consoleLog.scrollHeight;
}

window.submitConsoleCommand = function() {
    const cmd = ui.consoleInput.value.trim();
    ui.consoleInput.value = "";
    if(!cmd) return;
    
    window.consoleLog(cmd);
    
    const parts = cmd.split(' ');
    const command = parts[0].toLowerCase();
    
    if (command === '1453') {
        GAME.coins += 400000;
        updateUI();
        updateMenuStats();
        window.saveGame();
        window.consoleLog("CONQUEST MODE ACTIVATED: +400,000 $ ADDED", 'success');
        SoundSys.rankup();
    } else if (command === 'help') {
        window.consoleLog("Commands:\n- 1453: ???\n- clear: Clear console", 'info');
    } else if (command === 'clear') {
        ui.consoleLog.innerHTML = "Console Cleared.";
    } else {
        window.consoleLog("Unknown command: " + command, 'error');
    }
}

const actx = new (window.AudioContext || window.webkitAudioContext)();
const noiseBuffer = actx.createBuffer(1, actx.sampleRate * 2, actx.sampleRate);
const output = noiseBuffer.getChannelData(0);
for (let i = 0; i < actx.sampleRate * 2; i++) {
    output[i] = Math.random() * 2 - 1;
}

// YENİ: Tabanca sesini yükle
let pistolBuffer = null;
fetch('glock19voice.mp3')
    .then(response => response.arrayBuffer())
    .then(arrayBuffer => actx.decodeAudioData(arrayBuffer))
    .then(audioBuffer => {
        pistolBuffer = audioBuffer;
        console.log("Tabanca sesi yüklendi: glock19voice.mp3");
    })
    .catch(e => console.warn("Tabanca sesi yüklenemedi, sentezleyici kullanılacak.", e));

// YENİ: MPT-55 sesini yükle
let mptBuffer = null;
fetch('mpt55voice.mp3')
    .then(response => response.arrayBuffer())
    .then(arrayBuffer => actx.decodeAudioData(arrayBuffer))
    .then(audioBuffer => {
        mptBuffer = audioBuffer;
        console.log("MPT-55 sesi yüklendi: mpt55voice.mp3");
    })
    .catch(e => console.warn("MPT-55 sesi yüklenemedi.", e));

// YENİ: Şarjör sesini yükle (Tüm silahlar için)
let magazineBuffer = null;
fetch('magazinevoice.mp3')
    .then(response => response.arrayBuffer())
    .then(arrayBuffer => actx.decodeAudioData(arrayBuffer))
    .then(audioBuffer => {
        magazineBuffer = audioBuffer;
        console.log("Şarjör sesi yüklendi: magazinevoice.mp3");
    })
    .catch(e => console.warn("Şarjör sesi yüklenemedi.", e));

// YENİ: Kovan sesi yükle (bulletvoice.mp3)
let shellBuffer = null;
fetch('bulletvoice.mp3')
    .then(response => response.arrayBuffer())
    .then(arrayBuffer => actx.decodeAudioData(arrayBuffer))
    .then(audioBuffer => {
        shellBuffer = audioBuffer;
        console.log("Kovan sesi yüklendi: bulletvoice.mp3");
    })
    .catch(e => console.warn("Kovan sesi yüklenemedi.", e));

const SoundSys = {
    resume: () => { if(actx.state === 'suspended') actx.resume(); },
    shoot: (silenced) => {
        SoundSys.resume();
        const t = actx.currentTime;
        const wType = GAME.currentWeapon;
        
        // ÖZEL: MPT-55 İÇİN MP3 KULLAN (Susturucusuz)
        if (!silenced && wType === 'mpt55' && mptBuffer) {
            const src = actx.createBufferSource();
            src.buffer = mptBuffer;
            // Hafif pitch varyasyonu eklenebilir ama orijinal sesi korumak için 1.0 bırakıyoruz
            src.playbackRate.value = 1.0; 
            
            const gainNode = actx.createGain();
            gainNode.gain.value = 0.6; // Ses seviyesi ayarı

            src.connect(gainNode);
            gainNode.connect(actx.destination);
            src.start(t);
            return;
        }

        // EĞER SUSTURUCU YOKSA VE SİLAH TABANCAYSA (MPT-55 HARİÇ) MP3 KULLAN
        if (!silenced && wType !== 'mpt55' && pistolBuffer) {
            const src = actx.createBufferSource();
            src.buffer = pistolBuffer;

            // Her tabanca için ufak ton farkları yapalım ki hepsi aynı tınlamasın
            let rate = 1.0;
            if (wType === 'beretta') rate = 0.95; // Biraz daha tok
            if (wType === 'canik') rate = 1.05;   // Biraz daha tiz/sert
            if (wType === 'fn57') rate = 1.1;     // Daha keskin
            if (wType === 'magnum') rate = 0.7;   // Çok daha kalın ve ağır (Deagle)

            src.playbackRate.value = rate;
            
            const gainNode = actx.createGain();
            gainNode.gain.value = 0.7; // MP3 sesi genelde yüksek olur, dengeledik

            src.connect(gainNode);
            gainNode.connect(actx.destination);
            src.start(t);
            return; // Sentezleyici kodunu atla
        }

        // ESKİ SENTEZLEYİCİ (Susturucu veya MP3 yüklenemezse burası çalışır)
        let punchFreq = 150;
        let punchType = 'triangle';
        let punchDecay = 0.2;
        let noiseDecay = 0.3;
        let noiseFilter = 2000;
        let vol = 1.0;

        if (wType === 'magnum') {
            punchFreq = 100; punchDecay = 0.6; noiseDecay = 0.7; noiseFilter = 1500; punchType='square'; vol=1.2;
        } else if (wType === 'mpt55') {
            punchFreq = 200; punchDecay = 0.4; noiseDecay = 0.4; noiseFilter = 3000; punchType='sawtooth'; vol=1.0;
        } else if (wType === 'fn57') {
            punchFreq = 300; punchDecay = 0.15; noiseDecay = 0.2; noiseFilter = 4000; vol=0.8;
        }

        if (silenced) {
            noiseFilter = 800; noiseDecay = 0.1; punchDecay = 0.1; vol *= 0.4; punchType='sine';
        }

        const osc = actx.createOscillator();
        const oscGain = actx.createGain();
        osc.type = punchType;
        osc.frequency.setValueAtTime(punchFreq, t);
        osc.frequency.exponentialRampToValueAtTime(10, t + punchDecay);
        oscGain.gain.setValueAtTime(vol * 0.5, t);
        oscGain.gain.exponentialRampToValueAtTime(0.01, t + punchDecay);
        osc.connect(oscGain);
        oscGain.connect(actx.destination);
        osc.start(t);
        osc.stop(t + punchDecay);

        const noiseSrc = actx.createBufferSource();
        noiseSrc.buffer = noiseBuffer;
        const noiseFilterNode = actx.createBiquadFilter();
        const noiseGain = actx.createGain();
        
        noiseFilterNode.type = silenced ? 'lowpass' : 'bandpass';
        noiseFilterNode.frequency.setValueAtTime(noiseFilter, t);
        if(!silenced) noiseFilterNode.frequency.linearRampToValueAtTime(100, t + noiseDecay);

        noiseGain.gain.setValueAtTime(vol, t);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, t + noiseDecay);

        noiseSrc.connect(noiseFilterNode);
        noiseFilterNode.connect(noiseGain);
        noiseGain.connect(actx.destination);
        noiseSrc.start(t);
        noiseSrc.stop(t + noiseDecay);
    },
    buy: () => {
        SoundSys.resume(); const t = actx.currentTime;
        const osc = actx.createOscillator(); const g = actx.createGain();
        osc.type = 'sine'; osc.frequency.setValueAtTime(800, t); osc.frequency.linearRampToValueAtTime(1200, t+0.1);
        g.gain.setValueAtTime(0.3, t); g.gain.linearRampToValueAtTime(0, t+0.1);
        osc.connect(g); g.connect(actx.destination); osc.start(t); osc.stop(t+0.2);
    },
    reload: () => {
        SoundSys.resume(); 
        const t = actx.currentTime;

        // YENİ: EĞER MP3 YÜKLENDİYSE ONU KULLAN
        if (magazineBuffer) {
            const src = actx.createBufferSource();
            src.buffer = magazineBuffer;
            
            const gainNode = actx.createGain();
            gainNode.gain.value = 0.8; // Ses seviyesi

            src.connect(gainNode);
            gainNode.connect(actx.destination);
            src.start(t);
            return;
        }

        // ESKİ SENTEZLEYİCİ (Dosya yüklenemezse yedek olarak çalışır)
        const osc = actx.createOscillator(); const g = actx.createGain();
        osc.type = 'sawtooth'; osc.frequency.setValueAtTime(300, t); g.gain.setValueAtTime(0.2, t); g.gain.linearRampToValueAtTime(0, t+0.1);
        osc.connect(g); g.connect(actx.destination); osc.start(t); osc.stop(t+0.1);
    },
    impact: () => {
        SoundSys.resume(); const t = actx.currentTime;
        const osc = actx.createOscillator(); const g = actx.createGain();
        osc.frequency.setValueAtTime(100, t); osc.frequency.exponentialRampToValueAtTime(10, t+0.1);
        g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.01, t+0.1);
        osc.connect(g); g.connect(actx.destination); osc.start(t); osc.stop(t+0.1);
    },
    shell: () => { 
        if(SETTINGS.graphics === 'low') return; 
        SoundSys.resume(); 
        const t = actx.currentTime; 

        // YENİ: MP3 KULLAN (Fiziksel çarpışma için)
        if (shellBuffer) {
            const src = actx.createBufferSource();
            src.buffer = shellBuffer;
            // Her düşüşte hafif ton farkı (0.9 ile 1.1 arası hız)
            src.playbackRate.value = 0.9 + Math.random() * 0.2; 
            
            const gainNode = actx.createGain();
            // Ses seviyesini biraz rastgele yap (0.3 - 0.5 arası)
            gainNode.gain.value = 0.3 + Math.random() * 0.2;

            src.connect(gainNode);
            gainNode.connect(actx.destination);
            src.start(t);
            return;
        }

        // ESKİ SENTETİK SES (Yedek)
        const osc=actx.createOscillator(); const g=actx.createGain(); 
        osc.frequency.setValueAtTime(1200,t); osc.frequency.exponentialRampToValueAtTime(800,t+0.05); 
        g.gain.setValueAtTime(0.05,t); g.gain.exponentialRampToValueAtTime(0.01,t+0.05); 
        osc.connect(g); g.connect(actx.destination); osc.start(t); osc.stop(t+0.05); 
    },
    boxDrop: () => { SoundSys.resume(); const t = actx.currentTime; const osc = actx.createOscillator(); const g = actx.createGain(); osc.type='square'; osc.frequency.setValueAtTime(100, t); osc.frequency.exponentialRampToValueAtTime(10, t+0.3); g.gain.setValueAtTime(0.5, t); g.gain.linearRampToValueAtTime(0, t+0.3); osc.connect(g); g.connect(actx.destination); osc.start(t); osc.stop(t+0.3); },
    levelup: () => { SoundSys.resume(); const t = actx.currentTime; const osc = actx.createOscillator(); const g = actx.createGain(); osc.type='triangle'; osc.frequency.setValueAtTime(440, t); osc.frequency.setValueAtTime(554, t+0.1); osc.frequency.setValueAtTime(659, t+0.2); g.gain.setValueAtTime(0.2, t); g.gain.linearRampToValueAtTime(0, t+0.6); osc.connect(g); g.connect(actx.destination); osc.start(t); osc.stop(t+0.6); },
    rankup: () => { SoundSys.resume(); const t = actx.currentTime; const osc = actx.createOscillator(); const g = actx.createGain(); osc.type='square'; osc.frequency.setValueAtTime(523.25, t); osc.frequency.setValueAtTime(659.25, t+0.1); osc.frequency.setValueAtTime(783.99, t+0.2); osc.frequency.setValueAtTime(1046.50, t+0.3); g.gain.setValueAtTime(0.2, t); g.gain.linearRampToValueAtTime(0, t+1.0); osc.connect(g); g.connect(actx.destination); osc.start(t); osc.stop(t+1.0); },
    error: () => { SoundSys.resume(); const t = actx.currentTime; const osc = actx.createOscillator(); const g = actx.createGain(); osc.type = 'sawtooth'; osc.frequency.setValueAtTime(150, t); osc.frequency.linearRampToValueAtTime(100, t + 0.2); g.gain.setValueAtTime(0.3, t); g.gain.linearRampToValueAtTime(0, t + 0.2); osc.connect(g); g.connect(actx.destination); osc.start(t); osc.stop(t + 0.2); },
    blip: () => { SoundSys.resume(); const t=actx.currentTime; const osc=actx.createOscillator(); const g=actx.createGain(); osc.frequency.setValueAtTime(600, t); osc.type='sine'; g.gain.setValueAtTime(0.1, t); g.gain.linearRampToValueAtTime(0, t+0.1); osc.connect(g); g.connect(actx.destination); osc.start(t); osc.stop(t+0.1); }
};

function init() {
    resize();
    window.addEventListener('resize', resize);
    
    // MÜZİK BAŞLATMA (İlk tıklamada)
    const startMusic = () => {
        bgMusic.play().catch(e => console.log("Audio play blocked until interaction"));
        window.removeEventListener('click', startMusic);
        window.removeEventListener('keydown', startMusic);
        window.removeEventListener('touchstart', startMusic);
    };
    window.addEventListener('click', startMusic);
    window.addEventListener('keydown', startMusic);
    window.addEventListener('touchstart', startMusic);

    window.addEventListener('mousemove', e => { 
        if (!containerRect) return; 
        const scaleX = canvas.width / containerRect.width;
        const scaleY = canvas.height / containerRect.height;
        mouse.x = (e.clientX - containerRect.left) * scaleX;
        mouse.y = (e.clientY - containerRect.top) * scaleY;
        
        if(GAME.state === 'menu' || GAME.state === 'lobby') {
            const cx = width / 2;
            const cy = height / 2;
            const dx = mouse.x - cx;
            menuRotation = (dx / width) * 0.5; 
        }
    });

    const handleTouch = (e) => {
        if (!containerRect) return;
        const touch = e.touches[0];
        const scaleX = canvas.width / containerRect.width;
        const scaleY = canvas.height / containerRect.height;
        mouse.x = (touch.clientX - containerRect.left) * scaleX;
        mouse.y = (touch.clientY - containerRect.top) * scaleY;
    };

    window.addEventListener('touchmove', handleTouch, { passive: false });
    window.addEventListener('touchstart', (e) => {
        handleTouch(e);
        handleClick(e);
    }, { passive: false });
    
    gameContainer.addEventListener('touchmove', function(e) { e.preventDefault(); }, { passive: false });

    window.addEventListener('mousedown', handleClick);
    window.addEventListener('keydown', e => { 
        SoundSys.resume(); 
        if (e.key.toLowerCase() === 'r') reload(); 

        // CONSOLE TOGGLE KEY: " or é
        if (e.key === '"' || e.key === 'é') {
            e.preventDefault(); 
            window.toggleConsole();
        }
        
        if (e.key === 'Escape') {
            if(ui.devConsole.style.display === 'flex') {
                window.toggleConsole();
                return;
            }

            if (GAME.state === 'playing') {
                if (GAME.isPaused) { window.closeExitModal(); } else { window.openExitModal(); }
            } else if (GAME.state === 'menu' && !ui.storeModal.style.display.includes('flex') && !GAME.isSettingsOpen && !GAME.isPromoOpen && !ui.leaderboardModal.style.display.includes('flex')) {
            } else if (GAME.isStoreOpen) { window.toggleShop(); }
            else if (GAME.isWeaponStoreOpen) { window.toggleInventory(); }
            else if (GAME.isProfileOpen) { window.toggleProfile(); }
            else if (GAME.isRankInfoOpen) { window.toggleRankInfo(); }
            else if (GAME.isSettingsOpen) { window.toggleSettings(); }
            else if (GAME.isPromoOpen) { window.togglePromo(); }
            else if (ui.leaderboardModal.style.display === 'flex') { window.toggleLeaderboard(); }
        }
    });
    
    requestAnimationFrame(loop);
}

function initGameUI() {
    ui.langSelect.value = SETTINGS.language;
    ui.resSelect.value = SETTINGS.resolution;
    ui.gfxSelect.value = SETTINGS.graphics;
    
    if (WEAPONS[GAME.currentWeapon]) GUN.maxAmmo = WEAPONS[GAME.currentWeapon].capacity;
    GUN.ammo = GUN.maxAmmo;
    
    window.updateLanguageUI = function() {
        const t = TRANSLATIONS[SETTINGS.language];
        document.querySelectorAll('[data-lang]').forEach(el => {
            const key = el.getAttribute('data-lang');
            if (t[key]) {
                 if(el.childNodes.length === 1 && el.childNodes[0].nodeType === 3) {
                     el.innerText = t[key];
                 } else {
                     el.innerHTML = t[key];
                 }
            }
        });
    }

    window.updateLanguageUI();
    updateUI();
    updateRankUI();
    currentFullRankName = getFullRankName();
    updateMenuStats();
}

function updateMenuStats() {
    ui.menuDmgLevel.innerText = "LVL " + GAME.weaponLevel;
    ui.menuBalance.innerText = GAME.coins + " $";
}

window.triggerMenuUpgrade = function() {
    if(GAME.coins >= 1000) {
        GAME.coins -= 1000;
        GAME.weaponLevel++;
        updateMenuStats();
        updateUI();
        window.saveGame();
        SoundSys.levelup();
        const btn = document.querySelector('.menu-card.highlight');
        btn.style.borderColor = '#22c55e';
        setTimeout(() => btn.style.borderColor = '#3b82f6', 300);
    } else {
        const btn = document.querySelector('.menu-card.highlight');
        btn.style.borderColor = '#ef4444';
        setTimeout(() => btn.style.borderColor = '#3b82f6', 300);
        SoundSys.error();
    }
}

window.toggleAttachment = function(type) {
    if(GAME.state !== 'playing' || GAME.isPaused) return;
    GUN.attachments[type] = !GUN.attachments[type];
    const btn = document.querySelector(`.attachment-btn[title*="${type === 'scope' ? 'Nişangah' : (type === 'silencer' ? 'Susturucu' : 'Lazer')}"]`);
    if(btn) { if(GUN.attachments[type]) btn.classList.add('active'); else btn.classList.remove('active'); }
}

function getRankData() {
    for(let i=0; i<RANK_SYSTEM.length; i++) {
        const r = RANK_SYSTEM[i];
        if(GAME.level >= r.min && GAME.level <= r.max) return { ...r, index: i };
    }
    return { ...RANK_SYSTEM[RANK_SYSTEM.length-1], index: RANK_SYSTEM.length-1 };
}

function getFullRankName() {
    const rank = getRankData();
    const t = TRANSLATIONS[SETTINGS.language];
    const baseName = t[rank.baseNameKey] || rank.baseNameKey;
    
    if(rank.id === 'general' && rank.tier >= 9) return baseName + " (MAX)";

    const roman = ROMAN[rank.tier] || "";
    return roman ? `${baseName} ${roman}` : baseName;
}

function getRankSVG(rank) {
    let svgContent = "";
    const tier = rank.tier;
    
    if (rank.id === 'private') {
        const hasBottomBar = tier >= 3;
        const hasMultiBar = tier >= 6;
        let rays = 2 + (tier % 3);
        const cx = 20; const cy = 30;
        for(let i=0; i<rays; i++) {
            const spread = 40;
            const angle = -90 - (spread/2) + (spread/(rays-1)) * i;
            const rad = angle * (Math.PI / 180);
            const x2 = cx + Math.cos(rad) * 20;
            const y2 = cy + Math.sin(rad) * 20;
            svgContent += `<line x1="${cx}" y1="${cy}" x2="${x2}" y2="${y2}" stroke="#facc15" stroke-width="4" stroke-linecap="round" />`;
        }
        if (hasBottomBar) svgContent += `<rect x="5" y="32" width="30" height="3" fill="#06b6d4" />`;
        if (hasMultiBar) {
             svgContent += `<rect x="5" y="36" width="30" height="3" fill="#06b6d4" />`;
             svgContent += `<rect x="5" y="28" width="30" height="3" fill="#06b6d4" />`;
        }
    } else if (rank.id === 'trigger') {
        svgContent += `<rect x="2" y="10" width="36" height="20" fill="#facc15" />`;
        const stripes = tier + 1;
        const startX = 5;
        const gap = 3;
        const w = 2;
        for(let i=0; i<stripes; i++) {
             svgContent += `<rect x="${startX + i*(w+gap)}" y="10" width="${w}" height="20" fill="#111" />`;
        }
    } else if (rank.id === 'chief') {
        svgContent += `<rect x="2" y="10" width="36" height="20" fill="#facc15" />`;
        const count = tier + 1;
        if (count <= 5) {
             for(let i=0; i<count; i++) {
                 svgContent += `<polygon points="0,-4 1,-1 4,-1 2,1 3,4 0,2 -3,4 -2,1 -4,-1 -1,-1" transform="translate(${8 + i*6}, 20) scale(1.2)" fill="black" />`;
             }
        } else {
             svgContent += `<circle cx="8" cy="20" r="5" stroke="black" stroke-width="1" fill="none" />`;
             svgContent += `<polygon points="0,-4 1,-1 4,-1 2,1 3,4 0,2 -3,4 -2,1 -4,-1 -1,-1" transform="translate(8, 20) scale(1.5)" fill="black" />`;
             const normalStars = Math.max(0, count - 6); 
             for(let i=0; i<normalStars; i++) {
                 svgContent += `<polygon points="0,-4 1,-1 4,-1 2,1 3,4 0,2 -3,4 -2,1 -4,-1 -1,-1" transform="translate(${18 + i*6}, 20) scale(1.2)" fill="black" />`;
             }
        }
    } else if (rank.id === 'general') {
        svgContent += `<rect x="2" y="10" width="36" height="20" fill="#ef4444" />`;
        svgContent += `<circle cx="8" cy="20" r="6" stroke="#facc15" stroke-width="1.5" fill="none" />`;
        svgContent += `<polygon points="0,-4 1,-1 4,-1 2,1 3,4 0,2 -3,4 -2,1 -4,-1 -1,-1" transform="translate(8, 20) scale(1.5)" fill="#facc15" />`;
        const stars = tier; 
        for(let i=0; i<stars; i++) {
             svgContent += `<polygon points="0,-4 1,-1 4,-1 2,1 3,4 0,2 -3,4 -2,1 -4,-1 -1,-1" transform="translate(${18 + i*6}, 20) scale(1.2)" fill="#111" />`;
        }
    }
    return svgContent;
}

function updateRankUI() {
    const currentRank = getRankData();
    const isMax = currentRank.id === 'general' && currentRank.tier >= 9;
    
    ui.rankTitle.innerText = getFullRankName();
    ui.rankTitle.style.color = currentRank.color;
    ui.rankTitle.style.textShadow = `0 0 15px ${currentRank.color}`;
    
    ui.rankSub.innerText = isMax ? "MAX RANK" : `TIER ${currentRank.tier + 1}`;
    ui.rankSub.style.color = currentRank.color;
    
    const svgContent = getRankSVG(currentRank);
    ui.currentRankIcon.innerHTML = svgContent;
    ui.rankPanel.style.borderLeftColor = currentRank.color;

    if(ui.menuRankWidget) {
        ui.menuRankWidget.style.borderRightColor = currentRank.color;
        ui.menuRankIcon.innerHTML = svgContent;
        ui.menuRankName.innerText = getFullRankName();
        ui.menuRankName.style.color = currentRank.color;
    }

    if(isMax) {
        ui.rankProgressBar.style.width = '100%';
        ui.rankProgressBar.style.backgroundColor = currentRank.color;
        ui.rankProgressText.innerText = "MAX LEVEL";
    } else {
        const totalLevelsInRank = currentRank.max - currentRank.min + 1;
        const currentLevelInRank = GAME.level - currentRank.min;
        const percent = Math.min(100, (currentLevelInRank / totalLevelsInRank) * 100);
        ui.rankProgressBar.style.width = `${percent}%`;
        ui.rankProgressBar.style.backgroundColor = currentRank.color;
        const txtNext = TRANSLATIONS[SETTINGS.language].next_rank || 'NEXT';
        ui.rankProgressText.innerText = `${txtNext}: ${currentRank.max + 1 - GAME.level} LVL`;
    }
}

function triggerRankUpAnim(newRankName, rewardAmount) {
    const t = TRANSLATIONS[SETTINGS.language];
    RANK_UP_ANIM.active = true; RANK_UP_ANIM.timer = 200; 
    RANK_UP_ANIM.text = t.msg_rankup || "RANK UP!"; RANK_UP_ANIM.subText = newRankName; 
    RANK_UP_ANIM.rewardText = `+${rewardAmount} $ ${t.msg_reward || 'REWARD'}`;
    SoundSys.rankup();
}

function updateHitCounterUI() {
    const count = GAME.targetsHit || 0;
    if(ui.hitCountDisplay) {
        ui.hitCountDisplay.innerText = count;
    }
}

function startLevel(lvl) {
    GAME.level = lvl; ui.levelText.innerText = `LVL ${lvl}`;
    const rankData = getRankData();
    const newRankName = getFullRankName();
    
    if(newRankName !== currentFullRankName && lvl > 1) { 
        const reward = rankData.reward;
        if (reward > 0) { GAME.coins += reward; triggerRankUpAnim(newRankName, reward); } 
        else { triggerRankUpAnim(newRankName, 0); }
        currentFullRankName = newRankName; 
    }
    
    updateRankUI(); 
    window.saveGame();
    wallBlocks = []; bullets = []; reflexTargets = []; defenseEnemies = [];
    GAME.targetsHit = 0;
    updateHitCounterUI();

    if(GAME.mode === 'classic') {
        const maxRows = Math.min(25, 4 + Math.floor(lvl / 2));
        const maxCols = Math.min(8, 2 + Math.floor(lvl / 10));
        const baseHealth = 15 + (lvl * 5);
        const blockSize = height / 25;
        const wallX = width - (width * 0.2) - (maxCols * blockSize);
        const startY = (height - (maxRows * blockSize)) / 2;
        for (let c = 0; c < maxCols; c++) {
            for (let r = 0; r < maxRows; r++) {
                const isMetal = Math.random() > 0.7;
                let hp = baseHealth + (Math.random() * 5);
                if(isMetal) hp *= 1.5;
                wallBlocks.push({x: wallX + (c * blockSize), y: startY + (r * blockSize), size: blockSize, active: true, type: isMetal ? 'metal' : 'wood', hp: hp, maxHp: hp});
            }
        }
        const timePerBlock = Math.max(0.8, 2.5 - (lvl * 0.03)); 
        GAME.maxTime = Math.ceil(wallBlocks.length * timePerBlock) + 5; 
    } else if (GAME.mode === 'reflex') {
        GAME.targetsToHit = 10 + Math.floor(lvl * 1.5);
        GAME.maxTime = 30 + (lvl * 2); 
        reflexSpawnTimer = 0;
    } else if (GAME.mode === 'hostage') {
        GAME.targetsToHit = 5 + lvl + Math.floor(lvl/2); 
        GAME.maxTime = 25; 
        reflexSpawnTimer = 0;
    } else if (GAME.mode === 'defense') {
        GAME.targetsToHit = 10 + Math.floor(lvl * 2); 
        GAME.maxTime = 60 + (lvl * 5); 
        defenseSpawnTimer = 0;
    }

    GAME.timer = GAME.maxTime; GAME.lastTime = Date.now(); GAME.hitStreak = 0;
    updateTimerUI();
    updateUI();
}

function gameOver(reason) {
    const t = TRANSLATIONS[SETTINGS.language];
    GAME.state = 'gameover';
    
    if (!isGuest && currentUserDoc) {
        window.addScore(currentUserDoc, GAME.stats.totalScore);
    }

    if(reason === 'breach') {
        ui.notify.innerText = t.msg_breach;
    } else {
        ui.notify.innerText = t.msg_timeup; 
    }
    
    ui.notify.style.color = "#ef4444"; ui.notify.style.opacity = 1; SoundSys.error();
    setTimeout(() => {
        ui.notify.style.opacity = 0; ui.notify.style.color = "#fff";
        startLevel(GAME.level); GAME.state = 'playing';
    }, 2000);
}

function updateTimerUI() {
    ui.timerDisplay.innerText = GAME.timer.toFixed(1);
    ui.timerDisplay.style.color = GAME.timer < 5 ? '#fff' : '#ef4444';
}

function updateUI() {
    ui.ammoCount.innerText = GUN.ammo;
    ui.ammoBar.style.width = `${(GUN.ammo/GUN.maxAmmo)*100}%`;
    ui.scoreDisplay.innerText = GAME.score;
    ui.coinDisplay.innerText = GAME.coins + " $";
    ui.weaponLevelText.innerText = "LVL " + GAME.weaponLevel;
    const skinName = SKINS[GAME.currentSkin] ? SKINS[GAME.currentSkin].name : "Factory New";
    const weaponName = WEAPONS[GAME.currentWeapon] ? WEAPONS[GAME.currentWeapon].name : "UNKNOWN";
    ui.gunName.innerText = weaponName.toUpperCase() + " | " + skinName.toUpperCase();
}

window.toggleShop = function() {
    GAME.isStoreOpen = !GAME.isStoreOpen;
    ui.storeModal.style.display = GAME.isStoreOpen ? 'flex' : 'none';
    if(GAME.isStoreOpen) { 
        if(GAME.isRankInfoOpen) window.toggleRankInfo(); 
        if(GAME.isWeaponStoreOpen) window.toggleInventory();
        if(GAME.isProfileOpen) window.toggleProfile();
        if(GAME.isSettingsOpen) window.toggleSettings();
        if(GAME.isPromoOpen) window.togglePromo();
        if(ui.leaderboardModal.style.display === 'flex') window.toggleLeaderboard();
        renderShop();
        requestAnimationFrame(renderPreviews);
    }
}

window.toggleInventory = function() {
    GAME.isWeaponStoreOpen = !GAME.isWeaponStoreOpen;
    ui.weaponModal.style.display = GAME.isWeaponStoreOpen ? 'flex' : 'none';
    if(GAME.isWeaponStoreOpen) { 
        if(GAME.isRankInfoOpen) window.toggleRankInfo(); 
        if(GAME.isStoreOpen) window.toggleShop();
        if(GAME.isProfileOpen) window.toggleProfile();
        if(GAME.isSettingsOpen) window.toggleSettings();
        if(GAME.isPromoOpen) window.togglePromo();
        if(ui.leaderboardModal.style.display === 'flex') window.toggleLeaderboard();
        renderInventory(); 
        requestAnimationFrame(renderPreviews);
    }
}

window.toggleRankInfo = function() {
    GAME.isRankInfoOpen = !GAME.isRankInfoOpen;
    ui.rankInfoModal.style.display = GAME.isRankInfoOpen ? 'flex' : 'none';
    if(GAME.isRankInfoOpen) { 
        if(GAME.isStoreOpen) window.toggleShop(); 
        if(GAME.isWeaponStoreOpen) window.toggleInventory();
        if(GAME.isProfileOpen) window.toggleProfile();
        if(GAME.isSettingsOpen) window.toggleSettings();
        if(GAME.isPromoOpen) window.togglePromo();
        if(ui.leaderboardModal.style.display === 'flex') window.toggleLeaderboard();
        renderRankInfo(); 
    }
}

window.toggleProfile = function() {
    GAME.isProfileOpen = !GAME.isProfileOpen;
    ui.profileModal.style.display = GAME.isProfileOpen ? 'flex' : 'none';
    if(GAME.isProfileOpen) {
        if(GAME.isStoreOpen) window.toggleShop();
        if(GAME.isWeaponStoreOpen) window.toggleInventory();
        if(GAME.isRankInfoOpen) window.toggleRankInfo();
        if(GAME.isSettingsOpen) window.toggleSettings();
        if(GAME.isPromoOpen) window.togglePromo();
        if(ui.leaderboardModal.style.display === 'flex') window.toggleLeaderboard();
        renderProfile();
    }
}

window.toggleSettings = function() {
    GAME.isSettingsOpen = !GAME.isSettingsOpen;
    ui.settingsModal.style.display = GAME.isSettingsOpen ? 'flex' : 'none';
    if(GAME.isSettingsOpen) {
        if(GAME.isStoreOpen) window.toggleShop();
        if(GAME.isWeaponStoreOpen) window.toggleInventory();
        if(GAME.isRankInfoOpen) window.toggleRankInfo();
        if(GAME.isProfileOpen) window.toggleProfile();
        if(GAME.isPromoOpen) window.togglePromo();
        if(ui.leaderboardModal.style.display === 'flex') window.toggleLeaderboard();
    }
}

window.togglePromo = function() {
    GAME.isPromoOpen = !GAME.isPromoOpen;
    ui.promoModal.style.display = GAME.isPromoOpen ? 'flex' : 'none';
    ui.promoResult.innerText = "";
    ui.promoInput.value = "";
    
    if(GAME.isPromoOpen) {
        if(GAME.isStoreOpen) window.toggleShop();
        if(GAME.isWeaponStoreOpen) window.toggleInventory();
        if(GAME.isRankInfoOpen) window.toggleRankInfo();
        if(GAME.isProfileOpen) window.toggleProfile();
        if(GAME.isSettingsOpen) window.toggleSettings();
        if(ui.leaderboardModal.style.display === 'flex') window.toggleLeaderboard();
        setTimeout(() => ui.promoInput.focus(), 100);
    }
}

window.submitPromoCode = function() {
    const code = ui.promoInput.value.trim().toLowerCase();
    const t = TRANSLATIONS[SETTINGS.language];
    
    if(!code) return;
    
    if(code === "masterfc") {
        if(GAME.redeemedCodes.includes("masterfc")) {
            ui.promoResult.innerText = t.msg_code_used;
            ui.promoResult.style.color = "#ef4444";
            SoundSys.error();
        } else {
            GAME.coins += 20000;
            GAME.redeemedCodes.push("masterfc");
            updateUI();
            updateMenuStats();
            window.saveGame();
            
            ui.promoResult.innerText = t.msg_code_success;
            ui.promoResult.style.color = "#22c55e";
            SoundSys.rankup();
            
            setTimeout(() => { if(GAME.isPromoOpen) window.togglePromo(); }, 1500);
        }
    } else {
        ui.promoResult.innerText = t.msg_code_invalid;
        ui.promoResult.style.color = "#ef4444";
        SoundSys.error();
    }
}

window.changeLanguage = function(lang) {
    SETTINGS.language = lang;
    window.updateLanguageUI();
    window.saveGame();
}

window.changeResolution = function(res) {
    SETTINGS.resolution = res;
    resize();
    window.saveGame();
}

window.changeGraphics = function(gfx) {
    SETTINGS.graphics = gfx;
    window.saveGame();
}

function renderShop() {
    ui.storeList.innerHTML = '';
    const t = TRANSLATIONS[SETTINGS.language];
    const btnTextBuy = t.buy || 'BUY';
    const txtOwned = t.owned || 'OWNED';
    const txtWeapons = t.section_weapons || 'WEAPONS';
    const txtSkins = t.section_skins || 'SKINS';
    const txtPatches = t.section_patches || 'PATCHES';

    // 1. WEAPONS
    const weaponTitle = document.createElement('div');
    weaponTitle.className = 'section-title';
    weaponTitle.innerText = txtWeapons;
    ui.storeList.appendChild(weaponTitle);

    Object.keys(WEAPONS).forEach(key => {
        const w = WEAPONS[key];
        const isOwned = GAME.ownedWeapons.includes(key);
        const card = document.createElement('div');
        card.className = `item-card`;
        let btnHTML = isOwned ? `<button class="action-btn btn-equipped" style="cursor:default;">${txtOwned}</button>` : `<button class="action-btn" style="background:#eab308; color:black" onclick="window.buyWeapon('${key}')">${btnTextBuy}</button>`;
        card.innerHTML = `<div class="skin-preview-box"><canvas class="preview-canvas" data-weapon="${key}" width="200" height="100"></canvas></div><div style="font-weight:bold; color:#fff; font-size:1.2rem;">${w.name}</div><div style="color:#888; font-size:0.8rem; margin:5px 0;">${w.desc}</div><div style="color:#3b82f6; margin-bottom:5px; font-weight:bold;">${w.price} $</div>${btnHTML}`;
        ui.storeList.appendChild(card);
    });

    // 2. SKINS
    const skinTitle = document.createElement('div');
    skinTitle.className = 'section-title';
    skinTitle.innerText = txtSkins;
    ui.storeList.appendChild(skinTitle);

    Object.values(SKINS).forEach(skin => {
        const isOwned = GAME.ownedSkins.includes(skin.id);
        const card = document.createElement('div');
        card.className = `item-card`;
        let btnHTML = isOwned ? `<button class="action-btn btn-equipped" style="cursor:default;">${txtOwned}</button>` : `<button class="action-btn btn-buy" onclick="window.buySkin('${skin.id}')">${btnTextBuy}</button>`;
        card.innerHTML = `<div class="skin-preview-box"><canvas class="preview-canvas" data-skin="${skin.id}" width="200" height="100"></canvas></div><div style="font-weight:bold; color:#fff">${skin.name}</div><div style="color:#eab308; margin-bottom:5px;">${skin.price} $</div>${btnHTML}`;
        ui.storeList.appendChild(card);
    });
    
    // 3. PATCHES
    const patchTitle = document.createElement('div');
    patchTitle.className = 'section-title';
    patchTitle.innerText = txtPatches;
    ui.storeList.appendChild(patchTitle);

    Object.values(PATCHES).forEach(patch => {
        const isOwned = GAME.ownedPatches && GAME.ownedPatches.includes(patch.id);
        const card = document.createElement('div');
        card.className = `item-card`;
        const name = t[patch.nameKey] || patch.nameKey;
        let btnHTML = isOwned ? `<button class="action-btn btn-equipped" style="cursor:default;">${txtOwned}</button>` : `<button class="action-btn btn-buy" onclick="window.buyPatch('${patch.id}')">${btnTextBuy}</button>`;
        card.innerHTML = `<div class="skin-preview-box"><canvas class="preview-canvas" data-patch="${patch.id}" width="100" height="100"></canvas></div><div style="font-weight:bold; color:#fff">${name}</div><div style="color:#eab308; margin-bottom:5px;">${patch.price} $</div>${btnHTML}`;
        ui.storeList.appendChild(card);
    });
}

function renderInventory() {
    ui.weaponList.innerHTML = '';
    const t = TRANSLATIONS[SETTINGS.language];
    const btnTextEquip = t.equip || 'EQUIP';
    const btnTextEquipped = t.equipped || 'EQUIPPED';
    const txtWeapons = t.section_weapons || 'WEAPONS';
    const txtSkins = t.section_skins || 'SKINS';
    const txtPatches = t.section_patches || 'PATCHES';

    // 1. WEAPONS
    const weaponTitle = document.createElement('div');
    weaponTitle.className = 'section-title';
    weaponTitle.innerText = txtWeapons;
    ui.weaponList.appendChild(weaponTitle);

    GAME.ownedWeapons.forEach(key => {
        const w = WEAPONS[key];
        const isActive = GAME.currentWeapon === key;
        const card = document.createElement('div');
        card.className = `item-card ${isActive ? 'active' : ''}`;
        card.style.borderColor = isActive ? '#3b82f6' : '#333';
        let btnHTML = isActive ? `<button class="action-btn" style="background:#333; color:#777; cursor:default;">${btnTextEquipped}</button>` : `<button class="action-btn" style="background:#3b82f6; color:white" onclick="window.equipWeapon('${key}')">${btnTextEquip}</button>`;
        card.innerHTML = `<div class="skin-preview-box" style="border-color:${isActive?'#3b82f6':'#333'}"><canvas class="preview-canvas" data-weapon="${key}" width="200" height="100"></canvas></div><div style="font-weight:bold; color:#fff; font-size:1.2rem;">${w.name}</div><div style="color:#888; font-size:0.8rem; margin:5px 0;">${w.desc}</div>${btnHTML}`;
        ui.weaponList.appendChild(card);
    });

    // 2. SKINS
    const skinTitle = document.createElement('div');
    skinTitle.className = 'section-title';
    skinTitle.innerText = txtSkins;
    ui.weaponList.appendChild(skinTitle);

    GAME.ownedSkins.forEach(skinId => {
        const skin = SKINS[skinId];
        if(!skin) return;
        const isActive = (skin.type === 'gun' && GAME.currentSkin === skin.id) || (skin.type === 'silencer' && GAME.currentSilencer === skin.id);
        const card = document.createElement('div');
        card.className = `item-card ${isActive ? 'active' : ''}`;
        let btnHTML = isActive ? `<button class="action-btn btn-equipped" style="cursor:default;">${btnTextEquipped}</button>` : `<button class="action-btn btn-equip" onclick="window.equipSkin('${skin.id}')">${btnTextEquip}</button>`;
        card.innerHTML = `<div class="skin-preview-box"><canvas class="preview-canvas" data-skin="${skin.id}" width="200" height="100"></canvas></div><div style="font-weight:bold; color:#fff">${skin.name}</div>${btnHTML}`;
        ui.weaponList.appendChild(card);
    });

    // 3. PATCHES
    const patchTitle = document.createElement('div');
    patchTitle.className = 'section-title';
    patchTitle.innerText = txtPatches;
    ui.weaponList.appendChild(patchTitle);

    if(GAME.ownedPatches) {
        GAME.ownedPatches.forEach(patchId => {
            const patch = PATCHES[patchId];
            if(!patch) return;
            const isActive = GAME.currentPatch === patch.id;
            const card = document.createElement('div');
            card.className = `item-card ${isActive ? 'active' : ''}`;
            const name = t[patch.nameKey] || patch.nameKey;
            let btnHTML = isActive ? `<button class="action-btn btn-equipped" style="cursor:default;">${btnTextEquipped}</button>` : `<button class="action-btn btn-equip" onclick="window.equipPatch('${patch.id}')">${btnTextEquip}</button>`;
            card.innerHTML = `<div class="skin-preview-box"><canvas class="preview-canvas" data-patch="${patch.id}" width="100" height="100"></canvas></div><div style="font-weight:bold; color:#fff">${name}</div>${btnHTML}`;
            ui.weaponList.appendChild(card);
        });
    }
}

window.buyPatch = (id) => {
    const p = PATCHES[id];
    if(GAME.coins >= p.price) {
        GAME.coins -= p.price;
        if(!GAME.ownedPatches) GAME.ownedPatches = [];
        GAME.ownedPatches.push(id);
        updateUI(); updateMenuStats(); renderShop(); window.saveGame(); SoundSys.buy(); requestAnimationFrame(renderPreviews);
    } else { ui.coinDisplay.classList.add('no-money'); setTimeout(()=>ui.coinDisplay.classList.remove('no-money'), 400); SoundSys.error(); }
}

window.equipPatch = (id) => {
    GAME.currentPatch = id;
    renderInventory(); window.saveGame(); SoundSys.buy(); updateUI(); requestAnimationFrame(renderPreviews);
}

window.buySkin = (id) => {
    const s = SKINS[id];
    if(GAME.coins >= s.price) {
        GAME.coins -= s.price; 
        GAME.ownedSkins.push(id); 
        updateUI(); 
        updateMenuStats();
        renderShop();
        window.saveGame(); 
        SoundSys.buy(); 
        requestAnimationFrame(renderPreviews);
    } else { 
        ui.coinDisplay.classList.add('no-money'); 
        setTimeout(()=>ui.coinDisplay.classList.remove('no-money'), 400); 
        SoundSys.error();
    }
}

window.equipSkin = (id) => { 
    const s = SKINS[id]; 
    if(s.type === 'silencer') GAME.currentSilencer = id; 
    else GAME.currentSkin = id; 
    
    renderInventory(); 
    window.saveGame(); 
    SoundSys.buy(); 
    updateUI(); 
    requestAnimationFrame(renderPreviews); 
}

window.buyWeapon = (key) => {
    const w = WEAPONS[key];
    if(GAME.coins >= w.price) {
        GAME.coins -= w.price; 
        GAME.ownedWeapons.push(key); 
        
        updateUI(); 
        updateMenuStats();
        renderShop(); 
        window.saveGame(); 
        SoundSys.buy(); 
        requestAnimationFrame(renderPreviews);
    } else { 
        ui.coinDisplay.classList.add('no-money'); 
        setTimeout(()=>ui.coinDisplay.classList.remove('no-money'), 400); 
        SoundSys.error();
    }
}

window.equipWeapon = (key) => { 
    GAME.currentWeapon = key; 
    const w = WEAPONS[key]; 
    GUN.maxAmmo = w.capacity; 
    GUN.ammo = w.capacity; 
    
    renderInventory(); 
    window.saveGame(); 
    SoundSys.buy(); 
    updateUI(); 
    requestAnimationFrame(renderPreviews); 
}

window.triggerUpgradeAnim = () => {
    if(GAME.state !== 'playing' || UPGRADE.active) return;
    if(GAME.coins >= 1000) {
        GAME.coins -= 1000; updateUI(); UPGRADE.active = true; UPGRADE.phase = 0; UPGRADE.timer = 0; UPGRADE.boxY = -100; UPGRADE.boxScale = 1; UPGRADE.glow = 0; UPGRADE.particles = [];
    } else { ui.coinDisplay.classList.add('no-money'); setTimeout(()=> ui.coinDisplay.classList.remove('no-money'), 400); }
}

function updateUpgradeAnim() {
    UPGRADE.timer++; const cx = width / 2; const cy = height / 2;
    if(UPGRADE.phase === 0) { UPGRADE.boxY += (cy - UPGRADE.boxY) * 0.15; if(Math.abs(cy - UPGRADE.boxY) < 5) { UPGRADE.phase = 1; UPGRADE.timer = 0; SoundSys.boxDrop(); } } 
    else if(UPGRADE.phase === 1) { UPGRADE.boxScale = 1 + Math.sin(UPGRADE.timer * 0.8) * 0.05; if(UPGRADE.timer > 60) { UPGRADE.phase = 2; UPGRADE.timer = 0; SoundSys.levelup(); 
        if(SETTINGS.graphics !== 'low') {
            for(let i=0; i<30; i++) UPGRADE.particles.push({x: cx, y: cy, vx: (Math.random()-0.5)*15, vy: (Math.random()-0.5)*15, life: 1, color: Math.random()>0.5?'#eab308':'#fff'}); 
        }
        GAME.weaponLevel++; updateUI(); window.saveGame(); } } 
    else if(UPGRADE.phase === 2) { if(UPGRADE.timer > 120) UPGRADE.active = false; }
}

function drawUpgradeEffect() {
    const t = TRANSLATIONS[SETTINGS.language];
    const cx = width/2; const cy = height/2; ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0,0,width,height);
    if(UPGRADE.phase <= 1) { ctx.save(); ctx.translate(cx, UPGRADE.boxY); if(UPGRADE.phase === 1) ctx.rotate((Math.random()-0.5)*0.1); ctx.scale(UPGRADE.boxScale, UPGRADE.boxScale); ctx.fillStyle = '#444'; ctx.fillRect(-40, -30, 80, 60); ctx.fillStyle = '#555'; ctx.fillRect(-35, -25, 70, 50); ctx.fillStyle = '#eab308'; ctx.fillRect(-40, -5, 80, 10); ctx.fillRect(-10, -30, 20, 60); ctx.restore(); }
    if(UPGRADE.phase === 2) { 
        if(SETTINGS.graphics !== 'low') {
            UPGRADE.particles.forEach(p => { p.x += p.vx; p.y += p.vy; p.life -= 0.02; if(p.life>0) { ctx.globalAlpha = p.life; ctx.fillStyle=p.color; ctx.fillRect(p.x, p.y, 5, 5); } }); ctx.globalAlpha = 1; 
        }
        const floatY = cy - Math.min(UPGRADE.timer * 2, 50); const scale = Math.min(UPGRADE.timer * 0.1, 2); ctx.save(); ctx.translate(cx, floatY); ctx.scale(scale, scale); ctx.shadowColor = '#eab308'; ctx.shadowBlur = 20; ctx.strokeStyle = '#eab308'; ctx.lineWidth = 3; ctx.beginPath(); for(let i=0; i<10; i++) { ctx.moveTo(-15, -20 + i*5); ctx.lineTo(15, -18 + i*5); ctx.lineTo(-15, -15 + i*5); } ctx.stroke(); ctx.fillStyle = '#fff'; ctx.fillRect(-2, -25, 4, 55); ctx.restore(); ctx.shadowBlur = 0; ctx.save(); ctx.textAlign = "center"; ctx.fillStyle = "#fff"; ctx.font = "bold 40px Segoe UI"; ctx.fillText(t.msg_upgraded || "UPGRADED", cx, cy + 80); ctx.font = "20px Segoe UI"; ctx.fillStyle = "#eab308"; ctx.fillText(t.msg_dmg_added || "DAMAGE +10", cx, cy + 110); ctx.restore(); }
}

function handleClick(e) {
    if(GAME.state === 'menu' || GAME.state === 'lobby') return; 
    if(GAME.isStoreOpen || GAME.isWeaponStoreOpen || GAME.isRankInfoOpen || UPGRADE.active || GAME.isProfileOpen || GAME.isSettingsOpen || GAME.isPromoOpen || GAME.state !== 'playing' || GAME.isPaused || ui.leaderboardModal.style.display === 'flex' || ui.devConsole.style.display === 'flex') return;
    if(e.target.closest('.hud-element') || e.target.closest('.modal-content')) return;

    SoundSys.resume(); if(GUN.reloading) return; if(GUN.ammo <= 0) { reload(); return; }
    const now = Date.now(); if(now - GUN.lastShot > 110) { shoot(); GUN.lastShot = now; }
}

function shoot() {
    GUN.ammo--; updateUI(); SoundSys.shoot(GUN.attachments.silencer); const rMod = GUN.attachments.silencer ? 0.8 : 1.0;
    const weaponData = WEAPONS[GAME.currentWeapon]; const dmgMult = weaponData.damage || 1;
    let baseRecoil = 20; let baseAngle = -0.15;
    if(GAME.currentWeapon === 'beretta') { baseRecoil = 25; baseAngle = -0.18; } 
    if(GAME.currentWeapon === 'canik') { baseRecoil = 22; baseAngle = -0.16; } 
    if(GAME.currentWeapon === 'magnum') { baseRecoil = 45; baseAngle = -0.35; } 
    if(GAME.currentWeapon === 'fn57') { baseRecoil = 15; baseAngle = -0.10; }
    if(GAME.currentWeapon === 'mpt55') { baseRecoil = 28; baseAngle = -0.12; }
    
    GUN.recoilX = baseRecoil * rMod; 
    GUN.recoilAngle = baseAngle * rMod; 
    GUN.slideOffset = (GAME.currentWeapon === 'magnum' || GAME.currentWeapon === 'mpt55') ? 40 : 25; 
    
    let barrelLen = GUN.attachments.silencer ? 95 : 70; 
    if(GAME.currentWeapon === 'mpt55') barrelLen = GUN.attachments.silencer ? 140 : 110;

    const visualAngle = GUN.angle + GUN.recoilAngle * 0.5; 
    const nX = (GUN.x - GUN.recoilX*0.5) + Math.cos(visualAngle) * barrelLen; 
    const nY = GUN.y + Math.sin(visualAngle) * barrelLen; 
    const fireAngle = GUN.angle; 

    let spread = (Math.random()-0.5) * 0.015; 
    if(GUN.attachments.scope) spread = 0; 
    if(GAME.currentWeapon === 'mpt55') spread *= 0.6;

    const damage = (45 + (GAME.weaponLevel - 1) * 10) * dmgMult;
    let bulletSpeed = 30; 
    if(GAME.mode === 'reflex' || GAME.mode === 'hostage') bulletSpeed = 80;

    bullets.push({
        x: nX, y: nY, vx: Math.cos(fireAngle + spread) * bulletSpeed, vy: Math.sin(fireAngle + spread) * bulletSpeed, 
        prevX: nX, prevY: nY, active: true, power: damage
    }); 
    
    // GÜNCELLEME: SoundSys.shell() buradan kaldırıldı, artık fizik döngüsünde (yere çarpınca) çalacak.
    shells.push({x: GUN.x, y:GUN.y-5, vx: -Math.random()*3-2, vy:-Math.random()*6-3, angle:0, life:100}); 
    
    if(!GUN.attachments.silencer && SETTINGS.graphics !== 'low') { flashTimer = 3; flashPos = {x:nX, y:nY, angle:visualAngle}; }
}

function reload() {
    if(GUN.reloading || GUN.ammo === GUN.maxAmmo) return;
    if(GAME.coins < GAME.reloadCost) { ui.coinDisplay.classList.add('no-money'); setTimeout(()=>ui.coinDisplay.classList.remove('no-money'), 400); return; }
    GAME.coins -= GAME.reloadCost; updateUI(); GUN.reloading = true; const wData = WEAPONS[GAME.currentWeapon]; 
    let magW = 15; let magH = 35;
    if(GAME.currentWeapon === 'mpt55') { magW = 20; magH = 45; }
    magazines.push({ x: GUN.x - 10, y: GUN.y + 20, vx: -1, vy: 2, angle: 0, width: magW, height: magH }); 
    SoundSys.reload(); 
    setTimeout(() => { GUN.ammo = GUN.maxAmmo; GUN.reloading = false; updateUI(); }, wData.reloadTime);
}

function checkHitmanCombo() { if (GAME.hitStreak > 0 && GAME.hitStreak % 15 === 0) { HITMAN_ANIM.active = true; HITMAN_ANIM.timer = 90; HITMAN_ANIM.alpha = 0; SoundSys.levelup(); } }
function drawHitmanEffect(ctx) {
    const t = TRANSLATIONS[SETTINGS.language];
    if (!HITMAN_ANIM.active) return; HITMAN_ANIM.timer--; if (HITMAN_ANIM.timer <= 0) { HITMAN_ANIM.active = false; return; }
    if (HITMAN_ANIM.timer > 70) HITMAN_ANIM.alpha += 0.05; else if (HITMAN_ANIM.timer < 20) HITMAN_ANIM.alpha -= 0.05; if (HITMAN_ANIM.alpha > 1) HITMAN_ANIM.alpha = 1; if (HITMAN_ANIM.alpha < 0) HITMAN_ANIM.alpha = 0;
    const cx = width / 2; const cy = height / 2 - 50; ctx.save(); ctx.globalAlpha = HITMAN_ANIM.alpha; const gradient = ctx.createRadialGradient(cx, cy, 10, cx, cy, 300); gradient.addColorStop(0, 'rgba(220, 38, 38, 0.4)'); gradient.addColorStop(1, 'rgba(0, 0, 0, 0)'); ctx.fillStyle = gradient; ctx.fillRect(0, 0, width, height); const scale = 1 + Math.sin(Date.now() * 0.01) * 0.05; ctx.translate(cx, cy); ctx.scale(scale * 3, scale * 3); const agentPath = new Path2D("M12 2C6.48 2 2 6.48 2 12c0 5.52 4.48 10 10 10s10-4.48 10-10C22 6.48 17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"); ctx.fillStyle = "#fff"; ctx.shadowColor = "#ef4444"; ctx.shadowBlur = 20; ctx.fill(agentPath); ctx.restore(); ctx.save(); ctx.globalAlpha = HITMAN_ANIM.alpha; ctx.textAlign = "center"; ctx.font = "900 60px 'Segoe UI'"; ctx.fillStyle = "#fff"; ctx.shadowColor = "#ef4444"; ctx.shadowBlur = 30; ctx.fillText("HITMAN", cx, cy + 120); ctx.font = "bold 20px 'Segoe UI'"; ctx.fillStyle = "#ef4444"; ctx.shadowBlur = 0; ctx.fillText(`15 ${t.msg_hit_streak || 'STREAK'}`, cx, cy + 150); ctx.restore();
}
function drawRankUpEffect(ctx) {
    if (!RANK_UP_ANIM.active) return; RANK_UP_ANIM.timer--; if (RANK_UP_ANIM.timer <= 0) { RANK_UP_ANIM.active = false; return; }
    const cx = width / 2; const cy = height / 2; const alpha = Math.min(1, RANK_UP_ANIM.timer / 50); ctx.save(); ctx.globalAlpha = alpha; const rankData = getRankData(); const color = rankData.color; ctx.fillStyle = "rgba(0, 0, 0, 0.9)"; ctx.fillRect(0, 0, width, height); ctx.textAlign = "center"; ctx.shadowBlur = 30; ctx.shadowColor = color; ctx.font = "900 80px 'Segoe UI'"; ctx.fillStyle = color; ctx.fillText(RANK_UP_ANIM.text, cx, cy - 40); ctx.font = "bold 50px 'Segoe UI'"; ctx.fillStyle = "#fff"; ctx.fillText(RANK_UP_ANIM.subText, cx, cy + 40); if (RANK_UP_ANIM.rewardText) { ctx.font = "bold 30px 'Segoe UI'"; ctx.fillStyle = "#22c55e"; ctx.shadowColor = "#22c55e"; ctx.shadowBlur = 10; ctx.fillText(RANK_UP_ANIM.rewardText, cx, cy + 90); } for(let i=0; i<8; i++) { ctx.fillStyle = Math.random() > 0.5 ? color : "#fff"; ctx.shadowColor = color; ctx.fillRect(cx + (Math.random()-0.5)*500, cy + (Math.random()-0.5)*400, 5, 5); } ctx.restore();
}

// YAMA ÇİZİM FONKSİYONU
function drawPatch(ctx, x, y, scale = 1, patchId = null) {
    const id = patchId || GAME.currentPatch || 'patch_ops';
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    
    // Kumaş Dokusu (Pattern)
    // Siyah/Koyu Gri varsayılan zemin
    const fabricColor = (id === 'patch_tr') ? '#b91c1c' : ((id === 'patch_us') ? '#1e293b' : '#111');
    
    // Gölge (Patch'in hafif kabarık durması için)
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = 10 * scale;
    ctx.shadowOffsetX = 4 * scale;
    ctx.shadowOffsetY = 4 * scale;

    // Ana Daire
    ctx.beginPath();
    ctx.arc(0, 0, 40, 0, Math.PI*2);
    ctx.fillStyle = fabricColor;
    ctx.fill();
    
    // Gölgeyi sıfırla (içerik için)
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // Kumaş Efekti (Noise)
    if(SETTINGS.graphics !== 'low') {
        ctx.fillStyle = "rgba(255,255,255,0.05)";
        for(let i=0; i<100; i++) {
             // Rastgele noktalarla kumaş pürüzü
             const r = Math.random() * 38;
             const a = Math.random() * Math.PI * 2;
             ctx.fillRect(Math.cos(a)*r, Math.sin(a)*r, 1, 1);
        }
        // Kanvas dokusu (ızgara)
        ctx.fillStyle = "rgba(0,0,0,0.1)";
        for(let i=-40; i<40; i+=3) {
             ctx.fillRect(i, -40, 1, 80);
             ctx.fillRect(-40, i, 80, 1);
        }
    }

    // Dikiş (Stitching)
    ctx.beginPath();
    ctx.arc(0, 0, 36, 0, Math.PI*2);
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]); // Dikiş efekti
    ctx.stroke();
    ctx.setLineDash([]); // Reset

    // İÇERİK
    ctx.clip(); // Dışarı taşmayı önle (gerçi daire çizdik ama garanti olsun)

    if (id === 'patch_tr') {
        // Türk Bayrağı (Ay Yıldız)
        // Hilal
        ctx.shadowColor = "rgba(0,0,0,0.5)"; ctx.shadowBlur = 2; // İşleme hissi
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(-5, 0, 12, 0, Math.PI*2); // Dış daire
        ctx.fill();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.arc(-2, 0, 10, 0, Math.PI*2); // İç kesim
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        
        // Yıldız
        ctx.save();
        ctx.translate(12, 0);
        ctx.rotate(-0.2);
        ctx.beginPath();
        drawStar(ctx, 0, 0, 5, 8, 5);
        ctx.fillStyle = "#fff";
        ctx.fill();
        ctx.restore();

    } else if (id === 'patch_us') {
        // ABD Bayrağı (Yuvarlak stilize)
        // Canton (Mavi alan)
        ctx.fillStyle = "#1e3a8a"; // Koyu mavi
        ctx.beginPath();
        ctx.arc(0, 0, 40, Math.PI, Math.PI*1.5); // Sol üst çeyrek
        ctx.lineTo(0,0);
        ctx.fill();
        
        // Şeritler (Kırmızı Beyaz)
        // Kalan alanı doldurmak zor, maskeleme kullanalım
        ctx.save();
        ctx.beginPath();
        ctx.arc(0, 0, 40, 0, Math.PI*2);
        ctx.clip();
        
        // Sadece mavi alan dışına şerit çizmek yerine üstüne çizip maviyi tekrar çizelim
        // Zemin zaten mavi değil, kırmızı/beyaz şerit yapalım
        for(let i=-40; i<40; i+=10) {
            ctx.fillStyle = (i/10)%2===0 ? "#b91c1c" : "#fff";
            ctx.fillRect(-40, i, 80, 10);
        }
        
        // Mavi Alan (Sol Üst)
        ctx.fillStyle = "#1e3a8a";
        ctx.beginPath();
        ctx.moveTo(-40, 0);
        ctx.arc(0, 0, 40, Math.PI, Math.PI*1.5); 
        ctx.lineTo(0, -40);
        ctx.lineTo(0, 0);
        ctx.lineTo(-40, 0);
        ctx.fill();
        
        // Yıldızlar
        ctx.fillStyle = "#fff";
        ctx.shadowColor = "rgba(0,0,0,0.5)"; ctx.shadowBlur = 2;
        for(let r=0; r<3; r++) {
            for(let c=0; c<3; c++) {
                 ctx.beginPath();
                 drawStar(ctx, -30 + c*10, -30 + r*10, 3, 2, 5);
                 ctx.fill();
            }
        }
        ctx.restore();

    } else {
        // Spec Ops (Kuru kafa veya Logo)
        ctx.shadowColor = "rgba(0,0,0,0.5)"; ctx.shadowBlur = 2;
        ctx.fillStyle = "#333"; // Koyu gri logo
        // Basit Kuru Kafa
        ctx.beginPath();
        ctx.arc(0, -5, 12, 0, Math.PI*2);
        ctx.rect(-8, 5, 16, 12);
        ctx.fill();
        
        ctx.fillStyle = "#111"; // Gözler
        ctx.beginPath(); ctx.arc(-4, -5, 3, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(4, -5, 3, 0, Math.PI*2); ctx.fill();
        // Dişler
        ctx.fillRect(-5, 10, 2, 5);
        ctx.fillRect(-1, 10, 2, 5);
        ctx.fillRect(3, 10, 2, 5);
        
        ctx.font = "bold 8px Arial";
        ctx.fillStyle = "#555";
        ctx.textAlign = "center";
        ctx.fillText("SPEC OPS", 0, 25);
    }
    
    ctx.restore();
}

// Helper: Yıldız çizimi
function drawStar(ctx, cx, cy, spikes, outerRadius, innerRadius) {
    let rot = Math.PI / 2 * 3;
    let x = cx;
    let y = cy;
    let step = Math.PI / spikes;

    ctx.beginPath();
    ctx.moveTo(cx, cy - outerRadius);
    for (let i = 0; i < spikes; i++) {
        x = cx + Math.cos(rot) * outerRadius;
        y = cy + Math.sin(rot) * outerRadius;
        ctx.lineTo(x, y);
        rot += step;

        x = cx + Math.cos(rot) * innerRadius;
        y = cy + Math.sin(rot) * innerRadius;
        ctx.lineTo(x, y);
        rot += step;
    }
    ctx.lineTo(cx, cy - outerRadius);
    ctx.closePath();
}

function loop() {
    const t = TRANSLATIONS[SETTINGS.language];
    const now = Date.now();
    const dt = (now - GAME.lastTime) / 1000;
    if(!GAME.isPaused) GAME.lastTime = now; 
    
    ctx.clearRect(0,0,width,height);

    if (GAME.state === 'menu' || GAME.state === 'lobby') {
        if (SETTINGS.graphics !== 'low') {
            for(let i=0; i<20; i++) {
                ctx.fillStyle = `rgba(100, 100, 120, 0.1)`;
                ctx.beginPath();
                ctx.arc((now/20 + i*100) % width, (Math.sin(now/1000 + i) * 100 + height/2), 2 + i, 0, Math.PI*2);
                ctx.fill();
            }
        }
        if(GAME.state === 'menu') {
             const cx = width / 2 + 100; const cy = height / 2; ctx.save(); ctx.translate(cx, cy); ctx.scale(2.5, 2.5); ctx.rotate(menuRotation); const wType = GAME.currentWeapon; 
             if(wType==='glock') drawDetailedGlock(ctx,0,0,0,0); 
             else if(wType==='beretta') drawDetailedBeretta(ctx,0,0,0,0); 
             else if(wType==='canik') drawDetailedCanik(ctx,0,0,0,0); 
             else if(wType==='magnum') drawDetailedMagnum(ctx,0,0,0,0); 
             else if(wType==='fn57') drawDetailedFN57(ctx,0,0,0,0); 
             else if(wType==='mpt55') drawDetailedMPT55(ctx,0,0,0,0);
             ctx.restore();
        }
        if(GAME.isStoreOpen || GAME.isWeaponStoreOpen) requestAnimationFrame(renderPreviews);
        requestAnimationFrame(loop);
        return; 
    }
    
    if(GAME.state === 'playing') {
        if (SETTINGS.graphics !== 'low') {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
            ctx.lineWidth = 1;
            const gridSize = 40;
            ctx.beginPath();
            for(let x=0; x<=width; x+=gridSize) { ctx.moveTo(x,0); ctx.lineTo(x,height); }
            for(let y=0; y<=height; y+=gridSize) { ctx.moveTo(0,y); ctx.lineTo(width,y); }
            ctx.stroke();
        }
        
        if(GAME.mode === 'defense') {
            ctx.beginPath();
            ctx.moveTo(GUN.x + 80, 0);
            ctx.lineTo(GUN.x + 80, height);
            ctx.strokeStyle = 'rgba(239, 68, 68, 0.3)';
            ctx.setLineDash([10, 10]);
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // --- DRAW PATCH (HUD / ARM) ---
        // Ekranın sol orta-alt kısmında, silahın gerisinde (vücut üzerinde gibi)
        // Silah x: width * 0.2 (soldan %20)
        // Patch konumu: x: 60, y: height - 120 (biraz aşağıda)
        if (GAME.currentPatch) {
            drawPatch(ctx, 60, height - 120, 1.2, GAME.currentPatch);
        }
    }

    if (GAME.state === 'playing' && !GAME.isPaused) {
        if (!GAME.weaponUsage[GAME.currentWeapon]) GAME.weaponUsage[GAME.currentWeapon] = 0;
        GAME.weaponUsage[GAME.currentWeapon] += (dt * 1000); checkMedals();
        GAME.timer -= dt; 
        if (GAME.timer <= 0) { GAME.timer = 0; gameOver(); } 
        updateTimerUI();
    }
    if(UPGRADE.active) updateUpgradeAnim();

    const dx = mouse.x - GUN.x; const dy = mouse.y - GUN.y;
    if(!GAME.isPaused) {
        GUN.targetAngle = Math.atan2(dy, dx); 
        GUN.angle += (GUN.targetAngle - GUN.angle) * 0.2; 
    }
    GUN.recoilX *= 0.8; GUN.recoilAngle *= 0.8; GUN.slideOffset *= 0.8;
    if(GUN.attachments.laser) { const bLen = GUN.attachments.silencer ? 95 : 70; const lx = (GUN.x - GUN.recoilX) + Math.cos(GUN.angle+GUN.recoilAngle)*bLen; const ly = GUN.y + Math.sin(GUN.angle+GUN.recoilAngle)*bLen; ctx.beginPath(); ctx.moveTo(lx, ly+10); ctx.lineTo(lx + Math.cos(GUN.angle)*2000, ly+10 + Math.sin(GUN.angle)*2000); ctx.strokeStyle='rgba(234, 179, 8, 0.5)'; ctx.lineWidth=2; ctx.stroke(); ctx.fillStyle='#eab308'; ctx.beginPath(); ctx.arc(mouse.x, mouse.y, 3, 0, Math.PI*2); ctx.fill(); }

    let levelCleared = false;

    if(GAME.state === 'playing' && !GAME.isPaused) {
        if(GAME.mode === 'classic') {
            let allCleared = true;
            wallBlocks.forEach(b => {
                if(b.active) {
                    allCleared = false;
                    const damagePct = b.hp / b.maxHp;
                    const size = b.size;
                    if(b.hitTimer > 0) { b.hitTimer--; ctx.fillStyle = '#fff'; ctx.fillRect(b.x, b.y, size, size); } 
                    else {
                        if(b.type === 'metal') { const mCol = `rgba(50, 60, 80, ${damagePct})`; ctx.fillStyle = '#1e293b'; ctx.fillRect(b.x, b.y, size, size); ctx.fillStyle = mCol; ctx.fillRect(b.x + 2, b.y + 2, size - 4, size - 4); } 
                        else { const wCol = `rgba(120, 80, 50, ${damagePct})`; ctx.fillStyle = '#3a2510'; ctx.fillRect(b.x, b.y, size, size); ctx.fillStyle = wCol; ctx.fillRect(b.x + 2, b.y + 2, size - 4, size - 4); }
                    }
                }
            });
            levelCleared = allCleared;
        } 
        else if(GAME.mode === 'reflex') {
            reflexSpawnTimer--;
            if(reflexSpawnTimer <= 0) {
                const size = 60 - Math.min(30, GAME.level * 2);
                const padding = 100;
                const rx = padding + Math.random() * (width - padding*2);
                const ry = padding + Math.random() * (height - padding*2);
                const life = 120 - Math.min(60, GAME.level * 5); 
                reflexTargets.push({x: rx, y: ry, size: size, maxLife: life, life: life, active: true, id: Date.now()+Math.random()});
                SoundSys.blip();
                reflexSpawnTimer = 60 - Math.min(40, GAME.level * 3); 
            }
            
            reflexTargets = reflexTargets.filter(t => t.active);

            reflexTargets.forEach(t => {
                if(!t.active) return;
                t.life--;
                if(t.life <= 0) { t.active = false; } else {
                    const lifePct = t.life / t.maxLife;
                    const scale = 0.5 + (lifePct * 0.5); 
                    ctx.save(); ctx.translate(t.x, t.y); ctx.scale(scale, scale);
                    ctx.beginPath(); ctx.arc(0, 0, t.size/2, 0, Math.PI*2); ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 4; ctx.stroke();
                    ctx.fillStyle = `rgba(239, 68, 68, 0.2)`; ctx.fill();
                    ctx.beginPath(); ctx.arc(0, 0, t.size/6, 0, Math.PI*2); ctx.fillStyle = '#fff'; ctx.fill();
                    ctx.beginPath(); ctx.arc(0, 0, (t.size/2) + 5, -Math.PI/2, (-Math.PI/2) + (Math.PI*2 * lifePct), false); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
                    ctx.restore();
                }
            });
            if(GAME.targetsHit >= GAME.targetsToHit) levelCleared = true;
            ctx.font = "bold 20px Segoe UI"; ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.fillText(`${t.msg_targets || 'TARGETS'}: ${GAME.targetsHit} / ${GAME.targetsToHit}`, width/2, 50);
        } else if (GAME.mode === 'hostage') {
            reflexSpawnTimer--;
            if(reflexSpawnTimer <= 0) {
                const size = 50; const padding = 100; const rx = padding + Math.random() * (width - padding*2); const ry = padding + Math.random() * (height - padding*2); const life = 90; 
                reflexTargets.push({x: rx, y: ry, size: size, maxLife: life, life: life, active: true, id: Date.now()+Math.random()});
                SoundSys.blip();
                reflexSpawnTimer = 45 - Math.min(25, GAME.level * 2); 
            }

            reflexTargets = reflexTargets.filter(t => t.active);

            reflexTargets.forEach(t => {
                if(!t.active) return;
                t.life--;
                if(t.life <= 0) t.active = false;
                else {
                    const lifePct = t.life / t.maxLife;
                    const scale = 0.5 + (lifePct * 0.5);
                    ctx.save(); ctx.translate(t.x, t.y); ctx.scale(scale, scale);
                    ctx.fillStyle = "#ef4444"; ctx.beginPath(); ctx.arc(0, -10, 15, 0, Math.PI*2); ctx.fill(); ctx.fillRect(-15, 5, 30, 25); 
                    ctx.strokeStyle = "#fff"; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(-20,0); ctx.lineTo(20,0); ctx.moveTo(0,-20); ctx.lineTo(0,20); ctx.stroke();
                    ctx.restore();
                }
            });
            if(GAME.targetsHit >= GAME.targetsToHit) levelCleared = true;
            ctx.font = "bold 20px Segoe UI"; ctx.fillStyle = "#facc15"; ctx.textAlign = "center"; ctx.fillText(`${t.msg_rescue || 'SAVED'}: ${GAME.targetsHit} / ${GAME.targetsToHit}`, width/2, 50);
        } else if (GAME.mode === 'defense') {
            defenseSpawnTimer--;
            let spawnRate = 100 - Math.min(70, GAME.level * 4); 
            
            if(defenseSpawnTimer <= 0 && defenseEnemies.length < 20) {
                const size = 50;
                const speed = 0.8 + (GAME.level * 0.12) + (Math.random() * 0.5); 
                const hp = 30 + (GAME.level * 5); 
                const spawnY = 50 + Math.random() * (height - 100);
                defenseEnemies.push({ x: width + size, y: spawnY, initialY: spawnY, size: size, hp: hp, maxHp: hp, speed: speed, active: true, jitterPhase: Math.random() * Math.PI * 2, hitTimer: 0 });
                defenseSpawnTimer = spawnRate;
            }

            defenseEnemies.forEach(e => {
                if(!e.active) return;
                e.x -= e.speed;
                const jitterAmt = 3; 
                e.y = e.initialY + Math.sin(Date.now() * 0.005 + e.jitterPhase) * 20 + Math.sin(Date.now() * 0.05) * jitterAmt;

                const safeZoneX = GUN.x + 80;
                if (e.x < safeZoneX) { gameOver('breach'); return; }

                const hpPct = e.hp / e.maxHp;
                const hitFlash = e.hitTimer > 0;
                if(e.hitTimer > 0) e.hitTimer--;

                ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(Math.sin(Date.now() * 0.01) * 0.1);
                if(hitFlash) {
                    ctx.fillStyle = '#fff'; ctx.fillRect(-e.size/2, -e.size/2, e.size, e.size);
                } else {
                    ctx.fillStyle = '#7f1d1d'; ctx.fillRect(-e.size/2, -e.size/2, e.size, e.size);
                    ctx.fillStyle = `rgba(220, 38, 38, ${0.5 + hpPct * 0.5})`; ctx.fillRect(-e.size/2 + 4, -e.size/2 + 4, e.size - 8, e.size - 8);
                    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.moveTo(-10, -5); ctx.lineTo(-20, 0); ctx.lineTo(-10, 5); ctx.fill();
                    ctx.fillStyle = '#333'; ctx.fillRect(-e.size/2, -e.size/2 - 10, e.size, 5); ctx.fillStyle = '#ef4444'; ctx.fillRect(-e.size/2, -e.size/2 - 10, e.size * hpPct, 5);
                }
                ctx.restore();
            });
            
            defenseEnemies = defenseEnemies.filter(e => e.active);

            if(GAME.targetsHit >= GAME.targetsToHit) levelCleared = true;
            ctx.font = "bold 20px Segoe UI"; ctx.fillStyle = "#ef4444"; ctx.textAlign = "center"; ctx.fillText(`${t.msg_wave}: ${GAME.targetsHit} / ${GAME.targetsToHit}`, width/2, 50);
        }
    } else if (GAME.isPaused) {
        if(GAME.mode === 'classic') {
             wallBlocks.forEach(b => {
                 if(!b.active) return;
                 const size = b.size; const damagePct = b.hp / b.maxHp;
                 if(b.type === 'metal') { ctx.fillStyle = '#1e293b'; ctx.fillRect(b.x, b.y, size, size); ctx.fillStyle = `rgba(50, 60, 80, ${damagePct})`; ctx.fillRect(b.x+2, b.y+2, size-4, size-4); } 
                 else { ctx.fillStyle = '#3a2510'; ctx.fillRect(b.x, b.y, size, size); ctx.fillStyle = `rgba(120, 80, 50, ${damagePct})`; ctx.fillRect(b.x+2, b.y+2, size-4, size-4); }
             });
        }
    }

    if(levelCleared && GAME.state==='playing') { 
        GAME.state='leveling'; 
        if (GAME.modeLevels[GAME.mode]) { GAME.modeLevels[GAME.mode]++; } else { GAME.modeLevels[GAME.mode] = 2; }
        window.saveGame();

        if(GAME.mode === 'hostage') {
            GAME.hostagesSaved++; renderHostageUI();
            if(GAME.hostagesSaved >= GAME.totalHostages) {
                ui.notify.innerText = t.msg_all_saved; ui.notify.style.color = "#22c55e"; setTimeout(() => { GAME.hostagesSaved = 0; renderHostageUI(); }, 3000);
            } else { ui.notify.innerText = t.msg_saved; ui.notify.style.color = "#facc15"; }
        } else {
            ui.notify.innerText = t.msg_level_clear; ui.notify.style.color = "#fff"; 
        }
        ui.notify.style.opacity=1; 
        
        setTimeout(()=>{ 
            ui.notify.style.opacity=0; 
            const nextLvl = GAME.modeLevels[GAME.mode];
            if(nextLvl < GAME.maxLevel){ startLevel(nextLvl); GAME.state='playing'; } 
        }, 2000); 
    }

    bullets.forEach(b => {
        if(!b.active) return;
        if(!GAME.isPaused) {
            for(let i=0; i<5; i++) {
                if(!b.active) break; b.prevX = b.x; b.prevY = b.y; b.x += b.vx/5; b.y += b.vy/5;
                if(b.x>width || b.y<0 || b.y>height) { b.active=false; break; }
                
                if(GAME.mode === 'classic') {
                    for(let w of wallBlocks) {
                        if(w.active && b.x>w.x && b.x<w.x+w.size && b.y>w.y && b.y<w.y+w.size) {
                            w.hp -= b.power; w.hitTimer=3;
                            if(w.hp<=0) { 
                                w.active=false; 
                                GAME.targetsHit++; 
                                updateHitCounterUI(); 

                                GAME.score+=100; GAME.coins+=10; GAME.stats.totalScore += 100; GAME.stats.totalBlocks++; updateUI(); SoundSys.impact(); window.saveGame(); GAME.hitStreak++; checkHitmanCombo(); 
                                const debColor = w.type === 'metal' ? '#64748b' : '#a05a2c';
                                if (SETTINGS.graphics !== 'low') { for(let k=0;k<6;k++) particles.push({x:w.x+w.size/2, y:w.y+w.size/2, vx:(Math.random()-0.5)*15, vy:(Math.random()-0.5)*15, life:1, color:debColor, size:w.size/3}); }
                            } else SoundSys.impact();
                            b.power -= 20; if(b.power<=0) { b.active=false; break; }
                        }
                    }
                } 
                else if(GAME.mode === 'reflex' || GAME.mode === 'hostage') {
                    for(let t of reflexTargets) {
                        if(t.active) {
                            const dist = Math.hypot(b.x - t.x, b.y - t.y);
                            if(dist < t.size/2) {
                                t.active = false; 
                                GAME.targetsHit++; 
                                updateHitCounterUI();

                                GAME.score+=200; GAME.coins+=20; GAME.stats.totalScore += 200; updateUI(); SoundSys.impact(); window.saveGame(); GAME.hitStreak++;
                                if (SETTINGS.graphics !== 'low') { for(let k=0;k<8;k++) particles.push({x:t.x, y:t.y, vx:(Math.random()-0.5)*20, vy:(Math.random()-0.5)*20, life:1, color:'#ef4444', size:5}); }
                                b.active = false; break;
                            }
                        }
                    }
                }
                else if(GAME.mode === 'defense') {
                    for(let e of defenseEnemies) {
                        if(e.active && b.x > e.x - e.size/2 && b.x < e.x + e.size/2 && b.y > e.y - e.size/2 && b.y < e.y + e.size/2) {
                             e.hp -= b.power; e.hitTimer = 3;
                             if(e.hp <= 0) {
                                 e.active = false;
                                 GAME.targetsHit++;
                                 updateHitCounterUI();
                                 GAME.score += 150; GAME.coins += 15; GAME.hitStreak++; checkHitmanCombo(); updateUI(); SoundSys.impact();
                                 if (SETTINGS.graphics !== 'low') { for(let k=0;k<6;k++) particles.push({x:e.x, y:e.y, vx:(Math.random()-0.5)*15, vy:(Math.random()-0.5)*15, life:1, color:'#7f1d1d', size:5}); }
                             } else { SoundSys.impact(); }
                             b.power -= 20; if(b.power<=0) { b.active=false; break; }
                        }
                    }
                }
            }
        }
        ctx.beginPath(); ctx.moveTo(b.prevX, b.prevY); ctx.lineTo(b.x, b.y); ctx.strokeStyle='#ffffaa'; ctx.lineWidth=3; ctx.stroke();
    });
    
    bullets = bullets.filter(b=>b.active);
    
    // KOVAN FİZİĞİ VE SESİ
    shells.forEach(s => { 
        if(!GAME.isPaused) { 
            s.x+=s.vx; s.y+=s.vy; s.vy+=GRAVITY; s.angle+=0.2; s.life--; 
            if(s.y>height-20){
                // Yere çarpma kontrolü
                // Eğer düşey hızı (vy) belirli bir değerin üstündeyse ses çal (sürüklenirken çalmasın)
                if(Math.abs(s.vy) > 2) {
                    SoundSys.shell();
                }
                
                s.y=height-20; s.vy*=-0.5; s.vx*=0.8;
            } 
        } 
        if(s.life>0){ ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.angle); ctx.fillStyle='#ffd700'; ctx.fillRect(-3,-1.5,6,3); ctx.restore(); } 
    }); 
    shells = shells.filter(s=>s.life>0);

    magazines.forEach(m => { if(!GAME.isPaused) { m.x+=m.vx; m.y+=m.vy; m.vy+=GRAVITY; m.angle+=0.1; if(m.y>height-20){m.y=height-20;m.vy=0;m.vx=0;m.angle=Math.PI/2;} } ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(m.angle); ctx.fillStyle='#111'; ctx.fillRect(-7,-17,14,34); ctx.fillStyle='#333'; ctx.fillRect(-7,15,16,4); ctx.restore(); });
    particles.forEach(p => { if(!GAME.isPaused) { p.x+=p.vx; p.y+=p.vy; p.vy+=GRAVITY; p.life-=0.02; } if(p.life>0){ ctx.globalAlpha=p.life; ctx.fillStyle=p.color; ctx.fillRect(p.x, p.y, p.size, p.size); ctx.globalAlpha=1; } }); particles = particles.filter(p=>p.life>0);

    const wType = GAME.currentWeapon; const gX = GUN.x - GUN.recoilX; const gY = GUN.y; const gA = GUN.angle + GUN.recoilAngle;
    if(wType==='beretta') drawDetailedBeretta(ctx, gX, gY, gA, GUN.slideOffset);
    else if(wType==='canik') drawDetailedCanik(ctx, gX, gY, gA, GUN.slideOffset);
    else if(wType==='magnum') drawDetailedMagnum(ctx, gX, gY, gA, GUN.slideOffset);
    else if(wType==='fn57') drawDetailedFN57(ctx, gX, gY, gA, GUN.slideOffset);
    else if(wType==='mpt55') drawDetailedMPT55(ctx, gX, gY, gA, GUN.slideOffset);
    else drawDetailedGlock(ctx, gX, gY, gA, GUN.slideOffset);

    if(HITMAN_ANIM.active) drawHitmanEffect(ctx);
    if(RANK_UP_ANIM.active) drawRankUpEffect(ctx);
    if(flashTimer>0 && SETTINGS.graphics !== 'low') { ctx.save(); ctx.translate(flashPos.x, flashPos.y); ctx.rotate(flashPos.angle); ctx.fillStyle = `rgba(255, 200, 50, ${flashTimer/3})`; ctx.beginPath(); ctx.ellipse(15, 0, 40, 15+Math.random()*10, 0, 0, Math.PI*2); ctx.fill(); ctx.restore(); flashTimer--; }
    if(UPGRADE.active) drawUpgradeEffect();

    requestAnimationFrame(loop);
}

function drawDetailedGlock(ctx, x, y, angle, slideOffset, skinOverride = null, silencerOverride = null) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
    const skin = skinOverride || SKINS[GAME.currentSkin];
    const silencerId = silencerOverride || GAME.currentSilencer;
    const frameColor = skin.color; const slideColor = skin.slideColor === 'fade' ? null : skin.slideColor;
    ctx.fillStyle = frameColor; ctx.beginPath(); ctx.moveTo(-5, 5); ctx.quadraticCurveTo(-15, 20, -18, 45); ctx.lineTo(-12, 60); ctx.lineTo(15, 60); ctx.lineTo(18, 45); ctx.lineTo(15, 18); ctx.quadraticCurveTo(30, 25, 25, 35); ctx.lineTo(15, 35); ctx.lineTo(5, 35); ctx.quadraticCurveTo(-5, 30, 5, 18); ctx.lineTo(15, 5); ctx.fill();
    
    if (SETTINGS.graphics === 'high') {
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; for(let i=0; i<50; i++) { const gx = (Math.random()*25) - 10; const gy = (Math.random()*30) + 25; ctx.beginPath(); ctx.arc(gx, gy, 1, 0, Math.PI*2); ctx.fill(); }
    }

    ctx.fillStyle = frameColor; ctx.fillRect(15, 0, 45, 12); ctx.fillStyle = '#000'; ctx.fillRect(45, 10, 5, 2); 
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.moveTo(10, 20); ctx.quadraticCurveTo(15, 28, 8, 30); ctx.lineTo(6, 30); ctx.lineTo(8, 20); ctx.fill(); ctx.fillStyle = '#222'; ctx.fillRect(8, 24, 2, 6); ctx.fillRect(5, 25, 8, 5); ctx.fillRect(5, 5, 12, 3);
    ctx.fillStyle = '#333'; ctx.beginPath(); ctx.arc(2, 10, 2, 0, Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(-8, 12, 2, 0, Math.PI*2); ctx.fill(); 
    const sX = -10 - slideOffset; const tilt = slideOffset > 5 ? -0.05 : 0; 
    ctx.save(); ctx.rotate(tilt); ctx.fillStyle = '#444'; ctx.fillRect(30, -14, 15, 12); ctx.fillStyle = '#555'; ctx.fillRect(45, -12, 35, 8); ctx.restore();
    if(slideOffset > 0) { ctx.fillStyle = '#111'; ctx.fillRect(45, -2, 30, 3); ctx.fillStyle = '#333'; ctx.fillRect(75, -3, 2, 5); }
    ctx.save(); ctx.translate(sX, 0); 
    if(slideColor === 'fade') { const grd = ctx.createLinearGradient(0, -20, 80, 0); grd.addColorStop(0, "#fbbf24"); grd.addColorStop(0.5, "#ec4899"); grd.addColorStop(1, "#6366f1"); ctx.fillStyle = grd; } else ctx.fillStyle = slideColor;
    ctx.beginPath(); ctx.roundRect(0, -18, 85, 20, [2, 2, 0, 0]); ctx.fill();
    
    if (SETTINGS.graphics !== 'low') {
        ctx.fillStyle = 'rgba(0,0,0,0.2)'; for(let i=0; i<6; i++) ctx.fillRect(5 + i*3, -16, 1.5, 16); for(let i=0; i<6; i++) ctx.fillRect(65 + i*3, -16, 1.5, 16); 
    }
    
    ctx.fillStyle = '#111'; ctx.fillRect(30, -18, 15, 10); ctx.fillStyle = '#222'; ctx.fillRect(46, -12, 8, 3);
    ctx.fillStyle = '#111'; ctx.fillRect(2, -21, 6, 3); ctx.fillRect(80, -20, 3, 2); ctx.fillStyle = '#fff'; ctx.fillRect(2, -20, 1, 1); ctx.fillRect(6, -20, 1, 1); ctx.fillStyle = '#0f0'; ctx.fillRect(81, -19, 1.5, 1.5);
    ctx.fillStyle = slideColor === 'fade' ? 'rgba(0,0,0,0.1)' : slideColor; ctx.beginPath(); ctx.moveTo(85, -18); ctx.lineTo(85, 2); ctx.lineTo(82, 2); ctx.lineTo(82, -18); ctx.fill();
    drawSkinDetails(ctx, skin, 'glock'); ctx.restore(); drawAttachments(ctx, sX, silencerId, 'glock'); ctx.restore();
}

function drawDetailedBeretta(ctx, x, y, angle, slideOffset, skinOverride = null, silencerOverride = null) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle); const skin = skinOverride || SKINS[GAME.currentSkin]; const silencerId = silencerOverride || GAME.currentSilencer;
    const frameColor = skin.id === 'skin_black' ? '#222' : skin.color; const slideColor = skin.id === 'skin_black' ? '#111' : (skin.slideColor === 'fade' ? null : skin.slideColor);
    ctx.fillStyle = frameColor; ctx.beginPath(); ctx.moveTo(-5, 0); ctx.quadraticCurveTo(-15, 10, -20, 45); ctx.lineTo(-12, 65); ctx.lineTo(20, 65); ctx.lineTo(22, 45); ctx.quadraticCurveTo(20, 35, 15, 25); ctx.lineTo(35, 25); ctx.quadraticCurveTo(45, 25, 45, 15); ctx.lineTo(40, 5); ctx.lineTo(55, 5); ctx.lineTo(55, 0); ctx.lineTo(-5, 0); ctx.fill();
    ctx.fillStyle = '#0a0a0a'; ctx.beginPath(); ctx.moveTo(-12, 20); ctx.lineTo(-15, 45); ctx.lineTo(-10, 60); ctx.lineTo(15, 60); ctx.lineTo(17, 45); ctx.lineTo(12, 20); ctx.fill();
    ctx.fillStyle = '#333'; ctx.beginPath(); ctx.arc(0, 30, 2.5, 0, Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(0, 50, 2.5, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(25, 15, 4, 0, Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.moveTo(25, 15); ctx.quadraticCurveTo(30, 25, 22, 25); ctx.stroke();
    ctx.fillStyle = '#222'; const hammerRot = slideOffset > 5 ? 0.5 : 0; ctx.save(); ctx.translate(-18, 5); ctx.rotate(hammerRot); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-5, -8); ctx.quadraticCurveTo(-2, -12, 4, -8); ctx.lineTo(2, 0); ctx.fill(); ctx.restore();
    ctx.fillStyle = '#333'; ctx.fillRect(15, -14, 80, 8); ctx.fillStyle = '#111'; ctx.fillRect(95, -14, 2, 8);
    const sX = -10 - slideOffset; ctx.save(); ctx.translate(sX, 0);
    if(slideColor === 'fade') { const grd = ctx.createLinearGradient(0, -20, 80, 0); grd.addColorStop(0, "#fbbf24"); grd.addColorStop(0.5, "#ec4899"); grd.addColorStop(1, "#6366f1"); ctx.fillStyle = grd; } else ctx.fillStyle = slideColor || '#111';
    ctx.fillRect(75, -18, 15, 18); ctx.fillRect(0, -18, 35, 18); ctx.fillRect(35, -2, 40, 2); 
    ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(10, -10, 4, 0, Math.PI*2); ctx.fill(); ctx.fillRect(6, -10, 12, 3); ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(10, -6, 1, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#000'; ctx.fillRect(2, -21, 6, 4); ctx.fillRect(82, -21, 2, 4);
    drawSkinDetails(ctx, skin, 'beretta'); ctx.restore(); drawAttachments(ctx, sX, silencerId, 'beretta'); ctx.restore();
}

function drawDetailedCanik(ctx, x, y, angle, slideOffset, skinOverride = null, silencerOverride = null) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle); const skin = skinOverride || SKINS[GAME.currentSkin]; const silencerId = silencerOverride || GAME.currentSilencer;
    const frameColor = skin.id === 'skin_black' ? '#1c1c1c' : skin.color; const slideColor = skin.id === 'skin_black' ? '#2a2a2a' : (skin.slideColor === 'fade' ? null : skin.slideColor);
    ctx.fillStyle = frameColor; ctx.beginPath(); ctx.moveTo(-5, 0); ctx.quadraticCurveTo(-15, 15, -18, 50); ctx.lineTo(-12, 70); ctx.lineTo(22, 70); ctx.lineTo(25, 45); ctx.quadraticCurveTo(22, 35, 15, 30); ctx.lineTo(35, 30); ctx.quadraticCurveTo(45, 30, 45, 20); ctx.lineTo(45, 5); ctx.lineTo(60, 5); ctx.lineTo(60, 0); ctx.lineTo(-5, 0); ctx.fill();
    
    if (SETTINGS.graphics !== 'low') {
        ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.roundRect(-8, 25, 25, 35, 2); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.05)'; for(let i=0; i<30; i++) { ctx.beginPath(); ctx.arc(-5 + Math.random()*20, 30 + Math.random()*25, 0.8, 0, Math.PI*2); ctx.fill(); }
    }

    ctx.fillStyle = '#111'; ctx.fillRect(-10, 70, 30, 4); ctx.fillStyle = '#111'; ctx.beginPath(); ctx.moveTo(25, 10); ctx.quadraticCurveTo(30, 20, 25, 25); ctx.lineTo(28, 25); ctx.lineTo(28, 10); ctx.fill(); ctx.fillStyle = '#b91c1c'; ctx.fillRect(26, 18, 2, 6);
    ctx.fillStyle = '#000'; ctx.fillRect(18, 5, 8, 3); ctx.fillStyle = '#222'; ctx.fillRect(5, 0, 15, 2);
    const sX = -12 - slideOffset; const tilt = slideOffset > 5 ? -0.05 : 0; ctx.save(); ctx.rotate(tilt); ctx.fillStyle = '#333'; ctx.fillRect(30, -13, 15, 11); ctx.fillStyle = '#444'; ctx.fillRect(45, -11, 40, 7); ctx.restore(); if(slideOffset > 0) { ctx.fillStyle = '#111'; ctx.fillRect(45, -1, 35, 3); }
    ctx.save(); ctx.translate(sX, 0); if(slideColor === 'fade') { const grd = ctx.createLinearGradient(0, -20, 80, 0); grd.addColorStop(0, "#fbbf24"); grd.addColorStop(0.5, "#ec4899"); grd.addColorStop(1, "#6366f1"); ctx.fillStyle = grd; } else ctx.fillStyle = slideColor || '#2a2a2a';
    ctx.beginPath(); ctx.moveTo(0, -15); ctx.lineTo(2, -20); ctx.lineTo(88, -20); ctx.lineTo(90, -15); ctx.lineTo(90, 2); ctx.lineTo(0, 2); ctx.fill();
    if (slideOffset < 5) { ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(1, -10, 1.5, 0, Math.PI*2); ctx.fill(); }
    
    if (SETTINGS.graphics !== 'low') {
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; for(let i=0; i<5; i++) ctx.fillRect(5 + i*3.5, -18, 1.5, 14); for(let i=0; i<4; i++) ctx.fillRect(70 + i*3.5, -18, 1.5, 14);
    }
    
    ctx.fillStyle = '#111'; ctx.fillRect(30, -18, 15, 10); ctx.fillStyle = '#222'; ctx.fillRect(46, -14, 8, 3);
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(0, -25); ctx.lineTo(8, -25); ctx.lineTo(5, -20); ctx.fill(); ctx.fillRect(86, -20, 4, 4); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(88, -19, 1, 0, Math.PI*2); ctx.fill();
    drawSkinDetails(ctx, skin, 'canik'); ctx.restore(); drawAttachments(ctx, sX, silencerId, 'canik'); ctx.restore();
}

function drawDetailedMagnum(ctx, x, y, angle, slideOffset, skinOverride = null, silencerOverride = null) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
    const chromeGrad = ctx.createLinearGradient(0, -20, 0, 20); chromeGrad.addColorStop(0, "#e8e8e8"); chromeGrad.addColorStop(0.2, "#fff"); chromeGrad.addColorStop(0.5, "#d4d4d4"); chromeGrad.addColorStop(0.8, "#fff"); chromeGrad.addColorStop(1, "#a3a3a3");
    const skin = skinOverride || SKINS[GAME.currentSkin]; const silencerId = silencerOverride || GAME.currentSilencer;
    const isChrome = skin.id === 'skin_black' || skin.id === 'skin_chrome' || skin.id === 'skin_silver';
    const baseColor = isChrome ? chromeGrad : skin.color; const slideFill = (skin.slideColor === 'fade') ? 'url(#grad_fade)' : (isChrome ? chromeGrad : skin.slideColor);
    ctx.fillStyle = baseColor; ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(-20, 20); ctx.lineTo(-25, 50); ctx.lineTo(-20, 75); ctx.lineTo(25, 75); ctx.lineTo(30, 45); ctx.lineTo(25, 35); ctx.lineTo(50, 35); ctx.lineTo(55, 25); ctx.lineTo(55, 5); ctx.lineTo(90, 5); ctx.lineTo(90, 0); ctx.lineTo(-10, 0); ctx.fill();
    ctx.fillStyle = '#1a1a1a'; ctx.beginPath(); ctx.moveTo(-15, 25); ctx.lineTo(-18, 50); ctx.lineTo(-15, 70); ctx.lineTo(20, 70); ctx.lineTo(25, 45); ctx.lineTo(20, 25); ctx.fill(); ctx.fillStyle = '#222'; for(let i=0; i<5; i++) ctx.fillRect(-10, 30+i*8, 30, 2);
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(35, 15, 8, 0.5, 2.5); ctx.stroke();
    ctx.fillStyle = '#333'; const hammerRot = slideOffset > 5 ? 0.8 : 0; ctx.save(); ctx.translate(-22, 5); ctx.rotate(hammerRot); ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI*2); ctx.fill(); ctx.fillStyle='#000'; ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI*2); ctx.fill(); ctx.restore();
    ctx.fillStyle = slideFill; ctx.beginPath(); ctx.moveTo(55, -20); ctx.lineTo(160, -20); ctx.lineTo(160, 5); ctx.lineTo(55, 5); ctx.fill();
    if (SETTINGS.graphics !== 'low') {
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; for(let i=0; i<8; i++) ctx.fillRect(60 + i*12, -21, 8, 3);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.moveTo(65, -10); ctx.lineTo(150, -10); ctx.lineTo(150, -2); ctx.lineTo(65, -2); ctx.fill(); ctx.fillStyle = '#222'; ctx.fillRect(55, 5, 40, 4);
    drawSkinDetails(ctx, skin, 'magnum');
    const sX = -slideOffset; ctx.save(); ctx.translate(sX, 0); ctx.fillStyle = slideFill; ctx.beginPath(); ctx.moveTo(-10, -20); ctx.lineTo(55, -20); ctx.lineTo(55, 5); ctx.lineTo(-10, 5); ctx.fill();
    ctx.fillStyle = '#222'; ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(15, -15); ctx.lineTo(15, -9); ctx.fill(); ctx.fillStyle = 'rgba(0,0,0,0.2)'; for(let i=0; i<5; i++) ctx.fillRect(0 + i*5, -15, 2, 12); ctx.fillStyle = '#111'; ctx.fillRect(-5, -23, 10, 3); ctx.restore();
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.moveTo(155, -20); ctx.lineTo(155, -28); ctx.lineTo(160, -28); ctx.lineTo(160, -20); ctx.fill(); ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(160, -8, 3.5, 0, Math.PI*2); ctx.fill();
    drawAttachments(ctx, -10, silencerId, 'magnum'); ctx.restore();
}

function drawDetailedFN57(ctx, x, y, angle, slideOffset, skinOverride = null, silencerOverride = null) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle); const skin = skinOverride || SKINS[GAME.currentSkin]; const silencerId = silencerOverride || GAME.currentSilencer;
    const frameColor = skin.id === 'skin_black' ? '#222' : skin.color; const slideColor = skin.id === 'skin_black' ? '#1a1a1a' : (skin.slideColor === 'fade' ? null : skin.slideColor);
    ctx.fillStyle = frameColor; ctx.beginPath(); ctx.moveTo(-5, 5); ctx.quadraticCurveTo(-15, 15, -15, 50); ctx.lineTo(-10, 70); ctx.lineTo(25, 70); ctx.lineTo(28, 45); ctx.quadraticCurveTo(25, 35, 15, 30); ctx.lineTo(40, 30); ctx.quadraticCurveTo(50, 30, 50, 20); ctx.lineTo(50, 5); ctx.lineTo(75, 5); ctx.lineTo(75, 0); ctx.lineTo(-5, 0); ctx.fill();
    
    if(SETTINGS.graphics !== 'low') {
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.rect(-8, 25, 28, 35); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.05)'; for(let r=0; r<6; r++) { for(let c=0; c<5; c++) { ctx.fillRect(-5 + c*5, 30 + r*5, 2, 2); }}
    }

    ctx.fillStyle = '#333'; ctx.beginPath(); ctx.arc(32, 15, 6, 0.5, 2.5); ctx.stroke(); ctx.fillStyle = '#555'; ctx.fillRect(28, 8, 12, 4); ctx.fillStyle = '#111'; ctx.fillRect(15, 5, 5, 5);
    const sX = -10 - slideOffset; ctx.save(); ctx.translate(sX, 0); if(slideColor === 'fade') { const grd = ctx.createLinearGradient(0, -20, 80, 0); grd.addColorStop(0, "#fbbf24"); grd.addColorStop(0.5, "#ec4899"); grd.addColorStop(1, "#6366f1"); ctx.fillStyle = grd; } else ctx.fillStyle = slideColor || '#1a1a1a';
    ctx.beginPath(); ctx.moveTo(0, -18); ctx.lineTo(95, -18); ctx.lineTo(95, 2); ctx.lineTo(0, 2); ctx.fill();
    if(SETTINGS.graphics !== 'low') {
        ctx.fillStyle = 'rgba(0,0,0,0.4)'; for(let i=0; i<4; i++) ctx.beginPath(), ctx.ellipse(5 + i*4, -8, 1.5, 6, 0, 0, Math.PI*2), ctx.fill(); for(let i=0; i<3; i++) ctx.beginPath(), ctx.ellipse(80 + i*4, -8, 1.5, 6, 0, 0, Math.PI*2), ctx.fill();
    }
    ctx.fillStyle = '#050505'; ctx.fillRect(35, -18, 18, 10); ctx.fillStyle = '#222'; ctx.fillRect(54, -14, 6, 3);
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.moveTo(0, -18); ctx.lineTo(0, -26); ctx.lineTo(10, -26); ctx.lineTo(10, -18); ctx.fill(); ctx.fillRect(90, -24, 4, 6);
    drawSkinDetails(ctx, skin, 'fn57'); ctx.restore();
    const bTilt = slideOffset > 5 ? -0.02 : 0; ctx.save(); ctx.rotate(bTilt); ctx.fillStyle = '#333'; ctx.fillRect(35, -12, 18, 8); if(slideOffset > 0) { ctx.fillStyle='#222'; ctx.fillRect(53, -12, 40, 6); } ctx.restore();
    drawAttachments(ctx, sX, silencerId, 'fn57'); ctx.restore();
}

function drawDetailedMPT55(ctx, x, y, angle, slideOffset, skinOverride = null, silencerOverride = null) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
    const skin = skinOverride || SKINS[GAME.currentSkin];
    const silencerId = silencerOverride || GAME.currentSilencer;
    
    const isCamo = skin.id === 'skin_camo';
    const mainColor = isCamo ? '#3f4e38' : (skin.color === '#1a1a1a' ? '#222' : skin.color);
    const partColor = isCamo ? '#2c3327' : '#111';
    const accentColor = '#333';

    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(-85, -5, 40, 10);
    ctx.fillStyle = mainColor;
    ctx.beginPath();
    ctx.moveTo(-90, -10);
    ctx.lineTo(-50, -10);
    ctx.lineTo(-50, 15);
    ctx.lineTo(-80, 25); 
    ctx.lineTo(-90, 25);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#050505';
    ctx.fillRect(-93, -12, 6, 40);
    ctx.fillStyle = '#111';
    ctx.fillRect(-70, 15, 10, 5);

    ctx.fillStyle = mainColor;
    ctx.beginPath();
    ctx.moveTo(-45, -8);
    ctx.lineTo(10, -8);
    ctx.lineTo(10, 10); 
    ctx.lineTo(-15, 10);
    ctx.lineTo(-20, 25); 
    ctx.lineTo(-40, 25);
    ctx.lineTo(-45, 10);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = partColor;
    ctx.fillRect(-45, -22, 60, 14);
    
    ctx.fillStyle = mainColor;
    ctx.beginPath();
    ctx.moveTo(-25, 10);
    ctx.quadraticCurveTo(-20, 30, -35, 45); 
    ctx.lineTo(-20, 48);
    ctx.lineTo(-10, 25);
    ctx.lineTo(-15, 10);
    ctx.closePath();
    ctx.fill();
    if(SETTINGS.graphics !== 'low') {
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(-28, 20, 5, 20);
    }

    ctx.save();
    ctx.translate(0, 10);
    ctx.rotate(0.15); 
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.moveTo(-5, 0);
    ctx.lineTo(8, 0);
    ctx.lineTo(5, 40); 
    ctx.lineTo(-8, 38);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#333';
    ctx.fillRect(-4, 5, 8, 2);
    ctx.fillRect(-3, 15, 7, 2);
    ctx.fillRect(-2, 25, 6, 2);
    ctx.restore();

    ctx.fillStyle = mainColor;
    ctx.fillRect(15, -20, 65, 18);
    
    if(SETTINGS.graphics !== 'low') {
        ctx.fillStyle = '#000';
        for(let i=0; i<8; i++) {
            ctx.beginPath();
            ctx.arc(20 + i*8, -11, 2, 0, Math.PI*2);
            ctx.fill();
            ctx.fillRect(20 + i*8, -22, 3, 2);
        }
    }

    // Özel MPT Skin Efektleri
    if (skin.id === 'skin_mpt_wrapped') {
        const clothColor = '#c2b280';
        // Sargılar
        ctx.fillStyle = clothColor;
        // El kundağı sargıları
        for(let i=0; i<3; i++) {
            ctx.beginPath();
            ctx.moveTo(25 + i*15, -20);
            ctx.lineTo(35 + i*15, -22);
            ctx.lineTo(40 + i*15, -5);
            ctx.lineTo(30 + i*15, -3);
            ctx.fill();
            // Gölgelendirme
            ctx.fillStyle = 'rgba(0,0,0,0.1)';
            ctx.fillRect(30 + i*15, -22, 2, 20);
            ctx.fillStyle = clothColor;
        }

        // SALLANAN BEZ PARÇASI (Animasyonlu)
        const time = Date.now() * 0.008;
        const sway = Math.sin(time) * 3; // Doğal salınım
        const recoilKick = slideOffset * 2; // Ateş edince savrulma
        
        ctx.save();
        ctx.translate(55, -5); // Asılma noktası (El kundağı altı)
        
        // Bez açısı (Recoil ile geriye doğru savrulur gibi görünmesi için açıyı ters çeviriyoruz veya öne atıyoruz)
        const angleSway = (Math.sin(time * 0.5) * 0.2) + (recoilKick * 0.05); 
        ctx.rotate(angleSway);

        ctx.fillStyle = '#bfa57d'; // Bez rengi
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(12, 0);
        
        // Bez ucu koordinatları (Bezier eğrisi ile sarkma efekti)
        const tipX = 8 + (sway * 0.5) + recoilKick; 
        const tipY = 25 + Math.abs(sway); 
        
        ctx.quadraticCurveTo(15 + recoilKick, 10, tipX + 5, tipY); 
        ctx.lineTo(tipX - 5, tipY + 2);
        ctx.quadraticCurveTo(0 + recoilKick, 10, -5, 5); 
        ctx.closePath();
        ctx.fill();
        
        // Bez yırtık detayları
        if (SETTINGS.graphics !== 'low') {
             ctx.fillStyle = 'rgba(0,0,0,0.2)';
             ctx.beginPath(); ctx.arc(tipX, tipY-5, 2, 0, Math.PI*2); ctx.fill();
        }

        ctx.restore();
    } else if (skin.id === 'skin_mpt_forest') {
        // Orman kamuflaj ağı deseni
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        for(let i=0; i<6; i++) {
            ctx.beginPath();
            ctx.moveTo(20 + i*10, -20);
            ctx.lineTo(25 + i*10, -5);
            ctx.lineTo(30 + i*10, -20);
            ctx.fill();
        }
    } else if (skin.id === 'skin_mpt_branches' || skin.id === 'skin_mpt_autumn') {
        const isAutumn = skin.id === 'skin_mpt_autumn';
        const time = Date.now() * 0.005;
        const recoilShake = slideOffset * 0.15; 
        
        ctx.save();
        // Attachment points
        const branches = [
            {x: 60, y: -5, len: 25, ang: 0.5, swaySpd: 1},
            {x: 40, y: -5, len: 20, ang: 0.8, swaySpd: 1.2},
            {x: 80, y: -8, len: 15, ang: 0.3, swaySpd: 0.8},
            {x: -10, y: 15, len: 18, ang: 2.5, swaySpd: 0.9} 
        ];

        branches.forEach((b, i) => {
            ctx.save();
            ctx.translate(b.x, b.y);
            
            // Calculate dynamic angle
            const currentSway = Math.sin(time * b.swaySpd + i) * 0.1;
            const kickRot = Math.sin(time * 20) * recoilShake * (i%2==0 ? 1 : -1); 
            
            ctx.rotate(b.ang + currentSway + kickRot);

            // Draw Branch
            ctx.strokeStyle = isAutumn ? '#6d4c41' : '#4e342e';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.quadraticCurveTo(5, 0, b.len, 0);
            ctx.stroke();

            // Draw Leaves/Twigs
            ctx.fillStyle = isAutumn ? '#d84315' : '#2e7d32'; 
            if(isAutumn && i%2===0) ctx.fillStyle = '#fbc02d'; 

            for(let j=0; j<3; j++) {
                const leafDist = b.len * (0.5 + j*0.25);
                ctx.beginPath();
                ctx.ellipse(leafDist, (j%2==0?2:-2), 4, 2, 0.5 * (j%2==0?1:-1), 0, Math.PI*2);
                ctx.fill();
            }

            ctx.restore();
        });
        ctx.restore();
    }

    ctx.fillStyle = '#111';
    ctx.fillRect(80, -14, 30, 6); 

    ctx.fillStyle = '#000';
    ctx.fillRect(110, -15, 10, 8);
    ctx.fillStyle = '#222';
    ctx.fillRect(112, -15, 2, 8);
    ctx.fillRect(116, -15, 2, 8);

    ctx.fillStyle = '#111';
    ctx.fillRect(-30, -28, 10, 6);
    ctx.fillRect(-28, -32, 2, 4); 
    
    ctx.fillStyle = '#111';
    ctx.fillRect(70, -26, 8, 6);
    ctx.fillRect(73, -30, 2, 4); 

    ctx.fillStyle = '#000';
    ctx.fillRect(-10, -18, 15, 6); 
    
    const boltPos = Math.min(10, slideOffset); 
    ctx.fillStyle = '#333';
    ctx.fillRect(-10 - boltPos, -17, 14, 4);

    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(-8, 5, 4, 0, Math.PI);
    ctx.stroke();

    drawSkinDetails(ctx, skin, 'mpt55');
    
    let attX = 20;
    if(silencerId) attX += 15;
    
    drawAttachments(ctx, attX, silencerId, 'mpt55');
    
    ctx.restore();
}

function drawSkinDetails(ctx, skin, weaponType) {
    if (SETTINGS.graphics === 'low') return; 
    let cx = 40; let cy = -8; let stripeYStart = -16; let stripeHeight = 3; let starBaseX = 5;
    if (weaponType === 'beretta') { cx = 15; starBaseX = -5; } 
    else if (weaponType === 'magnum') { cx = 90; starBaseX = 65; cy = -12; stripeYStart = -20; } 
    else if (weaponType === 'fn57') { cx = 50; }
    else if (weaponType === 'mpt55') { cx = 30; cy = -11; stripeYStart = -15; starBaseX = 20; }

    if (skin.id === 'skin_turkish') { ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI*2); ctx.fill(); ctx.fillStyle='#e30a17'; ctx.beginPath(); ctx.arc(cx+2, cy, 3, 0, Math.PI*2); ctx.fill(); ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(cx+8, cy, 1, 0, Math.PI*2); ctx.fill(); }
    if (skin.id === 'skin_usa') { ctx.fillStyle = '#fff'; for(let i=0; i<3; i++) { ctx.fillRect(cx, stripeYStart + (i*6), 45, stripeHeight); } ctx.fillStyle = '#3c3b6e'; ctx.fillRect(starBaseX, stripeYStart-2, 40, 20); ctx.fillStyle = '#fff'; for(let r=0; r<3; r++) { for(let c=0; c<4; c++) { ctx.beginPath(); ctx.arc(starBaseX + 5 + c*10, stripeYStart + 2 + r*6, 1.5, 0, Math.PI*2); ctx.fill(); } } }
    if (skin.id === 'skin_camo') { 
        ctx.fillStyle = '#2c3327';
        for(let i=0; i<5; i++) {
             ctx.beginPath();
             ctx.arc(cx - 20 + i*15, cy + (i%2)*5, 8, 0, Math.PI*2);
             ctx.fill();
        }
    }
}

function drawAttachments(ctx, sX, silencerIdOverride = null, weaponType = 'glock') {
    const isPreview = ctx.canvas.classList.contains('preview-canvas'); const silencerId = silencerIdOverride || GAME.currentSilencer;
    let shouldDraw = false; if (isPreview) { shouldDraw = !!silencerIdOverride; } else { shouldDraw = GUN.attachments.silencer; } if (isPreview && !silencerIdOverride) shouldDraw = true;
    let silOffset = 0; let scopeOffset = 0; let laserX = 18; let laserY = 12;
    if (weaponType === 'beretta') { silOffset = 15; } if (weaponType === 'canik') { silOffset = 10; } if (weaponType === 'fn57') { silOffset = 15; }
    if (weaponType === 'magnum') { silOffset = 80; scopeOffset = 65; laserX = 60; laserY = 8; }
    if (weaponType === 'mpt55') { silOffset = 110; scopeOffset = 20; laserX = 65; laserY = -5; } 

    if (shouldDraw && silencerId) { 
        if (silencerId === 'silencer_gold') { ctx.fillStyle = '#ffd700'; ctx.fillRect(80 + silOffset, -12, 40, 10); ctx.fillStyle = '#B8860B'; for(let i=0; i<10; i++) ctx.fillRect(85 + i*3 + silOffset, -12, 1, 10); } 
        else { ctx.fillStyle = '#222'; ctx.fillRect(80 + silOffset, -12, 40, 10); ctx.fillStyle = '#444'; for(let i=0; i<10; i++) ctx.fillRect(85 + i*3 + silOffset, -12, 1, 10); }
    }
    const showAccessories = isPreview || GUN.attachments.scope;
    if(showAccessories && GUN.attachments.scope) { 
        const rX = sX + 15 + scopeOffset; 
        
        if(weaponType === 'mpt55') {
            ctx.fillStyle = '#111';
            ctx.beginPath();
            ctx.moveTo(rX, -22); 
            ctx.lineTo(rX+10, -30); 
            ctx.lineTo(rX-5, -35); 
            ctx.lineTo(rX+35, -35); 
            ctx.lineTo(rX+40, -30); 
            ctx.lineTo(rX+20, -22); 
            ctx.fill();
            ctx.fillStyle = 'rgba(0, 100, 255, 0.3)';
            ctx.beginPath(); ctx.ellipse(rX+38, -32.5, 2, 4, 0, 0, Math.PI*2); ctx.fill();
        } else {
            ctx.fillStyle = '#111'; ctx.fillRect(rX, -18, 20, 4); ctx.beginPath(); ctx.moveTo(rX, -18); ctx.lineTo(rX, -28); ctx.lineTo(rX+20, -28); ctx.lineTo(rX+20, -18); ctx.fill(); ctx.fillStyle = 'rgba(0,255,255,0.2)'; ctx.fillRect(rX+2, -26, 16, 8); ctx.fillStyle = 'red'; ctx.fillRect(rX+9, -23, 2, 2); 
        }
    }
    const showLaser = isPreview || GUN.attachments.laser;
    if(showLaser && GUN.attachments.laser) { ctx.fillStyle = '#111'; ctx.fillRect(laserX, laserY, 25, 8); ctx.fillStyle = '#eab308'; ctx.fillRect(laserX + 22, laserY + 2, 2, 4); }
}

ffunction resize() {
    // Ekranın tam genişlik ve yüksekliğini al
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
    
    // Konteynerı da aynı boyuta zorla
    gameContainer.style.width = width + 'px';
    gameContainer.style.height = height + 'px';
    
    // Silahın konumunu ekran boyutuna göre yeniden ayarla
    GUN.y = height / 2; 
    GUN.x = width * 0.2; // Soldan %20 içeride
    
    // Tıklama algılaması için konteyner sınırlarını güncelle
    containerRect = gameContainer.getBoundingClientRect();
    
    // Eğer oyun oynanıyorsa seviyeyi yeniden render et (kayma olmaması için)
    if(GAME.state === 'playing') {
        // Blokları veya hedefleri ekran boyutuna göre güncellemek gerekebilir
        // Ancak şimdilik sadece görseli düzeltiyoruz.
    }
}

function renderPreviews() {
    const previews = document.querySelectorAll('.preview-canvas');
    previews.forEach(canvas => {
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;
        ctx.clearRect(0, 0, w, h);
        
        const skinId = canvas.getAttribute('data-skin');
        const weaponId = canvas.getAttribute('data-weapon');
        const patchId = canvas.getAttribute('data-patch');
        
        ctx.save();
        
        // ÖZEL KAPAK TASARIMLARI (MPT SKİNLERİ İÇİN ARKA PLAN)
        if (skinId && skinId.startsWith('skin_mpt_')) {
            // Arka Plan Çizimi
            if (skinId === 'skin_mpt_wrapped') {
                // Çöl / Kıyamet Sonrası Teması
                const grd = ctx.createLinearGradient(0, 0, 0, h);
                grd.addColorStop(0, "#dcb482");
                grd.addColorStop(1, "#8c6e48");
                ctx.fillStyle = grd;
                ctx.fillRect(0, 0, w, h);
                // Rüzgar çizgileri / toz
                ctx.fillStyle = "rgba(255,255,255,0.1)";
                ctx.beginPath();
                ctx.moveTo(0, h); ctx.lineTo(w, h-20); ctx.lineTo(w, h); ctx.fill();
                ctx.fillStyle = "rgba(0,0,0,0.1)";
                for(let i=0; i<20; i++) ctx.fillRect(Math.random()*w, Math.random()*h, Math.random()*20, 1);
            } else if (skinId === 'skin_mpt_forest' || skinId === 'skin_mpt_branches') {
                // Derin Orman Teması
                const grd = ctx.createLinearGradient(0, 0, 0, h);
                grd.addColorStop(0, "#14532d"); // Dark Green
                grd.addColorStop(1, "#052e16"); // Darker Green
                ctx.fillStyle = grd;
                ctx.fillRect(0, 0, w, h);
                // Ağaç gölgeleri / Yapraklar
                ctx.fillStyle = "rgba(0,0,0,0.2)";
                for(let i=0; i<5; i++) {
                    ctx.beginPath();
                    ctx.arc(Math.random()*w, h, 30 + Math.random()*20, 0, Math.PI*2);
                    ctx.fill();
                }
            } else if (skinId === 'skin_mpt_autumn') {
                // Sonbahar Teması
                const grd = ctx.createLinearGradient(0, 0, 0, h);
                grd.addColorStop(0, "#7c2d12"); // Rust
                grd.addColorStop(1, "#451a03"); // Dark Brown
                ctx.fillStyle = grd;
                ctx.fillRect(0, 0, w, h);
                // Düşen yaprak efekti
                ctx.fillStyle = "#d97706"; // Amber
                for(let i=0; i<10; i++) {
                    ctx.beginPath();
                    ctx.ellipse(Math.random()*w, Math.random()*h, 4, 2, Math.random(), 0, Math.PI*2);
                    ctx.fill();
                }
            }
        }

        const cx = w / 2;
        const cy = h / 2;
        ctx.translate(cx, cy);
        
        if (patchId) {
            ctx.scale(1.0, 1.0);
            drawPatch(ctx, 0, 0, 1, patchId);
        } else if (skinId) {
            const skin = SKINS[skinId];
            
            // MPT-55 ÖZEL SKİNLERİ KONTROLÜ
            if (skinId.startsWith('skin_mpt_')) {
                // MPT-55 Çiz (Glock yerine)
                // Biraz küçültelim çünkü tüfek büyük
                ctx.scale(0.7, 0.7); 
                // Hafif açılı duruş
                ctx.rotate(0.1);
                drawDetailedMPT55(ctx, 0, 10, 0, 0, skin, null);
                
                // Ön izlemede "Special" ibaresi
                ctx.restore(); ctx.save(); // Reset transforms
                ctx.font = "bold 10px Segoe UI";
                ctx.fillStyle = "rgba(255,255,255,0.8)";
                ctx.textAlign = "right";
                ctx.fillText("MPT-55 CLASS", w-5, h-5);
                ctx.save(); // Dummy save for restore at end
            } 
            else if (skin.type === 'silencer') {
                 ctx.scale(1.2, 1.2);
                 if(GAME.currentWeapon === 'mpt55') drawDetailedMPT55(ctx, 0, 0, 0, 0, null, skinId);
                 else drawDetailedGlock(ctx, 0, 0, 0, 0, null, skinId);
            } else {
                 ctx.scale(1.2, 1.2);
                 drawDetailedGlock(ctx, 0, 0, 0, 0, skin, null);
            }
        } else if (weaponId) {
            if(weaponId === 'mpt55') ctx.scale(0.8, 0.8); else ctx.scale(1.2, 1.2);
            if(weaponId === 'glock') drawDetailedGlock(ctx, 0, 0, 0, 0);
            else if(weaponId ===
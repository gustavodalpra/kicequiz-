/* ==========================================
   BAÚ DO CAPITÃO
   storage.js — dados e progresso local
   ========================================== */

(function () {
  "use strict";

  const STORAGE_KEY = "bauDoCapitao_save_v1";
  const BACKUP_VERSION = 1;

  const DEFAULT_DATA = {
    version: BACKUP_VERSION,

    player: {
      name: "Capitão",
      coins: 0,
      xp: 0,
      totalAnswered: 0,
      totalCorrect: 0,
      quizzesCompleted: 0,
      streak: 0,
      lastPlayedDate: null
    },

    progress: {
      completedLevels: [],
      unlockedLevels: [1],
      currentLevel: 1,
      completedIslands: []
    },

    achievements: [],

    inventory: [],

    purchases: [],

    history: [],

    settings: {
      questionCount: 10,
      questionType: "mixed",
      difficulty: "auto"
    }
  };

  let data = createDefaultData();

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function createDefaultData() {
    return clone(DEFAULT_DATA);
  }

  function isObject(value) {
    return (
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value)
    );
  }

  function normalizeData(input) {
    const defaults = createDefaultData();

    if (!isObject(input)) {
      return defaults;
    }

    const result = {
      ...defaults,
      ...input,

      player: {
        ...defaults.player,
        ...(isObject(input.player) ? input.player : {})
      },

      progress: {
        ...defaults.progress,
        ...(isObject(input.progress) ? input.progress : {})
      },

      settings: {
        ...defaults.settings,
        ...(isObject(input.settings) ? input.settings : {})
      }
    };

    const arrayFields = [
      "completedLevels",
      "unlockedLevels",
      "completedIslands"
    ];

    for (const field of arrayFields) {
      if (!Array.isArray(result.progress[field])) {
        result.progress[field] = defaults.progress[field];
      }
    }

    const topLevelArrays = [
      "achievements",
      "inventory",
      "purchases",
      "history"
    ];

    for (const field of topLevelArrays) {
      if (!Array.isArray(result[field])) {
        result[field] = [];
      }
    }

    result.player.coins = Math.max(
      0,
      Number(result.player.coins) || 0
    );

    result.player.xp = Math.max(
      0,
      Number(result.player.xp) || 0
    );

    result.player.totalAnswered = Math.max(
      0,
      Number(result.player.totalAnswered) || 0
    );

    result.player.totalCorrect = Math.max(
      0,
      Number(result.player.totalCorrect) || 0
    );

    result.player.quizzesCompleted = Math.max(
      0,
      Number(result.player.quizzesCompleted) || 0
    );

    result.progress.currentLevel = Math.max(
      1,
      Number(result.progress.currentLevel) || 1
    );

    result.version = BACKUP_VERSION;

    return result;
  }

  function save() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(data)
      );

      return true;
    } catch (error) {
      console.error(
        "Não foi possível salvar os dados:",
        error
      );

      return false;
    }
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);

      if (!raw) {
        data = createDefaultData();
        save();
        return getAll();
      }

      data = normalizeData(JSON.parse(raw));

      return getAll();
    } catch (error) {
      console.error(
        "Não foi possível carregar os dados:",
        error
      );

      data = createDefaultData();

      return getAll();
    }
  }

  function getAll() {
    return clone(data);
  }

  function getPlayer() {
    return clone(data.player);
  }

  function updatePlayer(changes) {
    if (!isObject(changes)) {
      return false;
    }

    data.player = {
      ...data.player,
      ...changes
    };

    return save();
  }

  function setPlayerName(name) {
    const cleaned = String(name || "")
      .trim()
      .slice(0, 40);

    if (!cleaned) {
      return false;
    }

    data.player.name = cleaned;

    return save();
  }

  function getCoins() {
    return data.player.coins;
  }

  function addCoins(amount) {
    const value = Number(amount);

    if (!Number.isFinite(value) || value <= 0) {
      return false;
    }

    data.player.coins += Math.floor(value);

    return save();
  }

  function spendCoins(amount) {
    const value = Number(amount);

    if (
      !Number.isFinite(value) ||
      value <= 0 ||
      data.player.coins < Math.floor(value)
    ) {
      return false;
    }

    data.player.coins -= Math.floor(value);

    return save();
  }

  function addXp(amount) {
    const value = Number(amount);

    if (!Number.isFinite(value) || value <= 0) {
      return false;
    }

    data.player.xp += Math.floor(value);

    return save();
  }

  function getProgress() {
    return clone(data.progress);
  }

  function isLevelUnlocked(level) {
    const number = Number(level);

    return (
      Number.isInteger(number) &&
      data.progress.unlockedLevels.includes(number)
    );
  }

  function unlockLevel(level) {
    const number = Number(level);

    if (!Number.isInteger(number) || number < 1) {
      return false;
    }

    if (!data.progress.unlockedLevels.includes(number)) {
      data.progress.unlockedLevels.push(number);
      data.progress.unlockedLevels.sort((a, b) => a - b);
    }

    return save();
  }

  function completeLevel(level) {
    const number = Number(level);

    if (
      !Number.isInteger(number) ||
      number < 1 ||
      !isLevelUnlocked(number)
    ) {
      return false;
    }

    if (!data.progress.completedLevels.includes(number)) {
      data.progress.completedLevels.push(number);
      data.progress.completedLevels.sort((a, b) => a - b);
    }

    unlockLevel(number + 1);

    data.progress.currentLevel = Math.max(
      data.progress.currentLevel,
      number + 1
    );

    return save();
  }

  function isLevelCompleted(level) {
    return data.progress.completedLevels.includes(
      Number(level)
    );
  }

  function completeIsland(islandId) {
    const id = String(islandId || "").trim();

    if (!id) {
      return false;
    }

    if (!data.progress.completedIslands.includes(id)) {
      data.progress.completedIslands.push(id);
    }

    return save();
  }

  function getAchievements() {
    return clone(data.achievements);
  }

  function unlockAchievement(id) {
    const key = String(id || "").trim();

    if (!key) {
      return false;
    }

    if (data.achievements.includes(key)) {
      return false;
    }

    data.achievements.push(key);

    return save();
  }

  function hasAchievement(id) {
    return data.achievements.includes(String(id));
  }

  function getInventory() {
    return clone(data.inventory);
  }

  function addItem(itemId) {
    const id = String(itemId || "").trim();

    if (!id || data.inventory.includes(id)) {
      return false;
    }

    data.inventory.push(id);

    return save();
  }

  function hasItem(itemId) {
    return data.inventory.includes(String(itemId));
  }

  function getPurchases() {
    return clone(data.purchases);
  }

  function recordPurchase(itemId, price) {
    const id = String(itemId || "").trim();
    const cost = Number(price);

    if (
      !id ||
      !Number.isFinite(cost) ||
      cost < 0
    ) {
      return false;
    }

    data.purchases.push({
      itemId: id,
      price: cost,
      date: new Date().toISOString()
    });

    return save();
  }

  function getSettings() {
    return clone(data.settings);
  }

  function updateSettings(changes) {
    if (!isObject(changes)) {
      return false;
    }

    data.settings = {
      ...data.settings,
      ...changes
    };

    return save();
  }

  function addHistory(entry) {
    if (!isObject(entry)) {
      return false;
    }

    data.history.unshift({
      ...clone(entry),
      date: entry.date || new Date().toISOString()
    });

    // Mantém os 100 registros mais recentes.
    data.history = data.history.slice(0, 100);

    return save();
  }

  function getHistory() {
    return clone(data.history);
  }

  function recordAnswer(isCorrect) {
    data.player.totalAnswered += 1;

    if (isCorrect) {
      data.player.totalCorrect += 1;
    }

    return save();
  }

  function recordQuizCompleted() {
    data.player.quizzesCompleted += 1;

    return save();
  }

  function exportBackup() {
    const backup = {
      app: "bau-do-capitao",
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      data: getAll()
    };

    const blob = new Blob(
      [JSON.stringify(backup, null, 2)],
      { type: "application/json;charset=utf-8" }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download =
      "bau-do-capitao-backup-" +
      new Date().toISOString().slice(0, 10) +
      ".json";

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);

    return true;
  }

  async function importBackup(file) {
    if (!file) {
      throw new Error("Selecione um arquivo de backup.");
    }

    const textContent = await file.text();

    let parsed;

    try {
      parsed = JSON.parse(textContent);
    } catch {
      throw new Error("O arquivo não contém JSON válido.");
    }

    if (
      !isObject(parsed) ||
      parsed.app !== "bau-do-capitao" ||
      !isObject(parsed.data)
    ) {
      throw new Error(
        "Esse arquivo não parece ser um backup do Baú do Capitão."
      );
    }

    // A chave da API não é armazenada neste arquivo.
    data = normalizeData(parsed.data);

    if (!save()) {
      throw new Error(
        "Não foi possível salvar o backup neste navegador."
      );
    }

    return getAll();
  }

  function resetAll() {
    data = createDefaultData();

    return save();
  }

  // Disponibiliza as funções para os outros arquivos.
  window.StorageManager = {
    load,
    save,
    getAll,

    getPlayer,
    updatePlayer,
    setPlayerName,

    getCoins,
    addCoins,
    spendCoins,
    addXp,

    getProgress,
    isLevelUnlocked,
    unlockLevel,
    completeLevel,
    isLevelCompleted,
    completeIsland,

    getAchievements,
    unlockAchievement,
    hasAchievement,

    getInventory,
    addItem,
    hasItem,

    getPurchases,
    recordPurchase,

    getSettings,
    updateSettings,

    addHistory,
    getHistory,

    recordAnswer,
    recordQuizCompleted,

    exportBackup,
    importBackup,
    resetAll
  };

  // Inicializa os dados assim que o arquivo é carregado.
  load();
})();

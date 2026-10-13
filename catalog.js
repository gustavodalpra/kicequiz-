"use strict";

/* ==========================================
   BAÚ DO CAPITÃO
   catalog.js — conquistas e itens da loja
   ========================================== */

(() => {
  const RARITIES = {
    common: { label: "Comum", reward: 10 },
    rare: { label: "Rara", reward: 25 },
    epic: { label: "Épica", reward: 50 },
    legendary: { label: "Lendária", reward: 100 }
  };

  // Conquistas por contador usam { stat, target }.
  // As ligadas a um quiz específico usam check(ctx) e só valem logo após um quiz.
  const ACHIEVEMENTS = {
    // --- Quizzes ---
    first_quiz: { name: "Primeira travessia", description: "Conclua seu primeiro quiz.", icon: "🧭", rarity: "common", stat: "quizzes", target: 1 },
    five_quizzes: { name: "Marujo experiente", description: "Conclua 5 quizzes.", icon: "⚓", rarity: "common", stat: "quizzes", target: 5 },
    ten_quizzes: { name: "Lobo do mar", description: "Conclua 10 quizzes.", icon: "🚢", rarity: "rare", stat: "quizzes", target: 10 },
    twentyfive_quizzes: { name: "Capitão lendário", description: "Conclua 25 quizzes.", icon: "🏴‍☠️", rarity: "epic", stat: "quizzes", target: 25 },
    fifty_quizzes: { name: "Almirante dos mares", description: "Conclua 50 quizzes.", icon: "👑", rarity: "legendary", stat: "quizzes", target: 50 },

    // --- Acertos ---
    correct_50: { name: "Vigia atento", description: "Acumule 50 respostas certas.", icon: "🔭", rarity: "common", stat: "correct", target: 50 },
    correct_200: { name: "Olho de águia", description: "Acumule 200 respostas certas.", icon: "🦅", rarity: "rare", stat: "correct", target: 200 },
    correct_500: { name: "Mente de ouro", description: "Acumule 500 respostas certas.", icon: "🧠", rarity: "epic", stat: "correct", target: 500 },
    correct_1000: { name: "Biblioteca viva", description: "Acumule 1000 respostas certas.", icon: "📚", rarity: "legendary", stat: "correct", target: 1000 },

    // --- Desempenho em um quiz ---
    perfect_score: {
      name: "Mira de ouro", description: "Acerte todas as perguntas de um quiz (mínimo de 3).", icon: "🎯", rarity: "rare",
      check: ctx => ctx.result && ctx.result.totalQuestions >= 3 && ctx.result.percentage === 100 && ctx.result.open === 0
    },
    perfect_3: { name: "Trio de diamantes", description: "Faça 3 quizzes perfeitos.", icon: "💎", rarity: "epic", stat: "perfectQuizzes", target: 3 },
    hard_master: {
      name: "Mar bravio", description: "Acerte 5 perguntas difíceis no mesmo quiz.", icon: "🌋", rarity: "epic",
      check: ctx => ctx.result && ctx.result.answers.filter(a => a && a.difficulty === "hard" && a.correct === true).length >= 5
    },
    big_quiz: {
      name: "Maratona de estudos", description: "Conclua um quiz com 15 perguntas ou mais.", icon: "📜", rarity: "rare",
      check: ctx => ctx.result && ctx.result.totalQuestions >= 15 && ctx.result.answered >= 15
    },
    speedster: {
      name: "Vento em popa", description: "Faça 80% ou mais em um quiz de 5+ perguntas em até 2 minutos.", icon: "⚡", rarity: "rare",
      check: ctx => ctx.result && ctx.result.totalQuestions >= 5 && ctx.result.percentage >= 80 && ctx.result.durationSeconds <= 120
    },
    comeback: {
      name: "Virada de maré", description: "Tire 80% ou mais logo depois de um quiz abaixo de 50%.", icon: "🌊", rarity: "rare",
      check: ctx => ctx.result && ctx.previous && ctx.previous.percentage < 50 && ctx.result.percentage >= 80
    },

    // --- Constância ---
    streak_3: { name: "Chama acesa", description: "Estude 3 dias seguidos.", icon: "🔥", rarity: "common", stat: "streak", target: 3 },
    streak_7: { name: "Semana de ouro", description: "Estude 7 dias seguidos.", icon: "🌟", rarity: "rare", stat: "streak", target: 7 },
    streak_30: { name: "Farol inabalável", description: "Estude 30 dias seguidos.", icon: "🗼", rarity: "legendary", stat: "streak", target: 30 },
    early_bird: {
      name: "Madrugador", description: "Conclua um quiz entre 5h e 8h da manhã.", icon: "🐦", rarity: "common", secret: true,
      check: ctx => ctx.result && ctx.hour >= 5 && ctx.hour < 8
    },
    night_owl: {
      name: "Coruja da madrugada", description: "Conclua um quiz entre meia-noite e 5h.", icon: "🦉", rarity: "common", secret: true,
      check: ctx => ctx.result && ctx.hour >= 0 && ctx.hour < 5
    },

    // --- Tesouro ---
    treasure_100: { name: "Tesouro crescente", description: "Junte 100 moedas no total.", icon: "🪙", rarity: "common", stat: "earned", target: 100 },
    treasure_500: { name: "Cofre cheio", description: "Junte 500 moedas no total.", icon: "💰", rarity: "rare", stat: "earned", target: 500 },
    treasure_2000: { name: "Tesouro de dragão", description: "Junte 2000 moedas no total.", icon: "🐉", rarity: "epic", stat: "earned", target: 2000 },

    // --- Mercado ---
    first_purchase: { name: "Primeira compra", description: "Compre qualquer item no mercado.", icon: "🛍️", rarity: "common", stat: "purchases", target: 1 },
    collector_5: { name: "Colecionador", description: "Tenha 5 itens de personalização.", icon: "🎒", rarity: "rare", stat: "items", target: 5 },
    collector_all: { name: "Dono do mercado", description: "Tenha todos os itens de personalização.", icon: "🏛️", rarity: "legendary", stat: "itemsAll", target: 1 },

    // --- Documentos e matérias ---
    first_doc: { name: "Primeiro mapa", description: "Adicione seu primeiro documento ao baú.", icon: "🗺️", rarity: "common", stat: "docs", target: 1 },
    docs_10: { name: "Cartógrafo", description: "Tenha 10 documentos no baú.", icon: "📖", rarity: "rare", stat: "docs", target: 10 },
    subjects_3: { name: "Explorador de matérias", description: "Tenha documentos em 3 matérias diferentes.", icon: "🧩", rarity: "rare", stat: "subjects", target: 3 },

    // --- Aprender com os erros ---
    tutor_5: { name: "Aluno curioso", description: "Peça 5 explicações extras ao tutor de IA.", icon: "🎓", rarity: "rare", stat: "aiHelps", target: 5 },
    learn_20: { name: "Errar é aprender", description: "Peça 20 explicações extras ao tutor de IA.", icon: "🛠️", rarity: "epic", stat: "aiHelps", target: 20 }
  };

  // Itens da loja.
  // kind: consumable (acumula), emblem / theme / title (permanentes e equipáveis).
  const SHOP_ITEMS = [
    // Úteis para estudar
    { id: "lupa", kind: "consumable", name: "Lupa do sábio", description: "Elimina 2 alternativas erradas em uma pergunta de múltipla escolha.", icon: "🔍", price: 30, grant: { lupa: 1 } },
    { id: "lupa_pack", kind: "consumable", name: "Kit com 5 lupas", description: "Cinco lupas do sábio com desconto.", icon: "🧰", price: 120, grant: { lupa: 5 } },
    { id: "potion", kind: "consumable", name: "Poção em dobro", description: "O próximo quiz que você concluir rende o dobro de moedas e XP.", icon: "🧪", price: 80, grant: { potion: 1 } },

    // Emblemas (ícone do capitão no topo)
    { id: "compass", kind: "emblem", name: "Bússola do explorador", description: "Use a bússola como seu emblema.", icon: "🧭", price: 50 },
    { id: "ship", kind: "emblem", name: "Veleiro veloz", description: "Um veleiro para cortar as ondas.", icon: "⛵", price: 90 },
    { id: "chest", kind: "emblem", name: "Baú dourado", description: "Um símbolo especial para sua coleção.", icon: "🧰", price: 100 },
    { id: "parrot", kind: "emblem", name: "Papagaio falante", description: "Companheiro fiel de todo capitão.", icon: "🦜", price: 120 },
    { id: "flag", kind: "emblem", name: "Bandeira do capitão", description: "Mostre que você está pronto para novas aventuras.", icon: "🏴‍☠️", price: 150 },
    { id: "octopus", kind: "emblem", name: "Polvo sábio", description: "Oito braços, oito matérias.", icon: "🐙", price: 180 },
    { id: "dragon", kind: "emblem", name: "Dragão do mar", description: "Para quem enfrenta os maiores desafios.", icon: "🐉", price: 300 },
    { id: "crown", kind: "emblem", name: "Coroa do almirante", description: "Reservada aos grandes mestres.", icon: "👑", price: 500 },

    // Temas de cores
    { id: "theme_tropical", kind: "theme", name: "Ilha tropical", description: "Verdes frescos de floresta e lagoa.", icon: "🌴", price: 200,
      theme: { "--parchment": "#d9ecd0", "--parchment-light": "#f1fbe9", "--parchment-dark": "#9cc18f", "--wood": "#4f6b3f", "--wood-dark": "#2d4224", "--wood-light": "#7da05f", "--ocean": "#1f8a78", "--ocean-dark": "#145a50", "--ocean-light": "#7fd1c0", "--gold": "#e8c04a", "--themeColor": "#2d4224" } },
    { id: "theme_sunset", kind: "theme", name: "Pôr do sol", description: "Tons quentes de fim de tarde no mar.", icon: "🌅", price: 250,
      theme: { "--parchment": "#f6d9bd", "--parchment-light": "#fff0df", "--parchment-dark": "#d9a67a", "--wood": "#8a4b3a", "--wood-dark": "#552b22", "--wood-light": "#b8745a", "--ocean": "#b4505f", "--ocean-dark": "#7d2f3d", "--ocean-light": "#f0a3a3", "--gold": "#f2b441", "--themeColor": "#552b22" } },
    { id: "theme_stars", kind: "theme", name: "Mar de estrelas", description: "Violeta de céu noturno, sem perder a leitura.", icon: "🌌", price: 250,
      theme: { "--parchment": "#dcd6ef", "--parchment-light": "#f3f0fc", "--parchment-dark": "#a79cd0", "--wood": "#5a4a8c", "--wood-dark": "#35295f", "--wood-light": "#8574bd", "--ocean": "#4b6cc1", "--ocean-dark": "#2f4585", "--ocean-light": "#9db4ee", "--gold": "#f0c14b", "--themeColor": "#35295f" } },
    { id: "theme_coral", kind: "theme", name: "Recife de coral", description: "Rosa coral e azul-turquesa.", icon: "🪸", price: 250,
      theme: { "--parchment": "#f7d6d2", "--parchment-light": "#fff0ee", "--parchment-dark": "#dca09a", "--wood": "#8a4a54", "--wood-dark": "#552b33", "--wood-light": "#b87580", "--ocean": "#2a8c9a", "--ocean-dark": "#175c66", "--ocean-light": "#8fd3da", "--gold": "#efb94a", "--themeColor": "#552b33" } },

    // Títulos
    { id: "title_navigator", kind: "title", name: "Título: Navegador", description: "Aparece na saudação da tela inicial.", icon: "🗺️", price: 80, title: "Navegador" },
    { id: "title_master", kind: "title", name: "Título: Mestre dos Mares", description: "Aparece na saudação da tela inicial.", icon: "🌊", price: 150, title: "Mestre dos Mares" },
    { id: "title_hunter", kind: "title", name: "Título: Caçador de Tesouros", description: "Aparece na saudação da tela inicial.", icon: "💎", price: 220, title: "Caçador de Tesouros" },
    { id: "title_sage", kind: "title", name: "Título: Sábio do Baú", description: "Aparece na saudação da tela inicial.", icon: "📜", price: 300, title: "Sábio do Baú" },
    { id: "title_legend", kind: "title", name: "Título: Lenda dos Sete Mares", description: "Aparece na saudação da tela inicial.", icon: "🌟", price: 600, title: "Lenda dos Sete Mares" }
  ];

  const CATEGORIES = [
    { kind: "consumable", title: "🎒 Para estudar melhor", hint: "Itens de uso que ajudam nos quizzes." },
    { kind: "emblem", title: "🏴‍☠️ Emblemas", hint: "Troque o ícone do capitão no topo." },
    { kind: "theme", title: "🎨 Temas", hint: "Mude as cores de todo o app." },
    { kind: "title", title: "📛 Títulos", hint: "Mude como o app chama você." }
  ];

  function getItem(id) {
    return SHOP_ITEMS.find(item => item.id === id) || null;
  }

  function isCosmetic(item) {
    return item.kind !== "consumable";
  }

  // Dados usados para avaliar as conquistas.
  function buildContext(extra = {}) {
    const storage = window.StorageManager;
    const player = storage ? storage.getPlayer() : {};
    const history = storage ? storage.getHistory() : [];
    const inventory = storage ? storage.getInventory() : [];
    const docs = window.DocumentManager ? window.DocumentManager.getDocuments() : [];
    const cosmetics = SHOP_ITEMS.filter(isCosmetic);

    return {
      quizzes: player.quizzesCompleted || 0,
      correct: player.totalCorrect || 0,
      streak: player.streak || 0,
      earned: player.totalCoinsEarned || 0,
      aiHelps: player.aiExplanations || 0,
      perfectQuizzes: history.filter(h => h.percentage === 100 && h.totalQuestions >= 3).length,
      purchases: storage ? storage.getPurchases().length : 0,
      items: cosmetics.filter(item => inventory.includes(item.id)).length,
      itemsAll: cosmetics.every(item => inventory.includes(item.id)) ? 1 : 0,
      docs: docs.length,
      subjects: new Set(docs.map(doc => doc.subject || "geral")).size,
      hour: new Date().getHours(),
      previous: history[1] || null,
      ...extra
    };
  }

  function isEarned(def, ctx) {
    if (def.check) return Boolean(def.check(ctx));
    return (ctx[def.stat] || 0) >= def.target;
  }

  function getProgress(def, ctx) {
    if (!def.stat) return null;
    return { value: Math.min(ctx[def.stat] || 0, def.target), target: def.target };
  }

  // Desbloqueia o que for merecido e devolve os ids novos.
  function unlockNew(extra = {}) {
    const storage = window.StorageManager;
    if (!storage) return [];

    const ctx = buildContext(extra);
    const unlocked = [];

    for (const [id, def] of Object.entries(ACHIEVEMENTS)) {
      if (storage.hasAchievement(id)) continue;
      if (!isEarned(def, ctx)) continue;

      if (storage.unlockAchievement(id)) {
        unlocked.push(id);
        storage.addCoins(RARITIES[def.rarity].reward);
        const player = storage.getPlayer();
        storage.updatePlayer({
          totalCoinsEarned: (player.totalCoinsEarned || 0) + RARITIES[def.rarity].reward
        });
      }
    }

    return unlocked;
  }

  window.Catalog = {
    RARITIES,
    ACHIEVEMENTS,
    SHOP_ITEMS,
    CATEGORIES,
    getItem,
    isCosmetic,
    buildContext,
    isEarned,
    getProgress,
    unlockNew
  };
})();

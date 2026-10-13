"use strict";

(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) =>
    Array.from(root.querySelectorAll(selector));

  let currentQuiz = null;
  let generating = false;
  let currentPage = "inicio";
  let apiReady = false;
  let currentSourceText = "";
  let achievementFilter = "all";
  const aiCache = new Map();

  const pageIds = [
    "inicio",
    "documentos",
    "configuracoes",
    "aventura",
    "jogo",
    "resultado",
    "revisao",
    "conquistas",
    "loja",
    "historico"
  ];

  function showMessage(text, type = "info") {
    const toast = $("#toast-container");

    if (toast) {
      toast.replaceChildren();

      const item = document.createElement("div");
      item.className = `toast ${type}`;
      item.textContent = text;
      item.setAttribute("role", "status");

      toast.appendChild(item);
      setTimeout(() => item.remove(), 4000);

      if (type === "error") {
        console.error("[Baú do Capitão]", text);
      } else {
        console.log("[Baú do Capitão]", text);
      }

      return;
    }

    console.log("[Baú do Capitão]", text);
  }

  function setStatus(selector, text, type = "") {
    const element = $(selector);
    if (!element) return;

    element.textContent = text;
    element.classList.remove("success", "error", "info");

    if (type) element.classList.add(type);
  }

  function setBusy(button, busy, text = "Preparando...") {
    if (!button) return;

    if (busy) {
      if (!button.dataset.originalText) {
        button.dataset.originalText = button.textContent;
      }

      button.disabled = true;
      button.textContent = text;
      button.setAttribute("aria-busy", "true");
    } else {
      button.disabled = false;

      if (button.dataset.originalText) {
        button.textContent = button.dataset.originalText;
        delete button.dataset.originalText;
      }

      button.removeAttribute("aria-busy");
    }
  }

  function goTo(pageId) {
    const target = document.getElementById(pageId);

    if (!target || !pageIds.includes(pageId)) {
      showMessage("Esta tela não foi encontrada.");
      return;
    }

    currentPage = pageId;

    $$(".page").forEach(page => {
      const active = page.id === pageId;

      page.classList.toggle("active", active);
      page.hidden = !active;
    });

    $$("[data-go]").forEach(button => {
      button.classList.toggle(
        "active",
        button.dataset.go === pageId
      );
    });

    if (pageId === "documentos") {
      refreshDocuments();
    }

    if (pageId === "aventura") {
      refreshDocumentSelect();
    }

    if (pageId === "inicio") {
      refreshDashboard();
    }

    if (pageId === "conquistas") {
      renderAchievements();
    }

    if (pageId === "loja") {
      renderShop();
    }

    if (pageId === "historico") {
      renderHistory();
    }

    if (pageId === "configuracoes") {
      refreshSettingsStatus();
    }

    if (pageId === "resultado") {
      renderResult();
    }

    if (pageId === "revisao") {
      renderReview();
    }

    if (pageId === "jogo") {
      renderCurrentQuestion();
    }

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }

  function bindNavigation() {
    document.addEventListener("click", event => {
      const button = event.target.closest("[data-go]");

      if (!button) return;

      event.preventDefault();
      goTo(button.dataset.go);
    });

    const brand = $(".brand");

    if (brand) {
      brand.addEventListener("click", event => {
        event.preventDefault();
        goTo("inicio");
      });
    }
  }

  // -----------------------------
  // DOCUMENTOS
  // -----------------------------

  function getDocuments() {
    if (!window.DocumentManager) return [];

    try {
      return window.DocumentManager.getDocuments();
    } catch (error) {
      console.error("Erro ao carregar documentos:", error);
      return [];
    }
  }

  function bindDocumentUpload() {
    const input = $("#document-files");

    if (!input || input.dataset.appBound === "true") return;

    input.dataset.appBound = "true";

    input.addEventListener("change", async () => {
      const files = Array.from(input.files || []);

      if (!files.length) return;

      if (!window.DocumentManager) {
        showMessage("O arquivo documents.js não foi carregado.", "error");
        input.value = "";
        return;
      }

      input.disabled = true;

      try {
        await window.DocumentManager.addFiles(files, $("#upload-subject")?.value);
      } catch (error) {
        showMessage(error.message || "Não foi possível ler os documentos.", "error");
      } finally {
        input.disabled = false;
        input.value = "";
        refreshAfterDocumentChange();
      }
    });
  }

  function bindSubjects() {
    const button = $("#add-subject");

    if (!button || button.dataset.appBound === "true") return;

    button.dataset.appBound = "true";

    const create = () => {
      const nameInput = $("#new-subject-name");

      try {
        const subject = window.DocumentManager.addSubject(
          nameInput.value,
          $("#new-subject-icon")?.value
        );

        nameInput.value = "";
        setStatus("#subject-status", `Matéria “${subject.name}” criada!`, "success");
        fillUploadSubject(subject.id);
      } catch (error) {
        setStatus("#subject-status", error.message, "error");
      }
    };

    button.addEventListener("click", create);

    $("#new-subject-name")?.addEventListener("keydown", event => {
      if (event.key === "Enter") create();
    });
  }

  function fillUploadSubject(selected) {
    window.DocumentManager?.fillSubjectSelect($("#upload-subject"), selected);
  }

  function refreshAfterDocumentChange() {
    refreshDocuments();
    refreshDocumentSelect();
    fillUploadSubject();
    refreshDashboard();
    announce(window.Catalog?.unlockNew() || []);
  }

  function refreshDocuments() {
    window.DocumentManager?.renderDocuments();

    const documents = getDocuments();
    const count = $("#document-count");

    if (count) {
      const max = window.DocumentManager?.MAX_DOCUMENTS || 60;
      count.textContent =
        `${documents.length} de ${max} ${documents.length === 1 ? "item" : "itens"}`;
    }
  }

  function refreshDocumentSelect() {
    const select = $("#quiz-document");
    if (!select) return;

    const previousValue = select.value;
    const documents = getDocuments();

    select.replaceChildren();

    if (!documents.length) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "Adicione um documento primeiro";
      select.appendChild(option);
      select.disabled = true;
      return;
    }

    select.disabled = false;

    const subjects = window.DocumentManager.getSubjects()
      .filter(subject => documents.some(item => item.subject === subject.id));

    const wholeSubjects = subjects.filter(
      subject => documents.filter(item => item.subject === subject.id).length > 1
    );

    if (wholeSubjects.length) {
      const group = document.createElement("optgroup");
      group.label = "📚 Matéria inteira";

      wholeSubjects.forEach(subject => {
        const option = document.createElement("option");
        option.value = `subject:${subject.id}`;
        option.textContent = `${subject.icon} ${subject.name} (todos os documentos)`;
        group.appendChild(option);
      });

      select.appendChild(group);
    }

    subjects.forEach(subject => {
      const group = document.createElement("optgroup");
      group.label = `${subject.icon} ${subject.name}`;

      documents
        .filter(item => item.subject === subject.id)
        .forEach(documentData => {
          const option = document.createElement("option");
          option.value = documentData.id;
          option.textContent = documentData.name;
          group.appendChild(option);
        });

      select.appendChild(group);
    });

    if (Array.from(select.options).some(item => item.value === previousValue)) {
      select.value = previousValue;
    }
  }

  function getSelectedSource() {
    const select = $("#quiz-document");

    if (!select || !select.value || !window.DocumentManager) return null;

    if (select.value.startsWith("subject:")) {
      const id = select.value.slice(8);
      const subject = window.DocumentManager.getSubject(id);
      const text = window.DocumentManager.getSubjectText(id);

      return text ? { label: `Matéria: ${subject.name}`, text } : null;
    }

    const documentData = getDocuments().find(item => item.id === select.value);

    return documentData
      ? {
          label: documentData.name,
          text: `DOCUMENTO: ${documentData.name}\n\n${documentData.text}`
        }
      : null;
  }

  // Abre a tela do quiz já com o documento ou a matéria escolhidos.
  function startQuizFor(value) {
    goTo("aventura");

    const select = $("#quiz-document");

    if (select && Array.from(select.options).some(item => item.value === value)) {
      select.value = value;
    }
  }

  // -----------------------------
  // CONFIGURAÇÕES DA IA
  // -----------------------------

  function configureModelOptions() {
    const select = $("#ai-model");
    if (!select) return;

    const previousValue = select.value;

    const models = [
      {
        value: "gemini-3.1-flash-lite",
        label: "Gemini 3.1 Flash-Lite — gratuito (recomendado)"
      },
      {
        value: "gemini-3.6-flash",
        label: "Gemini 3.6 Flash — gratuito"
      },
      {
        value: "gemini-3.5-flash-lite",
        label: "Gemini 3.5 Flash-Lite — gratuito"
      }
    ];

    select.replaceChildren();

    models.forEach(model => {
      const option = document.createElement("option");
      option.value = model.value;
      option.textContent = model.label;
      select.appendChild(option);
    });

    select.value = models.some(model => model.value === previousValue)
      ? previousValue
      : "gemini-3.1-flash-lite";
  }

  function getApiSettings() {
    return {
      apiKey: ($("#api-key")?.value || "").trim(),
      model: $("#ai-model")?.value || "gemini-3.1-flash-lite"
    };
  }

  function bindSettings() {
    configureModelOptions();

    const saveButton = $("#save-ai-settings");
    const clearButton = $("#clear-api-key");
    const keyInput = $("#api-key");

    if (keyInput) {
      keyInput.autocomplete = "off";
      keyInput.spellcheck = false;
    }

    if (saveButton && saveButton.dataset.appBound !== "true") {
      saveButton.dataset.appBound = "true";

      saveButton.addEventListener("click", async () => {
        const settings = getApiSettings();

        if (!settings.apiKey) {
          apiReady = false;

          setStatus(
            "#ai-status",
            "Cole sua chave da API antes de continuar.",
            "error"
          );

          return;
        }

        if (!window.AIManager) {
          setStatus("#ai-status", "O arquivo ai.js não foi carregado.", "error");
          return;
        }

        setBusy(saveButton, true, "Testando...");
        setStatus("#ai-status", "Testando a conexão com a IA...", "info");

        try {
          const test = await window.AIManager.testConnection(settings);

          apiReady = true;

          setStatus(
            "#ai-status",
            `Conexão confirmada com ${test.model}.`,
            "success"
          );

          showMessage("IA configurada para esta sessão.", "success");
        } catch (error) {
          apiReady = false;
          setStatus("#ai-status", error.message || "Falha ao testar a conexão.", "error");
        } finally {
          setBusy(saveButton, false);
        }
      });
    }

    if (clearButton && clearButton.dataset.appBound !== "true") {
      clearButton.dataset.appBound = "true";

      clearButton.addEventListener("click", () => {
        if (keyInput) keyInput.value = "";

        apiReady = false;

        setStatus(
          "#ai-status",
          "Chave removida do campo.",
          "info"
        );
      });
    }
  }

  function refreshSettingsStatus() {
    if (getApiSettings().apiKey) {
      setStatus(
        "#ai-status",
        "Há uma chave neste campo. Clique em “Testar e usar esta configuração”.",
        "info"
      );
    } else {
      setStatus(
        "#ai-status",
        "A IA ainda não foi configurada.",
        ""
      );
    }
  }

  // -----------------------------
  // GERAÇÃO DO QUIZ
  // -----------------------------

  function getQuizOptions() {
    const quantity = Number($("#quiz-quantity")?.value || 10);
    let type = $("#quiz-type")?.value || "mixed";
    let difficulty = $("#quiz-difficulty")?.value || "auto";
    const topic = ($("#quiz-focus")?.value || "").trim();

    if (difficulty === "auto") {
      difficulty = "medium";
    }

    if (type === "choice") {
      type = "multiple_choice";
    }

    if (type === "truefalse") {
      type = "true_false";
    }

    return {
      questionCount: Math.min(20, Math.max(1, quantity)),
      questionType: type,
      difficulty,
      topic
    };
  }

  async function generateQuiz() {
    if (generating) return;

    const button = $("#generate-quiz");
    const settings = getApiSettings();
    const source = getSelectedSource();

    if (!window.AIManager) {
      setStatus("#generation-status", "O arquivo ai.js não foi carregado.", "error");
      return;
    }

    if (!window.QuizManager) {
      setStatus("#generation-status", "O arquivo quiz.js não foi carregado.", "error");
      return;
    }

    if (!settings.apiKey) {
      setStatus(
        "#generation-status",
        "Abra Configurações e adicione sua chave da API Gemini.",
        "error"
      );

      goTo("configuracoes");
      return;
    }

    if (!source) {
      setStatus(
        "#generation-status",
        "Escolha um documento ou uma matéria para criar perguntas.",
        "error"
      );

      goTo("documentos");
      return;
    }

    generating = true;
    setBusy(button, true, "Criando perguntas...");

    setStatus(
      "#generation-status",
      "O mestre dos quizzes está estudando seu documento...",
      "info"
    );

    try {
      const options = getQuizOptions();

      const quiz = await window.AIManager.generateQuiz({
        ...options,
        ...settings,
        documentsText: source.text,
        onStatus(status) {
          setStatus("#generation-status", status, "info");
        }
      });

      if (!quiz?.questions?.length) {
        throw new Error("A IA não retornou perguntas válidas.");
      }

      currentQuiz = quiz;
      currentSourceText = source.text;
      aiCache.clear();

      window.QuizManager.startQuiz(currentQuiz);

      setStatus(
        "#generation-status",
        `Quiz criado com ${quiz.questions.length} perguntas!`,
        "success"
      );

      showMessage("O desafio está pronto, Capitão!", "success");
      goTo("jogo");
    } catch (error) {
      console.error("Erro ao criar quiz:", error);

      setStatus(
        "#generation-status",
        error.message || "Não foi possível criar o quiz.",
        "error"
      );
    } finally {
      generating = false;
      setBusy(button, false);
    }
  }

  function bindGenerateButton() {
    const button = $("#generate-quiz");

    if (!button || button.dataset.appBound === "true") return;

    button.dataset.appBound = "true";
    button.addEventListener("click", generateQuiz);
  }

  // -----------------------------
  // TELA DO JOGO
  // -----------------------------

  function renderCurrentQuestion() {
    const state = window.QuizManager?.getState();

    if (!state?.quiz || !state.currentQuestion) {
      if (currentPage === "jogo") {
        goTo("aventura");
      }
      return;
    }

    const question = state.currentQuestion;
    const index = state.currentQuestionIndex;
    const total = state.totalQuestions;

    const answerArea = $("#answer-area");
    const feedback = $("#answer-feedback");
    const submitButton = $("#submit-answer");
    const nextButton = $("#next-question");
    const hintBox = $("#question-hint");
    const hintButton = $("#show-hint");
    const progress = $("#quiz-progress");

    const labels = { easy: "fácil", medium: "média", hard: "difícil" };

    const questionText = $("#question-text");
    if (questionText) questionText.textContent = question.question;

    const category = $("#question-category");
    if (category) {
      category.textContent =
        `DESAFIO ${index + 1} · ${labels[question.difficulty] || "média"}`.toUpperCase();
    }

    const progressLabel = $("#game-progress-label");
    if (progressLabel) progressLabel.textContent = `Pergunta ${index + 1} de ${total}`;

    if (progress) {
      progress.style.width = `${((index + 1) / total) * 100}%`;
      progress.setAttribute("aria-valuenow", String(Math.round(((index + 1) / total) * 100)));
    }

    if (feedback) {
      feedback.textContent = "";
      feedback.classList.add("hidden");
      feedback.classList.remove("correct", "incorrect", "pending");
    }

    $("#study-slot")?.replaceChildren();

    if (hintBox) hintBox.classList.add("hidden");
    if ($("#hint-text")) $("#hint-text").textContent = "";
    if (hintButton) hintButton.disabled = false;

    if (submitButton) {
      submitButton.classList.remove("hidden");
      submitButton.disabled = false;
    }

    if (nextButton) {
      nextButton.classList.add("hidden");
      nextButton.disabled = false;
      nextButton.textContent =
        index === total - 1 ? "Ver resultado →" : "Próxima pergunta →";
    }

    updateBoosts(question);

    if (!answerArea) return;

    answerArea.replaceChildren();

    if (question.type === "open" || question.type === "fill") {
      const label = document.createElement("label");
      label.htmlFor = "open-answer";
      label.textContent = question.type === "fill"
        ? "Complete a lacuna:"
        : "Escreva sua resposta:";

      const field = question.type === "fill"
        ? document.createElement("input")
        : document.createElement("textarea");

      field.id = "open-answer";
      field.name = "answer";
      field.className = "text-input";
      field.maxLength = 3000;
      field.placeholder = "Sua resposta, Capitão...";
      field.autocomplete = "off";

      if (question.type === "fill") {
        field.type = "text";
        field.addEventListener("keydown", event => {
          if (event.key === "Enter") $("#submit-answer")?.click();
        });
      } else {
        field.rows = 4;
      }

      answerArea.append(label, field);
      return;
    }

    (question.options || []).forEach((option, optionIndex) => {
      const label = document.createElement("label");
      label.className = "answer-option";

      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = "quiz-answer";
      radio.value = option;
      radio.id = `quiz-answer-${index}-${optionIndex}`;

      const text = document.createElement("span");
      text.textContent = option;

      label.htmlFor = radio.id;
      label.append(radio, text);

      radio.addEventListener("change", () => {
        $$(".answer-option", answerArea).forEach(item => {
          item.classList.remove("selected");
        });

        label.classList.add("selected");
      });

      answerArea.appendChild(label);
    });
  }

  // Atualiza o botão da lupa e o aviso da poção.
  function updateBoosts(question) {
    const boosts = window.QuizManager?.getBoosts() || { lupa: 0, potion: 0 };
    const lupa = $("#use-lupa");
    const count = $("#lupa-count");

    if (count) count.textContent = String(boosts.lupa);

    if (lupa) {
      const usable = question?.type === "multiple_choice" &&
        (question.options || []).length > 2;

      lupa.classList.toggle("hidden", !usable && boosts.lupa === 0);
      lupa.disabled = !usable || boosts.lupa === 0;
    }

    $("#boost-note")?.classList.toggle("hidden", boosts.potion === 0);
  }

  function useLupa() {
    const state = window.QuizManager?.getState();
    const question = state?.currentQuestion;

    if (!question || question.type !== "multiple_choice") return;
    if (state.answers[state.currentQuestionIndex]) return;

    const labels = $$("#answer-area .answer-option").filter(
      item => !item.classList.contains("eliminated")
    );

    const wrong = labels.filter(
      item => item.querySelector("input").value !== question.answer
    );

    if (wrong.length < 2) {
      showMessage("Não há alternativas suficientes para eliminar.");
      return;
    }

    if (!window.QuizManager.spendConsumable("lupa")) {
      showMessage("Você não tem lupas. Compre mais no mercado!");
      return;
    }

    wrong
      .sort(() => Math.random() - 0.5)
      .slice(0, 2)
      .forEach(item => {
        item.classList.add("eliminated");
        item.classList.remove("selected");
        const radio = item.querySelector("input");
        radio.checked = false;
        radio.disabled = true;
      });

    updateWallet();
    updateBoosts(question);
    showMessage("A lupa eliminou 2 alternativas erradas. 🔍");
  }

  function bindGameButtons() {
    const submitButton = $("#submit-answer");
    const nextButton = $("#next-question");
    const quitButton = $("#quit-quiz");
    const hintButton = $("#show-hint");
    const lupaButton = $("#use-lupa");

    if (submitButton && submitButton.dataset.appBound !== "true") {
      submitButton.dataset.appBound = "true";

      submitButton.addEventListener("click", () => {
        const state = window.QuizManager?.getState();

        if (!state?.currentQuestion) return;

        const question = state.currentQuestion;
        const written = $("#open-answer");
        const selected = $('input[name="quiz-answer"]:checked');

        const answer = (question.type === "open" || question.type === "fill")
          ? (written?.value || "").trim()
          : (selected?.value || "");

        if (!answer) {
          showMessage("Escolha ou escreva uma resposta antes de continuar.");
          return;
        }

        try {
          const result = window.QuizManager.submitAnswer(answer);
          if (result) showAnswerFeedback(result);
        } catch (error) {
          showMessage(error.message || "Não foi possível registrar a resposta.", "error");
        }
      });
    }

    if (nextButton && nextButton.dataset.appBound !== "true") {
      nextButton.dataset.appBound = "true";

      nextButton.addEventListener("click", () => {
        try {
          window.QuizManager?.nextQuestion();
        } catch (error) {
          showMessage(error.message || "Não foi possível avançar.", "error");
          return;
        }

        const state = window.QuizManager?.getState();

        if (state?.finished) {
          announceNewResultAchievements();
          goTo("resultado");
        } else {
          renderCurrentQuestion();
        }
      });
    }

    if (quitButton && quitButton.dataset.appBound !== "true") {
      quitButton.dataset.appBound = "true";

      quitButton.addEventListener("click", () => {
        if (window.confirm("Sair deste quiz? Seu desafio não será concluído.")) {
          window.QuizManager?.resetQuiz();
          currentQuiz = null;
          goTo("aventura");
        }
      });
    }

    if (hintButton && hintButton.dataset.appBound !== "true") {
      hintButton.dataset.appBound = "true";

      hintButton.addEventListener("click", () => {
        const state = window.QuizManager?.getState();
        const question = state?.currentQuestion;

        if (!question || state.answers[state.currentQuestionIndex]) return;

        const hintBox = $("#question-hint");
        const hintText = $("#hint-text");

        if (hintBox && hintText) {
          window.QuizManager.useHint();

          hintText.textContent = "Dica: " + (
            question.hint ||
            "releia a pergunta com atenção e tente lembrar o trecho do material sobre este assunto."
          );

          hintBox.classList.remove("hidden");
          hintButton.disabled = true;
        }
      });
    }

    if (lupaButton && lupaButton.dataset.appBound !== "true") {
      lupaButton.dataset.appBound = "true";
      lupaButton.addEventListener("click", useLupa);
    }
  }

  function showAnswerFeedback(result) {
    const feedback = $("#answer-feedback");
    const submitButton = $("#submit-answer");
    const nextButton = $("#next-question");

    if (!feedback || !result) return;

    feedback.classList.remove("hidden", "correct", "incorrect", "pending");

    if (result.correct === true) {
      feedback.textContent = `Acertou, Capitão! +${result.points || 0} pontos.`;
      feedback.classList.add("correct");
    } else if (result.correct === false) {
      feedback.textContent =
        "Não foi dessa vez! Veja abaixo a explicação e onde estudar esse assunto.";
      feedback.classList.add("incorrect");
    } else {
      feedback.textContent =
        "Resposta registrada. Compare com a resposta-modelo abaixo.";
      feedback.classList.add("pending");
    }

    // Mostra qual opção era a certa e qual foi marcada.
    $$("#answer-area .answer-option").forEach(label => {
      const value = label.querySelector("input")?.value;

      if (value === result.correctAnswer) label.classList.add("correct");

      if (result.correct === false && value === result.selectedAnswer) {
        label.classList.add("incorrect");
      }
    });

    $$("#answer-area input, #answer-area textarea").forEach(input => {
      input.disabled = true;
    });

    $("#show-hint")?.setAttribute("disabled", "disabled");
    if ($("#use-lupa")) $("#use-lupa").disabled = true;

    const slot = $("#study-slot");

    if (slot) {
      slot.replaceChildren(buildStudyPanel(result, { showAnswer: true }));
    }

    if (submitButton) submitButton.classList.add("hidden");

    if (nextButton) {
      nextButton.classList.remove("hidden");

      const state = window.QuizManager?.getState();

      nextButton.textContent =
        state && state.currentQuestionIndex === state.totalQuestions - 1
          ? "Ver resultado →"
          : "Próxima pergunta →";
    }
  }

  // ---------- Estudo: explicação, trecho do material e links ----------

  function studyLinks(topic) {
    const query = encodeURIComponent(topic);

    return [
      { label: "Google", url: `https://www.google.com/search?q=${query}` },
      { label: "YouTube", url: `https://www.youtube.com/results?search_query=${query}` },
      { label: "Wikipédia", url: `https://pt.wikipedia.org/w/index.php?search=${query}` },
      { label: "Khan Academy", url: `https://pt.khanacademy.org/search?page_search_query=${query}` }
    ];
  }

  function buildLinks(topic) {
    const box = document.createElement("div");
    box.className = "study-links";
    box.appendChild(createTextElement("small", `🔎 Estudar mais sobre “${topic}”:`));

    const row = document.createElement("div");
    row.className = "chip-row";

    studyLinks(topic).forEach(link => {
      const anchor = document.createElement("a");
      anchor.className = "chip";
      anchor.href = link.url;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      anchor.textContent = `${link.label} ↗`;
      row.appendChild(anchor);
    });

    box.appendChild(row);
    return box;
  }

  function buildStudyPanel(answer, options = {}) {
    const panel = document.createElement("div");
    panel.className = "study-panel";

    if (options.showAnswer && answer.correct !== true) {
      panel.appendChild(
        createTextElement("p", `✅ Resposta correta: ${answer.correctAnswer}`)
      ).className = "study-answer";
    }

    if (answer.explanation) {
      const explanation = createTextElement("p", `💡 ${answer.explanation}`);
      explanation.className = "study-explanation";
      panel.appendChild(explanation);
    }

    if (answer.sourceExcerpt) {
      const quote = document.createElement("blockquote");
      quote.className = "study-excerpt";
      quote.appendChild(createTextElement("small", "📖 No seu material:"));
      quote.appendChild(createTextElement("p", answer.sourceExcerpt));
      panel.appendChild(quote);
    }

    if (answer.correct !== true) {
      const topic = answer.studyTopic ||
        String(answer.question || "").slice(0, 70);

      panel.appendChild(buildLinks(topic));

      const target = document.createElement("div");
      target.className = "tutor-slot";

      const button = document.createElement("button");
      button.type = "button";
      button.className = "button secondary";
      button.textContent = "🧑‍🏫 Explicar melhor com a IA";
      button.addEventListener("click", () => askTutor(answer, button, target));

      panel.append(button, target);

      if (aiCache.has(answer.questionId)) {
        renderTutor(target, aiCache.get(answer.questionId));
        button.classList.add("hidden");
      }
    }

    return panel;
  }

  function renderTutor(target, data) {
    target.replaceChildren();

    const card = document.createElement("div");
    card.className = "tutor-card";

    card.appendChild(createTextElement("strong", "🧑‍🏫 Tutor de IA"));
    if (data.explanation) card.appendChild(createTextElement("p", data.explanation));

    if (data.fromMaterial) {
      card.appendChild(createTextElement("p", `📖 No seu material: ${data.fromMaterial}`));
    }

    if (data.extraContext) {
      card.appendChild(
        createTextElement("p", `🌐 Além do material (confira em fontes confiáveis): ${data.extraContext}`)
      );
    }

    if (data.memoryTip) card.appendChild(createTextElement("p", `🧠 Macete: ${data.memoryTip}`));

    (data.studyTopics || []).slice(0, 2).forEach(topic => {
      card.appendChild(buildLinks(topic));
    });

    target.appendChild(card);
  }

  async function askTutor(answer, button, target) {
    const settings = getApiSettings();

    if (!settings.apiKey) {
      showMessage("Coloque sua chave da API em Configurações para usar o tutor.", "error");
      return;
    }

    if (!window.AIManager?.explainMistake) {
      showMessage("O arquivo ai.js não foi carregado.", "error");
      return;
    }

    setBusy(button, true, "O tutor está pensando...");

    try {
      const data = await window.AIManager.explainMistake({
        ...settings,
        question: {
          question: answer.question,
          answer: answer.correctAnswer,
          explanation: answer.explanation,
          studyTopic: answer.studyTopic
        },
        userAnswer: answer.selectedAnswer,
        sourceText: currentSourceText
      });

      aiCache.set(answer.questionId, data);

      const player = window.StorageManager.getPlayer();
      window.StorageManager.updatePlayer({
        aiExplanations: (Number(player.aiExplanations) || 0) + 1
      });

      renderTutor(target, data);
      button.classList.add("hidden");
      announce(window.Catalog?.unlockNew() || []);
    } catch (error) {
      showMessage(error.message || "O tutor não conseguiu responder agora.", "error");
    } finally {
      setBusy(button, false);
    }
  }

  // ---------- Avisos de conquistas ----------

  function announce(ids) {
    if (!ids || !ids.length) return;

    ids.forEach((id, position) => {
      const info = window.Catalog?.ACHIEVEMENTS[id];
      if (!info) return;

      const reward = window.Catalog.RARITIES[info.rarity].reward;

      setTimeout(() => {
        showMessage(`${info.icon} Conquista: ${info.name} (+${reward} 🪙)`, "success");
        updateWallet();
      }, position * 2200);
    });
  }

  function announceNewResultAchievements() {
    updateWallet();
  }

  // -----------------------------
  // RESULTADO E REVISÃO
  // -----------------------------

  function getResult() {
    return window.QuizManager?.getResult() || null;
  }

  function renderResult() {
    const result = getResult();

    if (!result) return;

    const title = $("#result-title");
    const messageText = $("#result-message");
    const percentage = $("#result-percentage");
    const correct = $("#result-correct");
    const coins = $("#result-coins");
    const xp = $("#result-xp");

    if (title) title.textContent = result.title || "Aventura concluída!";

    if (messageText) {
      messageText.textContent =
        result.percentage >= 80
          ? "Excelente navegação, Capitão! Você dominou o desafio."
          : result.percentage >= 50
            ? "Boa jornada! Revise os pontos difíceis e continue explorando."
            : "Toda aventura ensina algo. Revise as respostas e tente novamente!";

      if (result.multiplier > 1) {
        messageText.textContent += " 🧪 A poção em dobro foi usada!";
      }
    }

    if (percentage) percentage.textContent = `${result.percentage || 0}%`;

    if (correct) {
      correct.textContent =
        `${result.correct || 0} acertos de ${result.totalQuestions || 0} perguntas`;
    }

    const earned = result.coinsEarned ?? result.points ?? 0;

    if (coins) coins.textContent = `+${earned}`;
    if (xp) xp.textContent = `+${earned}`;

    const unlocked = $("#result-achievements");

    if (unlocked) {
      unlocked.replaceChildren();

      (result.newAchievements || []).forEach(id => {
        const info = window.Catalog?.ACHIEVEMENTS[id];
        if (!info) return;

        const reward = window.Catalog.RARITIES[info.rarity].reward;
        unlocked.appendChild(
          createTextElement("p", `${info.icon} Nova conquista: ${info.name} (+${reward} 🪙)`)
        );
      });
    }

    updateWallet();
    refreshDashboard();
  }

  function renderReview() {
    const container = $("#review-list");
    const result = getResult();

    if (!container) return;

    container.replaceChildren();

    if (!result?.answers?.length) {
      container.appendChild(
        createTextElement("p", "Nenhuma resposta para revisar ainda.")
      );
      return;
    }

    result.answers.forEach((answer, index) => {
      if (!answer) return;

      const card = document.createElement("article");
      card.className = "review-card";

      card.classList.add(
        answer.correct === true
          ? "correct"
          : answer.correct === false
            ? "incorrect"
            : "pending"
      );

      card.append(
        createTextElement("h3", `${index + 1}. ${answer.question}`),
        createTextElement("p", `Sua resposta: ${answer.selectedAnswer}`),
        createTextElement("p", `Resposta esperada: ${answer.correctAnswer}`),
        buildStudyPanel(answer)
      );

      container.appendChild(card);
    });
  }

  function createTextElement(tag, text) {
    const element = document.createElement(tag);
    element.textContent = text;
    return element;
  }

  // -----------------------------
  // PROGRESSO E ESTATÍSTICAS
  // -----------------------------

  function safeStorage(method, fallback) {
    try {
      if (!window.StorageManager || typeof window.StorageManager[method] !== "function") {
        return fallback;
      }

      const value = window.StorageManager[method]();
      return value ?? fallback;
    } catch (error) {
      console.warn(`Erro ao consultar ${method}:`, error);
      return fallback;
    }
  }

  function updateWallet() {
    const coins = safeStorage("getCoins", 0);
    const player = safeStorage("getPlayer", {});
    const coinBalance = $("#coin-balance");
    const shopCoins = $("#shop-coins");
    const xp = $("#player-xp");

    if (coinBalance) coinBalance.textContent = String(coins);
    if (shopCoins) shopCoins.textContent = String(coins);

    if (xp) {
      xp.textContent = String(player.xp ?? player.experience ?? 0);
    }
  }

  function refreshDashboard() {
    updateWallet();

    const history = safeStorage("getHistory", []);
    const achievements = safeStorage("getAchievements", []);
    const documents = getDocuments();

    const quizzes = $("#stat-quizzes");
    const correct = $("#stat-correct");
    const achievementCount = $("#stat-achievements");
    const documentCount = $("#stat-documents");

    if (quizzes) quizzes.textContent = String(history.length);

    if (correct) {
      const totalCorrect = history.reduce(
        (sum, item) => sum + Number(item.correct || 0),
        0
      );

      correct.textContent = String(totalCorrect);
    }

    if (achievementCount) {
      achievementCount.textContent = String(achievements.length);
    }

    if (documentCount) {
      documentCount.textContent = String(documents.length);
    }
  }

  function renderHistory() {
    const container = $("#history-list");
    if (!container) return;

    const history = safeStorage("getHistory", []);
    container.replaceChildren();

    if (!history.length) {
      container.appendChild(
        createTextElement("p", "Ainda não há aventuras concluídas.")
      );
      return;
    }

    history.forEach(item => {
      const card = document.createElement("article");
      card.className = "history-card";

      const title = createTextElement("h3", item.title || "Quiz concluído");

      const score = createTextElement(
        "p",
        `Acertos: ${item.correct ?? 0} · Pontos: ${item.points ?? 0}`
      );

      const date = createTextElement(
        "small",
        formatDate(item.completedAt || item.date)
      );

      card.append(title, score, date);
      container.appendChild(card);
    });
  }

  function renderAchievements() {
    const container = $("#achievement-grid");
    if (!container || !window.Catalog) return;

    const catalog = window.Catalog;
    const unlockedIds = safeStorage("getAchievements", []);
    const ctx = catalog.buildContext();
    const entries = Object.entries(catalog.ACHIEVEMENTS);

    const count = $("#achievement-count");

    if (count) {
      count.textContent =
        `${unlockedIds.length} de ${entries.length} conquistas desbloqueadas`;
    }

    container.replaceChildren();

    const visible = entries.filter(([id]) => {
      const done = unlockedIds.includes(id);
      if (achievementFilter === "unlocked") return done;
      if (achievementFilter === "locked") return !done;
      return true;
    });

    if (!visible.length) {
      container.appendChild(
        createTextElement("p", "Nada por aqui ainda. Continue estudando, Capitão!")
      );
      return;
    }

    // Desbloqueadas primeiro, depois as mais próximas de serem conquistadas.
    visible.sort(([idA, a], [idB, b]) => {
      const doneA = unlockedIds.includes(idA);
      const doneB = unlockedIds.includes(idB);

      if (doneA !== doneB) return doneA ? -1 : 1;

      const ratio = def => {
        const progress = catalog.getProgress(def, ctx);
        return progress ? progress.value / progress.target : 0;
      };

      return doneA ? 0 : ratio(b) - ratio(a);
    });

    visible.forEach(([id, def]) => {
      const done = unlockedIds.includes(id);
      const hidden = def.secret && !done;
      const rarity = catalog.RARITIES[def.rarity];

      const card = document.createElement("article");
      card.className = `achievement-card rarity-${def.rarity} ${done ? "unlocked" : "locked"}`;

      const icon = createTextElement("div", hidden ? "❓" : def.icon);
      icon.className = "achievement-icon big";

      const pill = createTextElement("span", rarity.label);
      pill.className = "rarity-pill";

      card.append(
        icon,
        createTextElement("h3", hidden ? "Conquista secreta" : def.name),
        pill,
        createTextElement(
          "p",
          hidden ? "Continue explorando para descobrir como desbloquear." : def.description
        )
      );

      const progress = !done && !hidden ? catalog.getProgress(def, ctx) : null;

      if (progress && progress.target > 1) {
        const bar = document.createElement("div");
        bar.className = "mini-progress";
        const fill = document.createElement("div");
        fill.style.width = `${(progress.value / progress.target) * 100}%`;
        bar.appendChild(fill);

        card.append(
          bar,
          createTextElement("small", `${progress.value} / ${progress.target}`)
        );
      }

      card.appendChild(
        createTextElement("small", done ? "✔ Desbloqueada" : `Recompensa: +${rarity.reward} 🪙`)
      );

      container.appendChild(card);
    });
  }

  function bindAchievementFilters() {
    const box = $("#achievement-filters");

    if (!box || box.dataset.appBound === "true") return;

    box.dataset.appBound = "true";

    box.addEventListener("click", event => {
      const chip = event.target.closest("[data-filter]");
      if (!chip) return;

      achievementFilter = chip.dataset.filter;

      $$("[data-filter]", box).forEach(item => {
        item.classList.toggle("active", item === chip);
      });

      renderAchievements();
    });
  }

  function getEquipped() {
    return safeStorage("getPlayer", {}).equipped || {};
  }

  function renderShop() {
    const container = $("#shop-grid");
    if (!container || !window.Catalog) return;

    updateWallet();
    container.replaceChildren();

    const catalog = window.Catalog;
    const purchases = safeStorage("getPurchases", []);
    const inventory = safeStorage("getInventory", []);
    const coins = safeStorage("getCoins", 0);
    const equipped = getEquipped();
    const boosts = window.QuizManager?.getBoosts() || { lupa: 0, potion: 0 };

    // Itens comprados na versão antiga continuam valendo.
    const owns = id =>
      inventory.includes(id) ||
      purchases.some(purchase => purchaseId(purchase) === id);

    catalog.CATEGORIES.forEach(category => {
      const items = catalog.SHOP_ITEMS.filter(item => item.kind === category.kind);
      if (!items.length) return;

      const section = document.createElement("section");
      section.className = "shop-section";
      section.append(
        createTextElement("h2", category.title),
        createTextElement("p", category.hint)
      );

      const grid = document.createElement("div");
      grid.className = "shop-grid";

      items.forEach(item => {
        const owned = item.kind !== "consumable" && owns(item.id);
        const isEquipped = equipped[item.kind] === item.id;

        const card = document.createElement("article");
        card.className = "shop-card" + (isEquipped ? " equipped" : "");

        card.append(
          createTextElement("div", item.icon),
          createTextElement("h3", item.name),
          createTextElement("p", item.description)
        );

        if (item.kind === "consumable") {
          const have = boosts[Object.keys(item.grant)[0]] || 0;
          card.appendChild(createTextElement("small", `Você tem: ${have}`));
        }

        card.appendChild(createTextElement("strong", `🪙 ${item.price}`));

        const button = document.createElement("button");
        button.type = "button";
        button.className = "button primary";

        if (owned) {
          button.textContent = isEquipped ? "✔ Em uso (tirar)" : "Usar";
          button.addEventListener("click", () => equipItem(item, !isEquipped));
        } else {
          button.textContent = "Comprar";
          button.disabled = coins < item.price;
          button.addEventListener("click", () => buyItem(item));
        }

        card.appendChild(button);
        grid.appendChild(card);
      });

      section.appendChild(grid);
      container.appendChild(section);
    });
  }

  function purchaseId(purchase) {
    return typeof purchase === "string"
      ? purchase
      : purchase?.itemId ?? purchase?.id;
  }

  function equipItem(item, on) {
    const storage = window.StorageManager;
    if (!storage) return;

    const equipped = { ...getEquipped() };

    if (on) {
      equipped[item.kind] = item.id;
    } else {
      delete equipped[item.kind];
    }

    storage.updatePlayer({ equipped });
    applyAppearance();
    renderShop();
    refreshDashboard();
  }

  function buyItem(item) {
    const storage = window.StorageManager;

    if (!storage) {
      showMessage("O sistema de salvamento não está disponível.", "error");
      return;
    }

    try {
      const isConsumable = item.kind === "consumable";

      if (!isConsumable && storage.hasItem(item.id)) {
        showMessage("Você já possui esse item.");
        return;
      }

      if (!storage.spendCoins(item.price)) {
        showMessage("Você ainda não tem moedas suficientes.");
        return;
      }

      storage.recordPurchase(item.id, item.price);

      if (isConsumable) {
        const player = storage.getPlayer();
        const consumables = { ...(player.consumables || {}) };

        Object.entries(item.grant).forEach(([key, amount]) => {
          consumables[key] = (Number(consumables[key]) || 0) + amount;
        });

        storage.updatePlayer({ consumables });
      } else {
        storage.addItem(item.id);

        // Já deixa o item novo em uso.
        const equipped = { ...getEquipped(), [item.kind]: item.id };
        storage.updatePlayer({ equipped });
        applyAppearance();
      }

      updateWallet();
      renderShop();
      refreshDashboard();

      setStatus("#shop-status", `${item.name} comprado!`, "success");
      announce(window.Catalog.unlockNew());
    } catch (error) {
      console.error("Erro na compra:", error);
      showMessage("Não foi possível concluir a compra.", "error");
    }
  }

  // Aplica tema, emblema e título escolhidos na loja.
  function applyAppearance() {
    const catalog = window.Catalog;
    if (!catalog) return;

    const equipped = getEquipped();
    const root = document.documentElement;

    const themeVars = new Set();
    catalog.SHOP_ITEMS
      .filter(item => item.kind === "theme")
      .forEach(item => Object.keys(item.theme).forEach(key => themeVars.add(key)));

    themeVars.forEach(key => {
      if (key !== "--themeColor") root.style.removeProperty(key);
    });

    const theme = catalog.getItem(equipped.theme);
    let themeColor = "#49352d";

    if (theme?.theme) {
      Object.entries(theme.theme).forEach(([key, value]) => {
        if (key === "--themeColor") {
          themeColor = value;
        } else {
          root.style.setProperty(key, value);
        }
      });
    }

    document.querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", themeColor);

    const emblem = catalog.getItem(equipped.emblem);
    const brandIcon = $(".brand-icon");
    if (brandIcon) brandIcon.textContent = emblem ? emblem.icon : "🏴‍☠️";

    const title = catalog.getItem(equipped.title);
    const titleSlot = $("#player-title");
    if (titleSlot) titleSlot.textContent = title ? title.title : "Capitão";
  }

  function buyItem(item) {
    const storage = window.StorageManager;

    if (!storage) {
      showMessage("O sistema de salvamento não está disponível.", "error");
      return;
    }

    try {
      const purchases = storage.getPurchases();

      const alreadyOwned = Array.isArray(purchases) &&
        purchases.some(purchase => purchaseId(purchase) === item.id);

      if (alreadyOwned) {
        showMessage("Você já possui esse item.");
        return;
      }

      if (!storage.spendCoins(item.price)) {
        showMessage("Você ainda não tem moedas suficientes.");
        return;
      }

      storage.recordPurchase(item.id, item.price);
      storage.addItem(item.id);

      updateWallet();
      renderShop();

      setStatus("#shop-status", `${item.name} comprado!`, "success");
    } catch (error) {
      console.error("Erro na compra:", error);
      showMessage("Não foi possível concluir a compra.", "error");
    }
  }

  function formatDate(value) {
    if (!value) return "Data não registrada";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "Data não registrada";
    }

    return date.toLocaleString("pt-BR");
  }

  // -----------------------------
  // BACKUP
  // -----------------------------

  function bindBackup() {
    const exportButton = $("#export-backup");
    const importInput = $("#import-backup");

    if (exportButton && exportButton.dataset.appBound !== "true") {
      exportButton.dataset.appBound = "true";

      exportButton.addEventListener("click", () => {
        try {
          if (!window.StorageManager?.exportBackup) {
            throw new Error("O sistema de salvamento não está disponível.");
          }

          window.StorageManager.exportBackup();

          setStatus("#backup-status", "Backup exportado!", "success");
        } catch (error) {
          setStatus(
            "#backup-status",
            error.message || "Não foi possível exportar o backup.",
            "error"
          );
        }
      });
    }

    if (importInput && importInput.dataset.appBound !== "true") {
      importInput.dataset.appBound = "true";

      importInput.addEventListener("change", async () => {
        const file = importInput.files?.[0];
        if (!file) return;

        try {
          if (!window.confirm(
            "Importar este backup pode substituir seu progresso atual. Deseja continuar?"
          )) {
            return;
          }

          if (!window.StorageManager?.importBackup) {
            throw new Error("O sistema de salvamento não está disponível.");
          }

          await window.StorageManager.importBackup(file);

          setStatus("#backup-status", "Backup importado!", "success");

          updateWallet();
          refreshDashboard();
          renderHistory();
          renderAchievements();
          renderShop();
          applyAppearance();
        } catch (error) {
          setStatus(
            "#backup-status",
            error.message || "Não foi possível importar esse arquivo.",
            "error"
          );
        } finally {
          importInput.value = "";
        }
      });
    }
  }

  // -----------------------------
  // INICIALIZAÇÃO
  // -----------------------------

  function initialize() {
    bindNavigation();
    bindDocumentUpload();
    bindSettings();
    bindGenerateButton();
    bindGameButtons();
    bindBackup();
    bindSubjects();
    bindAchievementFilters();

    applyAppearance();
    fillUploadSubject();
    refreshDocuments();
    refreshDocumentSelect();
    refreshDashboard();

    // Os documentos carregam em segundo plano (IndexedDB).
    window.DocumentManager?.ready.then(() => {
      refreshAfterDocumentChange();
    });

    window.DocumentManager?.onChange(() => {
      refreshDocuments();
      refreshDocumentSelect();
      fillUploadSubject();
      refreshDashboard();
    });

    // Mantém a tela inicial como ponto de entrada.
    goTo("inicio");

    console.log("Baú do Capitão pronto para zarpar!");
  }

  window.AppManager = {
    goTo,
    generateQuiz,
    refreshDocuments,
    refreshDocumentSelect,
    startQuizFor,
    applyAppearance,
    refreshDashboard,
    renderCurrentQuestion,
    renderResult,
    renderReview,
    renderHistory,
    renderAchievements,
    renderShop,
    getCurrentQuiz: () => currentQuiz
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize);
  } else {
    initialize();
  }
})();

"use strict";

(() => {
  let currentQuiz = null;
  let currentQuestionIndex = 0;
  let answers = [];
  let startedAt = null;
  let finished = false;
  let newAchievements = [];
  let rewardMultiplier = 1;
  let hintsUsed = new Set();
  // As conquistas ficam no catalog.js.
  const ACHIEVEMENTS = window.Catalog ? window.Catalog.ACHIEVEMENTS : {};

  const POINTS = {
    easy: 10,
    medium: 20,
    hard: 30
  };

  function normalizeAnswer(value) {
    return String(value ?? "")
      .trim()
      .toLocaleLowerCase("pt-BR")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ");
  }

  function showMessage(message) {
    const status = document.querySelector("#generation-status");

    if (status) {
      status.textContent = message;
    }

    if (typeof window.showToast === "function") {
      window.showToast(message);
    }
  }

  function getCorrectAnswer(question) {
    return question.correctAnswer ??
      question.answer ??
      question.correct_answer ??
      "";
  }

  function isCorrect(question, selectedAnswer) {
    const type = String(question.type || "").toLowerCase();

    if (
      type === "open" ||
      type === "open_ended" ||
      type === "dissertativa"
    ) {
      return null;
    }

    const given = normalizeAnswer(selectedAnswer);
    const accepted = [
      getCorrectAnswer(question),
      ...(Array.isArray(question.acceptedAnswers) ? question.acceptedAnswers : [])
    ].map(normalizeAnswer);

    return accepted.includes(given);
  }

  function getPoints(question, correct) {
    if (correct !== true) return 0;

    const difficulty = String(
      question.difficulty || "medium"
    ).toLowerCase();

    return POINTS[difficulty] || POINTS.medium;
  }

  function getSelectedAnswer() {
    const checked = document.querySelector(
      '#answer-area input[type="radio"]:checked'
    );

    if (checked) return checked.value;

    const textArea = document.querySelector(
      "#answer-area textarea, #answer-area input[type='text']"
    );

    if (textArea) return textArea.value.trim();

    const selected = document.querySelector(
      "#answer-area .selected"
    );

    if (selected) {
      return selected.dataset.answer ??
        selected.textContent.trim();
    }

    return "";
  }

  function getState() {
    return {
      quiz: currentQuiz,
      currentQuestionIndex,
      totalQuestions: currentQuiz?.questions.length || 0,
      currentQuestion:
        currentQuiz?.questions[currentQuestionIndex] || null,
      answers: answers.map(answer =>
        answer ? { ...answer } : null
      ),
      finished
    };
  }

  function startQuiz(quiz) {
    if (
      !quiz ||
      !Array.isArray(quiz.questions) ||
      quiz.questions.length === 0
    ) {
      throw new Error(
        "Não há perguntas válidas para iniciar o desafio."
      );
    }

    currentQuiz = {
      ...quiz,
      title: quiz.title || "Desafio do Capitão",
      questions: quiz.questions.map(question => ({
        ...question,
        type: question.type || "multiple_choice",
        difficulty: question.difficulty || "medium",
        options: Array.isArray(question.options)
          ? question.options
          : []
      }))
    };

    currentQuestionIndex = 0;
    answers = [];
    startedAt = Date.now();
    finished = false;
    newAchievements = [];
    rewardMultiplier = 1;
    hintsUsed = new Set();

    return getState();
  }

  function useHint() {
    hintsUsed.add(currentQuestionIndex);
  }

  function hasUsedHint(index = currentQuestionIndex) {
    return hintsUsed.has(index);
  }

  function getBoosts() {
    const player = window.StorageManager?.getPlayer() || {};
    const consumables = player.consumables || {};

    return {
      lupa: Number(consumables.lupa) || 0,
      potion: Number(consumables.potion) || 0
    };
  }

  function spendConsumable(id) {
    const storage = window.StorageManager;
    if (!storage) return false;

    const player = storage.getPlayer();
    const consumables = { ...(player.consumables || {}) };

    if ((Number(consumables[id]) || 0) <= 0) return false;

    consumables[id] = Number(consumables[id]) - 1;
    storage.updatePlayer({ consumables });

    return true;
  }

  function submitAnswer(value) {
    if (!currentQuiz || finished) {
      throw new Error("Não existe um desafio em andamento.");
    }

    if (answers[currentQuestionIndex]) {
      showMessage("Você já respondeu esta pergunta, Capitão!");
      return answers[currentQuestionIndex];
    }

    const question = currentQuiz.questions[currentQuestionIndex];

    const selectedAnswer = value !== undefined
      ? String(value).trim()
      : getSelectedAnswer();

    if (!selectedAnswer) {
      showMessage("Escolha ou escreva uma resposta antes de continuar.");
      return null;
    }

    const correct = isCorrect(question, selectedAnswer);
    const correctAnswer = getCorrectAnswer(question);

    const result = {
      questionId: question.id || `question-${currentQuestionIndex + 1}`,
      question: question.question || "Pergunta sem título",
      type: question.type,
      selectedAnswer,
      correctAnswer,
      correct,
      points: hintsUsed.has(currentQuestionIndex)
        ? Math.ceil(getPoints(question, correct) / 2)
        : getPoints(question, correct),
      hintUsed: hintsUsed.has(currentQuestionIndex),
      explanation: question.explanation || "",
      sourceExcerpt: question.sourceExcerpt || "",
      studyTopic: question.studyTopic || "",
      options: question.options || [],
      difficulty: question.difficulty
    };

    answers[currentQuestionIndex] = result;

    if (correct !== null && window.StorageManager?.recordAnswer) {
      try {
        window.StorageManager.recordAnswer(correct === true);
      } catch (error) {
        console.warn("Erro ao registrar a resposta:", error);
      }
    }

    return { ...result };
  }

  function nextQuestion() {
    if (!currentQuiz || finished) return null;

    if (!answers[currentQuestionIndex]) {
      showMessage("Responda à pergunta antes de avançar.");
      return null;
    }

    if (currentQuestionIndex < currentQuiz.questions.length - 1) {
      currentQuestionIndex++;
      return getState();
    }

    return finishQuiz();
  }

  function calculateResult() {
    if (!currentQuiz) return null;

    const total = currentQuiz.questions.length;
    const correct = answers.filter(
      answer => answer?.correct === true
    ).length;

    const incorrect = answers.filter(
      answer => answer?.correct === false
    ).length;

    const open = answers.filter(
      answer => answer?.correct === null
    ).length;

    const points = answers.reduce(
      (sum, answer) => sum + (answer?.points || 0),
      0
    );

    const automaticTotal = correct + incorrect;

    return {
      title: currentQuiz.title,
      totalQuestions: total,
      answered: answers.filter(Boolean).length,
      correct,
      incorrect,
      open,
      points,
      percentage: automaticTotal
        ? Math.round((correct / automaticTotal) * 100)
        : 0,
      durationSeconds: startedAt
        ? Math.max(
            0,
            Math.floor((Date.now() - startedAt) / 1000)
          )
        : 0,
      newAchievements: [...newAchievements],
      multiplier: rewardMultiplier,
      coinsEarned: points * rewardMultiplier,
      answers: answers.map(answer =>
        answer ? { ...answer } : null
      )
    };
  }

  function localDate(date) {
    const pad = number => String(number).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function updateStreakAndEarnings(coinsEarned) {
    const storage = window.StorageManager;
    const player = storage.getPlayer();
    const today = localDate(new Date());
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);

    let streak = Number(player.streak) || 0;

    if (player.lastPlayedDate !== today) {
      streak = player.lastPlayedDate === localDate(yesterdayDate)
        ? streak + 1
        : 1;
    }

    storage.updatePlayer({
      streak,
      lastPlayedDate: today,
      totalCoinsEarned: (Number(player.totalCoinsEarned) || 0) + coinsEarned
    });
  }

  function finishQuiz() {
    if (!currentQuiz) {
      throw new Error("Não existe um desafio para finalizar.");
    }

    if (finished) return calculateResult();

    finished = true;

    const basePoints = answers.reduce(
      (sum, answer) => sum + (answer?.points || 0),
      0
    );

    rewardMultiplier = 1;

    if (basePoints > 0 && spendConsumable("potion")) {
      rewardMultiplier = 2;
    }

    const result = calculateResult();

    if (window.StorageManager) {
      try {
        if (typeof StorageManager.addCoins === "function") {
          StorageManager.addCoins(result.coinsEarned);
        }

        if (typeof StorageManager.addXp === "function") {
          StorageManager.addXp(result.coinsEarned);
        }

        if (
          typeof StorageManager.recordQuizCompleted === "function"
        ) {
          StorageManager.recordQuizCompleted({
            title: result.title,
            totalQuestions: result.totalQuestions,
            correct: result.correct,
            incorrect: result.incorrect,
            points: result.points,
            percentage: result.percentage,
            durationSeconds: result.durationSeconds,
            completedAt: new Date().toISOString()
          });
        }

        if (typeof StorageManager.addHistory === "function") {
          StorageManager.addHistory({
            title: result.title,
            totalQuestions: result.totalQuestions,
            correct: result.correct,
            incorrect: result.incorrect,
            points: result.coinsEarned,
            percentage: result.percentage,
            completedAt: new Date().toISOString()
          });
        }

        updateStreakAndEarnings(result.coinsEarned);

        if (window.Catalog) {
          newAchievements = window.Catalog.unlockNew({ result });
        }
      } catch (error) {
        console.warn("Erro ao salvar o resultado:", error);
      }
    }

    return calculateResult();
  }

  function resetQuiz() {
    currentQuiz = null;
    currentQuestionIndex = 0;
    answers = [];
    startedAt = null;
    finished = false;
    newAchievements = [];
    rewardMultiplier = 1;
    hintsUsed = new Set();
  }

  window.QuizManager = {
    ACHIEVEMENTS,
    startQuiz,
    submitAnswer,
    nextQuestion,
    finishQuiz,
    calculateResult,
    getResult: calculateResult,
    getState,
    resetQuiz,
    useHint,
    hasUsedHint,
    getBoosts,
    spendConsumable
  };
})();

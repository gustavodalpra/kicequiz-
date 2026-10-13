"use strict";

(() => {
  const OLD_STORAGE_KEY = "bauDoCapitao_documents_v1";
  const SUBJECTS_KEY = "bauDoCapitao_subjects_v1";
  const DB_NAME = "bauDoCapitao_docs";
  const DB_STORE = "documents";
  const MAX_FILE_SIZE = 15 * 1024 * 1024;
  const MAX_TEXT_LENGTH = 80000;
  const MAX_DOCUMENTS = 60;
  const DEFAULT_SUBJECT = { id: "geral", name: "Geral", icon: "📁" };

  let documents = [];
  let subjects = loadSubjects();
  let isProcessing = false;
  let dbPromise = null;
  const listeners = [];

  function createId() {
    return (
      Date.now().toString(36) +
      Math.random().toString(36).slice(2, 9)
    );
  }

  function notify() {
    listeners.forEach(callback => {
      try { callback(); } catch (error) { console.warn(error); }
    });
  }

  // ---------- Matérias ----------

  function loadSubjects() {
    try {
      const parsed = JSON.parse(localStorage.getItem(SUBJECTS_KEY) || "[]");
      const valid = Array.isArray(parsed)
        ? parsed.filter(item => item && item.id && item.name)
        : [];

      if (!valid.some(item => item.id === DEFAULT_SUBJECT.id)) {
        valid.unshift({ ...DEFAULT_SUBJECT });
      }

      return valid;
    } catch {
      return [{ ...DEFAULT_SUBJECT }];
    }
  }

  function saveSubjects() {
    try {
      localStorage.setItem(SUBJECTS_KEY, JSON.stringify(subjects));
    } catch (error) {
      console.warn("Não foi possível salvar as matérias.", error);
    }
  }

  function getSubjects() {
    return subjects.map(item => ({ ...item }));
  }

  function getSubject(id) {
    return subjects.find(item => item.id === id) || subjects[0];
  }

  function addSubject(name, icon) {
    const cleaned = String(name || "").trim().slice(0, 40);

    if (!cleaned) {
      throw new Error("Digite o nome da matéria.");
    }

    const exists = subjects.some(
      item => item.name.toLocaleLowerCase("pt-BR") === cleaned.toLocaleLowerCase("pt-BR")
    );

    if (exists) {
      throw new Error("Você já tem uma matéria com esse nome.");
    }

    if (subjects.length >= 30) {
      throw new Error("O limite é de 30 matérias.");
    }

    const subject = { id: createId(), name: cleaned, icon: icon || "📘" };
    subjects.push(subject);
    saveSubjects();
    renderDocuments();
    notify();

    return { ...subject };
  }

  async function removeSubject(id) {
    if (id === DEFAULT_SUBJECT.id) return;

    subjects = subjects.filter(item => item.id !== id);
    saveSubjects();

    // Os documentos da matéria removida voltam para "Geral".
    for (const doc of documents) {
      if (doc.subject === id) {
        doc.subject = DEFAULT_SUBJECT.id;
        await persistPut(doc);
      }
    }

    renderDocuments();
    notify();
  }

  async function setDocumentSubject(docId, subjectId) {
    const doc = documents.find(item => item.id === docId);
    if (!doc || !subjects.some(item => item.id === subjectId)) return;

    doc.subject = subjectId;
    await persistPut(doc);
    renderDocuments();
    notify();
  }

  // ---------- Armazenamento (IndexedDB, com plano B no localStorage) ----------

  function openDb() {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise(resolve => {
      if (!window.indexedDB) {
        resolve(null);
        return;
      }

      try {
        const request = indexedDB.open(DB_NAME, 1);

        request.onupgradeneeded = () => {
          request.result.createObjectStore(DB_STORE, { keyPath: "id" });
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });

    return dbPromise;
  }

  function idbRun(db, mode, action) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, mode);
      const store = tx.objectStore(DB_STORE);
      const request = action(store);

      tx.oncomplete = () => resolve(request ? request.result : undefined);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  function saveToLocalStorage() {
    try {
      localStorage.setItem(OLD_STORAGE_KEY, JSON.stringify(documents));
      return true;
    } catch (error) {
      console.warn("Não foi possível salvar os documentos.", error);
      showMessage(
        "Os documentos continuam disponíveis nesta sessão, " +
        "mas não foi possível salvá-los permanentemente."
      );
      return false;
    }
  }

  async function persistPut(doc) {
    const db = await openDb();

    if (!db) return saveToLocalStorage();

    try {
      await idbRun(db, "readwrite", store => store.put(doc));
      return true;
    } catch (error) {
      console.warn("Falha ao salvar no IndexedDB.", error);
      showMessage("Não foi possível salvar este documento permanentemente.");
      return false;
    }
  }

  async function persistDelete(id) {
    const db = await openDb();

    if (!db) return saveToLocalStorage();

    try {
      await idbRun(db, "readwrite", store => store.delete(id));
    } catch (error) {
      console.warn("Falha ao remover do IndexedDB.", error);
    }
  }

  async function loadDocuments() {
    const db = await openDb();
    let stored = [];

    if (db) {
      try {
        stored = (await idbRun(db, "readonly", store => store.getAll())) || [];
      } catch (error) {
        console.warn("Falha ao ler o IndexedDB.", error);
      }
    }

    // Migra documentos guardados na versão antiga (localStorage).
    try {
      const legacy = JSON.parse(localStorage.getItem(OLD_STORAGE_KEY) || "[]");

      if (Array.isArray(legacy) && legacy.length) {
        if (db) {
          for (const doc of legacy) {
            if (doc && doc.id && !stored.some(item => item.id === doc.id)) {
              await idbRun(db, "readwrite", store => store.put(doc));
              stored.push(doc);
            }
          }

          localStorage.removeItem(OLD_STORAGE_KEY);
        } else if (!stored.length) {
          stored = legacy;
        }
      }
    } catch (error) {
      console.warn("Não foi possível migrar os documentos antigos.", error);
    }

    return stored
      .filter(doc => doc && doc.id && typeof doc.text === "string")
      .map(doc => ({
        ...doc,
        subject: subjects.some(item => item.id === doc.subject)
          ? doc.subject
          : DEFAULT_SUBJECT.id
      }))
      .sort((a, b) => String(a.addedAt).localeCompare(String(b.addedAt)));
  }

  function normalizeText(text) {
    return String(text || "")
      .replace(/\u0000/g, "")
      .replace(/\r\n?/g, "\n")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
      .slice(0, MAX_TEXT_LENGTH);
  }

  function getExtension(filename) {
    const parts = String(filename).toLowerCase().split(".");
    return parts.length > 1 ? parts.pop() : "";
  }

  function showMessage(message) {
    console.log("[Baú do Capitão]", message);

    const status = document.querySelector(
      "#document-status, #upload-status, [data-document-status]"
    );

    if (status) {
      status.textContent = message;
    }

    if (typeof window.showToast === "function") {
      window.showToast(message);
    }
  }

  function getLibrary() {
    const possibleContainers = [
      "#document-list",
      "#documents-list",
      "#uploaded-documents",
      "#document-library",
      "#documents-container",
      "[data-document-list]"
    ];

    for (const selector of possibleContainers) {
      const element = document.querySelector(selector);
      if (element) return element;
    }

    return null;
  }

  async function readTextFile(file) {
    return await file.text();
  }

  async function readPdf(file) {
    if (!window.pdfjsLib) {
      throw new Error(
        "O leitor de PDF não foi carregado. Confira a conexão com a internet."
      );
    }

    const buffer = await file.arrayBuffer();

    if (window.pdfjsLib.GlobalWorkerOptions) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    }

    const pdf = await window.pdfjsLib.getDocument({
      data: new Uint8Array(buffer)
    }).promise;

    const pages = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      showMessage(
        `Lendo PDF: página ${pageNumber} de ${pdf.numPages}...`
      );

      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();

      const pageText = content.items
        .map(item => item.str || "")
        .join(" ");

      pages.push(pageText);
    }

    return pages.join("\n\n");
  }

  async function readDocx(file) {
    if (!window.mammoth) {
      throw new Error(
        "O leitor de Word não foi carregado. Confira a conexão com a internet."
      );
    }

    const result = await window.mammoth.extractRawText({
      arrayBuffer: await file.arrayBuffer()
    });

    return result.value || "";
  }

  async function readPptx(file) {
    if (!window.JSZip) {
      throw new Error(
        "O leitor de PowerPoint não foi carregado. Confira a conexão com a internet."
      );
    }

    const zip = await window.JSZip.loadAsync(
      await file.arrayBuffer()
    );

    const slideFiles = Object.keys(zip.files)
      .filter(path =>
        /^ppt\/slides\/slide\d+\.xml$/i.test(path)
      )
      .sort((a, b) => {
        const numberA = Number(a.match(/slide(\d+)/i)[1]);
        const numberB = Number(b.match(/slide(\d+)/i)[1]);
        return numberA - numberB;
      });

    if (!slideFiles.length) {
      throw new Error("Não encontrei slides legíveis nesse PowerPoint.");
    }

    const slides = [];

    for (let i = 0; i < slideFiles.length; i++) {
      showMessage(`Lendo PowerPoint: slide ${i + 1} de ${slideFiles.length}...`);

      const xmlText = await zip.files[slideFiles[i]].async("text");
      const xml = new DOMParser().parseFromString(
        xmlText,
        "application/xml"
      );

      if (xml.querySelector("parsererror")) {
        continue;
      }

      const texts = Array.from(xml.getElementsByTagName("a:t"))
        .map(node => node.textContent || "")
        .filter(Boolean);

      slides.push(
        `Slide ${i + 1}\n${texts.join(" ")}`
      );
    }

    return slides.join("\n\n");
  }

  function loadScript(url) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(
        `script[data-dynamic-library="${url}"]`
      );

      if (existing) {
        if (existing.dataset.loaded === "true") {
          resolve();
          return;
        }

        existing.addEventListener("load", resolve, { once: true });
        existing.addEventListener(
          "error",
          () => reject(new Error("Não foi possível carregar uma biblioteca.")),
          { once: true }
        );
        return;
      }

      const script = document.createElement("script");
      script.src = url;
      script.async = true;
      script.dataset.dynamicLibrary = url;

      script.onload = () => {
        script.dataset.loaded = "true";
        resolve();
      };

      script.onerror = () => {
        script.remove();
        reject(
          new Error(
            "Não foi possível carregar o leitor de imagens. " +
            "Confira sua conexão com a internet."
          )
        );
      };

      document.head.appendChild(script);
    });
  }

  async function ensureOcr() {
    if (window.Tesseract) return;

    await loadScript(
      "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js"
    );

    if (!window.Tesseract) {
      throw new Error("O leitor de imagens não ficou disponível.");
    }
  }

  async function readImage(file) {
    await ensureOcr();

    showMessage(
      "Lendo o texto da imagem... Isso pode levar alguns minutos."
    );

    const result = await window.Tesseract.recognize(
      file,
      "por+eng",
      {
        logger(info) {
          if (info.status === "recognizing text" && info.progress != null) {
            const percent = Math.round(info.progress * 100);
            showMessage(`Reconhecendo texto da imagem: ${percent}%`);
          }
        }
      }
    );

    return result.data.text || "";
  }

  async function extractFile(file) {
    if (!file) {
      throw new Error("Nenhum arquivo foi selecionado.");
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new Error(
        `"${file.name}" ultrapassa o limite de 15 MB.`
      );
    }

    const extension = getExtension(file.name);
    let text = "";

    switch (extension) {
      case "txt":
      case "md":
      case "markdown":
        text = await readTextFile(file);
        break;

      case "pdf":
        text = await readPdf(file);
        break;

      case "docx":
        text = await readDocx(file);
        break;

      case "pptx":
        text = await readPptx(file);
        break;

      case "png":
      case "jpg":
      case "jpeg":
      case "webp":
      case "bmp":
        text = await readImage(file);
        break;

      default:
        throw new Error(
          `Formato não suportado: .${extension || "desconhecido"}. ` +
          "Use PDF, DOCX, TXT, MD, PPTX ou uma imagem."
        );
    }

    text = normalizeText(text);

    if (!text) {
      throw new Error(
        "Não encontrei texto nesse arquivo. " +
        "Se for um PDF digitalizado, envie imagens das páginas para tentar o OCR."
      );
    }

    return {
      id: createId(),
      name: file.name,
      type: extension,
      size: file.size,
      text,
      addedAt: new Date().toISOString()
    };
  }

  async function addFiles(fileList, subjectId) {
    if (isProcessing) {
      showMessage("Espere a leitura atual terminar antes de enviar outros arquivos.");
      return [];
    }

    const files = Array.from(fileList || []);

    if (!files.length) return [];

    const availableSlots = MAX_DOCUMENTS - documents.length;

    if (availableSlots <= 0) {
      showMessage(
        `O limite é de ${MAX_DOCUMENTS} documentos. Remova algum para adicionar outro.`
      );
      return [];
    }

    if (files.length > availableSlots) {
      showMessage(
        `Você pode adicionar mais ${availableSlots} documento(s) agora.`
      );
    }

    const subject = subjects.some(item => item.id === subjectId)
      ? subjectId
      : DEFAULT_SUBJECT.id;

    const selectedFiles = files.slice(0, availableSlots);
    const added = [];

    isProcessing = true;

    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];

        showMessage(
          `Preparando documento ${i + 1} de ${selectedFiles.length}: ${file.name}`
        );

        try {
          const documentData = await extractFile(file);
          documentData.subject = subject;

          documents.push(documentData);
          added.push(documentData);

          await persistPut(documentData);
          renderDocuments();
        } catch (error) {
          console.error("Erro ao ler documento:", file.name, error);
          showMessage(`${file.name}: ${error.message}`);
        }
      }
    } finally {
      isProcessing = false;
      renderDocuments();
      notify();

      if (added.length) {
        showMessage(
          `${added.length} documento(s) preparado(s) para os quizzes!`
        );
      }
    }

    return added;
  }

  async function removeDocument(id) {
    documents = documents.filter(documentData => documentData.id !== id);
    await persistDelete(id);
    renderDocuments();
    notify();
    showMessage("Documento removido.");
  }

  async function clearDocuments() {
    const ids = documents.map(item => item.id);
    documents = [];

    for (const id of ids) {
      await persistDelete(id);
    }

    renderDocuments();
    notify();
    showMessage("Todos os documentos foram removidos.");
  }

  function getDocuments() {
    return documents.map(documentData => ({ ...documentData }));
  }

  function getCombinedText() {
    return documents
      .map(documentData =>
        `DOCUMENTO: ${documentData.name}\n\n${documentData.text}`
      )
      .join("\n\n--------------------\n\n");
  }

  // Junta os documentos de uma matéria, dividindo o espaço entre eles.
  function getSubjectText(subjectId, budget = 110000) {
    const docs = documents.filter(item => item.subject === subjectId);

    if (!docs.length) return "";

    const perDocument = Math.floor(budget / docs.length);

    return docs
      .map(item =>
        `DOCUMENTO: ${item.name}\n\n${item.text.slice(0, perDocument)}`
      )
      .join("\n\n--------------------\n\n");
  }

  function el(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function renderDocuments() {
    const container = getLibrary();

    if (!container) return;

    container.replaceChildren();

    if (!documents.length) {
      const empty = el("div", "empty-state");
      empty.id = "documents-empty";
      empty.append(
        el("span", "", "🏝️"),
        el("h3", "", "Esta ilha ainda está vazia"),
        el("p", "", "Adicione um documento para começar sua coleção.")
      );
      container.appendChild(empty);
    }

    for (const subject of subjects) {
      const docs = documents.filter(item => item.subject === subject.id);

      if (!docs.length && subject.id === DEFAULT_SUBJECT.id) continue;

      const group = el("section", "subject-group");
      const header = el("div", "subject-header");
      const title = el("h3", "", `${subject.icon} ${subject.name}`);
      const count = el(
        "small",
        "",
        `${docs.length} ${docs.length === 1 ? "documento" : "documentos"}`
      );
      const titleBox = el("div", "subject-title");
      titleBox.append(title, count);

      const actions = el("div", "subject-actions");

      if (docs.length) {
        const quizButton = el("button", "button secondary", "🎯 Quiz");
        quizButton.type = "button";
        quizButton.addEventListener("click", () => {
          window.AppManager?.startQuizFor?.(`subject:${subject.id}`);
        });
        actions.appendChild(quizButton);
      }

      if (subject.id !== DEFAULT_SUBJECT.id) {
        const removeSubjectButton = el("button", "button secondary", "🗑️");
        removeSubjectButton.type = "button";
        removeSubjectButton.setAttribute("aria-label", `Excluir matéria ${subject.name}`);
        removeSubjectButton.addEventListener("click", () => {
          if (window.confirm(
            `Excluir a matéria "${subject.name}"? Os documentos dela vão para "Geral".`
          )) {
            removeSubject(subject.id);
          }
        });
        actions.appendChild(removeSubjectButton);
      }

      header.append(titleBox, actions);
      group.appendChild(header);

      if (!docs.length) {
        group.appendChild(el("p", "helper-text", "Nenhum documento nesta matéria ainda."));
      }

      for (const documentData of docs) {
        const card = el("div", "document-card");
        const info = el("div", "document-info");
        const name = el("strong", "", documentData.name);
        const details = el(
          "small",
          "",
          `${documentData.type.toUpperCase()} · ` +
          `${Math.max(1, Math.ceil(documentData.text.length / 1000))} blocos de texto`
        );

        const move = el("select", "text-input document-subject");
        move.setAttribute("aria-label", `Matéria de ${documentData.name}`);

        subjects.forEach(item => {
          const option = el("option", "", `${item.icon} ${item.name}`);
          option.value = item.id;
          move.appendChild(option);
        });

        move.value = documentData.subject;
        move.addEventListener("change", () => {
          setDocumentSubject(documentData.id, move.value);
        });

        const removeButton = el("button", "button secondary document-remove", "Retirar");
        removeButton.type = "button";
        removeButton.setAttribute("aria-label", `Retirar ${documentData.name}`);
        removeButton.addEventListener("click", () => {
          removeDocument(documentData.id);
        });

        info.append(name, details, move);
        card.append(info, removeButton);
        group.appendChild(card);
      }

      container.appendChild(group);
    }
  }

  function fillSubjectSelect(select, selected) {
    if (!select) return;

    const previous = selected || select.value;
    select.replaceChildren();

    subjects.forEach(item => {
      const option = el("option", "", `${item.icon} ${item.name}`);
      option.value = item.id;
      select.appendChild(option);
    });

    select.value = subjects.some(item => item.id === previous)
      ? previous
      : DEFAULT_SUBJECT.id;
  }

  const ready = (async () => {
    documents = await loadDocuments();
    renderDocuments();
    notify();
  })();

  window.DocumentManager = {
    MAX_DOCUMENTS,
    ready,
    onChange: callback => listeners.push(callback),
    extractFile,
    addFiles,
    getDocuments,
    getCombinedText,
    getSubjectText,
    removeDocument,
    clearDocuments,
    renderDocuments,
    getSubjects,
    getSubject,
    addSubject,
    removeSubject,
    setDocumentSubject,
    fillSubjectSelect,
    isProcessing: () => isProcessing
  };
})();

(function () {
  const orderPilot = (window.OrderPilot = window.OrderPilot || {});
  const appRoot = document.getElementById("app");
  const statusRegion = document.getElementById("status-region");
  const clone = (value) => JSON.parse(JSON.stringify(value));
  let started = false;

  const state = {
    page: "chat",
    mobilePane: "chat",
    selectedScenarioId: "missing-size",
    draft: null,
    history: [],
    catalogSearch: "",
    composerText: "",
    operationError: "",
    userNotice: "",
    userNoticeType: "notice-info",
    sourceFocus: null,
    storageMode: "local",
    storageMessage: "บันทึกตัวอย่างไว้ในเบราว์เซอร์นี้เท่านั้น"
  };

  function announce(message) {
    if (statusRegion) statusRegion.textContent = message || "";
  }

  function updateNavigation() {
    document.querySelectorAll(".primary-nav [data-page]").forEach((button) => {
      const active = button.dataset.page === state.page;
      button.classList.toggle("is-active", active);
      if (active) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
  }

  function render() {
    if (!appRoot) return;
    appRoot.innerHTML = orderPilot.views.render(state, state.page);
    updateNavigation();
    if (state.sourceFocus) {
      requestAnimationFrame(() => {
        const message = Array.from(document.querySelectorAll("[data-message-id]"))
          .find((element) => element.dataset.messageId === state.sourceFocus.messageId);
        if (message) message.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
      });
    }
  }

  function refreshHistory() {
    const result = orderPilot.store.load();
    state.history = result.drafts;
    state.storageMode = result.storageMode;
    state.storageMessage = result.message;
  }

  function persistDraft(draft, expectedVersion) {
    const result = orderPilot.store.save(draft, expectedVersion);
    state.storageMode = result.storageMode;
    state.storageMessage = result.message;
    if (!result.ok) {
      state.userNotice = result.message;
      state.userNoticeType = "notice-error";
      if (result.draft) state.draft = result.draft;
      refreshHistory();
      announce(result.message);
      render();
      return false;
    }
    state.draft = result.draft;
    state.userNotice = "";
    state.userNoticeType = "notice-info";
    refreshHistory();
    render();
    return true;
  }

  function startScenario(scenarioId) {
    const scenario = orderPilot.scenarios.find((entry) => entry.id === scenarioId);
    if (!scenario) return;
    const draftId = `demo-${scenario.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const draft = orderPilot.domain.createDraft({
      shopId: "synthetic-shop",
      threadId: `thread-${scenario.id}`,
      draftId,
      message: scenario.initialMessage
    });
    draft.scenarioId = scenario.id;
    draft.scenarioTitle = scenario.title;
    const result = orderPilot.demoAssistant.extractMessage(scenario.initialMessage, orderPilot.catalog, draft);
    state.selectedScenarioId = scenario.id;
    state.page = "chat";
    state.mobilePane = "chat";
    state.composerText = "";
    state.operationError = "";
    state.sourceFocus = null;
    state.userNotice = "";
    persistDraft(result.draft, 0);
    announce(`เริ่มสถานการณ์ ${scenario.title}`);
  }

  function loadExistingDraft() {
    const saved = orderPilot.store.load();
    state.history = saved.drafts;
    state.storageMode = saved.storageMode;
    state.storageMessage = saved.message;
    const active = saved.drafts.find((draft) => !draft.confirmedAt);
    if (active) {
      state.draft = active;
      state.selectedScenarioId = orderPilot.scenarios.some((scenario) => scenario.id === active.scenarioId)
        ? active.scenarioId
        : "missing-size";
      render();
    } else {
      startScenario("missing-size");
    }
  }

  function setManualSource(item, field) {
    item.source = item.source || {};
    item.source[field] = { messageId: null, phrase: "แก้ไขโดยผู้ขาย" };
  }

  function saveDraftEdit(control) {
    if (!state.draft) return;
    const draft = clone(state.draft);
    const field = control.dataset.edit;
    const itemIndex = Number(control.dataset.itemIndex);
    const value = control.value;

    if (field === "product") {
      const item = draft.items[itemIndex];
      const product = orderPilot.catalog.find((entry) => entry.id === value);
      if (!item || !product) return;
      item.productId = product.id;
      item.sku = product.sku;
      item.productName = product.name;
      item.unitPriceTHB = product.priceTHB;
      item.matchStatus = "matched";
      item.candidates = [product.id];
      item.reviewReason = "";
      setManualSource(item, "product");
    } else if (["color", "size", "quantity"].includes(field)) {
      const item = draft.items[itemIndex];
      if (!item) return;
      item[field] = field === "quantity" ? value : value;
      if (field === "size") item.size = String(value).toUpperCase();
      setManualSource(item, field);
    } else if (field.startsWith("recipient.")) {
      const recipientField = field.slice("recipient.".length);
      draft.recipient = draft.recipient || { name: "", phone: "", address: "" };
      draft.recipient[recipientField] = value;
      draft.recipientSource = draft.recipientSource || {};
      draft.recipientSource[recipientField] = { messageId: null, phrase: "แก้ไขโดยผู้ขาย" };
    }

    orderPilot.domain.validateDraft(draft, orderPilot.catalog);
    state.sourceFocus = null;
    state.operationError = "";
    persistDraft(draft, state.draft.version);
    announce("บันทึกร่างตัวอย่างแล้ว");
  }

  function submitMessage() {
    const input = document.getElementById("chat-input");
    const text = input ? input.value.trim() : "";
    if (!text) {
      announce("พิมพ์ข้อความตัวอย่างก่อนรับคำตอบ");
      return;
    }
    state.composerText = text;
    state.operationError = "";
    let base = state.draft;
    if (!base) {
      base = orderPilot.domain.createDraft({
        shopId: "synthetic-shop",
        threadId: `thread-${Date.now()}`,
        draftId: `demo-message-${Date.now()}`
      });
    }
    const result = base.items && base.items.length
      ? orderPilot.demoAssistant.applyBuyerReply(text, orderPilot.catalog, base)
      : orderPilot.demoAssistant.extractMessage(text, orderPilot.catalog, base);
    if (result.error) {
      state.operationError = result.error;
      render();
      announce(result.error);
      return;
    }
    result.draft.scenarioId = state.selectedScenarioId || "custom-message";
    result.draft.scenarioTitle = orderPilot.scenarios.find((entry) => entry.id === state.selectedScenarioId)?.title || "ข้อความจำลอง";
    state.composerText = "";
    state.sourceFocus = null;
    state.mobilePane = "chat";
    persistDraft(result.draft, base.version || 0);
    announce("อัปเดตร่างจากข้อความจำลองแล้ว");
  }

  function highlightSource(button) {
    const messageId = button.dataset.sourceMessage;
    const itemIndex = button.dataset.sourceItem === "" ? null : Number(button.dataset.sourceItem);
    const field = button.dataset.sourceField;
    const source = getSourceForField(state.draft, itemIndex, field);
    if (!source || !messageId) return;
    state.page = "chat";
    state.mobilePane = "chat";
    state.sourceFocus = { messageId, phrase: source.phrase };
    render();
    announce("แสดงข้อความต้นทางของช่องนี้แล้ว");
  }

  function getSourceForField(draft, itemIndex, field) {
    if (!draft) return null;
    if (field.startsWith("recipient.")) return (draft.recipientSource || {})[field.slice("recipient.".length)] || null;
    return draft.items && draft.items[itemIndex] ? (draft.items[itemIndex].source || {})[field] || null : null;
  }

  function handleReset() {
    const accepted = window.confirm("ล้างเฉพาะร่างทดลองและประวัติจำลองในเบราว์เซอร์นี้หรือไม่?");
    if (!accepted) return;
    const result = orderPilot.store.reset();
    state.draft = null;
    state.history = [];
    state.selectedScenarioId = "";
    state.page = "chat";
    state.mobilePane = "chat";
    state.composerText = "";
    state.operationError = "";
    state.userNotice = result.message;
    state.userNoticeType = result.storageMode === "session" ? "notice-error" : "notice-info";
    state.storageMode = result.storageMode;
    state.storageMessage = result.message;
    state.sourceFocus = null;
    render();
    announce(result.message);
  }

  function handleAction(action, target) {
    if (action === "scenario-select") {
      startScenario(target.value);
    } else if (action === "fill-example-reply") {
      const scenario = orderPilot.scenarios.find((entry) => entry.id === state.selectedScenarioId);
      const input = document.getElementById("chat-input");
      if (scenario && input) {
        input.value = scenario.replyExample;
        state.composerText = scenario.replyExample;
        input.focus();
      }
    } else if (action === "simulate-error") {
      if (!state.draft) return;
      const result = orderPilot.demoAssistant.applyBuyerReply("จำลองข้อผิดพลาด", orderPilot.catalog, state.draft);
      state.operationError = result.error || "การจำลองขัดข้อง แต่ร่างเดิมยังอยู่";
      render();
      announce(state.operationError);
    } else if (action === "reset") {
      handleReset();
    } else if (action === "confirm") {
      if (!state.draft) return;
      const result = orderPilot.store.confirm(state.draft.draftId, state.draft.version);
      state.storageMode = result.storageMode;
      state.userNotice = result.message;
      state.userNoticeType = result.ok ? "notice-success" : "notice-review";
      if (result.ok && result.draft) state.draft = result.draft;
      else if (result.draft) state.draft = result.draft;
      refreshHistory();
      render();
      announce(result.message);
    } else if (action === "load-history") {
      const selected = state.history.find((draft) => draft.draftId === target.dataset.draftId);
      if (!selected) return;
      state.draft = clone(selected);
      state.selectedScenarioId = selected.scenarioId || "";
      state.page = "chat";
      state.mobilePane = "draft";
      state.userNotice = "เปิดร่างจากประวัติในเบราว์เซอร์นี้";
      state.userNoticeType = "notice-info";
      render();
      announce("เปิดร่างจากประวัติแล้ว");
    }
  }

  function preserveCatalogFocus(value, selectionStart) {
    render();
    const input = document.getElementById("catalog-search");
    if (input) {
      input.focus();
      if (typeof selectionStart === "number") input.setSelectionRange(selectionStart, selectionStart);
      input.value = value;
    }
  }

  function bindEvents() {
    document.addEventListener("click", (event) => {
      const pageButton = event.target.closest("[data-page]");
      if (pageButton) {
        state.page = pageButton.dataset.page;
        state.userNotice = "";
        render();
        return;
      }
      const scenarioButton = event.target.closest("[data-scenario]");
      if (scenarioButton) {
        startScenario(scenarioButton.dataset.scenario);
        return;
      }
      const paneButton = event.target.closest("[data-pane]");
      if (paneButton) {
        state.mobilePane = paneButton.dataset.pane;
        render();
        return;
      }
      const sourceButton = event.target.closest("[data-show-source]");
      if (sourceButton) {
        highlightSource(sourceButton);
        return;
      }
      const actionButton = event.target.closest("[data-action]");
      if (actionButton) handleAction(actionButton.dataset.action, actionButton);
    });

    document.addEventListener("change", (event) => {
      const target = event.target;
      if (target.matches("[data-edit]")) saveDraftEdit(target);
      else if (target.matches('[data-action="scenario-select"]')) handleAction("scenario-select", target);
    });

    document.addEventListener("input", (event) => {
      const target = event.target;
      if (target.id === "chat-input") state.composerText = target.value;
      else if (target.matches('[data-action="catalog-search"]')) {
        state.catalogSearch = target.value;
        preserveCatalogFocus(target.value, target.selectionStart);
      }
    });

    document.addEventListener("submit", (event) => {
      if (event.target && event.target.id === "chat-form") {
        event.preventDefault();
        submitMessage();
      }
    });
  }

  function start() {
    if (started) return;
    started = true;
    bindEvents();
    loadExistingDraft();
  }

  orderPilot.start = start;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();

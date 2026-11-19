(function () {
  const orderPilot = (window.OrderPilot = window.OrderPilot || {});
  const catalog = orderPilot.catalog;

  function escapeHTML(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
  }

  function formatPrice(value) {
    return value == null ? "—" : `${new Intl.NumberFormat("th-TH").format(value)} บาท`;
  }

  function formatTime(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "ตอนนี้" : new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit" }).format(date);
  }

  function getSource(draft, itemIndex, field) {
    if (!draft) return null;
    if (field.startsWith("recipient.")) return (draft.recipientSource || {})[field.slice("recipient.".length)] || null;
    return draft.items && draft.items[itemIndex] ? (draft.items[itemIndex].source || {})[field] || null : null;
  }

  function renderSourceChip(source, itemIndex, field) {
    if (!source || !source.phrase) return '<span class="source-placeholder">ยังไม่มีที่มาจากข้อความ</span>';
    const phrase = escapeHTML(source.phrase);
    if (!source.messageId) return `<span class="source-chip source-manual">${phrase}</span>`;
    return `<button type="button" class="source-chip" data-show-source="true" data-source-message="${escapeHTML(source.messageId)}" data-source-item="${itemIndex == null ? "" : itemIndex}" data-source-field="${escapeHTML(field)}">จากข้อความ: “${phrase}”</button>`;
  }

  function renderMessage(message, state) {
    const isBuyer = message.role === "buyer";
    const focus = state.sourceFocus && state.sourceFocus.messageId === message.id ? state.sourceFocus : null;
    let body = escapeHTML(message.text);
    if (focus && focus.phrase) {
      const index = message.text.indexOf(focus.phrase);
      if (index >= 0) {
        body = `${escapeHTML(message.text.slice(0, index))}<mark class="source-highlight">${escapeHTML(focus.phrase)}</mark>${escapeHTML(message.text.slice(index + focus.phrase.length))}`;
      }
    }
    return `<article class="message-row ${isBuyer ? "message-buyer" : "message-assistant"} ${focus ? "source-active" : ""}" data-message-id="${escapeHTML(message.id)}">
      <span class="message-avatar" aria-hidden="true">${isBuyer ? "ผ" : "OP"}</span>
      <div class="message-card">
        <div class="message-meta"><strong>${isBuyer ? "ผู้ซื้อจำลอง" : "OrderPilot · จำลอง"}</strong><time datetime="${escapeHTML(message.createdAt)}">${formatTime(message.createdAt)}</time></div>
        <p class="message-body">${body}</p>
      </div>
    </article>`;
  }

  function renderSelect(label, field, itemIndex, options, currentValue, emptyLabel = "เลือกข้อมูล") {
    const selectedExists = options.some((option) => String(option.value) === String(currentValue));
    const optionsHTML = [`<option value="" ${!currentValue ? "selected" : ""}>${escapeHTML(emptyLabel)}</option>`]
      .concat(!selectedExists && currentValue ? [`<option value="${escapeHTML(currentValue)}" selected>${escapeHTML(currentValue)} · ยังไม่อยู่ในรายการ</option>`] : [])
      .concat(options.map((option) => `<option value="${escapeHTML(option.value)}" ${String(option.value) === String(currentValue) ? "selected" : ""}>${escapeHTML(option.label)}</option>`))
      .join("");
    return `<label class="draft-field"><span class="field-label">${escapeHTML(label)}</span><select class="field-control" data-edit="${escapeHTML(field)}" data-item-index="${itemIndex}" aria-label="${escapeHTML(label)} · รายการ ${itemIndex + 1}">${optionsHTML}</select></label>`;
  }

  function renderInput(label, field, value, placeholder, itemIndex = "") {
    const type = field === "quantity" ? "number" : field === "recipient.phone" ? "tel" : "text";
    const extra = field === "quantity" ? ' min="1" step="1" inputmode="numeric"' : field === "recipient.phone" ? ' inputmode="tel" autocomplete="off"' : "";
    return `<label class="draft-field"><span class="field-label">${escapeHTML(label)}</span><input class="field-control" type="${type}" value="${escapeHTML(value)}" placeholder="${escapeHTML(placeholder)}" data-edit="${escapeHTML(field)}" data-item-index="${itemIndex}"${extra} /></label>`;
  }

  function sourceControl(draft, itemIndex, field) {
    return renderSourceChip(getSource(draft, itemIndex, field), itemIndex, field);
  }

  function getValidation(state) {
    if (!state.draft) return { status: "needs_info", missing: [], ambiguous: [], errors: [], canConfirm: false };
    return orderPilot.domain.validateDraft(JSON.parse(JSON.stringify(state.draft)), catalog);
  }

  function statusMeta(draft, validation) {
    if (draft && draft.confirmedAt) return { label: "ยืนยันแล้ว", className: "is-confirmed" };
    if (validation.ambiguous.length || validation.errors.length) return { label: "รอตรวจ", className: "is-review" };
    if (validation.missing.length) return { label: "รอข้อมูล", className: "is-review" };
    return { label: "พร้อมยืนยัน", className: "is-ready" };
  }

  function renderValidation(validation) {
    if (validation.ambiguous.length) return `<div class="notice notice-review"><strong>มีสินค้าที่ต้องเลือก</strong><p>ชื่อหรือคำตอบยังตรงได้มากกว่าหนึ่งแบบ เลือกสินค้าในร่างก่อนยืนยัน</p></div>`;
    if (validation.errors.length) return `<div class="notice notice-error"><strong>พบข้อมูลที่ต้องแก้</strong><ul>${validation.errors.map((error) => `<li>${escapeHTML(error.message)}</li>`).join("")}</ul></div>`;
    if (validation.missing.length) return `<div class="notice notice-review"><strong>ยังขาด ${validation.missing.length} ช่อง</strong><p>${escapeHTML([...new Set(validation.missing.map((field) => field.label))].join(" / "))}</p></div>`;
    return '<div class="notice notice-success"><strong>ข้อมูลครบตามกติกาของตัวอย่าง</strong><p>ตรวจข้อความต้นทางและรายละเอียดก่อนยืนยัน</p></div>';
  }

  function renderDraft(state) {
    if (!state.draft) return `<section class="panel draft-panel"><div class="panel-heading"><div><p class="eyebrow">รายการทดลอง</p><h2>ร่างออเดอร์</h2></div><span class="status-pill">ยังไม่มีร่าง</span></div><div class="empty-state"><strong>เลือกสถานการณ์เพื่อเริ่ม</strong><p>ข้อความและสินค้าในตัวอย่างเป็นข้อมูลสมมติทั้งหมด</p></div></section>`;
    const draft = state.draft;
    const validation = getValidation(state);
    const meta = statusMeta(draft, validation);
    const itemCards = draft.items.map((item, index) => {
      const product = catalog.find((entry) => entry.id === item.productId || entry.sku === item.sku);
      const candidateProducts = (item.candidates || []).map((id) => catalog.find((entry) => entry.id === id)).filter(Boolean);
      const productOptions = (candidateProducts.length ? candidateProducts : catalog).map((entry) => ({ value: entry.id, label: `${entry.sku} · ${entry.name}` }));
      const colorOptions = (product ? product.colors : catalog.flatMap((entry) => entry.colors).filter((color, colorIndex, all) => all.findIndex((candidate) => candidate.value === color.value) === colorIndex)).map((color) => ({ value: color.value, label: color.value }));
      const sizeValues = product ? product.sizes : [...new Set(catalog.flatMap((entry) => entry.sizes))];
      return `<article class="item-editor ${item.matchStatus === "ambiguous" ? "needs-choice" : ""}">
        <div class="item-editor-heading"><div><span class="item-count">รายการ ${index + 1}</span><strong>${escapeHTML(product ? product.name : item.matchStatus === "ambiguous" ? "เลือกสินค้าที่ตรง" : "ยังไม่พบสินค้า")}</strong></div><span class="mono sku">${escapeHTML(product ? product.sku : "SKU —")}</span></div>
        ${item.reviewReason ? `<div class="notice notice-review item-review-note">${escapeHTML(item.reviewReason)}</div>` : ""}
        ${renderSelect("สินค้า", "product", index, productOptions, item.productId || "", item.candidates && item.candidates.length > 1 ? "เลือกรายการที่ตรง" : "เลือกสินค้า")}
        ${sourceControl(draft, index, "product")}
        <div class="variant-grid">
          <div>${renderSelect("สี", "color", index, colorOptions, item.color, "เลือกสี")}${sourceControl(draft, index, "color")}</div>
          <div>${renderSelect("ไซซ์", "size", index, sizeValues.map((value) => ({ value, label: value })), item.size, "เลือกไซซ์")}${sourceControl(draft, index, "size")}</div>
        </div>
        <div class="item-bottom-row"><div>${renderInput("จำนวน", "quantity", item.quantity, "เช่น 2", index)}${sourceControl(draft, index, "quantity")}</div><div class="unit-price"><span class="field-label">ราคาตัวอย่าง/ชิ้น</span><strong>${formatPrice(product ? product.priceTHB : null)}</strong></div></div>
      </article>`;
    }).join("");

    const subtotal = draft.items.reduce((sum, item) => {
      const product = catalog.find((entry) => entry.id === item.productId || entry.sku === item.sku);
      return sum + (product ? product.priceTHB * Math.max(0, Number(item.quantity) || 0) : 0);
    }, 0);
    const recipient = draft.recipient || {};
    const recipientFields = [
      ["ชื่อผู้รับ", "recipient.name", recipient.name, "ชื่อสมมติ"],
      ["เบอร์โทร", "recipient.phone", recipient.phone, "0812345678"],
      ["ที่อยู่", "recipient.address", recipient.address, "ที่อยู่สมมติ"]
    ].map(([label, field, value, placeholder]) => `<div>${renderInput(label, field, value, placeholder)}${sourceControl(draft, null, field)}</div>`).join("");

    return `<section class="panel draft-panel" aria-labelledby="draft-title">
      <div class="panel-heading"><div><p class="eyebrow">เก็บไว้ในเบราว์เซอร์นี้</p><h2 id="draft-title">ร่างออเดอร์</h2></div><span class="status-pill ${meta.className}">${escapeHTML(meta.label)}</span></div>
      <div class="draft-content">
        ${state.storageMode === "session" ? `<div class="notice notice-info storage-notice">${escapeHTML(state.storageMessage)}</div>` : ""}
        ${state.userNotice ? `<div class="notice ${state.userNoticeType || "notice-info"}">${escapeHTML(state.userNotice)}</div>` : ""}
        ${renderValidation(validation)}
        <section class="draft-section"><div class="section-title-row"><h3>สินค้า</h3><span class="caption">ราคาอิงจากคลังตัวอย่าง</span></div>${itemCards || '<div class="empty-state"><strong>ยังไม่มีรายการสินค้า</strong><p>เลือกสถานการณ์หรือส่งข้อความตัวอย่าง</p></div>'}</section>
        <section class="draft-section recipient-section"><div class="section-title-row"><h3>ผู้รับจำลอง</h3><span class="caption">ใช้ข้อมูลสมมติเท่านั้น</span></div><div class="recipient-fields">${recipientFields}</div></section>
        <div class="draft-total"><span>รวมสินค้า</span><strong>${formatPrice(subtotal)}</strong></div>
        <p class="local-note">การยืนยันนี้เปลี่ยนเฉพาะร่างตัวอย่างในเบราว์เซอร์ ไม่ได้ส่งคำสั่งซื้อ</p>
      </div>
      <div class="draft-actions"><button type="button" class="button" data-action="confirm" ${validation.canConfirm && !draft.confirmedAt ? "" : "disabled"}>${draft.confirmedAt ? "ยืนยันแล้ว" : "ยืนยันร่างตัวอย่าง"}</button><span class="mono version-note">เวอร์ชัน ${Number(draft.version) || 0}</span></div>
    </section>`;
  }

  function renderScenarioPicker(state, currentScenario) {
    const placeholder = state.selectedScenarioId ? "" : '<option value="" selected disabled>เลือกสถานการณ์เพื่อเริ่มต้น</option>';
    return `<div class="scenario-picker"><label class="field-label" for="scenario-picker">สถานการณ์จำลอง</label><select id="scenario-picker" class="field-control" data-action="scenario-select">${placeholder}${orderPilot.scenarios.map((scenario) => `<option value="${escapeHTML(scenario.id)}" ${state.selectedScenarioId === scenario.id ? "selected" : ""}>${escapeHTML(scenario.title)}</option>`).join("")}</select><p>${escapeHTML(currentScenario ? currentScenario.description : "เลือกหนึ่งสถานการณ์เพื่อเริ่มต้น")}</p></div>`;
  }

  function renderScenarioRail(state) {
    return `<details class="panel scenario-rail" open><summary><span><strong>สถานการณ์ตัวอย่าง</strong><small>ข้อมูลสมมติ · เลือกเพื่อเริ่มใหม่</small></span><span class="summary-chevron" aria-hidden="true">⌄</span></summary><div class="scenario-list">${orderPilot.scenarios.map((scenario) => `<button type="button" class="scenario-option ${scenario.id === state.selectedScenarioId ? "is-selected" : ""}" data-scenario="${escapeHTML(scenario.id)}"><span class="scenario-icon" aria-hidden="true">${scenario.id === "complete-order" ? "✓" : scenario.id === "ambiguous-product" ? "?" : "•"}</span><span><strong>${escapeHTML(scenario.title)}</strong><small>${escapeHTML(scenario.description)}</small></span></button>`).join("")}</div></details>`;
  }

  function renderChat(state) {
    const scenario = orderPilot.scenarios.find((entry) => entry.id === state.selectedScenarioId) || null;
    const draft = state.draft;
    const messages = draft && draft.messages ? draft.messages : [];
    return `<section class="route-heading"><div><p class="eyebrow">ห้องทดลองสำหรับร้านเสื้อผ้า</p><h1>เปลี่ยนแชตให้เป็นร่างที่ตรวจได้</h1><p>ดูข้อความต้นทาง เทียบกับสินค้า แล้วให้ผู้ขายตัดสินใจก่อนยืนยัน</p></div><button type="button" class="button button-secondary" data-action="reset">เริ่มสถานการณ์ใหม่</button></section>
      ${state.userNotice && !draft ? `<div class="notice notice-info route-feedback">${escapeHTML(state.userNotice)}</div>` : ""}
      ${renderScenarioPicker(state, scenario)}
      <div class="mobile-pane-tabs" role="tablist" aria-label="เลือกมุมมองการทำงาน"><button type="button" role="tab" data-pane="chat" aria-selected="${state.mobilePane === "chat"}">แชต</button><button type="button" role="tab" data-pane="draft" aria-selected="${state.mobilePane === "draft"}">ร่างออเดอร์ ${draft && draft.items.length ? `<span class="tab-count">${draft.items.length}</span>` : ""}</button></div>
      <div class="simulator-layout" data-mobile-pane="${escapeHTML(state.mobilePane)}">
        ${renderScenarioRail(state)}
        <section class="panel conversation-panel" aria-labelledby="conversation-title">
          <div class="panel-heading"><div><p class="eyebrow">บทสนทนาเดียวกัน</p><h2 id="conversation-title">แชตผู้ซื้อจำลอง</h2></div><span class="status-pill"><span class="demo-dot" aria-hidden="true"></span>ข้อมูลสมมติ</span></div>
          <div class="conversation-body">
            <div class="thread-intro"><span class="thread-avatar" aria-hidden="true">ผ</span><div><strong>ลูกค้าตัวอย่าง</strong><small>ห้องสนทนาจำลอง · ${escapeHTML(scenario ? scenario.title : "ยังไม่เลือก")}</small></div><span class="thread-tag">ไม่ใช่แชตจริง</span></div>
            <div class="thread-messages" aria-label="ข้อความในบทสนทนา">${messages.length ? messages.map((message) => renderMessage(message, state)).join("") : '<div class="empty-state"><strong>เริ่มจากสถานการณ์ด้านบน</strong><p>ข้อความทั้งหมดในหน้านี้เป็นข้อมูลสมมติ</p></div>'}</div>
            ${state.operationError ? `<div class="notice notice-error operation-error" role="alert"><strong>ระบบจำลองขัดข้อง</strong><p>${escapeHTML(state.operationError)}</p></div>` : ""}
            ${draft && draft.followUpQuestion ? `<div class="assistant-prompt"><span class="prompt-spark" aria-hidden="true">✳</span><div><strong>คำถามที่แนะนำ</strong><p>${escapeHTML(draft.followUpQuestion)}</p></div></div>` : ""}
            <div class="reply-tools"><button type="button" class="button button-secondary" data-action="fill-example-reply" ${scenario ? "" : "disabled"}>ใส่คำตอบตัวอย่าง</button><button type="button" class="button button-quiet" data-action="simulate-error" ${draft ? "" : "disabled"}>จำลองข้อผิดพลาด</button></div>
            <form id="chat-form" class="chat-composer"><label class="field-label" for="chat-input">ข้อความจากผู้ซื้อจำลอง</label><div class="composer-row"><textarea id="chat-input" name="message" rows="2" placeholder="พิมพ์ข้อความสังเคราะห์เพื่อจำลองการตอบ..." ${draft && draft.confirmedAt ? "disabled" : ""}>${escapeHTML(state.composerText || "")}</textarea><button type="submit" class="button" ${draft && draft.confirmedAt ? "disabled" : ""}>${draft && draft.items.length ? "รับคำตอบ" : "วิเคราะห์ข้อความ"}</button></div><p class="caption">ใช้ข้อความสมมติเท่านั้น ข้อความจะไม่ถูกส่งออกจากเบราว์เซอร์</p></form>
          </div>
        </section>
        ${renderDraft(state)}
      </div>`;
  }

  function renderProducts(state) {
    const query = String(state.catalogSearch || "").toLocaleLowerCase("th-TH");
    const products = catalog.filter((product) => `${product.name} ${product.sku} ${(product.aliases || []).join(" ")}`.toLocaleLowerCase("th-TH").includes(query));
    return `<section class="route-heading"><div><p class="eyebrow">รายการสมมติ</p><h1>สินค้า</h1><p>สินค้า ราคา และตัวเลือกทั้งหมดสร้างขึ้นเพื่อทดลอง</p></div></section>
      <section class="catalog-toolbar"><label class="field-label" for="catalog-search">ค้นหาชื่อหรือ SKU</label><input id="catalog-search" class="field-control" type="search" value="${escapeHTML(state.catalogSearch || "")}" placeholder="เช่น Breeze หรือ OP-BL-310" data-action="catalog-search" /></section>
      <div class="catalog-grid">${products.length ? products.map((product) => `<article class="panel catalog-card"><div class="product-art" aria-hidden="true"><span>${escapeHTML(product.name.slice(0, 1))}</span><i class="swatch swatch-berry"></i><i class="swatch swatch-cyan"></i><i class="swatch swatch-amber"></i></div><div class="catalog-card-body"><div class="catalog-name"><div><h2>${escapeHTML(product.name)}</h2><span class="mono">${escapeHTML(product.sku)}</span></div><strong>${formatPrice(product.priceTHB)}</strong></div><div class="catalog-tags">${product.aliases.slice(0, 3).map((alias) => `<span class="catalog-tag">${escapeHTML(alias)}</span>`).join("")}</div><div class="catalog-variants"><div><span class="caption">สี</span><div class="variant-chips">${product.colors.map((color) => `<span class="variant-chip">${escapeHTML(color.value)}</span>`).join("")}</div></div><div><span class="caption">ไซซ์</span><div class="variant-chips">${product.sizes.map((size) => `<span class="variant-chip variant-chip-size">${escapeHTML(size)}</span>`).join("")}</div></div></div></div></article>`).join("") : '<div class="panel empty-state"><strong>ไม่พบสินค้า</strong><p>ลองค้นด้วยชื่อหรือ SKU อีกครั้ง</p></div>'}</div>
      <p class="catalog-footnote">ราคานี้เป็นตัวอย่างจากแค็ตตาล็อกจำลอง ไม่มีสต็อกหรือการขายจริง</p>`;
  }

  function renderHistory(state) {
    const drafts = [...(state.history || [])].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    return `<section class="route-heading"><div><p class="eyebrow">ข้อมูลในเบราว์เซอร์นี้</p><h1>ประวัติ</h1><p>ร่างตัวอย่างจะอยู่ในเครื่องนี้เท่านั้น ไม่ใช่ฐานข้อมูลของร้าน</p></div><button type="button" class="button button-secondary" data-action="reset">ล้างข้อมูลตัวอย่าง</button></section>
      <section class="history-list">${drafts.length ? drafts.map((draft) => {
        const validation = orderPilot.domain.validateDraft(JSON.parse(JSON.stringify(draft)), catalog);
        const meta = statusMeta(draft, validation);
        const title = orderPilot.scenarios.find((scenario) => scenario.id === draft.scenarioId)?.title || "บทสนทนาจำลอง";
        const itemCount = (draft.items || []).length;
        return `<button type="button" class="panel history-row" data-action="load-history" data-draft-id="${escapeHTML(draft.draftId)}"><span class="history-symbol" aria-hidden="true">${draft.confirmedAt ? "✓" : "◷"}</span><span class="history-copy"><strong>${escapeHTML(title)}</strong><small>${itemCount} รายการสินค้า · อัปเดต ${formatTime(draft.updatedAt)}</small></span><span class="status-pill ${meta.className}">${escapeHTML(meta.label)}</span><span class="history-open" aria-hidden="true">เปิด</span></button>`;
      }).join("") : '<div class="panel empty-state"><strong>ยังไม่มีร่างในประวัติ</strong><p>เลือกสถานการณ์ในแชตจำลองเพื่อเริ่มเก็บตัวอย่างแรก</p></div>'}</section>`;
  }

  function renderAbout() {
    return `<section class="route-heading"><div><p class="eyebrow">ภาพรวมผลิตภัณฑ์</p><h1>ข้อมูลโครงการ</h1><p>ต้นแบบสำหรับตรวจว่าแชตกลายเป็นร่างออเดอร์ที่คนอ่านและแก้ได้หรือไม่</p></div></section>
      <div class="about-grid">
        <section class="panel about-lead"><span class="about-mark" aria-hidden="true">OP</span><div><h2>OrderPilot ช่วยร้านเสื้อผ้าจัดออเดอร์จากข้อความ</h2><p>ระบบตัวอย่างจับคู่ชื่อสินค้า สี ไซซ์ และจำนวนกับแค็ตตาล็อก จากนั้นแสดงข้อความที่มาของข้อมูลและจุดที่ยังต้องตรวจ ผู้ขายเป็นคนแก้และยืนยันเอง</p></div></section>
        <section class="panel about-panel"><h2>ในต้นแบบนี้ลองอะไรได้</h2><ul><li>สกัดรายละเอียดจากข้อความจำลอง</li><li>ถามข้อมูลที่ขาดและรับคำตอบในบทสนทนาเดิม</li><li>แก้รายการเดิมหรือเพิ่มรายการใหม่อย่างชัดเจน</li><li>เลือกสินค้าเมื่อชื่อกำกวม</li><li>แก้ร่าง ดูประวัติ และยืนยันข้อมูลตัวอย่าง</li><li>จำลองข้อผิดพลาดโดยเก็บร่างเดิมไว้</li></ul></section>
        <section class="panel about-panel"><h2>สิ่งที่ต้นแบบนี้ยังไม่ทำ</h2><ul><li>ไม่ได้เชื่อมต่อ AI จริงหรือช่องทางขาย</li><li>ไม่รับเงิน ไม่เปลี่ยนสต็อก และไม่สร้างพัสดุ</li><li>เก็บข้อมูลตัวอย่างไว้ในเบราว์เซอร์เครื่องนี้</li><li>ไม่ใช่ระบบหลังบ้านหรือระบบยืนยันสิทธิ์หลายร้าน</li></ul></section>
        <section class="panel evidence-panel"><span class="status-pill is-review">หลักฐานยังอยู่ระหว่างเก็บ</span><h2>ตัวเลขเป็นเป้าหมาย ไม่ใช่ผลทดลอง</h2><p>ข้อเสนอโครงการตั้งเป้าทดสอบความถูกต้องของ SKU/สี/ไซซ์/จำนวน การตรวจข้อมูลที่ขาด และเวลาทำงานกับร้านจริง ยังไม่มีผลสัมภาษณ์ ผล pilot หรือ benchmark ที่ยืนยันในต้นแบบนี้</p><p class="caption">ห้ามใช้ข้อความจากผู้ซื้อจริงหรือข้อมูลส่วนบุคคลในหน้าโหมดทดลอง</p></section>
      </div>`;
  }

  function renderMobileNav(state) {
    const entries = [
      ["chat", "แชต", "M7 5h10l4 4v10H7z M10 12h8 M10 16h5"],
      ["products", "สินค้า", "M6 7h12v14H6z M9 4h12v14 M9 11h6 M9 15h6"],
      ["history", "ประวัติ", "M5 12a7 7 0 1 0 2-5 M5 5v4h4 M12 8v4l3 2"],
      ["about", "โครงการ", "M12 16v.01 M10 9a2 2 0 1 1 3.5 1.3c-.8.6-1.5 1-1.5 2.2 M5 4h14v16H5z"]
    ];
    return `<nav class="mobile-nav" aria-label="เมนูหลักบนมือถือ">${entries.map(([page, label, path]) => `<button type="button" class="mobile-nav-item ${state.page === page ? "is-active" : ""}" data-page="${page}" ${state.page === page ? 'aria-current="page"' : ""}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}" /></svg><span>${label}</span></button>`).join("")}</nav>`;
  }

  function render(state, activePage = state.page) {
    state.page = activePage;
    let content = "";
    if (activePage === "products") content = renderProducts(state);
    else if (activePage === "history") content = renderHistory(state);
    else if (activePage === "about") content = renderAbout();
    else content = renderChat(state);
    return `${content}${renderMobileNav(state)}`;
  }

  orderPilot.views = { render, escapeHTML };
})();

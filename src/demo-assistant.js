(function () {
  const orderPilot = (window.OrderPilot = window.OrderPilot || {});
  const domain = orderPilot.domain;

  function textPhrase(text, aliases) {
    const lower = String(text || "").toLocaleLowerCase("th-TH");
    const candidates = [...new Set((aliases || []).filter(Boolean))]
      .sort((a, b) => String(b).length - String(a).length);
    for (const alias of candidates) {
      const index = lower.indexOf(String(alias).toLocaleLowerCase("th-TH"));
      if (index >= 0) return text.slice(index, index + String(alias).length);
    }
    return "";
  }

  function getProductMatch(text, catalog) {
    const result = domain.matchProduct({ skuText: text }, catalog);
    const phrase = textPhrase(text, result.candidates.flatMap((product) => [product.sku, product.name, ...(product.aliases || [])]));
    return { ...result, phrase };
  }

  function getColor(text, products) {
    const options = products.flatMap((product) => (product.colors || []).flatMap((color) =>
      [color.value, ...(color.aliases || [])].map((alias) => ({ value: color.value, alias }))));
    const sorted = options.sort((a, b) => b.alias.length - a.alias.length);
    const phrase = textPhrase(text, sorted.map((option) => option.alias));
    if (!phrase) return { value: "", phrase: "" };
    const selected = sorted.find((option) => option.alias.toLocaleLowerCase("th-TH") === phrase.toLocaleLowerCase("th-TH"));
    return { value: selected ? selected.value : "", phrase };
  }

  function getSize(text) {
    const match = String(text || "").match(/(?:ไซซ์|ไซส์|size)\s*(2XL|XL|XS|S|M|L)\b/i) || String(text || "").match(/\b(2XL|XL|XS|S|M|L)\b/i);
    return match ? { value: match[1].toUpperCase(), phrase: match[0] } : { value: "", phrase: "" };
  }

  function getQuantity(text) {
    const match = String(text || "").match(/(?:จำนวน\s*)?(\d{1,2})\s*(?:ตัว|ชิ้น|รายการ)/) || String(text || "").match(/(?:เพิ่มเป็น|เปลี่ยนเป็น|เป็น)\s*(\d{1,2})\b/i);
    return match ? { value: Number(match[1]), phrase: match[0] } : { value: "", phrase: "" };
  }

  function getRecipient(text) {
    const nameMatch = String(text || "").match(/(?:ชื่อผู้รับ|ชื่อ)\s*([ก-๙A-Za-z0-9]+)/);
    const phoneMatch = String(text || "").match(/(?:เบอร์(?:โทร)?\s*)?(0\d{9})/);
    const addressMatch = String(text || "").match(/ที่อยู่\s*(.+?)(?=\s*(?:เบอร์(?:โทร)?|ชื่อผู้รับ|ชื่อ)\s*|$)/i);
    return {
      name: nameMatch ? { value: nameMatch[1], phrase: nameMatch[0] } : null,
      phone: phoneMatch ? { value: phoneMatch[1], phrase: phoneMatch[1] } : null,
      address: addressMatch ? { value: addressMatch[1].trim(), phrase: addressMatch[0].trim() } : null
    };
  }

  function makeParsedItem(text, messageId, catalog) {
    const match = getProductMatch(text, catalog);
    const product = match.status === "matched" ? match.candidates[0] : null;
    const colorProducts = match.candidates.length ? match.candidates : catalog;
    const color = getColor(text, colorProducts);
    const size = getSize(text);
    const quantity = getQuantity(text);
    return {
      productId: product ? product.id : null,
      sku: product ? product.sku : "",
      productName: product ? product.name : "",
      productQuery: match.phrase || "",
      matchStatus: match.status,
      candidates: match.candidates.map((candidate) => candidate.id),
      color: color.value,
      size: size.value,
      quantity: quantity.value,
      unitPriceTHB: product ? product.priceTHB : null,
      source: {
        product: match.phrase ? { messageId, phrase: match.phrase } : null,
        color: color.phrase ? { messageId, phrase: color.phrase } : null,
        size: size.phrase ? { messageId, phrase: size.phrase } : null,
        quantity: quantity.phrase ? { messageId, phrase: quantity.phrase } : null
      }
    };
  }

  function addMessage(draft, role, text) {
    const message = domain.createMessage(role, text);
    draft.messages.push(message);
    return message;
  }

  function applyRecipient(draft, parsed) {
    Object.entries(parsed).forEach(([field, value]) => {
      if (!value) return;
      draft.recipient[field] = value.value;
      draft.recipientSource = draft.recipientSource || {};
      draft.recipientSource[field] = { messageId: value.messageId, phrase: value.phrase };
    });
  }

  function sourceMatches(draft) {
    const matches = [];
    (draft.items || []).forEach((item, itemIndex) => {
      Object.entries(item.source || {}).forEach(([field, source]) => {
        if (source && source.phrase) matches.push({ field, itemIndex, messageId: source.messageId, phrase: source.phrase });
      });
    });
    Object.entries(draft.recipientSource || {}).forEach(([field, source]) => {
      if (source && source.phrase) matches.push({ field: `recipient.${field}`, itemIndex: null, messageId: source.messageId, phrase: source.phrase });
    });
    return matches;
  }

  function followUp(validation) {
    if (validation.ambiguous.length) return "ชื่อสินค้าตรงกับหลายรายการ กรุณาเลือกสินค้าที่ถูกต้องในร่างก่อนยืนยัน";
    if (validation.errors.length) return validation.errors.map((error) => error.message).join(" · ");
    if (!validation.missing.length) return "ข้อมูลครบแล้ว ตรวจร่างและที่มาของข้อมูลก่อนยืนยันได้เลย";
    const labels = [...new Set(validation.missing.map((field) => field.label))];
    return `ขอข้อมูลเพิ่ม: ${labels.join(" / ")} แล้วตรวจร่างอีกครั้ง`;
  }

  function extractMessage(message, catalog = orderPilot.catalog, draft) {
    const next = draft ? structuredClone(draft) : domain.createDraft({ message });
    let buyerMessage = next.messages[next.messages.length - 1];
    if (!buyerMessage || buyerMessage.role !== "buyer" || buyerMessage.text !== message) {
      buyerMessage = addMessage(next, "buyer", message);
    }
    const item = makeParsedItem(message, buyerMessage.id, catalog);
    next.items.push(item);
    const recipient = getRecipient(message);
    applyRecipient(next, Object.fromEntries(Object.entries(recipient).map(([field, value]) => [field, value && { ...value, messageId: buyerMessage.id }])));
    const validation = orderPilot.domain.validateDraft(next, catalog);
    next.followUpQuestion = followUp(validation);
    addMessage(next, "assistant", `จำลองการสกัดข้อมูลแล้ว · ${next.followUpQuestion}`);
    return { draft: next, sourceMatches: sourceMatches(next), validation };
  }

  function applyBuyerReply(reply, catalog = orderPilot.catalog, draft) {
    const prior = draft;
    const priorValidation = domain.validateDraft(structuredClone(prior), catalog);
    if (/จำลองข้อผิดพลาด|simulate error|\[error\]/i.test(reply)) {
      return {
        draft: prior,
        sourceMatches: sourceMatches(prior),
        validation: priorValidation,
        error: "จำลองระบบขัดข้อง ข้อความและร่างเดิมยังอยู่ ลองใหม่หรือแก้ร่างต่อได้"
      };
    }

    const next = structuredClone(prior);
    const buyerMessage = addMessage(next, "buyer", reply);
    const incoming = makeParsedItem(reply, buyerMessage.id, catalog);
    const recipient = getRecipient(reply);
    applyRecipient(next, Object.fromEntries(Object.entries(recipient).map(([field, value]) => [field, value && { ...value, messageId: buyerMessage.id }])));
    const isAddition = /เพิ่ม|อีก\s*\d*\s*(?:ตัว|ชิ้น)|\badd\b/i.test(reply);

    if (isAddition || next.items.length === 0) {
      next.items.push(incoming);
    } else {
      const item = next.items[0];
      const hasUpdate = Boolean(incoming.productId || incoming.matchStatus === "ambiguous" || incoming.color || incoming.size || incoming.quantity !== "" || recipient.name || recipient.phone || recipient.address);
      if (incoming.matchStatus === "ambiguous") {
        item.matchStatus = "ambiguous";
        item.candidates = incoming.candidates;
        item.reviewReason = "ชื่อสินค้าใหม่ตรงกับหลายรายการ";
      } else if (incoming.productId && incoming.productId !== item.productId) {
        if (/เปลี่ยน|แทน|แก้|เป็น/i.test(reply)) {
          const product = catalog.find((entry) => entry.id === incoming.productId);
          item.productId = product.id;
          item.sku = product.sku;
          item.productName = product.name;
          item.unitPriceTHB = product.priceTHB;
          item.matchStatus = "matched";
          item.candidates = [product.id];
          item.source.product = incoming.source.product;
        } else {
          item.matchStatus = "ambiguous";
          item.candidates = [...new Set([item.productId, incoming.productId].filter(Boolean))];
          item.reviewReason = "ยังไม่ชัดว่าเปลี่ยนสินค้าเดิมหรือเพิ่มสินค้าใหม่";
        }
      }

      const product = catalog.find((entry) => entry.id === item.productId);
      if (incoming.color) {
        item.color = incoming.color;
        item.source.color = incoming.source.color;
      }
      if (incoming.size) {
        item.size = incoming.size;
        item.source.size = incoming.source.size;
      }
      if (incoming.quantity !== "") {
        item.quantity = incoming.quantity;
        item.source.quantity = incoming.source.quantity;
      }
      if (!hasUpdate) {
        item.matchStatus = "ambiguous";
        item.candidates = item.productId ? [item.productId] : item.candidates;
        item.reviewReason = "ยังจับไม่ได้ว่าข้อความนี้เป็นการแก้สินค้าเดิมหรือเพิ่มรายการใหม่";
      }
      if (product) {
        item.sku = product.sku;
        item.productName = product.name;
        item.unitPriceTHB = product.priceTHB;
      }
    }

    const validation = orderPilot.domain.validateDraft(next, catalog);
    next.followUpQuestion = followUp(validation);
    addMessage(next, "assistant", `จำลองการอ่านคำตอบแล้ว · ${next.followUpQuestion}`);
    return { draft: next, sourceMatches: sourceMatches(next), validation };
  }

  orderPilot.demoAssistant = {
    extractMessage,
    applyBuyerReply,
    buildFollowUp: followUp
  };
})();

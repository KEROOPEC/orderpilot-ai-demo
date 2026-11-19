(function () {
  const orderPilot = (window.OrderPilot = window.OrderPilot || {});

  function normalize(value) {
    return String(value || "").toLocaleLowerCase("th-TH").replace(/[\s\-_/.,:()]/g, "");
  }

  function createMessage(role, text) {
    return {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      role,
      text: String(text || ""),
      createdAt: new Date().toISOString(),
      synthetic: true
    };
  }

  function createDraft({ shopId = "demo-shop", threadId = "demo-thread", draftId, message = "" } = {}) {
    const draft = {
      shopId,
      threadId,
      draftId: draftId || `draft-${Date.now()}`,
      version: 0,
      status: "draft",
      items: [],
      recipient: { name: "", phone: "", address: "" },
      missing: [],
      ambiguous: [],
      validationErrors: [],
      messages: [],
      followUpQuestion: "",
      confirmedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      synthetic: true
    };
    if (message) draft.messages.push(createMessage("buyer", message));
    return draft;
  }

  function matchProduct({ skuText = "", productText = "" } = {}, products = orderPilot.catalog || []) {
    const query = normalize(skuText || productText);
    if (!query) return { status: "missing", candidates: [] };

    const exactSku = products.filter((product) => normalize(product.sku) === query);
    if (exactSku.length === 1) return { status: "matched", candidates: exactSku };

    const exactId = products.filter((product) => normalize(product.id) === query);
    if (exactId.length === 1) return { status: "matched", candidates: exactId };

    const candidates = products.filter((product) => {
      const names = [product.name, ...(product.aliases || [])].map(normalize).filter(Boolean);
      return names.some((name) => query === name || (name.length > 2 && query.includes(name)));
    });

    if (candidates.length === 1) return { status: "matched", candidates };
    if (candidates.length > 1) return { status: "ambiguous", candidates };
    return { status: "missing", candidates: [] };
  }

  function findColor(product, value) {
    const normalized = normalize(value);
    if (!normalized || !product) return null;
    return (product.colors || []).find((color) => [color.value, ...(color.aliases || [])]
      .some((alias) => normalize(alias) === normalized)) || null;
  }

  function validateDraft(draft, products = orderPilot.catalog || []) {
    const missing = [];
    const ambiguous = [];
    const errors = [];

    if (!draft.items || draft.items.length === 0) {
      missing.push({ field: "item", label: "สินค้า", itemIndex: null });
    }

    (draft.items || []).forEach((item, index) => {
      const product = products.find((entry) => entry.id === item.productId || entry.sku === item.sku);
      if (item.matchStatus === "ambiguous" || (item.candidates || []).length > 1) {
        ambiguous.push({ field: "product", label: "สินค้า", itemIndex: index, candidates: item.candidates || [] });
      } else if (!product) {
        missing.push({ field: "product", label: "สินค้า", itemIndex: index });
      }

      if (product) {
        if (!item.color) {
          missing.push({ field: "color", label: "สี", itemIndex: index });
        } else if (!findColor(product, item.color)) {
          errors.push({ field: "color", label: "สี", itemIndex: index, message: `ไม่มีสี ${item.color} ในรายการสินค้า` });
        }

        if (!item.size) {
          missing.push({ field: "size", label: "ไซซ์", itemIndex: index });
        } else if (!product.sizes.includes(String(item.size).toUpperCase())) {
          errors.push({ field: "size", label: "ไซซ์", itemIndex: index, message: `ไม่มีไซซ์ ${item.size} ในรายการสินค้า` });
        }

        item.sku = product.sku;
        item.productName = product.name;
        item.unitPriceTHB = product.priceTHB;
      }

      if (!Number.isInteger(Number(item.quantity)) || Number(item.quantity) < 1) {
        if (item.quantity === "" || item.quantity == null || Number(item.quantity) === 0) {
          missing.push({ field: "quantity", label: "จำนวน", itemIndex: index });
        } else {
          errors.push({ field: "quantity", label: "จำนวน", itemIndex: index, message: "จำนวนต้องเป็นเลขเต็มตั้งแต่ 1 ขึ้นไป" });
        }
      } else {
        item.quantity = Number(item.quantity);
      }
    });

    const recipient = draft.recipient || {};
    if (!String(recipient.name || "").trim()) missing.push({ field: "recipient.name", label: "ชื่อผู้รับ", itemIndex: null });
    if (!String(recipient.phone || "").trim()) {
      missing.push({ field: "recipient.phone", label: "เบอร์โทร", itemIndex: null });
    } else if (!/^0\d{9}$/.test(String(recipient.phone).replace(/[\s-]/g, ""))) {
      errors.push({ field: "recipient.phone", label: "เบอร์โทร", itemIndex: null, message: "เบอร์โทรตัวอย่างต้องมี 10 หลักและขึ้นต้นด้วย 0" });
    }
    if (!String(recipient.address || "").trim()) missing.push({ field: "recipient.address", label: "ที่อยู่", itemIndex: null });

    const status = errors.length || ambiguous.length ? "review" : missing.length ? "needs_info" : "ready";
    draft.missing = missing;
    draft.ambiguous = ambiguous;
    draft.validationErrors = errors;
    draft.status = draft.confirmedAt ? "confirmed" : status;

    return {
      status,
      missing,
      ambiguous,
      errors,
      canConfirm: status === "ready" && !draft.confirmedAt
    };
  }

  orderPilot.domain = { createDraft, matchProduct, validateDraft, createMessage, normalize, findColor };
})();

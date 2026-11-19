(function () {
  const orderPilot = (window.OrderPilot = window.OrderPilot || {});
  const storageKey = "orderpilot-demo-v1";
  let memoryDrafts = [];
  let storageMode = "local";
  let storageMessage = "บันทึกตัวอย่างไว้ในเบราว์เซอร์นี้เท่านั้น";

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function switchToSession(message) {
    storageMode = "session";
    storageMessage = message || "พื้นที่บันทึกในเบราว์เซอร์ใช้ไม่ได้ ข้อมูลจะอยู่จนกว่าจะปิดหน้านี้";
  }

  function readDrafts() {
    if (storageMode === "session") return clone(memoryDrafts);
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) {
        memoryDrafts = [];
        return [];
      }
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.schemaVersion !== 1 || !Array.isArray(parsed.drafts)) {
        switchToSession("ข้อมูลบันทึกเดิมอ่านไม่ได้ เซสชันนี้ยังแก้ร่างได้ และจะไม่เขียนทับข้อมูลเดิม");
        return clone(memoryDrafts);
      }
      memoryDrafts = parsed.drafts;
      storageMode = "local";
      storageMessage = "บันทึกตัวอย่างไว้ในเบราว์เซอร์นี้เท่านั้น";
      return clone(memoryDrafts);
    } catch (error) {
      switchToSession("เบราว์เซอร์ปิดกั้นพื้นที่บันทึก ข้อมูลจะอยู่จนกว่าจะปิดหน้านี้");
      return clone(memoryDrafts);
    }
  }

  function writeDrafts(drafts) {
    memoryDrafts = clone(drafts);
    if (storageMode === "session") {
      return { ok: true, storageMode, message: storageMessage };
    }
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({ schemaVersion: 1, drafts: memoryDrafts }));
      storageMode = "local";
      storageMessage = "บันทึกตัวอย่างไว้ในเบราว์เซอร์นี้เท่านั้น";
      return { ok: true, storageMode, message: storageMessage };
    } catch (error) {
      switchToSession("เบราว์เซอร์บันทึกข้อมูลไม่ได้ ร่างนี้ยังใช้ได้จนกว่าจะปิดหน้านี้");
      return { ok: true, storageMode, message: storageMessage };
    }
  }

  function load() {
    return { drafts: readDrafts(), storageMode, message: storageMessage };
  }

  function save(draft, expectedVersion) {
    const drafts = readDrafts();
    const index = drafts.findIndex((entry) => entry.draftId === draft.draftId);
    const current = index >= 0 ? drafts[index] : null;
    if (current && current.confirmedAt) {
      return { ok: true, draft: current, storageMode, message: "ร่างนี้ยืนยันแล้วและเก็บไว้ในประวัติ" };
    }

    const currentVersion = current ? Number(current.version) || 0 : 0;
    if (Number(expectedVersion) !== currentVersion) {
      return {
        ok: false,
        draft: current,
        storageMode,
        message: "ร่างนี้มีการเปลี่ยนแปลงแล้ว โหลดร่างล่าสุดก่อนบันทึกต่อ"
      };
    }

    const saved = clone(draft);
    saved.version = currentVersion + 1;
    saved.updatedAt = new Date().toISOString();
    if (index >= 0) drafts[index] = saved;
    else drafts.unshift(saved);
    const result = writeDrafts(drafts);
    return { ok: result.ok, draft: saved, storageMode: result.storageMode, message: result.message };
  }

  function confirm(draftId, expectedVersion) {
    const drafts = readDrafts();
    const index = drafts.findIndex((entry) => entry.draftId === draftId);
    if (index < 0) return { ok: false, draft: null, storageMode, message: "ไม่พบร่างทดลองนี้ ลองเลือกสถานการณ์ใหม่" };
    const current = drafts[index];
    if (current.confirmedAt) return { ok: true, draft: current, storageMode, message: "ร่างนี้ยืนยันแล้ว ไม่มีการสร้างรายการซ้ำ" };
    if (Number(expectedVersion) !== Number(current.version)) {
      return { ok: false, draft: current, storageMode, message: "ร่างเปลี่ยนไปแล้ว โหลดข้อมูลล่าสุดก่อนยืนยัน" };
    }

    const next = clone(current);
    const validation = orderPilot.domain.validateDraft(next, orderPilot.catalog);
    if (!validation.canConfirm) {
      return {
        ok: false,
        draft: current,
        validation,
        storageMode,
        message: "ยังยืนยันไม่ได้ ตรวจข้อมูลที่ขาดหรือรายการที่ต้องเลือกก่อน"
      };
    }

    next.confirmedAt = new Date().toISOString();
    next.status = "confirmed";
    next.version += 1;
    next.updatedAt = next.confirmedAt;
    drafts[index] = next;
    const result = writeDrafts(drafts);
    return { ok: result.ok, draft: next, validation, storageMode: result.storageMode, message: "ยืนยันร่างตัวอย่างแล้ว" };
  }

  function reset() {
    memoryDrafts = [];
    try {
      window.localStorage.removeItem(storageKey);
      storageMode = "local";
      storageMessage = "ล้างข้อมูลตัวอย่างจากเบราว์เซอร์นี้แล้ว";
      return { ok: true, message: storageMessage, storageMode };
    } catch (error) {
      switchToSession("ล้างข้อมูลตัวอย่างของเซสชันนี้แล้ว แต่เบราว์เซอร์ไม่อนุญาตให้ลบข้อมูลเดิมที่บันทึกไว้");
      return { ok: true, message: storageMessage, storageMode };
    }
  }

  orderPilot.store = { load, save, confirm, reset, storageKey };
})();

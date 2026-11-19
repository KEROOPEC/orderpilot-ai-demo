(function () {
  const orderPilot = (window.OrderPilot = window.OrderPilot || {});

  orderPilot.scenarios = [
    {
      id: "missing-size",
      title: "ถามไซซ์ที่ขาด",
      description: "เริ่มจากสีและจำนวน แล้วรับคำตอบในแชตเดิม",
      initialMessage: "ขอเสื้อรุ่น Breeze สีฟ้า 2 ตัวค่ะ",
      replyExample: "M ทั้งคู่ เปลี่ยนเป็น 3 ตัว",
      expectedAction: "ตอบไซซ์และตรวจจำนวน"
    },
    {
      id: "change-item",
      title: "แก้สีและจำนวน",
      description: "คำตอบใหม่แก้สินค้าชิ้นเดิม ไม่เพิ่มรายการซ้ำ",
      initialMessage: "ขอเสื้อรุ่น Breeze สีฟ้า ไซซ์ S 2 ตัว",
      replyExample: "เปลี่ยนเป็นสีชมพู ไซซ์ M 1 ตัว",
      expectedAction: "ตรวจว่าร่างเดิมถูกแก้"
    },
    {
      id: "add-item",
      title: "เพิ่มสินค้าอีกชิ้น",
      description: "ใช้คำว่า “เพิ่ม” เพื่อสร้างรายการใหม่อย่างชัดเจน",
      initialMessage: "ขอเสื้อรุ่น Breeze สีฟ้า ไซซ์ M 1 ตัว",
      replyExample: "เพิ่มเสื้อ Mira สีขาว ไซซ์ L อีก 1 ตัว",
      expectedAction: "ตรวจว่ามีสองรายการ"
    },
    {
      id: "ambiguous-product",
      title: "ชื่อสินค้ากำกวม",
      description: "รุ่น A ตรงกับสินค้าตัวอย่างสองรายการ ต้องเลือกเอง",
      initialMessage: "ขอเสื้อรุ่น A สีฟ้า ไซซ์ L 1 ตัว",
      replyExample: "เลือกรายการที่ตรงจากเมนูสินค้าในร่าง",
      expectedAction: "เลือกรายการก่อนยืนยัน"
    },
    {
      id: "complete-order",
      title: "ออเดอร์ข้อมูลครบ",
      description: "เห็นร่างพร้อมยืนยันจากข้อมูลสังเคราะห์ครบชุด",
      initialMessage: "ขอเสื้อ Mira สีครีม ไซซ์ M 1 ตัว ชื่อเมย์ เบอร์ 0812345678 ที่อยู่ 88/1 ถนนตัวอย่าง กรุงเทพฯ 10000",
      replyExample: "ข้อมูลครบแล้ว ทดลองแก้หรือยืนยันร่างได้",
      expectedAction: "ตรวจที่มาของฟิลด์ก่อนยืนยัน"
    },
    {
      id: "operation-error",
      title: "จำลองข้อผิดพลาด",
      description: "จำลองระบบขัดข้องโดยเก็บข้อความและร่างเดิมไว้",
      initialMessage: "ขอเสื้อรุ่น Mira สีขาว ไซซ์ S 1 ตัว",
      replyExample: "กดปุ่มจำลองข้อผิดพลาดเพื่อดูการกู้คืน",
      expectedAction: "ลองจำลองข้อผิดพลาด"
    }
  ];
})();

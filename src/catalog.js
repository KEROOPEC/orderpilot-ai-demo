(function () {
  const orderPilot = (window.OrderPilot = window.OrderPilot || {});

  const catalog = [
    {
      id: "breeze",
      sku: "OP-BL-310",
      name: "เสื้อเบลาส์ Breeze",
      category: "เสื้อ",
      aliases: ["Breeze", "รุ่น Breeze", "เสื้อ Breeze", "บรีซ"],
      priceTHB: 690,
      synthetic: true,
      colors: [
        { value: "ฟ้า", aliases: ["ฟ้า", "สีฟ้า", "ฟ้าอ่อน", "sky"] },
        { value: "ชมพู", aliases: ["ชมพู", "สีชมพู", "pink"] },
        { value: "ครีม", aliases: ["ครีม", "สีครีม", "cream"] }
      ],
      sizes: ["S", "M", "L"]
    },
    {
      id: "mira",
      sku: "OP-TS-205",
      name: "เสื้อยืด Mira",
      category: "เสื้อ",
      aliases: ["Mira", "รุ่น Mira", "เสื้อ Mira", "มีรา"],
      priceTHB: 490,
      synthetic: true,
      colors: [
        { value: "ขาว", aliases: ["ขาว", "สีขาว", "white"] },
        { value: "ดำ", aliases: ["ดำ", "สีดำ", "black"] },
        { value: "ครีม", aliases: ["ครีม", "สีครีม", "cream"] }
      ],
      sizes: ["S", "M", "L", "XL"]
    },
    {
      id: "classic-a",
      sku: "OP-TS-101",
      name: "เสื้อยืดคลาสสิก A",
      category: "เสื้อ",
      aliases: ["รุ่น A", "เสื้อ A", "คลาสสิก A"],
      priceTHB: 390,
      synthetic: true,
      colors: [
        { value: "ฟ้า", aliases: ["ฟ้า", "สีฟ้า", "ฟ้าอ่อน"] },
        { value: "ขาว", aliases: ["ขาว", "สีขาว"] },
        { value: "ดำ", aliases: ["ดำ", "สีดำ"] }
      ],
      sizes: ["S", "M", "L"]
    },
    {
      id: "aline-a",
      sku: "OP-TS-102",
      name: "เสื้อ A-line",
      category: "เสื้อ",
      aliases: ["รุ่น A", "เสื้อ A", "A-line", "เอไลน์"],
      priceTHB: 590,
      synthetic: true,
      colors: [
        { value: "ฟ้า", aliases: ["ฟ้า", "สีฟ้า", "ฟ้าอ่อน"] },
        { value: "ชมพู", aliases: ["ชมพู", "สีชมพู"] },
        { value: "ครีม", aliases: ["ครีม", "สีครีม"] }
      ],
      sizes: ["M", "L", "XL"]
    }
  ];

  orderPilot.catalog = catalog;
})();

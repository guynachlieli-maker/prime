/*
 * הגדרות החנות. זה הקובץ היחיד שצריך למלא כדי שהאתר יחבר קניות אמיתיות לשופיפיי.
 * התשלום עצמו (כרטיס אשראי, Apple Pay, Google Pay, Bit דרך ספק סליקה) קורה בקופה המאובטחת של Shopify.
 * האתר לא רואה ולא שומר אף פרט אשראי.
 */
window.STORE_CONFIG = {
  brand: "שלווה",
  brandLatin: "SHALVA",

  shopify: {
    // הדומיין של החנות, למשל "shalva-il.myshopify.com"
    domain: "",
    // Storefront API public access token (Shopify Admin > Settings > Apps > Develop apps / Headless channel)
    storefrontToken: "",
    apiVersion: "2025-10",
    // קוד הנחה שיוחל אוטומטית בקופה (לא חובה). חייב להיות קיים בשופיפיי.
    autoDiscountCode: ""
  },

  // כל חבילה = וריאנט נפרד במוצר בשופיפיי, עם המחיר שלו.
  // את ה־variantId מעתיקים מהמוצר בשופיפיי, בפורמט gid://shopify/ProductVariant/1234567890
  bundles: [
    { key: "1", qty: 1, title: "מכשיר אחד",                 price: 249, compareAt: 399, badge: "",              variantId: "" },
    { key: "2", qty: 2, title: "זוג: לך ולמישהו שאתה אוהב", price: 429, compareAt: 798, badge: "הכי משתלם",     variantId: "", default: true },
    { key: "3", qty: 3, title: "שלישייה למשפחה",            price: 579, compareAt: 1197, badge: "חיסכון מקסימלי", variantId: "" }
  ],

  // מועד אחרון להזמנה שמגיעה לפני חנוכה (חנוכה 2026 מתחילה בערב 4.12.2026).
  // שנו לפי זמני המשלוח האמיתיים של הספק שלכם. אחרי התאריך הפס פשוט נעלם.
  giftDeadline: "2026-11-29T23:59:00+02:00",
  giftDeadlineLabel: "להזמנות שיגיעו לפני חנוכה",

  shippingDays: "3-7 ימי עסקים",
  guaranteeDays: 30,

  contact: {
    whatsapp: "",            // למשל "972501234567"
    email: "",               // למשל "hello@shalva.co.il"
    businessName: "",        // שם העסק הרשום / עוסק מורשה
    businessId: "",          // מספר עוסק / ח.פ.
    address: ""
  },

  // ביקורות אמיתיות בלבד, מלקוחות שקנו בפועל (או חברו אפליקציה כמו Judge.me).
  // כל עוד הרשימה ריקה, אזור הביקורות לא מוצג. אסור לפרסם ביקורות מומצאות.
  // דוגמת מבנה: { name: "מיכל, חיפה", rating: 5, text: "...", verified: true }
  reviews: [],

  tracking: {
    metaPixelId: "",   // Facebook / Instagram
    ga4Id: "",         // Google Analytics 4, למשל "G-XXXXXXX"
    tiktokPixelId: ""
  }
};

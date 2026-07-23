// Seed data. Real settlement names of Gush Katif and Northern Samaria,
// with approximate geographic coordinates (lat/lng) for the Leaflet map.
// Coordinates are approximations for a memorial map, not survey-grade.
// One settlement (Neve Dekalim) carries rich sample content as a template.

const now = 1690000000000 // fixed timestamp; runtime clock is unavailable at build

export const REGIONS = {
  gush_katif: {
    id: 'gush_katif',
    name: 'גוש קטיף',
    subtitle: 'רצועת החוף הדרומית',
    blurb:
      'גוש של 17 יישובים חקלאיים לאורך חופה הדרומי־מערבי של רצועת עזה. כ־8,600 תושבים, חקלאות ייצוא פורחת, וקהילות דתיות שהוקמו מסוף שנות ה־70. פונו באוגוסט 2005.',
  },
  northern_samaria: {
    id: 'northern_samaria',
    name: 'צפון השומרון',
    subtitle: 'ארבעה יישובים',
    blurb:
      'ארבעה יישובים בצפון השומרון — חומש, שא־נור, גנים וקדים — שפונו אף הם במסגרת תוכנית ההתנתקות באוגוסט 2005.',
  },
}

/** @type {import('./types.js').Settlement[]} */
export const SETTLEMENTS = [
  {
    id: 'neve-dekalim',
    name: 'נווה דקלים',
    region: 'gush_katif',
    lat: 31.353,
    lng: 34.268,
    population: 2600,
    founded: 1983,
    evacuatedTo: 'ניצן, אשקלון ומרכזי קליטה זמניים',
    tagline: 'בירת גוש קטיף',
    moderators: ['מודרטור נווה דקלים'],
    info: [
      {
        key: 'general',
        body: 'היישוב הגדול בגוש קטיף ומרכזו האזורי. שכנו בו מוסדות הגוש, ישיבות, אולפנות ומרכז מסחרי. כ־500 משפחות.',
        media: [],
      },
      {
        key: 'agriculture',
        body: 'חממות ירקות ופרחים ליצוא, עגבניות שרי, תבלינים ועלים ירוקים נטולי חרקים ("עלי קטיף").',
        media: [],
      },
      {
        key: 'education',
        body: 'ישיבת תורה והארץ, אולפנת בני עקיבא, בתי ספר יסודיים וגני ילדים.',
        media: [],
      },
      {
        key: 'community',
        body: 'קהילה דתית־לאומית מגובשת, בתי כנסת רבים, מתנ"ס ומרכז אזורי.',
        media: [],
      },
      {
        key: 'commerce',
        body: 'מרכז מסחרי אזורי ששירת את כל יישובי הגוש: מכולת, בנק, מרפאה, מוסך ובתי מלאכה.',
        media: [],
      },
    ],
    pois: [
      {
        id: 'nd-home-1',
        settlementId: 'neve-dekalim',
        title: 'בית משפחת לדוגמה',
        lat: 31.3535,
        lng: 34.269,
        authorName: 'משפחת לדוגמה',
        before: [
          {
            id: 'm1',
            type: 'text',
            body: 'בנינו את הבית בשנת 1990. גידלנו חמישה ילדים על החולות מול הים. בכל בוקר היינו יוצאים לחממות עם הזריחה.',
            authorName: 'משפחת לדוגמה',
            createdAt: now,
            status: 'approved',
          },
        ],
        during: [
          {
            id: 'm2',
            type: 'text',
            timeLabel: '06:30',
            approximate: false,
            body: 'הקצין דפק בדלת. נתנו לנו זמן לארוז. הילדים לא הבינו מה קורה.',
            authorName: 'משפחת לדוגמה',
            createdAt: now,
            status: 'approved',
          },
          {
            id: 'm3',
            type: 'text',
            timeLabel: '11:00',
            approximate: true,
            body: 'העמסנו את הארגזים האחרונים. עצרנו רגע ליד עץ הזית שנטענו ביום שנולדה הבת הבכורה.',
            authorName: 'משפחת לדוגמה',
            createdAt: now,
            status: 'approved',
          },
        ],
        after: [
          {
            id: 'd1',
            dateLabel: 'ספטמבר 2005',
            title: 'מלון ומרכז קליטה',
            description: 'שלושה שבועות בחדר מלון עם חמישה ילדים, בלי לדעת לאן ממשיכים.',
            media: [],
          },
          {
            id: 'd2',
            dateLabel: '2009',
            title: 'בית קבע בניצן',
            description: 'אחרי ארבע שנים בקרוואן נכנסנו סוף סוף לבית קבע. הקהילה נשארה יחד.',
            media: [],
          },
        ],
      },
    ],
  },
  { id: 'netzer-hazani', name: 'נצר חזני', region: 'gush_katif', lat: 31.358, lng: 34.272, population: 400, founded: 1977, moderators: [], info: [], pois: [] },
  { id: 'gadid', name: 'גדיד', region: 'gush_katif', lat: 31.347, lng: 34.27, population: 350, founded: 1982, moderators: [], info: [], pois: [] },
  { id: 'gan-or', name: 'גן אור', region: 'gush_katif', lat: 31.351, lng: 34.276, population: 350, founded: 1983, moderators: [], info: [], pois: [] },
  { id: 'katif', name: 'קטיף', region: 'gush_katif', lat: 31.36, lng: 34.28, population: 350, founded: 1985, moderators: [], info: [], pois: [] },
  { id: 'ganei-tal', name: 'גני טל', region: 'gush_katif', lat: 31.362, lng: 34.274, population: 400, founded: 1979, moderators: [], info: [], pois: [] },
  { id: 'bedolah', name: 'בדולח', region: 'gush_katif', lat: 31.33, lng: 34.26, population: 220, founded: 1986, moderators: [], info: [], pois: [] },
  { id: 'atzmona', name: 'עצמונה', region: 'gush_katif', lat: 31.305, lng: 34.305, population: 700, founded: 1979, moderators: [], info: [], pois: [] },
  { id: 'kfar-yam', name: 'כפר ים', region: 'gush_katif', lat: 31.355, lng: 34.262, population: 40, founded: 1983, moderators: [], info: [], pois: [] },
  { id: 'kfar-darom', name: 'כפר דרום', region: 'gush_katif', lat: 31.405, lng: 34.348, population: 350, founded: 1989, moderators: [], info: [], pois: [] },
  { id: 'morag', name: 'מורג', region: 'gush_katif', lat: 31.285, lng: 34.32, population: 250, founded: 1972, moderators: [], info: [], pois: [] },
  { id: 'netzarim', name: 'נצרים', region: 'gush_katif', lat: 31.455, lng: 34.425, population: 500, founded: 1984, moderators: [], info: [], pois: [] },
  { id: 'peat-sadeh', name: 'פאת שדה', region: 'gush_katif', lat: 31.335, lng: 34.255, population: 120, founded: 1989, moderators: [], info: [], pois: [] },
  { id: 'rafiah-yam', name: 'רפיח ים', region: 'gush_katif', lat: 31.315, lng: 34.245, population: 130, founded: 1984, moderators: [], info: [], pois: [] },
  { id: 'shirat-hayam', name: 'שירת הים', region: 'gush_katif', lat: 31.348, lng: 34.26, population: 40, founded: 2001, moderators: [], info: [], pois: [] },
  { id: 'tel-katifa', name: 'תל קטיפא', region: 'gush_katif', lat: 31.365, lng: 34.285, population: 60, founded: 1992, moderators: [], info: [], pois: [] },
  { id: 'elei-sinai', name: 'אלי סיני', region: 'gush_katif', lat: 31.565, lng: 34.535, population: 350, founded: 1983, moderators: [], info: [], pois: [] },
  { id: 'dugit', name: 'דוגית', region: 'gush_katif', lat: 31.555, lng: 34.525, population: 80, founded: 1990, moderators: [], info: [], pois: [] },
  { id: 'nisanit', name: 'ניסנית', region: 'gush_katif', lat: 31.575, lng: 34.545, population: 1100, founded: 1982, moderators: [], info: [], pois: [] },

  { id: 'homesh', name: 'חומש', region: 'northern_samaria', lat: 32.303, lng: 35.187, population: 200, founded: 1980, moderators: [], info: [], pois: [] },
  { id: 'sa-nur', name: 'שא־נור', region: 'northern_samaria', lat: 32.36, lng: 35.24, population: 100, founded: 1982, moderators: [], info: [], pois: [] },
  { id: 'ganim', name: 'גנים', region: 'northern_samaria', lat: 32.435, lng: 35.275, population: 150, founded: 1983, moderators: [], info: [], pois: [] },
  { id: 'kadim', name: 'קדים', region: 'northern_samaria', lat: 32.445, lng: 35.29, population: 160, founded: 1983, moderators: [], info: [], pois: [] },
]

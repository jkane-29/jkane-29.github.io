// ── Fridge layout ─────────────────────────────────────────────
// Where every magnet sits, as % of the fridge photo. To rearrange: open the
// site with ?edit, drag things around, press "Copy layout" and paste the
// ITEMS / TTT_POS it gives you over the ones below (VIEWS_POS goes in
// styles.css, under the page-views sticky note).
//
// Per item: src (image) or embed (live iframe); href opens in the fridge
// window (http links open a new tab); windowEmbed opens a whole app in the
// window; hoverLabel shows on hover; passthrough lets clicks fall through.
let ITEMS = [
  {"id":"item_1779583589922","src":"items/bike-business.webp","top":38.205,"left":28.992,"width":20.3,"rotate":0,"href":"rides.html","hoverLabel":"Rides","windowTitle":"Best Rides"},
  {"id":"item_1779583606062","src":"items/furniture.webp","top":21.122,"left":26.421,"width":9.442,"rotate":0,"href":"woodshop/","hoverLabel":null,"windowTitle":"Woodshop"},
  {"id":"item_1779583643716","src":"items/greeting.webp","aspect":"507 / 800","daily":["items/greeting.webp","items/about-gallery/01-grotte-de-han.webp","items/about-gallery/02-mount-rushmore.webp","items/about-gallery/03-empire-state.webp","items/about-gallery/04-semmering.webp","items/about-gallery/05-sagrada-familia.webp","items/about-gallery/06-wilshire-blvd.webp"],"top":9.908,"left":49.123,"width":13,"rotate":0,"href":"about.html","hoverLabel":null,"windowTitle":"About Me"},
  {"id":"item_1779586060280","src":"items/tj-receipt.webp","top":10.299,"left":63.313,"width":9,"rotate":0,"href":"https://tj-prices.com","hoverLabel":"TJ Prices"},
  {"id":"item_1781388702732","src":"items/about-me.png","top":9.922,"left":48.594,"width":13.9,"rotate":0,"href":null,"hoverLabel":null,"passthrough":true},
  {"id":"item_rides_map","embed":"/rides/fridge.html?v=86b965a3","fluid":true,"aspect":"4 / 5","top":35.67,"left":53.68,"width":17.2,"rotate":0,"href":"https://www.jackkane.me/rides/","hoverLabel":"Best Rides Chi","square":true},
  {"id":"item_amtrak","embed":"/amtrak/map.html?embed=1&v=3489060a","fluid":true,"aspect":"50 / 33","top":9.759,"left":26.152,"width":23,"rotate":0,"windowEmbed":"/amtrak/map.html?v=3489060a","windowTitle":"Live Amtrak","hoverLabel":"Live Amtrak"},
  {"id":"item_1781393177283","src":"items/shopping.png","top":38.729,"left":38.306,"width":2,"rotate":0,"href":null,"hoverLabel":null},
  {"id":"item_1786000000001","src":"items/writing.png","top":17.993,"left":24.271,"width":11.5,"rotate":0,"href":"writing/writing.html","hoverLabel":null,"windowTitle":"Writing"},
  {"id":"item_clockclock24","embed":"/ClockClock24/index.html?v=2448fcd5","aspect":"8 / 3","top":23.345,"left":46.158,"width":29.2,"rotate":0,"href":"https://github.com/ArnaudSpanneut/ClockClock24","hoverLabel":null},
  {"id":"item_email_me","src":"items/send-a-note.webp","top":20.977,"left":62.285,"width":11.66,"rotate":0,"href":"postcard/postcard.html","hoverLabel":null,"windowTitle":"Send a Note"},
  {"id":"item_1788007465835","src":"items/shopping.png","top":36.957,"left":61.821,"width":2,"rotate":0,"href":null,"hoverLabel":null}
];

// Tic-tac-toe board position (draggable in edit mode)
const TTT_POS = { top: 19.545, left: 37.545, width: 10.135 };

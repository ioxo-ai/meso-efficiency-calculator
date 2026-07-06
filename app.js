const HUNDRED_MESO = 100_000_000;
const TEN_THOUSAND_KRW = 10_000;
const STORAGE_KEY = "maple-meso-efficiency-v1";

const DEFAULTS = {
  bankPricePerHundredM: 1950,
  marketPointPerHundredM: 2600,
  targetEok: 1,
  pcReceiveRate: 97,
  homeReceiveRate: 95,
  maplePointKrw: 90000,
  maplePointAmount: 100000,
  nexonCashKrw: 94000,
  nexonCashAmount: 100000,
  bundleCashCost: 10000,
  bundleMaplePoint: 10000,
  elixirCount: 100,
  elixirMesoEach: 18500
};

const inputs = Object.fromEntries(
  Object.keys(DEFAULTS).map((key) => [key, document.querySelector(`#${key}`)])
);

const resetButton = document.querySelector("#resetButton");
const bestCost = document.querySelector("#bestCost");
const bestRoute = document.querySelector("#bestRoute");
const targetCost = document.querySelector("#targetCost");
const targetRoute = document.querySelector("#targetRoute");
const mesoPerBudget = document.querySelector("#mesoPerBudget");
const budgetRoute = document.querySelector("#budgetRoute");
const routeList = document.querySelector("#routeList");
const comparisonBody = document.querySelector("#comparisonBody");
const calculationNotes = document.querySelector("#calculationNotes");
const updatedLabel = document.querySelector("#updatedLabel");

function toNumber(value, fallback) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function readStoredValues() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function storeValues(config) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    // Ignore private mode and quota failures.
  }
}

function setInputs(config) {
  for (const [key, input] of Object.entries(inputs)) {
    input.value = config[key];
  }
}

function getConfig() {
  const config = {};

  for (const [key, input] of Object.entries(inputs)) {
    config[key] = toNumber(input.value, DEFAULTS[key]);
  }

  config.bankPricePerHundredM = Math.max(1, config.bankPricePerHundredM);
  config.marketPointPerHundredM = Math.max(1, config.marketPointPerHundredM);
  config.targetEok = Math.max(0.01, config.targetEok);
  config.pcReceiveRate = Math.max(0, Math.min(100, config.pcReceiveRate));
  config.homeReceiveRate = Math.max(0, Math.min(100, config.homeReceiveRate));
  config.maplePointKrw = Math.max(1, config.maplePointKrw);
  config.maplePointAmount = Math.max(1, config.maplePointAmount);
  config.nexonCashKrw = Math.max(1, config.nexonCashKrw);
  config.nexonCashAmount = Math.max(1, config.nexonCashAmount);
  config.bundleCashCost = Math.max(1, config.bundleCashCost);
  config.bundleMaplePoint = Math.max(0, config.bundleMaplePoint);
  config.elixirCount = Math.max(0, config.elixirCount);
  config.elixirMesoEach = Math.max(0, config.elixirMesoEach);

  return config;
}

function routeFromBase({ id, name, group, krwSpent, netMeso, summary, detail }) {
  const eokReceived = netMeso / HUNDRED_MESO;
  const costPerHundredM = krwSpent / eokReceived;

  return {
    id,
    name,
    group,
    krwSpent,
    netMeso,
    costPerHundredM,
    mesoPerKrw: netMeso / krwSpent,
    summary,
    detail
  };
}

function calculateRoutes(config) {
  const bankGrossMeso = HUNDRED_MESO;
  const pcNetMeso = bankGrossMeso * (config.pcReceiveRate / 100);
  const homeNetMeso = bankGrossMeso * (config.homeReceiveRate / 100);

  const directMaplePointMeso =
    (config.maplePointAmount / config.marketPointPerHundredM) * HUNDRED_MESO;

  const bundleCount = config.nexonCashAmount / config.bundleCashCost;
  const bundleMaplePoint = bundleCount * config.bundleMaplePoint;
  const bundleElixirCount = bundleCount * config.elixirCount;
  const bundleMarketMeso = (bundleMaplePoint / config.marketPointPerHundredM) * HUNDRED_MESO;
  const bundleElixirMeso = bundleElixirCount * config.elixirMesoEach;
  const bundleTotalMeso = bundleMarketMeso + bundleElixirMeso;

  return [
    routeFromBase({
      id: "bank-pc",
      name: "무통장 거래 · PC방",
      group: "무통장",
      krwSpent: config.bankPricePerHundredM,
      netMeso: pcNetMeso,
      summary: `${formatWon(config.bankPricePerHundredM)} 결제 후 ${formatEok(pcNetMeso)} 수령`,
      detail: `1억 메소 구매분에 PC방 수령률 ${formatPercent(config.pcReceiveRate)} 적용`
    }),
    routeFromBase({
      id: "bank-home",
      name: "무통장 거래 · 일반",
      group: "무통장",
      krwSpent: config.bankPricePerHundredM,
      netMeso: homeNetMeso,
      summary: `${formatWon(config.bankPricePerHundredM)} 결제 후 ${formatEok(homeNetMeso)} 수령`,
      detail: `1억 메소 구매분에 일반 수령률 ${formatPercent(config.homeReceiveRate)} 적용`
    }),
    routeFromBase({
      id: "maple-point",
      name: "메이플포인트 직접 구매",
      group: "메소마켓",
      krwSpent: config.maplePointKrw,
      netMeso: directMaplePointMeso,
      summary: `${formatWon(config.maplePointKrw)} → ${formatPoint(config.maplePointAmount)} → ${formatEok(directMaplePointMeso)}`,
      detail: `${formatPoint(config.marketPointPerHundredM)}로 1억 메소 구매`
    }),
    routeFromBase({
      id: "nexon-package",
      name: "넥슨캐시 패키지",
      group: "메소마켓",
      krwSpent: config.nexonCashKrw,
      netMeso: bundleTotalMeso,
      summary: `${formatWon(config.nexonCashKrw)} → ${formatPoint(bundleMaplePoint)} + 엘릭서 ${formatCount(bundleElixirCount)}개`,
      detail: `포인트 환산 ${formatEok(bundleMarketMeso)} + 엘릭서 판매 ${formatEok(bundleElixirMeso)}`
    })
  ].sort((a, b) => a.costPerHundredM - b.costPerHundredM);
}

function formatWon(value, digits = 0) {
  return `${value.toLocaleString("ko-KR", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits
  })}원`;
}

function formatPoint(value) {
  return `${Math.round(value).toLocaleString("ko-KR")}P`;
}

function formatCash(value) {
  return `${Math.round(value).toLocaleString("ko-KR")}캐시`;
}

function formatCount(value) {
  return Math.round(value).toLocaleString("ko-KR");
}

function formatPercent(value) {
  return `${value.toLocaleString("ko-KR", { maximumFractionDigits: 1 })}%`;
}

function formatEok(meso) {
  const eok = meso / HUNDRED_MESO;
  const digits = eok >= 100 ? 1 : eok >= 10 ? 2 : 3;

  return `${eok.toLocaleString("ko-KR", {
    maximumFractionDigits: digits,
    minimumFractionDigits: eok < 1 ? 3 : 0
  })}억`;
}

function formatMesoPerKrw(value) {
  return `${Math.round(value).toLocaleString("ko-KR")} 메소/원`;
}

function getDelta(route, best) {
  if (route.id === best.id) {
    return {
      label: "최저",
      detail: "기준",
      className: "best"
    };
  }

  const wonGap = route.costPerHundredM - best.costPerHundredM;
  const percentGap = (wonGap / best.costPerHundredM) * 100;

  return {
    label: `+${formatPercent(percentGap)}`,
    detail: `1억당 +${formatWon(wonGap)}`,
    className: "more"
  };
}

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function renderRouteCards(routes, config) {
  routeList.replaceChildren();
  const best = routes[0];

  routes.forEach((route, index) => {
    const delta = getDelta(route, best);
    const card = makeElement("article", `route-card ${route.id === best.id ? "is-best" : ""}`);

    const rank = makeElement("div", "rank-badge", String(index + 1));
    const body = makeElement("div", "route-body");
    const heading = makeElement("div", "route-heading");
    const title = makeElement("h3", "", route.name);
    const group = makeElement("span", "route-group", route.group);
    const summary = makeElement("p", "route-summary", route.summary);
    const stats = makeElement("div", "route-stats");
    const cost = makeStat("1억 환산", formatWon(route.costPerHundredM));
    const target = makeStat(`${config.targetEok.toLocaleString("ko-KR")}억`, formatWon(route.costPerHundredM * config.targetEok));
    const budget = makeStat("1만원당", formatEok(route.mesoPerKrw * TEN_THOUSAND_KRW));
    const deltaBox = makeElement("div", `route-delta ${delta.className}`);

    deltaBox.append(makeElement("strong", "", delta.label), makeElement("span", "", delta.detail));
    heading.append(title, group);
    stats.append(cost, target, budget);
    body.append(heading, summary, stats);
    card.append(rank, body, deltaBox);
    routeList.append(card);
  });
}

function makeStat(label, value) {
  const item = makeElement("span", "stat");
  item.append(makeElement("strong", "", value), makeElement("small", "", label));
  return item;
}

function renderTable(routes, config) {
  comparisonBody.replaceChildren();
  const best = routes[0];

  for (const route of routes) {
    const delta = getDelta(route, best);
    const row = document.createElement("tr");
    const targetPrice = route.costPerHundredM * config.targetEok;

    row.append(
      makeCell(route.name, route.group),
      makeCell(formatWon(route.krwSpent), "기준 결제액"),
      makeCell(formatEok(route.netMeso), formatMesoPerKrw(route.mesoPerKrw)),
      makeCell(formatWon(route.costPerHundredM), "순수령 1억 기준"),
      makeCell(formatWon(targetPrice), `${config.targetEok.toLocaleString("ko-KR")}억 기준`),
      makeCell(delta.label, delta.detail, delta.className)
    );

    comparisonBody.append(row);
  }
}

function makeCell(primary, secondary, className = "") {
  const cell = document.createElement("td");
  if (className) cell.className = className;
  cell.append(makeElement("strong", "", primary));
  if (secondary) cell.append(makeElement("span", "", secondary));
  return cell;
}

function renderNotes(routes, config) {
  const byId = Object.fromEntries(routes.map((route) => [route.id, route]));
  const notes = [
    {
      title: "무통장 PC방",
      body: `${formatWon(config.bankPricePerHundredM)} ÷ ${formatPercent(config.pcReceiveRate)} = ${formatWon(byId["bank-pc"].costPerHundredM)} / 1억`
    },
    {
      title: "무통장 일반",
      body: `${formatWon(config.bankPricePerHundredM)} ÷ ${formatPercent(config.homeReceiveRate)} = ${formatWon(byId["bank-home"].costPerHundredM)} / 1억`
    },
    {
      title: "메이플포인트",
      body: `${formatWon(config.maplePointKrw)} ÷ (${formatPoint(config.maplePointAmount)} ÷ ${formatPoint(config.marketPointPerHundredM)}) = ${formatWon(byId["maple-point"].costPerHundredM)} / 1억`
    },
    {
      title: "넥슨캐시 패키지",
      body: `${formatCash(config.nexonCashAmount)} 기준 ${byId["nexon-package"].detail}, ${formatWon(byId["nexon-package"].costPerHundredM)} / 1억`
    }
  ];

  calculationNotes.replaceChildren();

  for (const note of notes) {
    const item = makeElement("article", "note");
    item.append(makeElement("h3", "", note.title), makeElement("p", "", note.body));
    calculationNotes.append(item);
  }
}

function render() {
  const config = getConfig();
  const routes = calculateRoutes(config);
  const best = routes[0];
  const marketBest = routes.find((route) => route.group === "메소마켓");

  bestCost.textContent = formatWon(best.costPerHundredM);
  bestRoute.textContent = best.name;
  targetCost.textContent = formatWon(best.costPerHundredM * config.targetEok);
  targetRoute.textContent = `${config.targetEok.toLocaleString("ko-KR")}억 기준 · ${best.name}`;
  mesoPerBudget.textContent = formatEok(best.mesoPerKrw * TEN_THOUSAND_KRW);
  budgetRoute.textContent = marketBest
    ? `메소마켓 최저 ${formatWon(marketBest.costPerHundredM)} / 1억`
    : best.name;

  renderRouteCards(routes, config);
  renderTable(routes, config);
  renderNotes(routes, config);

  updatedLabel.textContent = new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(new Date());

  storeValues(config);
}

function boot() {
  const stored = readStoredValues();
  setInputs({ ...DEFAULTS, ...stored });
  render();

  for (const input of Object.values(inputs)) {
    input.addEventListener("input", render);
  }

  resetButton.addEventListener("click", () => {
    setInputs(DEFAULTS);
    render();
  });
}

boot();

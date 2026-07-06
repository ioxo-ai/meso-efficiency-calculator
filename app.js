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
  elixirMesoEach: 18500,
  mvpSpendKrw: 300000,
  mvpRecoveredEok: 0,
  mvpDirectBenefitEok: 0,
  mvpHoursSaved: 0,
  mvpMesoPerHourEok: 0
};

const inputs = Object.fromEntries(
  Object.keys(DEFAULTS).map((key) => [key, document.querySelector(`#${key}`)])
);

const resetButton = document.querySelector("#resetButton");
const routeList = document.querySelector("#routeList");
const calculationNotes = document.querySelector("#calculationNotes");
const updatedLabel = document.querySelector("#updatedLabel");
const mvpSpendMeso = document.querySelector("#mvpSpendMeso");
const mvpBenefitMeso = document.querySelector("#mvpBenefitMeso");
const mvpNetMeso = document.querySelector("#mvpNetMeso");
const mvpOffsetRate = document.querySelector("#mvpOffsetRate");
const mvpFormula = document.querySelector("#mvpFormula");

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
  config.mvpSpendKrw = Math.max(0, config.mvpSpendKrw);
  config.mvpRecoveredEok = Math.max(0, config.mvpRecoveredEok);
  config.mvpDirectBenefitEok = Math.max(0, config.mvpDirectBenefitEok);
  config.mvpHoursSaved = Math.max(0, config.mvpHoursSaved);
  config.mvpMesoPerHourEok = Math.max(0, config.mvpMesoPerHourEok);

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

function formatMesoPerWon(value) {
  return `${Math.round(value).toLocaleString("ko-KR")}메소/원`;
}

function formatEok(meso) {
  const eok = meso / HUNDRED_MESO;
  const absEok = Math.abs(eok);
  const digits = absEok >= 100 ? 1 : absEok >= 10 ? 2 : 3;

  return `${eok.toLocaleString("ko-KR", {
    maximumFractionDigits: digits,
    minimumFractionDigits: absEok > 0 && absEok < 1 ? 3 : 0
  })}억`;
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
  const targetLabel = `${config.targetEok.toLocaleString("ko-KR")}억 받는 가격`;

  routes.forEach((route, index) => {
    const delta = getDelta(route, best);
    const card = makeElement("article", `compare-card ${route.id === best.id ? "is-best" : ""}`);

    const heading = makeElement("div", "compare-heading");
    const rank = makeElement("span", "rank-badge", String(index + 1));
    const title = makeElement("h3", "", route.name);
    const group = makeElement("span", "route-group", route.group);
    const price = makeElement("div", "compare-price");
    const stats = makeElement("div", "compare-stats");
    const detail = makeElement("p", "route-summary", route.summary);

    heading.append(rank, title, group);
    price.append(
      makeElement("span", "", targetLabel),
      makeElement("strong", "", formatWon(route.costPerHundredM * config.targetEok))
    );
    stats.append(
      makeStat("1만원당 수령", formatEok(route.mesoPerKrw * TEN_THOUSAND_KRW)),
      makeStat("최저 대비", route.id === best.id ? "최저" : delta.label),
      makeStat("기본 결제 수령", formatEok(route.netMeso))
    );
    card.append(heading, price, stats, detail);
    routeList.append(card);
  });
}

function makeStat(label, value) {
  const item = makeElement("span", "stat");
  item.append(makeElement("strong", "", value), makeElement("small", "", label));
  return item;
}

function renderNotes(routes, config) {
  const byId = Object.fromEntries(routes.map((route) => [route.id, route]));
  const notes = [
    {
      title: "무통장 PC방",
      body: `${formatWon(config.bankPricePerHundredM)}로 ${formatEok(byId["bank-pc"].netMeso)} 수령, 실수령 1억 가격 ${formatWon(byId["bank-pc"].costPerHundredM)}`
    },
    {
      title: "무통장 일반",
      body: `${formatWon(config.bankPricePerHundredM)}로 ${formatEok(byId["bank-home"].netMeso)} 수령, 실수령 1억 가격 ${formatWon(byId["bank-home"].costPerHundredM)}`
    },
    {
      title: "메이플포인트",
      body: `${formatWon(config.maplePointKrw)}로 ${formatEok(byId["maple-point"].netMeso)} 수령, 실수령 1억 가격 ${formatWon(byId["maple-point"].costPerHundredM)}`
    },
    {
      title: "넥슨캐시 패키지",
      body: `${formatCash(config.nexonCashAmount)} 기준 ${byId["nexon-package"].detail}, 실수령 1억 가격 ${formatWon(byId["nexon-package"].costPerHundredM)}`
    }
  ];

  calculationNotes.replaceChildren();

  for (const note of notes) {
    const item = makeElement("article", "note");
    item.append(makeElement("h3", "", note.title), makeElement("p", "", note.body));
    calculationNotes.append(item);
  }
}

function renderMvpValue(routes, config) {
  const best = routes[0];
  const spendMeso = config.mvpSpendKrw * best.mesoPerKrw;
  const recoveredMeso = config.mvpRecoveredEok * HUNDRED_MESO;
  const directBenefitMeso = config.mvpDirectBenefitEok * HUNDRED_MESO;
  const timeBenefitMeso = config.mvpHoursSaved * config.mvpMesoPerHourEok * HUNDRED_MESO;
  const totalBenefitMeso = directBenefitMeso + timeBenefitMeso;
  const baseCostMeso = spendMeso - recoveredMeso;
  const netCostMeso = baseCostMeso - totalBenefitMeso;
  const offsetRate = baseCostMeso > 0 ? (totalBenefitMeso / baseCostMeso) * 100 : 0;
  const netCostKrw = best.mesoPerKrw > 0 ? netCostMeso / best.mesoPerKrw : 0;

  mvpSpendMeso.textContent = formatEok(spendMeso);
  mvpBenefitMeso.textContent = formatEok(totalBenefitMeso);
  mvpNetMeso.textContent = `${formatEok(netCostMeso)} (${formatWon(netCostKrw)})`;
  mvpOffsetRate.textContent = formatPercent(offsetRate);
  mvpFormula.textContent =
    `순비용 = 지출 ${formatEok(spendMeso)} - 회수 ${formatEok(recoveredMeso)} - 혜택 ${formatEok(totalBenefitMeso)}. ` +
    `환산 기준은 현재 최저 경로인 ${best.name}의 ${formatMesoPerWon(best.mesoPerKrw)}입니다.`;
}

function render() {
  const config = getConfig();
  const routes = calculateRoutes(config);

  renderRouteCards(routes, config);
  renderMvpValue(routes, config);
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

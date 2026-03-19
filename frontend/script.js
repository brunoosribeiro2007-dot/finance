const API_URL = "/api";

let currentUser = JSON.parse(localStorage.getItem("currentUser")) || null;
let transactions = [];
let goals = [];
let categories = [];
let filters = {
  dateFrom: "",
  dateTo: ""
};

let monthlyBarChart = null;
let lineFlowChart = null;
let categoryChart = null;
let goalGaugeChart = null;
let radarChart = null;
let sparkIncome = null;
let sparkExpense = null;
let sparkProfit = null;
let sparkMargin = null;

const authScreen = document.getElementById("authScreen");
const app = document.getElementById("app");
const sidebar = document.getElementById("sidebar");
const menuToggle = document.getElementById("menuToggle");

const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const financeForm = document.getElementById("financeForm");
const goalForm = document.getElementById("goalForm");

const loginUsername = document.getElementById("loginUsername");
const loginPassword = document.getElementById("loginPassword");
const registerName = document.getElementById("registerName");
const registerUsername = document.getElementById("registerUsername");
const registerPassword = document.getElementById("registerPassword");

const financeTable = document.getElementById("financeTable");
const goalList = document.getElementById("goalList");
const cancelEditBtn = document.getElementById("cancelEditBtn");
const logoutBtn = document.getElementById("logoutBtn");

const categoryId = document.getElementById("categoryId");
const entryType = document.getElementById("entryType");


function formatCurrency(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function destroyChart(chartInstance) {
  if (chartInstance) chartInstance.destroy();
}

function buildQueryString() {
  const params = new URLSearchParams();
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);
  const query = params.toString();
  return query ? `?${query}` : "";
}

function getSummaryData() {
  const income = transactions
    .filter((item) => item.type === "income")
    .reduce((sum, item) => sum + Number(item.amount), 0);

  const expense = transactions
    .filter((item) => item.type === "expense")
    .reduce((sum, item) => sum + Number(item.amount), 0);

  const profit = income - expense;
  const margin = income > 0 ? ((profit / income) * 100).toFixed(1) : "0.0";

  return { income, expense, profit, margin };
}

function getMonthlyAggregation() {
  const monthlyMap = {};

  transactions.forEach((item) => {
    const key = item.transaction_date.slice(0, 7);

    if (!monthlyMap[key]) {
      monthlyMap[key] = { income: 0, expense: 0 };
    }

    if (item.type === "income") {
      monthlyMap[key].income += Number(item.amount);
    } else {
      monthlyMap[key].expense += Number(item.amount);
    }
  });

  const sortedKeys = Object.keys(monthlyMap).sort();

  return {
    labels: sortedKeys.map((key) => {
      const [year, month] = key.split("-");
      return `${month}/${year.slice(2)}`;
    }),
    income: sortedKeys.map((key) => monthlyMap[key].income),
    expense: sortedKeys.map((key) => monthlyMap[key].expense),
    profit: sortedKeys.map((key) => monthlyMap[key].income - monthlyMap[key].expense)
  };
}

function getCategoryExpenses() {
  const result = {};

  transactions
    .filter((item) => item.type === "expense")
    .forEach((item) => {
      const key = item.category_name || "Sem categoria";
      result[key] = (result[key] || 0) + Number(item.amount);
    });

  return result;
}

function chartScales() {
  return {
    x: {
      ticks: { color: "#6d819b" },
      grid: { display: false }
    },
    y: {
      ticks: { color: "#6d819b" },
      grid: { color: "rgba(168, 187, 214, 0.22)" }
    }
  };
}

function updateSummaryCards() {
  const { income, expense, profit, margin } = getSummaryData();

  document.getElementById("totalIncome").textContent = formatCurrency(income);
  document.getElementById("totalExpense").textContent = formatCurrency(expense);
  document.getElementById("netProfit").textContent = formatCurrency(profit);
  document.getElementById("profitMargin").textContent = `${margin}%`;

  document.getElementById("metricIncome").textContent = formatCurrency(income);
  document.getElementById("metricExpense").textContent = formatCurrency(expense);
  document.getElementById("metricProfit").textContent = formatCurrency(profit);

  const recurringCount = transactions.filter((item) => item.recurrence === "monthly").length;
  document.getElementById("metricRecurring").textContent = String(recurringCount);

  const welcomeUser = document.getElementById("welcomeUser");
  if (welcomeUser) {
    welcomeUser.textContent = currentUser ? `${currentUser.name} (@${currentUser.username})` : "Painel";
  }
}

function renderCategoryOptions(type = "income") {
  const filtered = categories.filter((item) => item.type === type);
  categoryId.innerHTML = `<option value="">Categoria</option>` +
    filtered.map((item) => `<option value="${item.id}">${item.name}</option>`).join("");
}

function renderTransactions() {
  financeTable.innerHTML = transactions.map((item) => {
    const typeLabel = item.type === "income" ? "Receita" : "Despesa";
    const recurrenceLabel = item.recurrence === "monthly" ? "Mensal" : "Avulsa";

    return `
      <tr>
        <td><span class="tag ${item.type === "income" ? "tag-income" : "tag-expense"}">${typeLabel}</span></td>
        <td>${item.category_name || "-"}</td>
        <td>${item.description}</td>
        <td>${recurrenceLabel}</td>
        <td>${new Date(item.transaction_date).toLocaleDateString("pt-BR")}</td>
        <td>${formatCurrency(item.amount)}</td>
        <td>
          <div class="actions">
            <button type="button" onclick="editTransaction(${item.id})">Editar</button>
            <button type="button" class="danger-btn" onclick="removeTransaction(${item.id})">Excluir</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

function renderGoals() {
  const goalSummary = document.getElementById("goalSummary");
  const goalGaugeText = document.getElementById("goalGaugeText");
  const { profit } = getSummaryData();

  if (!goals.length) {
    goalSummary.textContent = "Nenhuma meta cadastrada.";
    goalList.innerHTML = "";
    goalGaugeText.textContent = "0%";
    return;
  }

  const hitCount = goals.filter((goal) => profit >= Number(goal.target_amount)).length;
  goalSummary.textContent = `${hitCount} de ${goals.length} meta(s) batida(s).`;

  goalList.innerHTML = goals.map((goal) => {
    const target = Number(goal.target_amount);
    const hit = profit >= target;
    const percent = target > 0 ? Math.min((profit / target) * 100, 100) : 0;
    const safePercent = Number.isFinite(percent) ? percent : 0;

    return `
      <div class="goal-item">
        <strong>${goal.name}</strong>

        <div class="goal-meta-row">
          <span class="muted">Meta: ${formatCurrency(target)}</span>
          <span class="goal-badge ${hit ? "hit" : "miss"}">
            ${hit ? "Meta batida" : "Em andamento"}
          </span>
        </div>

        <div class="progress">
          <div style="width:${safePercent}%"></div>
        </div>

        <div class="goal-footer">
          <span class="muted">Progresso: ${safePercent.toFixed(1)}%</span>
          <span class="muted">${goal.deadline ? `Prazo: ${new Date(goal.deadline).toLocaleDateString("pt-BR")}` : "Sem prazo"}</span>
          <div class="actions">
            <button type="button" class="danger-btn" onclick="removeGoal(${goal.id})">Excluir</button>
          </div>
        </div>
      </div>
    `;
  }).join("");

  const topGoal = Number(goals[0].target_amount);
  const gaugePercent = topGoal > 0 ? Math.min((profit / topGoal) * 100, 100) : 0;
  goalGaugeText.textContent = `${Math.max(0, gaugePercent).toFixed(0)}%`;
}

function buildSparklines() {
  const monthly = getMonthlyAggregation();
  const marginSeries = monthly.profit.map((value, index) => {
    const income = monthly.income[index];
    return income > 0 ? Number(((value / income) * 100).toFixed(1)) : 0;
  });

  destroyChart(sparkIncome);
  destroyChart(sparkExpense);
  destroyChart(sparkProfit);
  destroyChart(sparkMargin);

  const baseOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
    scales: { x: { display: false }, y: { display: false } },
    elements: { point: { radius: 0 } }
  };

  sparkIncome = new Chart(document.getElementById("sparkIncome"), {
    type: "line",
    data: { labels: monthly.labels, datasets: [{ data: monthly.income, borderColor: "#67aefc", tension: 0.4 }] },
    options: baseOptions
  });

  sparkExpense = new Chart(document.getElementById("sparkExpense"), {
    type: "line",
    data: { labels: monthly.labels, datasets: [{ data: monthly.expense, borderColor: "#ff7d95", tension: 0.4 }] },
    options: baseOptions
  });

  sparkProfit = new Chart(document.getElementById("sparkProfit"), {
    type: "line",
    data: { labels: monthly.labels, datasets: [{ data: monthly.profit, borderColor: "#4e9af3", tension: 0.4 }] },
    options: baseOptions
  });

  sparkMargin = new Chart(document.getElementById("sparkMargin"), {
    type: "line",
    data: { labels: monthly.labels, datasets: [{ data: marginSeries, borderColor: "#8ec8ff", tension: 0.4 }] },
    options: baseOptions
  });
}

function buildDashboardCharts() {
  const monthly = getMonthlyAggregation();
  const { income, expense, profit } = getSummaryData();
  const categoriesMap = getCategoryExpenses();

  const categoryLabels = Object.keys(categoriesMap);
  const categoryValues = Object.values(categoriesMap);

  destroyChart(monthlyBarChart);
  destroyChart(lineFlowChart);
  destroyChart(categoryChart);
  destroyChart(goalGaugeChart);
  destroyChart(radarChart);

  monthlyBarChart = new Chart(document.getElementById("monthlyBarChart"), {
    type: "bar",
    data: {
      labels: monthly.labels.length ? monthly.labels : ["Sem dados"],
      datasets: [
        {
          label: "Receitas",
          data: monthly.income.length ? monthly.income : [0],
          backgroundColor: "#67aefc",
          borderRadius: 10
        },
        {
          label: "Despesas",
          data: monthly.expense.length ? monthly.expense : [0],
          backgroundColor: "#b8dbff",
          borderRadius: 10
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: "#6d819b" } } },
      scales: chartScales()
    }
  });

  lineFlowChart = new Chart(document.getElementById("lineFlowChart"), {
    type: "line",
    data: {
      labels: monthly.labels.length ? monthly.labels : ["Sem dados"],
      datasets: [
        {
          label: "Lucro",
          data: monthly.profit.length ? monthly.profit : [0],
          borderColor: "#4e9af3",
          backgroundColor: "rgba(103, 174, 252, 0.18)",
          fill: true,
          tension: 0.35,
          pointRadius: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: "#6d819b" } } },
      scales: chartScales()
    }
  });

  categoryChart = new Chart(document.getElementById("categoryChart"), {
    type: "doughnut",
    data: {
      labels: categoryLabels.length ? categoryLabels : ["Sem despesas"],
      datasets: [
        {
          data: categoryValues.length ? categoryValues : [1],
          backgroundColor: [
            "#67aefc",
            "#8ec8ff",
            "#b8dbff",
            "#dff0ff",
            "#8fb9e8",
            "#5f90cf"
          ],
          borderWidth: 0
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: "#6d819b" } } },
      cutout: "70%"
    }
  });

  const firstGoalTarget = goals.length ? Number(goals[0].target_amount) : 0;
  const goalPercent = firstGoalTarget > 0 ? Math.min((profit / firstGoalTarget) * 100, 100) : 0;

  goalGaugeChart = new Chart(document.getElementById("goalGaugeChart"), {
    type: "doughnut",
    data: {
      labels: ["Atingido", "Restante"],
      datasets: [
        {
          data: [Math.max(0, goalPercent), Math.max(0, 100 - goalPercent)],
          backgroundColor: ["#67aefc", "#e8f3ff"],
          borderWidth: 0
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      rotation: -90,
      circumference: 180,
      cutout: "78%",
      plugins: { legend: { display: false } }
    }
  });

  const recurringCount = transactions.filter((item) => item.recurrence === "monthly").length;
  const recurringScore = transactions.length ? Math.min((recurringCount / transactions.length) * 100, 100) : 0;
  const profitRatio = income > 0 ? Math.min((profit / income) * 100, 100) : 0;
  const goalScore = Math.max(0, Math.min(goalPercent, 100));
  const organizationScore = transactions.length ? 85 : 20;
  const revenueScore = income > 0 ? 100 : 10;

  radarChart = new Chart(document.getElementById("radarChart"), {
    type: "radar",
    data: {
      labels: ["Receita", "Lucro", "Metas", "Organização", "Recorrência"],
      datasets: [
        {
          label: "Saúde",
          data: [revenueScore, profitRatio, goalScore, organizationScore, recurringScore],
          borderColor: "#67aefc",
          backgroundColor: "rgba(103, 174, 252, 0.18)",
          pointBackgroundColor: "#4e9af3"
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: "#6d819b" } } },
      scales: {
        r: {
          angleLines: { color: "rgba(168, 187, 214, 0.22)" },
          grid: { color: "rgba(168, 187, 214, 0.22)" },
          pointLabels: { color: "#6d819b" },
          ticks: { display: false, beginAtZero: true, max: 100 }
        }
      }
    }
  });

  buildSparklines();
}

async function loadCategories() {
  const response = await fetch(`${API_URL}/categories/${currentUser.id}`);
  categories = await response.json();
}

async function loadTransactions() {
  const response = await fetch(`${API_URL}/transactions/${currentUser.id}${buildQueryString()}`);
  transactions = await response.json();
}

async function loadGoals() {
  const response = await fetch(`${API_URL}/goals/${currentUser.id}`);
  goals = await response.json();
}

async function refreshUI() {
  if (!currentUser) return;
  await loadCategories();
  await loadTransactions();
  await loadGoals();
  updateSummaryCards();
  renderCategoryOptions(entryType.value);
  renderTransactions();
  renderGoals();
  buildDashboardCharts();
}

window.editTransaction = function (id) {
  const item = transactions.find((transaction) => transaction.id === id);
  if (!item) return;

  document.getElementById("editId").value = item.id;
  document.getElementById("entryType").value = item.type;
  renderCategoryOptions(item.type);
  document.getElementById("categoryId").value = item.category_id || "";
  document.getElementById("description").value = item.description;
  document.getElementById("amount").value = item.amount;
  document.getElementById("recurrence").value = item.recurrence;
  document.getElementById("transactionDate").value = item.transaction_date;

  switchTab("lancamentos");
  window.scrollTo({ top: 0, behavior: "smooth" });
};

window.removeTransaction = async function (id) {
  const response = await fetch(`${API_URL}/transactions/${id}`, { method: "DELETE" });
  if (response.ok) await refreshUI();
};

window.removeGoal = async function (id) {
  const response = await fetch(`${API_URL}/goals/${id}`, { method: "DELETE" });
  if (response.ok) await refreshUI();
};

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const response = await fetch(`${API_URL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: loginUsername.value.trim(),
      password: loginPassword.value.trim()
    })
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    alert(data.message || "Erro no login.");
    return;
  }

  currentUser = data.user;
  localStorage.setItem("currentUser", JSON.stringify(currentUser));
  authScreen.classList.add("hidden");
  app.classList.remove("hidden");
  await refreshUI();
});

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const response = await fetch(`${API_URL}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: registerName.value.trim(),
      username: registerUsername.value.trim(),
      password: registerPassword.value.trim()
    })
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    alert(data.message || "Erro ao cadastrar usuário.");
    return;
  }

  alert("Usuário criado com sucesso.");
  registerForm.reset();
  document.querySelector('[data-auth="login"]').click();
});

financeForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const editId = document.getElementById("editId").value;

  const payload = {
    user_id: currentUser.id,
    category_id: categoryId.value || null,
    type: document.getElementById("entryType").value,
    description: document.getElementById("description").value.trim(),
    amount: Number(document.getElementById("amount").value),
    recurrence: document.getElementById("recurrence").value,
    transaction_date: document.getElementById("transactionDate").value
  };

  let response;

  if (editId) {
    response = await fetch(`${API_URL}/transactions/${editId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  } else {
    response = await fetch(`${API_URL}/transactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    alert(data?.message || "Erro ao salvar lançamento.");
    return;
  }

  financeForm.reset();
  document.getElementById("editId").value = "";
  renderCategoryOptions(entryType.value);
  await refreshUI();
});

goalForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const response = await fetch(`${API_URL}/goals`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id: currentUser.id,
      name: document.getElementById("goalName").value.trim(),
      target_amount: Number(document.getElementById("goalTarget").value),
      deadline: document.getElementById("goalDeadline").value || null
    })
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    alert(data?.message || "Erro ao criar meta.");
    return;
  }

  goalForm.reset();
  await refreshUI();
});

cancelEditBtn.addEventListener("click", () => {
  financeForm.reset();
  document.getElementById("editId").value = "";
  renderCategoryOptions(entryType.value);
});

logoutBtn.addEventListener("click", () => {
  currentUser = null;
  localStorage.removeItem("currentUser");
  app.classList.add("hidden");
  authScreen.classList.remove("hidden");
});

entryType.addEventListener("change", () => {
  renderCategoryOptions(entryType.value);
});

if (menuToggle && sidebar) {
  menuToggle.addEventListener("click", () => {
    sidebar.classList.toggle("open");
  });
}

document.querySelectorAll(".tab-btn").forEach((button) => {
  button.addEventListener("click", () => {
    switchTab(button.dataset.tab);
    if (window.innerWidth <= 1024 && sidebar) {
      sidebar.classList.remove("open");
    }
  });
});

function switchTab(tabId) {
  document.querySelectorAll(".tab-content").forEach((tab) => tab.classList.remove("active"));
  document.querySelectorAll(".tab-btn").forEach((button) => button.classList.remove("active"));

  const selectedTab = document.getElementById(tabId);
  const selectedButton = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);

  if (selectedTab) selectedTab.classList.add("active");
  if (selectedButton) selectedButton.classList.add("active");
}

document.querySelectorAll(".auth-tab").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".auth-tab").forEach((tab) => tab.classList.remove("active"));
    document.querySelectorAll(".auth-form").forEach((form) => form.classList.remove("active"));
    button.classList.add("active");
    const targetForm = document.getElementById(`${button.dataset.auth}Form`);
    if (targetForm) targetForm.classList.add("active");
  });
});

document.querySelectorAll(".switch-auth").forEach((element) => {
  element.addEventListener("click", () => {
    const target = element.dataset.openAuth;
    document.querySelectorAll(".auth-tab").forEach((tab) => tab.classList.remove("active"));
    document.querySelectorAll(".auth-form").forEach((form) => form.classList.remove("active"));

    const targetTab = document.querySelector(`.auth-tab[data-auth="${target}"]`);
    const targetForm = document.getElementById(`${target}Form`);

    if (targetTab) targetTab.classList.add("active");
    if (targetForm) targetForm.classList.add("active");
  });
});

async function init() {
  filters.dateFrom = "";
  filters.dateTo = "";

  if (currentUser) {
    authScreen.classList.add("hidden");
    app.classList.remove("hidden");
    await refreshUI();
  }
}

init();
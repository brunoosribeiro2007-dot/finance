import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { 
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, 
  onAuthStateChanged, signOut 
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { 
  getFirestore, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, where, orderBy 
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBKZHMXu5glCjMRVf5mvu7GLalHvYSBIvI",
  authDomain: "financepro-62da9.firebaseapp.com",
  projectId: "financepro-62da9",
  storageBucket: "financepro-62da9.firebasestorage.app",
  messagingSenderId: "103610899044",
  appId: "1:103610899044:web:1dd56731cc406ebc319d71"
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

let currentUser = null;
let activeProfileId = null;

let profiles = [];
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
let compoundChart = null;
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
const profileForm = document.getElementById("profileForm");

const activeProfileText = document.getElementById("activeProfileText");
const noProfileMsg = document.getElementById("noProfileMsg");

const profileSelector = document.getElementById("activeProfile");
const profileList = document.getElementById("profileList");
const profileSummary = document.getElementById("profileSummary");

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

function showToast(message, type = "success") {
  const container = document.getElementById("toastContainer");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  
  let icon = "✓";
  if (type === "error") icon = "✕";
  if (type === "warning") icon = "⚠";

  toast.innerHTML = `
    <div style="font-weight: 800; font-size: 1.1rem; opacity: 0.8;">${icon}</div>
    <span class="toast-message">${message}</span>
  `;
  container.appendChild(toast);
  
  setTimeout(() => toast.classList.add("show"), 10);
  
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 400);
  }, 4000);
}

function buildQueryString() {
  const params = new URLSearchParams();
  if (activeProfileId) params.set("profile_id", activeProfileId);
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

  const elTotalIncome = document.getElementById("totalIncome");
  const elTotalExpense = document.getElementById("totalExpense");
  const elNetProfit = document.getElementById("netProfit");
  const elProfitMargin = document.getElementById("profitMargin");

  elTotalIncome.textContent = formatCurrency(income);
  elTotalIncome.style.color = "var(--blue)";

  elTotalExpense.textContent = formatCurrency(expense);
  elTotalExpense.style.color = "var(--danger)";

  elNetProfit.textContent = formatCurrency(profit);
  elNetProfit.style.color = profit >= 0 ? "var(--success)" : "var(--danger)";

  elProfitMargin.textContent = `${margin}%`;
  elProfitMargin.style.color = margin >= 0 ? "var(--success)" : "var(--danger)";

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
    const isClone = typeof item.id === 'string' && item.id.includes('_rec_');

    return `
      <tr>
        <td><span class="tag ${item.type === "income" ? "tag-income" : "tag-expense"}">${typeLabel}</span></td>
        <td>${item.category_name || "-"}</td>
        <td>${item.description}</td>
        <td>${recurrenceLabel}</td>
        <td>${new Date(item.transaction_date + 'T12:00:00').toLocaleDateString("pt-BR")}</td>
        <td>${formatCurrency(item.amount)}</td>
        <td>
          <div class="actions">
            ${!isClone ? `
            <button type="button" onclick="editTransaction(${item.id})">Editar</button>
            <button type="button" class="danger-btn" onclick="removeTransaction(${item.id})">Excluir</button>
            ` : `<span class="muted" style="font-size: 0.75rem;">(Automático)</span>`}
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

function renderHistoryTab() {
  const grid = document.getElementById("historyGrid");
  if (!grid) return;

  const map = {};
  transactions.forEach(t => {
    const key = t.transaction_date.slice(0, 7);
    if (!map[key]) map[key] = { income: 0, expense: 0, txs: [] };
    if (t.type === "income") map[key].income += Number(t.amount);
    else map[key].expense += Number(t.amount);
    map[key].txs.push(t);
  });

  const sortedKeys = Object.keys(map).sort().reverse();

  grid.innerHTML = sortedKeys.map(key => {
    const data = map[key];
    const [yyyy, mm] = key.split("-");
    const dateObj = new Date(Number(yyyy), Number(mm) - 1, 1);
    const monthName = dateObj.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    const profit = data.income - data.expense;

    return `
      <div class="history-card" style="background: var(--panel-strong); border: 1px solid rgba(168,187,214,0.3); border-radius: 20px; padding: 24px; display: flex; flex-direction: column; gap: 16px; box-shadow: 0 8px 25px rgba(63,104,160,0.06); transition: transform 0.2s, box-shadow 0.2s;">
        <div style="text-transform: capitalize; font-weight: 700; font-size: 1.15rem; color: var(--blue-strong); border-bottom: 2px solid rgba(103,174,252,0.15); padding-bottom: 12px; display: flex; align-items: center; gap: 8px;">
          📅 ${monthName}
        </div>
        <div style="display: flex; flex-direction: column; gap: 10px; font-size: 0.95rem;">
          <div style="display: flex; justify-content: space-between;"><span style="color: var(--muted);">Receitas</span> <strong style="color: var(--blue);">${formatCurrency(data.income)}</strong></div>
          <div style="display: flex; justify-content: space-between;"><span style="color: var(--muted);">Despesas</span> <strong style="color: var(--danger);">${formatCurrency(data.expense)}</strong></div>
          <div style="display: flex; justify-content: space-between; margin-top: 4px; padding-top: 10px; border-top: 1px dashed rgba(168,187,214,0.3);"><span style="color: #11233c; font-weight: 700;">Saldo Líquido</span> <strong style="color: ${profit >= 0 ? 'var(--success)' : 'var(--danger)'}; font-size: 1.05rem;">${formatCurrency(profit)}</strong></div>
        </div>
        <button class="ghost-btn" onclick="openHistoryModal('${key}')" style="margin-top: auto; padding: 12px; width: 100%; border-radius: 12px; font-weight: 600; font-size: 0.9rem; background: var(--bg-soft); border: 1px solid rgba(168, 187, 214, 0.4); color: var(--blue-strong); cursor: pointer;">Ver Detalhes</button>
      </div>
    `;
  }).join("");
}

window.openHistoryModal = function(yearMonthKey) {
  const modal = document.getElementById("historyModal");
  const title = document.getElementById("historyModalTitle");
  const tableBody = document.getElementById("historyModalTable");
  
  if (!modal || !title || !tableBody) return;

  const [yyyy, mm] = yearMonthKey.split("-");
  const dateObj = new Date(Number(yyyy), Number(mm) - 1, 1);
  const monthName = dateObj.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  
  title.innerHTML = `<i class="ph ph-calendar-blank"></i> <span style="text-transform: capitalize;">${monthName}</span>`;

  const txs = transactions.filter(t => t.transaction_date.startsWith(yearMonthKey));
  
  tableBody.innerHTML = txs.map(m => {
    const typeLabel = m.type === "income" ? "Receita" : "Despesa";
    return `
      <tr>
        <td><span class="tag ${m.type === "income" ? "tag-income" : "tag-expense"}">${typeLabel}</span></td>
        <td>${m.category_name || "-"}</td>
        <td>${m.description}</td>
        <td>${new Date(m.transaction_date + 'T12:00:00').toLocaleDateString("pt-BR")}</td>
        <td>${formatCurrency(m.amount)}</td>
      </tr>
    `;
  }).join("");

  modal.classList.remove("hidden");
};

const closeHistoryModal = document.getElementById("closeHistoryModal");
if (closeHistoryModal) {
  closeHistoryModal.addEventListener("click", () => {
    document.getElementById("historyModal").classList.add("hidden");
  });
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
          borderRadius: 8,
          barPercentage: 0.6
        },
        {
          label: "Despesas",
          data: monthly.expense.length ? monthly.expense : [0],
          backgroundColor: "#b8dbff",
          borderRadius: 8,
          barPercentage: 0.6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: "#6d819b", usePointStyle: true, padding: 20 } } },
      scales: chartScales()
    }
  });

  lineFlowChart = new Chart(document.getElementById("lineFlowChart"), {
    type: "bar",
    data: {
      labels: monthly.labels.length ? monthly.labels : ["Sem dados"],
      datasets: [
        {
          label: "Lucro",
          data: monthly.profit.length ? monthly.profit : [0],
          backgroundColor: monthly.profit.map(val => val >= 0 ? "#67aefc" : "#ff7d95"),
          borderRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
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
          borderWidth: 2,
          borderColor: "#ffffff",
          hoverOffset: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "right", labels: { color: "#6d819b", usePointStyle: true } } },
      cutout: "75%",
      layout: { padding: 10 }
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
  if (!activeProfileId) return categories = [];
  try {
    const q = query(collection(db, "categories"), where("profile_id", "==", activeProfileId));
    const snap = await getDocs(q);
    categories = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Inject defaults if empty
    if (categories.length === 0) {
      const defaults = [
        { name: "Salário", type: "income" },
        { name: "Vendas", type: "income" },
        { name: "Outras Receitas", type: "income" },
        { name: "Moradia", type: "expense" },
        { name: "Alimentação", type: "expense" },
        { name: "Transporte", type: "expense" },
        { name: "Lazer", type: "expense" }
      ];
      for (const c of defaults) {
        const docRef = await addDoc(collection(db, "categories"), { ...c, profile_id: activeProfileId });
        categories.push({ id: docRef.id, ...c, profile_id: activeProfileId });
      }
    }
  } catch (err) {
    console.error(err);
    categories = [];
  }
}

function expandRecurring(list) {
  const expanded = [];
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();

  list.forEach(t => {
    expanded.push({...t}); // Always keep original

    if (t.recurrence === "monthly") {
      const d = new Date(t.transaction_date + 'T12:00:00');
      let tYear = d.getFullYear();
      let tMonth = d.getMonth();

      let targetYear = tYear;
      let targetMonth = tMonth + 1;

      // Expand to +1 month into the future for predictability graphs
      while (targetYear < currentYear || (targetYear === currentYear && targetMonth <= currentMonth + 1)) {
        if (targetYear > tYear || (targetYear === tYear && targetMonth > tMonth)) {
          const clone = { ...t };
          
          let day = d.getDate();
          const maxDays = new Date(targetYear, targetMonth + 1, 0).getDate();
          if (day > maxDays) day = maxDays;
          
          const strMonth = String(targetMonth + 1).padStart(2, '0');
          const strDay = String(day).padStart(2, '0');
          clone.transaction_date = `${targetYear}-${strMonth}-${strDay}`;
          clone.id = `${t.id}_rec_${targetYear}_${strMonth}`; // Identifiable pseudo ID
          
          expanded.push(clone);
        }

        targetMonth++;
        if (targetMonth > 11) {
          targetMonth = 0;
          targetYear++;
        }
      }
    }
  });

  return expanded.sort((a,b) => new Date(b.transaction_date) - new Date(a.transaction_date));
}

async function loadTransactions() {
  if (!activeProfileId) return transactions = [];
  try {
    const q = query(collection(db, "transactions"), where("profile_id", "==", activeProfileId));
    const snap = await getDocs(q);
    const rawData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    transactions = expandRecurring(rawData);
  } catch(err) {
    console.error(err);
    transactions = [];
  }
}

async function loadGoals() {
  if (!activeProfileId) return goals = [];
  try {
    const q = query(collection(db, "goals"), where("profile_id", "==", activeProfileId));
    const snap = await getDocs(q);
    goals = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch(err) {
    console.error(err);
    goals = [];
  }
}

async function loadCurrentUser() {
  const response = await fetch("/api/me");
  const data = await response.json().catch(() => null);

  if (!response.ok || !data?.success) {
    currentUser = null;
    localStorage.removeItem("currentUser");
    app.classList.add("hidden");
    authScreen.classList.remove("hidden");
    return false;
  }

  currentUser = data.user;
  localStorage.setItem("currentUser", JSON.stringify(currentUser));
  return true;
}
async function loadProfiles() {
  if (!currentUser) {
    profiles = [];
    return;
  }
  
  try {
    const q = query(collection(db, "profiles"), where("user_id", "==", currentUser.id));
    const snap = await getDocs(q);
    profiles = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch(err) {
    console.error(err);
    profiles = [];
  }

  if (profiles.length === 0) {
    if (document.getElementById("profileCustomWrapper")) document.getElementById("profileCustomWrapper").style.display = "none";
    if (document.getElementById("createProfileLink")) document.getElementById("createProfileLink").style.display = "none";
    noProfileMsg.style.display = "inline";
    activeProfileId = null;
    localStorage.removeItem("activeProfileId");
    profileList.innerHTML = "";
    profileSummary.textContent = "Nenhum perfil cadastrado.";
  } else {
    if (document.getElementById("profileCustomWrapper")) document.getElementById("profileCustomWrapper").style.display = "block";
    if (document.getElementById("createProfileLink")) document.getElementById("createProfileLink").style.display = "inline-block";
    noProfileMsg.style.display = "none";

    profileSelector.innerHTML = profiles
      .map((p) => `<option value="${p.id}">${p.name}</option>`)
      .join("");

    if (!activeProfileId || !profiles.some(p => p.id === activeProfileId)) {
      activeProfileId = profiles[0].id;
      localStorage.setItem("activeProfileId", activeProfileId);
    }
    profileSelector.value = activeProfileId;

    const customOptions = document.getElementById("profileCustomOptions");
    const customText = document.getElementById("profileCustomText");
    if (customOptions) {
      customOptions.innerHTML = profiles.map(p => `
        <div class="custom-option ${p.id == activeProfileId ? 'selected' : ''}" data-id="${p.id}">
          ${p.name}
        </div>
      `).join("");
      
      const activeP = profiles.find(p => p.id == activeProfileId);
      if (customText) customText.textContent = activeP ? activeP.name : "Selecione";
    }

    profileSummary.textContent = `${profiles.length} perfil(is) cadastrado(s).`;
    profileList.innerHTML = profiles.map(p => {
      const icon = p.name.toLowerCase().includes("casa") ? "🏠" : 
                   p.name.toLowerCase().includes("sítio") || p.name.toLowerCase().includes("sitio") ? "🌳" : "📁";
      return `
      <div class="profile-list-item">
        <div class="profile-icon">${icon}</div>
        <div>
          <strong style="font-size: 1.1rem; color: #11233c;">${p.name}</strong>
          <p class="muted" style="margin-top: 4px; font-size: 0.85rem;">Criado em: ${new Date(p.created_at).toLocaleDateString("pt-BR")}</p>
        </div>
      </div>
    `}).join("");
  }
}

async function refreshUI() {
  await loadProfiles();
  await loadCategories();
  await loadTransactions();
  await loadGoals();
  renderTransactions();
  renderGoals();
  renderHistoryTab();
  generateInsights();
  updateSummaryCards();
  buildDashboardCharts();
  renderCategoryOptions(entryType ? entryType.value : "income");
}

function loadCurrentUser() {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, (user) => {
      if (user) {
        currentUser = { id: user.uid, email: user.email };
        localStorage.setItem("currentUser", JSON.stringify(currentUser));
        resolve(true);
      } else {
        currentUser = null;
        localStorage.removeItem("currentUser");
        app.classList.add("hidden");
        authScreen.classList.remove("hidden");
        resolve(false);
      }
    });
  });
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
  try {
    await deleteDoc(doc(db, "transactions", String(id)));
    await refreshUI();
  } catch(err) {
    console.error(err);
    showToast("Erro ao excluir lançamento.", "error");
  }
};

window.removeGoal = async function (id) {
  try {
    await deleteDoc(doc(db, "goals", String(id)));
    await refreshUI();
  } catch(err) {
    console.error(err);
    showToast("Erro ao excluir meta.", "error");
  }
};

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  
  const email = loginUsername.value.trim() + "@financepro.com";
  const pass = loginPassword.value.trim();

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, pass);
    currentUser = { id: userCredential.user.uid, email: userCredential.user.email };
    localStorage.setItem("currentUser", JSON.stringify(currentUser));
    authScreen.classList.add("hidden");
    app.classList.remove("hidden");
    await refreshUI();
  } catch (err) {
    console.error(err);
    showToast("Erro no login. Verifique suas credenciais.", "error");
  }
});

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  
  const email = registerUsername.value.trim() + "@financepro.com";
  const pass = registerPassword.value.trim();
  
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
    showToast("Usuário criado com sucesso! Faça seu login.", "success");
    registerForm.reset();
    document.querySelector('[data-auth="login"]').click();
    
    // Auto logout immediately after register so the user can login explicitly
    await signOut(auth);
  } catch(err) {
    console.error(err);
    showToast("Erro ao cadastrar usuário.", "error");
  }
});

financeForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const editId = document.getElementById("editId").value;
  const payload = {
    profile_id: activeProfileId,
    category_id: categoryId.value || null,
    type: document.getElementById("entryType").value,
    description: document.getElementById("description").value.trim(),
    amount: Number(document.getElementById("amount").value),
    recurrence: document.getElementById("recurrence").value,
    transaction_date: document.getElementById("transactionDate").value
  };

  try {
    if (editId) {
      await updateDoc(doc(db, "transactions", editId), payload);
    } else {
      await addDoc(collection(db, "transactions"), payload);
    }
    showToast("Lançamento salvo com sucesso!", "success");
    financeForm.reset();
    document.getElementById("editId").value = "";
    renderCategoryOptions(entryType.value);
    await refreshUI();
  } catch (err) {
    console.error(err);
    showToast("Erro ao salvar lançamento.", "error");
  }
});

goalForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const payload = {
    profile_id: activeProfileId,
    name: document.getElementById("goalName").value.trim(),
    target_amount: Number(document.getElementById("goalTarget").value),
    deadline: document.getElementById("goalDeadline").value || null
  };

  try {
    await addDoc(collection(db, "goals"), payload);
    showToast("Nova meta criada com sucesso!", "success");
    goalForm.reset();
    await refreshUI();
  } catch (err) {
    console.error(err);
    showToast("Erro ao criar meta.", "error");
  }
});

if (profileSelector) {
  profileSelector.addEventListener("change", async (e) => {
    activeProfileId = Number(e.target.value);
    localStorage.setItem("activeProfileId", activeProfileId);
    await refreshUI();
  });
}

const createProfileLink = document.getElementById("createProfileLink");
if (createProfileLink) {
  createProfileLink.addEventListener("click", () => document.querySelector(".tab-btn[data-tab='perfis']").click());
}

if (noProfileMsg) {
  noProfileMsg.addEventListener("click", () => document.querySelector(".tab-btn[data-tab='perfis']").click());
}

if (profileForm) {
  profileForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = document.getElementById("profileName").value.trim();

    try {
      const docRef = await addDoc(collection(db, "profiles"), {
        user_id: currentUser.id,
        name: name,
        created_at: new Date().toISOString()
      });
      showToast(`O perfil "${name}" foi criado!`, "success");
      profileForm.reset();
      activeProfileId = docRef.id;
      localStorage.setItem("activeProfileId", activeProfileId);
      await refreshUI();
    } catch(err) {
      console.error(err);
      showToast("Erro ao criar perfil.", "error");
    }
  });
}

cancelEditBtn.addEventListener("click", () => {
  financeForm.reset();
  document.getElementById("editId").value = "";
  renderCategoryOptions(entryType.value);
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

  const titleEl = document.getElementById("pageTitle");
  const subtitleEl = document.getElementById("pageSubtitle");
  const summaryCards = document.querySelector(".summary-cards");

  if (summaryCards) {
    if (tabId === "dashboard" || tabId === "lancamentos") {
      summaryCards.style.display = "grid";
    } else {
      summaryCards.style.display = "none";
    }
  }

  if (titleEl && subtitleEl && pageTitles[tabId]) {
    titleEl.style.opacity = "0.4";
    titleEl.style.transform = "translateY(4px)";
    subtitleEl.style.opacity = "0.4";
    subtitleEl.style.transform = "translateY(4px)";

    setTimeout(() => {
      titleEl.textContent = pageTitles[tabId].title;
      subtitleEl.textContent = pageTitles[tabId].subtitle;
      titleEl.style.opacity = "1";
      titleEl.style.transform = "translateY(0)";
      subtitleEl.style.opacity = "1";
      subtitleEl.style.transform = "translateY(0)";
    }, 120);
  }
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

const calcForm = document.getElementById("calcForm");
if (calcForm) {
  calcForm.addEventListener("submit", (e) => {
    e.preventDefault();
    
    const initial = parseFloat(document.getElementById('calcInitial').value) || 0;
    const monthly = parseFloat(document.getElementById('calcMonthly').value) || 0;
    let rate = parseFloat(document.getElementById('calcRate').value) || 0;
    const rateType = document.getElementById('calcRateType').value;
    const years = parseInt(document.getElementById('calcYears').value) || 0;
    const extraMonths = parseInt(document.getElementById('calcMonths').value) || 0;
    const startDate = new Date(document.getElementById('calcDate').value + 'T12:00:00');

    const totalMonths = (years * 12) + extraMonths;
    if (totalMonths <= 0) {
      showToast("A duração precisa ser maior que 0 meses.", "warning");
      return;
    }

    rate = rate / 100;
    let monthlyRate = (rateType === 'anual') ? (Math.pow(1 + rate, 1/12) - 1) : rate;

    let currentBalance = initial;
    let totalInvested = initial;
    
    let labels = [];
    let balances = [];
    let investeds = [];

    let currentDate = new Date(startDate);
    
    for(let i = 0; i <= totalMonths; i++) {
      labels.push(currentDate.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }));
      balances.push(currentBalance);
      investeds.push(totalInvested);
      
      if (i < totalMonths) {
        currentBalance = currentBalance * (1 + monthlyRate) + monthly;
        totalInvested += monthly;
        currentDate.setMonth(currentDate.getMonth() + 1);
      }
    }

    document.getElementById('calcTotalInvested').innerText = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalInvested);
    document.getElementById('calcTotalInterest').innerText = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(currentBalance - totalInvested);
    document.getElementById('calcFinalBalance').innerText = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(currentBalance);


    buildCompoundChart(labels, balances, investeds);
  });
}

function buildCompoundChart(labels, balances, investeds) {
  if (compoundChart) compoundChart.destroy();
  
  compoundChart = new Chart(document.getElementById("compoundChart"), {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Saldo Total",
          data: balances,
          borderColor: "#67aefc",
          backgroundColor: "rgba(103, 174, 252, 0.18)",
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 6
        },
        {
          label: "Total Investido",
          data: investeds,
          borderColor: "#64748b",
          backgroundColor: "transparent",
          borderDash: [5, 5],
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { color: "#64748b", usePointStyle: true, padding: 20 } },
        tooltip: {
          callbacks: {
            label: function(context) {
              return context.dataset.label + ': ' + new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(context.parsed.y);
            }
          }
        }
      },
      scales: chartScales()
    }
  });
}

const descInput = document.getElementById("description");
const suggBox = document.getElementById("descriptionSuggestions");

if (descInput && suggBox) {
  descInput.addEventListener("input", () => {
    const val = descInput.value.toLowerCase().trim();
    if (!val) {
      suggBox.classList.add("hidden");
      return;
    }
    const uniqueDescs = [...new Set(transactions.map(t => t.description))];
    const matches = uniqueDescs.filter(d => d.toLowerCase().includes(val));
    
    if (matches.length > 0) {
      suggBox.innerHTML = matches.map(m => `<div class="suggestion-item">${m}</div>`).join("");
      suggBox.classList.remove("hidden");
    } else {
      suggBox.classList.add("hidden");
    }
  });

  suggBox.addEventListener("click", (e) => {
    if (e.target.classList.contains("suggestion-item")) {
      descInput.value = e.target.textContent;
      suggBox.classList.add("hidden");
    }
  });

  document.addEventListener("click", (e) => {
    if (!descInput.contains(e.target) && !suggBox.contains(e.target)) {
      suggBox.classList.add("hidden");
    }
  });
}

function generateInsights() {
  const el = document.getElementById("insightText");
  if (!el) return;

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const today = new Date();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const currentDay = today.getDate();

  const monthlyTrans = transactions.filter(t => {
    const d = new Date(t.transaction_date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  const income = monthlyTrans.filter(t => t.type === "income").reduce((acc, t) => acc + t.amount, 0);
  const expense = monthlyTrans.filter(t => t.type === "expense").reduce((acc, t) => acc + t.amount, 0);

  if (income === 0 && expense === 0) {
    el.innerHTML = "Não há movimentações neste mês para gerar previsões de gastos.";
    return;
  }

  const avgDailyExpense = expense / currentDay;
  const predictedExpense = avgDailyExpense * daysInMonth;
  const diff = income - predictedExpense;

  let msg = `Neste mês, sua velocidade de gasto é de <strong>${formatCurrency(avgDailyExpense)} ao dia</strong>. `;
  
  if (expense === 0) {
    msg = `Seu orçamento está impecável este mês! Nenhuma despesa registrada ainda.`;
  } else if (diff >= 0) {
    msg += `<br><span style="color: var(--success);">Neste ritmo, a previsão é terminar o mês com saldo positivo de aproximadamente <strong>${formatCurrency(diff)}</strong>. Excelente controle!</span>`;
  } else {
    msg += `<br><span style="color: var(--danger);">⚠ Atenção: Mantendo os gastos diários neste nível, você deve devassar seu teto e ultrapassar as receitas em <strong>${formatCurrency(Math.abs(diff))}</strong> até o fim do mês. Pisando no freio!</span>`;
  }

  el.innerHTML = msg;
}

const profileCustomWrapper = document.getElementById("profileCustomWrapper");
const profileCustomTrigger = document.getElementById("profileCustomTrigger");
const profileCustomOptions = document.getElementById("profileCustomOptions");

if (profileCustomWrapper && profileCustomTrigger) {
  profileCustomTrigger.addEventListener("click", () => {
    profileCustomWrapper.classList.toggle("open");
  });

  profileCustomOptions.addEventListener("click", async (e) => {
    const opt = e.target.closest(".custom-option");
    if (opt) {
      const newId = opt.dataset.id;
      if (newId && newId != activeProfileId) {
        activeProfileId = newId;
        localStorage.setItem("activeProfileId", activeProfileId);
        profileCustomWrapper.classList.remove("open");
        await refreshUI();
      } else {
        profileCustomWrapper.classList.remove("open");
      }
    }
  });

  document.addEventListener("click", (e) => {
    if (!profileCustomWrapper.contains(e.target)) {
      profileCustomWrapper.classList.remove("open");
    }
  });
}

async function initApp() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch((err) => console.log('SW falhou', err));
  }

  filters.dateFrom = "";
  filters.dateTo = "";

  const valid = await loadCurrentUser();
  if (valid) {
    authScreen.classList.add("hidden");
    app.classList.remove("hidden");
    await refreshUI();
  }
}

if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    try {
      await signOut(auth);
      // onAuthStateChanged in loadCurrentUser handles UI reset automatically
    } catch(err) {
      console.error(err);
      showToast("Erro ao deslogar.", "error");
    }
  });
}

initApp();
const pageTitles = {
  dashboard: {
    title: "Visão geral",
    subtitle: "Resumo financeiro e desempenho visual."
  },
  lancamentos: {
    title: "Lançamentos",
    subtitle: "Gerencie receitas e despesas com mais controle."
  },
  metas: {
    title: "Metas financeiras",
    subtitle: "Acompanhe seus objetivos e progresso."
  },
  perfis: {
    title: "Perfis de Controle",
    subtitle: "Alterne entre diferentes áreas financeiras (ex: Casa, Sítio)."
  },
  calculadora: {
    title: "Calculadora de Juros",
    subtitle: "Simule a evolução do seu patrimônio a longo prazo."
  },
  historico: {
    title: "Pesquisa e Histórico",
    subtitle: "Busque transações ou navegue pelo calendário de meses passados."
  }
};

const globalSearch = document.getElementById("globalSearch");
if (globalSearch) {
  globalSearch.addEventListener("input", (e) => {
    const val = e.target.value.toLowerCase().trim();
    if (!val) {
      renderHistoryTab();
      return;
    }
    
    const matched = transactions.filter(t => 
      t.description.toLowerCase().includes(val) || 
      (t.category_name && t.category_name.toLowerCase().includes(val)) ||
      String(t.amount).includes(val)
    );

    const grid = document.getElementById("historyGrid");
    
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; background: var(--panel-strong); border-radius: 20px; padding: 0; overflow: hidden; border: 1px solid rgba(168,187,214,0.3); box-shadow: 0 10px 30px rgba(17,35,60,0.06);">
        <div class="table-wrap">
          <table>
            <thead><tr><th>Mês</th><th>Tipo</th><th>Categoria</th><th>Descrição</th><th>Valor</th></tr></thead>
            <tbody>
              ${matched.map(m => {
                const typeLabel = m.type === "income" ? "Receita" : "Despesa";
                const [y, mm, d] = m.transaction_date.split('-');
                return `
                  <tr>
                    <td>${mm}/${y}</td>
                    <td><span class="tag ${m.type === "income" ? "tag-income" : "tag-expense"}">${typeLabel}</span></td>
                    <td>${m.category_name || "-"}</td>
                    <td>${m.description}</td>
                    <td>${formatCurrency(m.amount)}</td>
                  </tr>
                `;
              }).join("")}
              ${matched.length === 0 ? `<tr><td colspan="5" style="text-align: center; padding: 32px; color: var(--muted); font-size: 1.1rem;">Nada encontrado para "${val}".</td></tr>` : ''}
            </tbody>
          </table>
        </div>
      </div>
    `;
  });
}
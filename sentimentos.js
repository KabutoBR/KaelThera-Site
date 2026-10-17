const GOOGLE_SHEETS_URL="https://script.google.com/macros/s/AKfycbydLu1yLNP6yfCLWsWi9XhxgZowUhtJ94kFr_D9SgjUyB26j0xsaXaHkfSTbp62FV-g/exec";
const MINIMUM_FORM_TIME=5000;
const formOpenedAt=Date.now();
// KAEL'THERA SMP — SENTIMENTOS / GOOGLE SHEETS
const totalSteps = 8;
let currentStep = 1;
const DRAFT_STORAGE_KEY = "kaelthera:sentimentos:draft:v2";
const DRAFT_MAX_AGE = 30 * 24 * 60 * 60 * 1000;
const DRAFT_SAVE_DELAY = 350;
let draftSaveTimer = null;
let formCompleted = false;

const form = document.getElementById("feelingForm");
const prevButton = document.getElementById("prevButton");
const nextButton = document.getElementById("nextButton");
const submitButton = document.getElementById("submitButton");
const stepNumber = document.getElementById("stepNumber");
const stepTitle = document.getElementById("stepTitle");
const progressFill = document.getElementById("progressFill");
const successScreen = document.getElementById("successScreen");

const stepTitles = {
  1: "Identificação & escolha", 2: "Como você sente", 3: "Perda, falha & controle",
  4: "Vínculos & distância", 5: "Conflitos & decisões", 6: "Você consigo mesmo",
  7: "História emocional", 8: "Revisão"
};

function getCurrentStepElement() { return document.querySelector(`.form-step[data-step="${currentStep}"]`); }
function isFieldVisible(field) { return !!field && !field.closest(".hidden") && field.offsetParent !== null && !field.disabled; }

function updateFeelingChoiceFields() {
  const selected = form.querySelector('input[name="choiceMode"]:checked');
  const container = document.getElementById("desiredFeelingFields");
  const select = document.getElementById("desiredFeeling");
  const reason = document.getElementById("desiredFeelingReason");
  const wantsChoice = selected?.value === "quero_escolher";
  container.classList.toggle("hidden", !wantsChoice);
  select.required = wantsChoice;
  reason.required = wantsChoice;
  if (!wantsChoice) { select.value = ""; reason.value = ""; }
  updateNextButtonState();
}

function showStep(step) {
  document.querySelectorAll(".form-step").forEach(el => el.classList.toggle("active", Number(el.dataset.step) === step));
  currentStep = step;
  stepNumber.textContent = step;
  stepTitle.textContent = stepTitles[step];
  progressFill.style.width = `${((step - 1) / (totalSteps - 1)) * 100}%`;
  prevButton.classList.toggle("hidden", step === 1);
  nextButton.classList.toggle("hidden", step === totalSteps);
  submitButton.classList.toggle("hidden", step !== totalSteps);
  if (step === totalSteps) generateReview();
  window.scrollTo({top: 0, behavior: "smooth"});
  requestAnimationFrame(updateNextButtonState);
}

function isCurrentStepComplete() {
  const current = getCurrentStepElement();
  if (!current) return true;
  const required = current.querySelectorAll("input[required], textarea[required], select[required]");
  const groups = new Set();
  for (const field of required) {
    if (!isFieldVisible(field)) continue;
    if (field.type === "radio" || field.type === "checkbox") {
      if (groups.has(field.name)) continue;
      groups.add(field.name);
      const checked = Array.from(current.querySelectorAll(`[name="${field.name}"]`)).some(item => isFieldVisible(item) && item.checked);
      if (!checked) return false;
    } else if (!String(field.value || "").trim() || !field.checkValidity()) return false;
  }
  if (currentStep === 8 && !document.getElementById("confirmRules")?.checked) return false;
  return true;
}

function updateNextButtonState() {
  const complete = isCurrentStepComplete();
  const guidance = document.getElementById("formGuidance");
  if (currentStep < totalSteps) {
    nextButton.disabled = !complete;
    nextButton.classList.toggle("is-disabled", !complete);
  }
  if (guidance) {
    guidance.classList.toggle("complete", complete);
    const text = guidance.querySelector("span:last-child");
    if (text) text.textContent = complete ? "Etapa concluída. Você já pode continuar." : "Preencha os campos obrigatórios desta etapa para continuar.";
  }
}

function showValidationMessage(field, customMessage = "") {
  if (!field) return;
  const container = field.closest(".field, .confirmation");
  const label = container?.querySelector("label");
  const fieldName = label?.textContent?.replace("*", "").trim() || "Este campo";
  document.querySelectorAll(".validation-message").forEach(el => el.remove());
  document.querySelectorAll(".field-error").forEach(el => el.classList.remove("field-error"));
  if (container) {
    container.classList.add("field-error");
    const error = document.createElement("div");
    error.className = "validation-message";
    error.textContent = customMessage || `${fieldName} precisa ser preenchido para continuar.`;
    container.appendChild(error);
  }
  field.scrollIntoView({behavior: "smooth", block: "center"});
  setTimeout(() => field.focus(), 300);
}

function validateStep() {
  const current = getCurrentStepElement();
  if (!current) return true;
  const required = current.querySelectorAll("input[required], textarea[required], select[required]");
  const groups = new Set();
  for (const field of required) {
    if (!isFieldVisible(field)) continue;
    if (field.type === "radio" || field.type === "checkbox") {
      if (groups.has(field.name)) continue;
      groups.add(field.name);
      const checked = Array.from(current.querySelectorAll(`[name="${field.name}"]`)).some(item => isFieldVisible(item) && item.checked);
      if (!checked) { showValidationMessage(field); return false; }
    } else if (!String(field.value || "").trim() || !field.checkValidity()) {
      showValidationMessage(field); return false;
    }
  }
  if (currentStep === 8 && !document.getElementById("confirmRules")?.checked) {
    showValidationMessage(document.getElementById("confirmRules"), "Confirme a revisão antes de concluir.");
    return false;
  }
  return true;
}

nextButton.addEventListener("click", () => {
  if (!validateStep()) return;
  if (currentStep < totalSteps) { showStep(currentStep + 1); scheduleDraftSave(); }
});
prevButton.addEventListener("click", () => {
  if (currentStep > 1) { showStep(currentStep - 1); scheduleDraftSave(); }
});
form.querySelectorAll('input[name="choiceMode"]').forEach(radio => radio.addEventListener("change", updateFeelingChoiceFields));

const reviewFields = [
  ["nickname","Nickname"],["discord","Discord"],["discordUserId","Discord User ID"],["age","Idade"],["choiceMode","Modo de escolha","radio"],
  ["desiredFeeling","Sentimento desejado"],["desiredFeelingReason","Por que escolheu esse Sentimento"],["strongEmotion","Emoção que aparece primeiro"],
  ["goodMomentReaction","Reação a momentos bons"],["badMomentReaction","Reação a momentos ruins"],["emotionControl","Demonstra ou esconde emoções"],
  ["lossReaction","Reação à perda"],["failureReaction","Reação ao fracasso"],["lackOfControl","Reação à falta de controle"],["waitingReaction","Reação à espera e incerteza"],
  ["attachmentStyle","Forma de criar vínculos"],["lettingGo","Criar vínculos ou deixar partir"],["loneliness","Relação com a solidão"],["memoryAttachment","Relação com passado e memórias"],
  ["scenarioLovedOne","Cenário: proteger alguém importante"],["scenarioRecognition","Cenário: outra pessoa recebe reconhecimento"],["scenarioMistake","Cenário: erro que prejudicou alguém"],["scenarioFuture","Cenário: continuar ou desistir"],
  ["bestTrait","Característica mais valorizada"],["hardTrait","Característica mais difícil"],["comparison","Reação à comparação"],["guilt","Relação com culpa"],["fear","Reação ao medo"],
  ["emotionalStory","História emocional"],["hardToLeave","Dificuldade de deixar para trás"],["motivation","O que faz continuar"],["anythingElse","Algo mais"]
];

function escapeHtml(value) {
  return String(value || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
}
function getReviewValue(name, type = "") {
  if (type === "radio") {
    const value = form.querySelector(`input[name="${name}"]:checked`)?.value || "";
    if (name === "choiceMode") return value === "quero_escolher" ? "Quero indicar meu Sentimento" : value === "staff_decide" ? "Prefiro que a Staff avalie" : "";
    return value;
  }
  return form.querySelector(`[name="${name}"]`)?.value?.trim() || "";
}
function generateReview() {
  const container = document.getElementById("reviewContainer");
  container.innerHTML = "";
  reviewFields.forEach(([name,label,type]) => {
    const value = getReviewValue(name,type);
    if (!value) return;
    const item = document.createElement("article");
    item.className = "review-item feeling-review-item";
    item.innerHTML = `<div class="review-label feeling-review-label">${escapeHtml(label)}</div><div class="review-value">${escapeHtml(value)}</div>`;
    container.appendChild(item);
  });
}

function getDraftElements() {
  return {
    statusText: document.getElementById("draftStatusText"), statusTime: document.getElementById("draftStatusTime"), clearButton: document.getElementById("clearDraftButton"),
    draftModal: document.getElementById("draftModal"), draftFoundTime: document.getElementById("draftFoundTime"), restoreButton: document.getElementById("restoreDraftButton"),
    startFreshButton: document.getElementById("startFreshButton"), clearModal: document.getElementById("clearDraftModal"), cancelClearButton: document.getElementById("cancelClearDraftButton"),
    confirmClearButton: document.getElementById("confirmClearDraftButton")
  };
}
function formatDraftTime(timestamp) {
  try { return new Intl.DateTimeFormat("pt-BR", {dateStyle:"short", timeStyle:"short"}).format(new Date(timestamp)); }
  catch (_) { return "Salvo recentemente"; }
}
function collectDraftFields() {
  const data = {};
  form.querySelectorAll("input[name], textarea[name], select[name]").forEach(field => {
    if (field.name === "website" || field.name === "confirmRules") return;
    if (field.type === "radio" || field.type === "checkbox") {
      if (!data[field.name]) data[field.name] = [];
      if (field.checked) data[field.name].push(field.value);
    } else data[field.name] = field.value;
  });
  return data;
}
function hasMeaningfulDraftData(fields) {
  return Object.values(fields || {}).some(value => Array.isArray(value) ? value.length > 0 : String(value || "").trim().length > 0);
}
function updateDraftStatus(timestamp = Date.now(), message = "Rascunho salvo automaticamente") {
  const {statusText,statusTime} = getDraftElements();
  if (statusText) statusText.textContent = message;
  if (statusTime) statusTime.textContent = `Último salvamento: ${formatDraftTime(timestamp)}`;
}
function saveDraftNow() {
  if (formCompleted) return;
  try {
    const fields = collectDraftFields();
    if (!hasMeaningfulDraftData(fields)) return;
    const draft = {version:2, type:"sentimentos", updatedAt:Date.now(), step:currentStep, fields};
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    updateDraftStatus(draft.updatedAt);
  } catch (error) { console.warn("Falha ao salvar rascunho:", error); }
}
function scheduleDraftSave() {
  clearTimeout(draftSaveTimer);
  const {statusText,statusTime} = getDraftElements();
  if (statusText) statusText.textContent = "Salvando rascunho...";
  if (statusTime) statusTime.textContent = "Aguarde um instante.";
  draftSaveTimer = setTimeout(saveDraftNow, DRAFT_SAVE_DELAY);
}
function readDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw);
    if (!draft || draft.type !== "sentimentos" || !draft.updatedAt || Date.now() - draft.updatedAt > DRAFT_MAX_AGE) {
      localStorage.removeItem(DRAFT_STORAGE_KEY); return null;
    }
    return draft;
  } catch (_) { localStorage.removeItem(DRAFT_STORAGE_KEY); return null; }
}
function restoreDraft(draft) {
  if (!draft?.fields) return;
  Object.entries(draft.fields).forEach(([name,value]) => {
    const fields = form.querySelectorAll(`[name="${CSS.escape(name)}"]`);
    fields.forEach(field => {
      if (field.type === "radio" || field.type === "checkbox") {
        const values = Array.isArray(value) ? value.map(String) : [String(value)];
        field.checked = values.includes(String(field.value));
      } else field.value = value == null ? "" : String(value);
    });
  });
  updateFeelingChoiceFields();
  const step = Math.max(1, Math.min(totalSteps, Number(draft.step) || 1));
  showStep(step);
  updateDraftStatus(draft.updatedAt, "Rascunho restaurado");
  if (step === totalSteps) generateReview();
}
function clearStoredDraft() { clearTimeout(draftSaveTimer); localStorage.removeItem(DRAFT_STORAGE_KEY); }
function resetFeelingForm() {
  clearStoredDraft(); form.reset(); updateFeelingChoiceFields(); showStep(1);
  document.querySelectorAll(".validation-message").forEach(el => el.remove());
  document.querySelectorAll(".field-error").forEach(el => el.classList.remove("field-error"));
  const {statusText,statusTime} = getDraftElements();
  statusText.textContent = "Rascunho automático ativo";
  statusTime.textContent = "Seu progresso será salvo neste navegador.";
}
function openModal(element) { element?.classList.remove("hidden"); document.body.classList.add("modal-open"); }
function closeModal(element) {
  element?.classList.add("hidden");
  if (!document.querySelector(".portal-modal:not(.hidden)")) document.body.classList.remove("modal-open");
}
function initializeDraftSystem() {
  const elements = getDraftElements();
  const draft = readDraft();
  if (draft && hasMeaningfulDraftData(draft.fields)) {
    elements.draftFoundTime.textContent = formatDraftTime(draft.updatedAt);
    openModal(elements.draftModal);
  } else { showStep(1); updateFeelingChoiceFields(); }
  elements.restoreButton?.addEventListener("click", () => { restoreDraft(draft); closeModal(elements.draftModal); });
  elements.startFreshButton?.addEventListener("click", () => { resetFeelingForm(); closeModal(elements.draftModal); });
  elements.clearButton?.addEventListener("click", () => openModal(elements.clearModal));
  elements.cancelClearButton?.addEventListener("click", () => closeModal(elements.clearModal));
  elements.confirmClearButton?.addEventListener("click", () => { resetFeelingForm(); closeModal(elements.clearModal); });
  form.addEventListener("input", scheduleDraftSave);
  form.addEventListener("change", scheduleDraftSave);
  window.addEventListener("beforeunload", saveDraftNow);
}

function generateFeelingApplicationId() {
  return `SE-${Math.floor(100000 + Math.random() * 900000)}`;
}

function prepareFeelingFormData(applicationId) {
  const formData = new FormData(form);
  formData.append("form_type", "sentimentos");
  formData.append("application_id", applicationId);
  return formData;
}

async function sendFeelingToGoogleSheets(applicationId) {
  return fetch(GOOGLE_SHEETS_URL, {
    method: "POST",
    mode: "no-cors",
    body: prepareFeelingFormData(applicationId)
  });
}

function showFeelingSubmitSuccess(applicationId) {
  formCompleted = true;
  clearStoredDraft();
  form.classList.add("hidden");
  document.querySelector(".progress-container")?.classList.add("hidden");
  document.getElementById("formGuidance")?.classList.add("hidden");
  document.querySelector(".draft-toolbar")?.classList.add("hidden");
  document.querySelector(".intro")?.classList.add("hidden");
  document.querySelector(".feelings-catalog")?.classList.add("hidden");
  const successId = successScreen.querySelector(".success-id");
  if (successId) successId.innerHTML = `ID da avaliação: <strong>${applicationId}</strong>`;
  successScreen.classList.remove("hidden");
  window.scrollTo({top:0, behavior:"smooth"});
}

form.addEventListener("submit", async event => {
  event.preventDefault();
  if (!validateStep()) return;

  const honeypot = document.getElementById("website");
  if (honeypot && honeypot.value.trim() !== "") {
    console.warn("Envio bloqueado pelo honeypot.");
    return;
  }

  if (Date.now() - formOpenedAt < MINIMUM_FORM_TIME) {
    alert("Aguarde alguns segundos antes de enviar sua avaliação.");
    return;
  }

  const applicationId = generateFeelingApplicationId();
  const originalText = submitButton.textContent;
  submitButton.disabled = true;
  submitButton.textContent = "⏳ Enviando avaliação...";

  try {
    await sendFeelingToGoogleSheets(applicationId);
    showFeelingSubmitSuccess(applicationId);
    console.log(`Avaliação de Sentimento enviada: ${applicationId}`);
  } catch (error) {
    console.error("Erro ao enviar avaliação de Sentimento:", error);
    alert("Não foi possível enviar sua avaliação.\n\nSeu rascunho continua salvo.\n\nVerifique sua conexão e tente novamente.");
    submitButton.disabled = false;
    submitButton.textContent = originalText;
  }
});

form.addEventListener("input", event => {
  const container = event.target.closest(".field, .confirmation");
  if (container) {
    container.classList.remove("field-error");
    container.querySelectorAll(".validation-message").forEach(el => el.remove());
  }
  updateNextButtonState();
});
form.addEventListener("change", updateNextButtonState);
initializeDraftSystem();
console.log("Kael'Thera — Sentimentos Form V2 integrado ao Google Sheets.");

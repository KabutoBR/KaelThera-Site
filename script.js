// ==========================================
// KAEL THERA SMP
// PLAYER APPLICATION — V5
// ==========================================




// ==========================================
// GOOGLE SHEETS / APPS SCRIPT
// ==========================================

const GOOGLE_SHEETS_URL =
    "https://script.google.com/macros/s/AKfycbydLu1yLNP6yfCLWsWi9XhxgZowUhtJ94kFr_D9SgjUyB26j0xsaXaHkfSTbp62FV-g/exec";


// ==========================================
// CONFIGURAÇÃO
// ==========================================

const totalSteps = 8;
let currentStep = 1;

// Momento em que o formulário foi aberto
const formOpenedAt = Date.now();

// Tempo mínimo antes de permitir envio
// Ajuda a bloquear bots que enviam instantaneamente.
const MINIMUM_FORM_TIME = 5000;


// ==========================================
// ELEMENTOS
// ==========================================

const form =
    document.getElementById("playerForm");

const prevButton =
    document.getElementById("prevButton");

const nextButton =
    document.getElementById("nextButton");

const submitButton =
    document.getElementById("submitButton");

const stepNumber =
    document.getElementById("stepNumber");

const stepTitle =
    document.getElementById("stepTitle");

const progressFill =
    document.getElementById("progressFill");

const successScreen =
    document.getElementById("successScreen");

const applicationIdElement =
    document.getElementById("applicationId");


// ==========================================
// TÍTULOS DAS ETAPAS
// ==========================================

const stepTitles = {

    1: "Identificação",

    2: "Perfil de jogador",

    3: "Seu papel no mundo",

    4: "Seu personagem",

    5: "História",

    6: "Poderes e habilidades",

    7: "Roleplay e convivência",

    8: "Revisão"

};


// ==========================================
// MOSTRAR ETAPA
// ==========================================

function showStep(step) {

    const steps =
        document.querySelectorAll(".form-step");


    steps.forEach(element => {

        element.classList.remove("active");


        if (
            Number(element.dataset.step) === step
        ) {

            element.classList.add("active");

        }

    });


    currentStep = step;


    // Número
    if (stepNumber) {

        stepNumber.textContent = step;

    }


    // Título
    if (stepTitle) {

        stepTitle.textContent =
            stepTitles[step];

    }


    // Progresso
    const progress =
        ((step - 1) / (totalSteps - 1)) * 100;


    if (progressFill) {

        progressFill.style.width =
            `${progress}%`;

    }


    // Botão voltar
    if (step === 1) {

        prevButton.classList.add("hidden");

    } else {

        prevButton.classList.remove("hidden");

    }


    // Botões finais
    if (step === totalSteps) {

        nextButton.classList.add("hidden");

        submitButton.classList.remove(
            "hidden"
        );

        generateReview();

    } else {

        nextButton.classList.remove(
            "hidden"
        );

        submitButton.classList.add(
            "hidden"
        );

    }


    // Voltar ao topo
    window.scrollTo({

        top: 0,

        behavior: "smooth"

    });

    requestAnimationFrame(
        updateNextButtonState
    );

}


// ==========================================
// PEGAR VALOR
// ==========================================

function getValue(name) {

    const field =
        form.querySelector(
            `[name="${name}"]`
        );


    if (!field) {

        return "";

    }


    return field.value.trim();

}


// ==========================================
// PEGAR RADIO
// ==========================================

function getRadioValue(name) {

    const selected =
        form.querySelector(
            `input[name="${name}"]:checked`
        );


    return selected
        ? selected.value
        : "";

}


// ==========================================
// PEGAR CHECKBOXES
// ==========================================

function getCheckboxValues(name) {

    const selected =
        form.querySelectorAll(
            `input[name="${name}"]:checked`
        );


    return Array.from(selected)
        .map(
            checkbox => checkbox.value
        );

}


// ==========================================
// ESCAPAR HTML
// ==========================================

function escapeHtml(value) {

    if (!value) {

        return "";

    }


    return String(value)

        .replace(/&/g, "&amp;")

        .replace(/</g, "&lt;")

        .replace(/>/g, "&gt;")

        .replace(/"/g, "&quot;")

        .replace(/'/g, "&#039;");

}


// ==========================================
// VALIDAR ETAPA
// ==========================================

function getCurrentStepElement() {
    return document.querySelector(
        `.form-step[data-step="${currentStep}"]`
    );
}


function isFieldVisible(field) {
    if (!field) {
        return false;
    }

    return !field.closest(".hidden") &&
        field.offsetParent !== null &&
        !field.disabled;
}


function isCurrentStepComplete() {

    const currentStepElement =
        getCurrentStepElement();

    if (!currentStepElement) {
        return true;
    }

    const requiredFields =
        currentStepElement.querySelectorAll(
            "input[required], textarea[required], select[required]"
        );

    const checkedGroups =
        new Set();

    for (const field of requiredFields) {

        if (!isFieldVisible(field)) {
            continue;
        }

        if (
            field.type === "radio" ||
            field.type === "checkbox"
        ) {

            if (checkedGroups.has(field.name)) {
                continue;
            }

            checkedGroups.add(field.name);

            const group =
                currentStepElement.querySelectorAll(
                    `[name="${field.name}"]`
                );

            const hasVisibleChecked =
                Array.from(group).some(
                    input =>
                        isFieldVisible(input) &&
                        input.checked
                );

            if (!hasVisibleChecked) {
                return false;
            }

        } else {

            if (!String(field.value || "").trim()) {
                return false;
            }

            if (!field.checkValidity()) {
                return false;
            }
        }
    }

    // Etapa 2: pelo menos um estilo de jogo.
    if (currentStep === 2) {
        const playStyles =
            getCheckboxValues("playStyle");

        if (playStyles.length === 0) {
            return false;
        }
    }

    // Etapa 8: confirmação final.
    if (currentStep === 8) {
        const confirmRules =
            document.getElementById("confirmRules");

        if (!confirmRules || !confirmRules.checked) {
            return false;
        }
    }

    return true;
}


function updateNextButtonState() {

    const complete =
        isCurrentStepComplete();

    const guidance =
        document.getElementById("formGuidance");

    if (currentStep < totalSteps) {

        nextButton.disabled =
            !complete;

        nextButton.classList.toggle(
            "is-disabled",
            !complete
        );

    }

    if (guidance) {

        guidance.classList.toggle(
            "complete",
            complete
        );

        const text =
            guidance.querySelector(
                "span:last-child"
            );

        if (text) {
            text.textContent =
                complete
                    ? "Etapa concluída. Você já pode continuar."
                    : "Preencha os campos obrigatórios desta etapa para continuar.";
        }
    }
}


function validateStep() {

    const currentStepElement =
        getCurrentStepElement();

    if (!currentStepElement) {
        return true;
    }

    const requiredFields =
        currentStepElement.querySelectorAll(
            "input[required], textarea[required], select[required]"
        );

    const validatedGroups =
        new Set();

    for (const field of requiredFields) {

        if (!isFieldVisible(field)) {
            continue;
        }

        if (
            field.type === "radio" ||
            field.type === "checkbox"
        ) {

            if (validatedGroups.has(field.name)) {
                continue;
            }

            validatedGroups.add(field.name);

            const group =
                currentStepElement.querySelectorAll(
                    `[name="${field.name}"]`
                );

            const checked =
                Array.from(group).some(
                    input =>
                        isFieldVisible(input) &&
                        input.checked
                );

            if (!checked) {
                showValidationMessage(field);
                return false;
            }

        } else {

            if (
                !String(field.value || "").trim() ||
                !field.checkValidity()
            ) {
                showValidationMessage(field);
                return false;
            }
        }
    }

    if (currentStep === 2) {

        const playStyles =
            getCheckboxValues(
                "playStyle"
            );

        if (playStyles.length === 0) {

            const firstOption =
                currentStepElement.querySelector(
                    'input[name="playStyle"]'
                );

            showValidationMessage(
                firstOption,
                "Selecione pelo menos um estilo de jogo."
            );

            return false;
        }
    }

    if (currentStep === 8) {

        const confirmRules =
            document.getElementById(
                "confirmRules"
            );

        if (
            !confirmRules ||
            !confirmRules.checked
        ) {

            showValidationMessage(
                confirmRules,
                "Você precisa confirmar as informações antes de enviar."
            );

            return false;
        }
    }

    return true;
}

// ==========================================
// MENSAGEM DE VALIDAÇÃO
// ==========================================

function showValidationMessage(
    field,
    customMessage = ""
) {

    if (!field) {
        return;
    }

    const fieldContainer =
        field.closest(".field") ||
        field.closest(".confirmation");

    const label =
        fieldContainer
            ?.querySelector("label");

    const fieldName =
        label?.textContent?.replace("*", "").trim() ||
        "Este campo";

    const message =
        customMessage ||
        `${fieldName} precisa ser preenchido para continuar.`;

    document
        .querySelectorAll(".validation-message")
        .forEach(element => element.remove());

    document
        .querySelectorAll(".field-error")
        .forEach(element =>
            element.classList.remove("field-error")
        );

    if (fieldContainer) {

        fieldContainer.classList.add(
            "field-error"
        );

        const error =
            document.createElement("div");

        error.className =
            "validation-message";

        error.textContent =
            message;

        fieldContainer.appendChild(error);
    }

    field.scrollIntoView({
        behavior: "smooth",
        block: "center"
    });

    setTimeout(
        () => field.focus(),
        350
    );
}

// ==========================================
// PRÓXIMO
// ==========================================

nextButton.addEventListener(
    "click",
    () => {

        if (!validateStep()) {

            return;

        }


        if (currentStep < totalSteps) {

            showStep(
                currentStep + 1
            );

        }

    }
);


// ==========================================
// VOLTAR
// ==========================================

prevButton.addEventListener(
    "click",
    () => {

        if (currentStep > 1) {

            showStep(
                currentStep - 1
            );

        }

    }
);


// ==========================================
// PODERES
// ==========================================

const powersFields =
    document.getElementById(
        "powersFields"
    );


const powerRadios =
    document.querySelectorAll(
        'input[name="hasPowers"]'
    );


function updatePowersFields() {

    const selected =
        document.querySelector(
            'input[name="hasPowers"]:checked'
        );


    if (
        !selected ||
        !powersFields
    ) {

        return;

    }


    const hasPowers =
        selected.value === "sim";


    powersFields.classList.toggle(
        "hidden",
        !hasPowers
    );


    const conditionalFields =
        powersFields.querySelectorAll(
            "input, textarea, select"
        );


    conditionalFields.forEach(field => {

        if (
            field.id === "powers" ||
            field.id === "powerOrigin" ||
            field.id === "powerLimitations"
        ) {

            field.required =
                hasPowers;

        }

    });

    updateNextButtonState();

}


powerRadios.forEach(radio => {

    radio.addEventListener(
        "change",
        updatePowersFields
    );

});


updatePowersFields();


// ==========================================
// CAMPOS DA REVISÃO
// ==========================================

const reviewFields = [

    {
        name: "nickname",
        label: "Nickname"
    },

    {
        name: "discord",
        label: "Discord"
    },

    // NOVO
    {
        name: "discordUserId",
        label: "Discord User ID"
    },

    {
        name: "age",
        label: "Idade"
    },

    {
        name: "minecraftTime",
        label: "Tempo jogando Minecraft"
    },

    {
        name: "minecraftExperience",
        label: "Experiência no Minecraft"
    },

    {
        name: "playStyle",
        label: "Estilo de jogo",
        checkbox: true
    },

    {
        name: "buildLevel",
        label: "Nível de construção"
    },

    {
        name: "combatLevel",
        label: "Nível de combate"
    },

    {
        name: "differentExperience",
        label: "Experiência diferenciada"
    },

    {
        name: "smpRole",
        label: "Papel no mundo"
    },

    {
        name: "ownBase",
        label: "Possui base própria"
    },

    {
        name: "baseDescription",
        label: "Descrição da base"
    },

    {
        name: "communityProject",
        label: "Projeto comunitário"
    },

    {
        name: "characterName",
        label: "Nome do personagem"
    },

    {
        name: "characterRace",
        label: "Raça"
    },

    {
        name: "characterAge",
        label: "Idade do personagem"
    },

    {
        name: "profession",
        label: "Profissão"
    },

    {
        name: "personality",
        label: "Personalidade"
    },

    {
        name: "characterGoal",
        label: "Objetivo"
    },

    {
        name: "characterFear",
        label: "Medo"
    },

    {
        name: "characterConflict",
        label: "Conflito"
    },

    {
        name: "backstory",
        label: "História"
    },

    {
        name: "importantEvent",
        label: "Evento importante"
    },

    {
        name: "lorePermission",
        label: "Permissão para usar na lore"
    },

    {
        name: "hasPowers",
        label: "Possui poderes"
    },

    {
        name: "powers",
        label: "Poderes"
    },

    {
        name: "powerOrigin",
        label: "Origem dos poderes"
    },

    {
        name: "powerLimitations",
        label: "Limitações"
    },

    {
        name: "balancePermission",
        label: "Permissão para balanceamento"
    },

    {
        name: "loreConflict",
        label: "Conflito com a lore"
    },

    {
        name: "separateConflict",
        label: "Aceita conflitos separados"
    },

    {
        name: "secretObjectives",
        label: "Objetivos secretos"
    },

    {
        name: "rpLimits",
        label: "Limites de RP"
    },

    {
        name: "whyJoin",
        label: "Por que quer entrar"
    },

    {
        name: "contribution",
        label: "O que pode contribuir"
    }

];


// ==========================================
// GERAR REVISÃO
// ==========================================

function generateReview() {

    const reviewContainer =
        document.getElementById(
            "reviewContainer"
        );


    if (!reviewContainer) {

        return;

    }


    reviewContainer.innerHTML = "";


    reviewFields.forEach(field => {

        let value = "";


        if (field.checkbox) {

            value =
                getCheckboxValues(
                    field.name
                ).join(", ");

        } else {

            const radioValue =
                getRadioValue(
                    field.name
                );


            if (radioValue) {

                value = radioValue;

            } else {

                value =
                    getValue(
                        field.name
                    );

            }

        }


        if (!value) {

            return;

        }


        const card =
            document.createElement(
                "div"
            );


        card.className =
            "review-card";


        card.innerHTML = `

            <span class="review-label">
                ${escapeHtml(field.label)}
            </span>

            <div class="review-value">
                ${escapeHtml(value)}
            </div>

        `;


        reviewContainer.appendChild(card);

    });

}


// ==========================================
// GERAR ID
// ==========================================

function generateApplicationId() {

    const randomNumber =
        Math.floor(
            100000 +
            Math.random() * 900000
        );


    return `KT-${randomNumber}`;

}


// ==========================================
// DATA E HORA
// ==========================================

function getSubmissionDate() {

    const now = new Date();


    return new Intl.DateTimeFormat(
        "pt-BR",
        {
            dateStyle: "full",
            timeStyle: "medium"
        }
    ).format(now);

}


// ==========================================
// CONSTRUIR UMA LINHA DO E-MAIL
// ==========================================

function emailLine(label, value) {

    if (
        value === undefined ||
        value === null ||
        value === ""
    ) {

        return `${label}: Não informado`;

    }


    return `${label}: ${value}`;

}


// ==========================================
// GERAR CONTEÚDO ORGANIZADO DO E-MAIL
// ==========================================

function generateEmailMessage(applicationId) {

    const submissionDate =
        getSubmissionDate();


    // ======================================
    // IDENTIFICAÇÃO
    // ======================================

    const nickname =
        getValue("nickname");

    const discord =
        getValue("discord");

    // NOVO
    const discordUserId =
        getValue("discordUserId");

    const age =
        getValue("age");

    const minecraftTime =
        getRadioValue(
            "minecraftTime"
        );

    const minecraftExperience =
        getValue(
            "minecraftExperience"
        );


    // ======================================
    // PERFIL
    // ======================================

    const playStyle =
        getCheckboxValues(
            "playStyle"
        ).join(", ");

    const buildLevel =
        getRadioValue(
            "buildLevel"
        );

    const combatLevel =
        getRadioValue(
            "combatLevel"
        );

    const differentExperience =
        getValue(
            "differentExperience"
        );


    // ======================================
    // MUNDO
    // ======================================

    const smpRole =
        getRadioValue(
            "smpRole"
        );

    const ownBase =
        getRadioValue(
            "ownBase"
        );

    const baseDescription =
        getValue(
            "baseDescription"
        );

    const communityProject =
        getValue(
            "communityProject"
        );


    // ======================================
    // PERSONAGEM
    // ======================================

    const characterName =
        getValue(
            "characterName"
        );

    const characterRace =
        getValue(
            "characterRace"
        );

    const characterAge =
        getValue(
            "characterAge"
        );

    const profession =
        getValue(
            "profession"
        );

    const personality =
        getValue(
            "personality"
        );

    const characterGoal =
        getValue(
            "characterGoal"
        );

    const characterFear =
        getValue(
            "characterFear"
        );

    const characterConflict =
        getValue(
            "characterConflict"
        );


    // ======================================
    // HISTÓRIA
    // ======================================

    const backstory =
        getValue(
            "backstory"
        );

    const importantEvent =
        getValue(
            "importantEvent"
        );

    const lorePermission =
        getRadioValue(
            "lorePermission"
        );


    // ======================================
    // PODERES
    // ======================================

    const hasPowers =
        getRadioValue(
            "hasPowers"
        );

    const powers =
        getValue(
            "powers"
        );

    const powerOrigin =
        getValue(
            "powerOrigin"
        );

    const powerLimitations =
        getValue(
            "powerLimitations"
        );

    const balancePermission =
        getRadioValue(
            "balancePermission"
        );


    // ======================================
    // ROLEPLAY
    // ======================================

    const loreConflict =
        getValue(
            "loreConflict"
        );

    const separateConflict =
        getRadioValue(
            "separateConflict"
        );

    const secretObjectives =
        getValue(
            "secretObjectives"
        );

    const rpLimits =
        getValue(
            "rpLimits"
        );

    const whyJoin =
        getValue(
            "whyJoin"
        );

    const contribution =
        getValue(
            "contribution"
        );


    // ======================================
    // MONTAR E-MAIL
    // ======================================

    return `

══════════════════════════════════════════
              KAEL THERA SMP
              NOVA INSCRIÇÃO
══════════════════════════════════════════

ID DA INSCRIÇÃO: ${applicationId}
DATA: ${submissionDate}
STATUS: NOVA INSCRIÇÃO


──────────────────────────────────────────
👤 IDENTIFICAÇÃO
──────────────────────────────────────────

${emailLine("Nickname", nickname)}

${emailLine("Discord", discord)}

${emailLine("Discord User ID", discordUserId)}

${emailLine("Idade", age)}

${emailLine(
    "Tempo jogando Minecraft",
    minecraftTime
)}

${emailLine(
    "Experiência no Minecraft",
    minecraftExperience
)}


──────────────────────────────────────────
🎮 PERFIL DE JOGADOR
──────────────────────────────────────────

${emailLine(
    "Estilo de jogo",
    playStyle
)}

${emailLine(
    "Nível de construção",
    buildLevel
)}

${emailLine(
    "Nível de combate",
    combatLevel
)}

${emailLine(
    "Experiência diferenciada",
    differentExperience
)}


──────────────────────────────────────────
🏰 SEU PAPEL NO MUNDO
──────────────────────────────────────────

${emailLine(
    "Papel no mundo",
    smpRole
)}

${emailLine(
    "Possui base própria",
    ownBase
)}

${emailLine(
    "Descrição da base",
    baseDescription
)}

${emailLine(
    "Projeto comunitário",
    communityProject
)}


──────────────────────────────────────────
📖 SEU PERSONAGEM
──────────────────────────────────────────

${emailLine(
    "Nome",
    characterName
)}

${emailLine(
    "Raça",
    characterRace
)}

${emailLine(
    "Idade",
    characterAge
)}

${emailLine(
    "Profissão",
    profession
)}

${emailLine(
    "Personalidade",
    personality
)}

${emailLine(
    "Objetivo",
    characterGoal
)}

${emailLine(
    "Medo",
    characterFear
)}

${emailLine(
    "Conflito",
    characterConflict
)}


──────────────────────────────────────────
📜 HISTÓRIA
──────────────────────────────────────────

${emailLine(
    "História",
    backstory
)}

${emailLine(
    "Evento importante",
    importantEvent
)}

${emailLine(
    "Permissão para uso na lore",
    lorePermission
)}


──────────────────────────────────────────
✨ PODERES E HABILIDADES
──────────────────────────────────────────

${emailLine(
    "Possui poderes",
    hasPowers
)}

${emailLine(
    "Poderes",
    powers
)}

${emailLine(
    "Origem dos poderes",
    powerOrigin
)}

${emailLine(
    "Limitações",
    powerLimitations
)}

${emailLine(
    "Permissão para balanceamento",
    balancePermission
)}


──────────────────────────────────────────
🤝 ROLEPLAY E CONVIVÊNCIA
──────────────────────────────────────────

${emailLine(
    "Conflito com a lore",
    loreConflict
)}

${emailLine(
    "Aceita conflitos separados",
    separateConflict
)}

${emailLine(
    "Objetivos secretos",
    secretObjectives
)}

${emailLine(
    "Limites de RP",
    rpLimits
)}

${emailLine(
    "Por que quer entrar",
    whyJoin
)}

${emailLine(
    "O que pode contribuir",
    contribution
)}


══════════════════════════════════════════
        ID: ${applicationId}
        KAEL THERA SMP
══════════════════════════════════════════

Esta inscrição foi enviada através
do formulário oficial do Kael Thera SMP.
`;

}

// ==========================================
// PREPARAR DADOS
// ==========================================

function prepareFormData(
    applicationId
) {

    const formData =
        new FormData(form);


    // ======================================
    // ID
    // ======================================

    formData.append(
        "application_id",
        applicationId
    );


    // ======================================
    // PLAYSTYLE
    // ======================================

    const playStyles =
        getCheckboxValues(
            "playStyle"
        );


    formData.delete(
        "playStyle"
    );


    formData.append(
        "playStyle",
        playStyles.join(", ")
    );


    return formData;

}


// ==========================================
// ENVIAR PARA GOOGLE SHEETS — FONTE OFICIAL
// ==========================================

async function sendToGoogleSheets(
    applicationId
) {

    const formData =
        prepareFormData(
            applicationId
        );


    /*
        O Apps Script é um endpoint público.

        Usamos "no-cors" porque o navegador pode
        bloquear a leitura da resposta do Apps Script
        por causa das regras de CORS.

        A requisição é enviada normalmente,
        mas o navegador não permite que o JavaScript
        leia o conteúdo da resposta.
    */

    const response =
        await fetch(
            GOOGLE_SHEETS_URL,
            {
                method: "POST",
                mode: "no-cors",
                body: formData
            }
        );


    return response;

}

// ==========================================
// ENVIO FINAL
// ==========================================

form.addEventListener(
    "submit",
    async event => {

        event.preventDefault();


        // ==================================
        // VALIDAÇÃO
        // ==================================

        if (!validateStep()) {

            return;

        }


        // ==================================
        // HONEYPOT
        // ==================================

        const honeypot =
            document.getElementById(
                "website"
            );


        if (
            honeypot &&
            honeypot.value.trim() !== ""
        ) {

            console.warn(
                "Envio bloqueado pelo honeypot."
            );

            return;

        }


        // ==================================
        // PROTEÇÃO CONTRA ENVIO INSTANTÂNEO
        // ==================================

        const elapsedTime =
            Date.now() -
            formOpenedAt;


        if (
            elapsedTime <
            MINIMUM_FORM_TIME
        ) {

            alert(
                "Aguarde alguns segundos antes de enviar a inscrição."
            );

            return;

        }


        // ==================================
        // GERAR ID
        // ==================================

        const applicationId =
            generateApplicationId();


        // ==================================
        // DESABILITAR BOTÃO
        // ==================================

        const originalText =
            submitButton.textContent;


        submitButton.disabled =
            true;


        submitButton.textContent =
            "⏳ Enviando inscrição...";


        try {


            // ==================================
            // GOOGLE SHEETS
            // ==================================

            await sendToGoogleSheets(
                applicationId
            );


            // ==================================
            // SUCESSO
            // ==================================

            if (applicationIdElement) {

                applicationIdElement.textContent =
                    applicationId;

            }


            // ==================================
            // ESCONDER FORMULÁRIO
            // ==================================

            form.classList.add(
                "hidden"
            );


            prevButton.classList.add(
                "hidden"
            );


            nextButton.classList.add(
                "hidden"
            );


            submitButton.classList.add(
                "hidden"
            );


            // ==================================
            // ESCONDER PROGRESSO
            // ==================================

            const progressContainer =
                document.querySelector(
                    ".progress-container"
                );


            if (progressContainer) {

                progressContainer.classList.add(
                    "hidden"
                );

            }


            // ==================================
            // ESCONDER INTRO
            // ==================================

            const intro =
                document.querySelector(
                    ".intro"
                );


            if (intro) {

                intro.classList.add(
                    "hidden"
                );

            }


            // ==================================
            // MOSTRAR SUCESSO
            // ==================================

            successScreen.classList.remove(
                "hidden"
            );


            // ==================================
            // TOPO
            // ==================================

            window.scrollTo({

                top: 0,

                behavior: "smooth"

            });


            console.log(
                `Inscrição enviada com sucesso: ${applicationId}`
            );


        } catch (error) {

            console.error(
                "Erro ao enviar inscrição:",
                error
            );


            alert(
                "Não foi possível enviar sua inscrição.\n\n" +
                "Sua inscrição NÃO foi confirmada.\n\n" +
                "Verifique sua conexão e tente novamente.\n\n" +
                "Detalhes: " +
                error.message
            );


            // ==================================
            // RESTAURAR BOTÃO
            // ==================================

            submitButton.disabled =
                false;


            submitButton.textContent =
                originalText;

        }

    }
);


// ==========================================
// INICIALIZAÇÃO
// ==========================================



// ==========================================
// VALIDAÇÃO EM TEMPO REAL
// ==========================================

form.addEventListener(
    "input",
    event => {

        const container =
            event.target.closest(
                ".field, .confirmation"
            );

        if (container) {
            container.classList.remove(
                "field-error"
            );

            container
                .querySelectorAll(
                    ".validation-message"
                )
                .forEach(
                    element => element.remove()
                );
        }

        updateNextButtonState();
    }
);


form.addEventListener(
    "change",
    () => {
        updateNextButtonState();
    }
);


showStep(1);

updatePowersFields();


// ==========================================
// CONSOLE
// ==========================================

console.log(
    "Kael Thera SMP — Player Form V5 carregado."
);

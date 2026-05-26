/* ==========================================================================
   PROMPTERQUEST: MOTOR DE JUEGO Y LOGICA DE APRENDIZAJE CON INTEGRACION FIREBASE Y PANEL DOCENTE
   ========================================================================= */

// ==========================================================================
// 1. CONFIGURACIÓN DE CREDENCIALES DE GOOGLE FIREBASE (MODO HÍBRIDO)
// ==========================================================================
// Prof: Cuando crees tu proyecto en la consola de Firebase, reemplaza este
// objeto con los datos que te proveerá la consola.
const firebaseConfig = {
  apiKey: "AIzaSyDYkrfSeq4u8sCGHcVfFnAo3JrHlQb2yYM",
  authDomain: "prompterquest.firebaseapp.com",
  projectId: "prompterquest",
  storageBucket: "prompterquest.firebasestorage.app",
  messagingSenderId: "454809612422",
  appId: "1:454809612422:web:f284b4c58ecf92a7dd2107",
  measurementId: "G-0Q9T8DQDYW"
};

let isFirebaseEnabled = false;
let db = null;
let currentUser = null;

// Inicialización Segura
try {
    if (firebaseConfig.apiKey && firebaseConfig.apiKey !== "TU_API_KEY_AQUI") {
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        isFirebaseEnabled = true;
        console.log("☁️ Firebase inicializado correctamente. Modo Nube activado.");
    } else {
        console.log("ℹ️ Firebase no configurado aún o usando valores por defecto. Modo Local Activado (localStorage).");
    }
} catch (e) {
    console.error("⚠️ Error de inicialización de Firebase. Iniciando en Modo Local de respaldo.", e);
}

// ==========================================================================
// 2. ESTADO GLOBAL DE LA APLICACIÓN (Persistencia con LocalStorage)
// ==========================================================================
const DEFAULT_GAME_STATE = {
    username: "Estudiante Prompter",
    email: "local@colegio.cl",
    avatarEmoji: "🚀",
    xp: 0,
    level: 1,
    streak: 1,
    hearts: 5,
    lessonsCompleted: [], // Array de IDs de lecciones completadas, ej: "1_1"
    activeView: "dashboard",
    theme: "dark",
    course: "",
    institution: "",
    role: "student"
};

const defaultInstitutions = [
    "Liceo Polivalente Juan A. Ríos",
    "Falcon College",
    "Fundación Yuntagape"
];
const defaultCourses = ["1° Medio", "2° Medio", "3° Medio", "4° Medio"];

let institutionsList = [...defaultInstitutions];
let coursesList = [...defaultCourses];

let gameState = { ...DEFAULT_GAME_STATE };
let isTeacherAuthorized = false; // Estado de seguridad de panel docente

// Sincronizar Colegios y Cursos de forma dinámica
async function syncInstitutionsAndCourses() {
    if (isFirebaseEnabled && db) {
        try {
            const instDoc = await db.collection("config").doc("institutions").get();
            if (instDoc.exists) {
                institutionsList = instDoc.data().list || [];
            } else {
                await db.collection("config").doc("institutions").set({ list: defaultInstitutions });
                institutionsList = [...defaultInstitutions];
            }
            
            const courDoc = await db.collection("config").doc("courses").get();
            if (courDoc.exists) {
                coursesList = courDoc.data().list || [];
            } else {
                await db.collection("config").doc("courses").set({ list: defaultCourses });
                coursesList = [...defaultCourses];
            }
            
            // Guardar localmente como respaldo
            localStorage.setItem("prompterquest_institutions", JSON.stringify(institutionsList));
            localStorage.setItem("prompterquest_courses", JSON.stringify(coursesList));
        } catch (e) {
            console.error("Error al sincronizar configuración con Firebase Firestore:", e);
            loadLocalInstitutionsAndCourses();
        }
    } else {
        loadLocalInstitutionsAndCourses();
    }
}

function loadLocalInstitutionsAndCourses() {
    const savedInst = localStorage.getItem("prompterquest_institutions");
    const savedCour = localStorage.getItem("prompterquest_courses");
    if (savedInst) {
        try { institutionsList = JSON.parse(savedInst); } catch (e) { institutionsList = [...defaultInstitutions]; }
    } else {
        institutionsList = [...defaultInstitutions];
    }
    if (savedCour) {
        try { coursesList = JSON.parse(savedCour); } catch (e) { coursesList = [...defaultCourses]; }
    } else {
        coursesList = [...defaultCourses];
    }
}

async function saveInstitutions() {
    localStorage.setItem("prompterquest_institutions", JSON.stringify(institutionsList));
    if (isFirebaseEnabled && db) {
        try {
            await db.collection("config").doc("institutions").set({ list: institutionsList });
        } catch (e) {
            console.error("Error al guardar establecimientos en Firebase Firestore:", e);
        }
    }
    populateDropdowns();
}

async function saveCourses() {
    localStorage.setItem("prompterquest_courses", JSON.stringify(coursesList));
    if (isFirebaseEnabled && db) {
        try {
            await db.collection("config").doc("courses").set({ list: coursesList });
        } catch (e) {
            console.error("Error al guardar cursos en Firebase Firestore:", e);
        }
    }
    populateDropdowns();
}

function populateDropdowns() {
    const selectOnboardingInst = document.getElementById("select-onboarding-institution");
    const selectOnboardingCour = document.getElementById("select-onboarding-course");
    const selectProfileInst = document.getElementById("select-profile-institution");
    const selectProfileCour = document.getElementById("select-profile-course");
    
    // Rellenar Establecimientos
    let instOptions = `<option value="" disabled selected>Selecciona tu colegio o liceo...</option>`;
    institutionsList.forEach(inst => {
        instOptions += `<option value="${escapeHTML(inst)}">${escapeHTML(inst)}</option>`;
    });
    
    if (selectOnboardingInst) selectOnboardingInst.innerHTML = instOptions;
    if (selectProfileInst) {
        selectProfileInst.innerHTML = instOptions;
        if (gameState.institution) selectProfileInst.value = gameState.institution;
    }
    
    // Rellenar Cursos
    let courOptions = `<option value="" disabled selected>Selecciona tu curso...</option>`;
    coursesList.forEach(cour => {
        courOptions += `<option value="${escapeHTML(cour)}">${escapeHTML(cour)}</option>`;
    });
    
    if (selectOnboardingCour) selectOnboardingCour.innerHTML = courOptions;
    if (selectProfileCour) {
        selectProfileCour.innerHTML = courOptions;
        if (gameState.course) selectProfileCour.value = gameState.course;
    }
}

function checkOnboarding() {
    const overlay = document.getElementById("onboarding-overlay");
    if (!overlay) return;
    
    if (!gameState.course || !gameState.institution) {
        overlay.classList.remove("hidden");
        populateDropdowns();
        
        // Selector de avatar interactivo en Onboarding
        const onboardingAvatarPreview = document.getElementById("onboarding-avatar-preview");
        if (onboardingAvatarPreview) onboardingAvatarPreview.innerText = gameState.avatarEmoji || "🚀";
        
        const onboardingOpts = document.querySelectorAll("#onboarding-overlay .avatar-opt");
        onboardingOpts.forEach(opt => {
            opt.classList.remove("active");
            if (opt.getAttribute("data-emoji") === gameState.avatarEmoji) {
                opt.classList.add("active");
            }
            opt.onclick = () => {
                playSound('click');
                onboardingOpts.forEach(o => o.classList.remove("active"));
                opt.classList.add("active");
                gameState.avatarEmoji = opt.getAttribute("data-emoji");
                if (onboardingAvatarPreview) {
                    onboardingAvatarPreview.innerText = gameState.avatarEmoji;
                    onboardingAvatarPreview.classList.add("animate-pop");
                    setTimeout(() => onboardingAvatarPreview.classList.remove("animate-pop"), 300);
                }
            };
        });
    } else {
        overlay.classList.add("hidden");
    }
}

function loadGameState() {
    // El progreso se lee y maneja exclusivamente desde la nube de Firebase Firestore.
    // Solo inicializamos el estado base si no hay sesión iniciada de alumno.
    if (!currentUser) {
        gameState = { ...DEFAULT_GAME_STATE };
    }
    applyTheme(gameState.theme);
    updateGlobalUIStats();
    renderLeaderboard();
    renderAchievements();
}

// Guardar estado en la Nube
async function saveGameState() {
    updateGlobalUIStats();

    if (isFirebaseEnabled && currentUser) {
        try {
            await db.collection("users").doc(currentUser.uid).set(gameState);
            console.log("☁️ Progreso sincronizado con éxito en Firebase Firestore.");
        } catch (error) {
            console.error("❌ Error al guardar progreso en la nube:", error);
        }
    }
}

// Cargar progreso asincrónico desde la nube
async function loadCloudProgress(user) {
    if (!isFirebaseEnabled || !user) return;
    try {
        const doc = await db.collection("users").doc(user.uid).get();
        if (doc.exists) {
            gameState = { ...DEFAULT_GAME_STATE, ...doc.data() };
            gameState.email = user.email; // Asegurar vinculación de correo
            console.log("☁️ Progreso recuperado con éxito desde Firestore.");
        } else {
            console.log("🆕 Usuario nuevo detectado en la nube. Sincronizando progreso actual en Firestore.");
            gameState.email = user.email;
            await db.collection("users").doc(user.uid).set(gameState);
        }
        
        updateGlobalUIStats();
        updateDashboardNodes();
        renderLeaderboard();
        renderAchievements();
        
        // Sincronizar configuraciones y verificar onboarding
        await syncInstitutionsAndCourses();
        checkOnboarding();
        initProfileView();
    } catch (error) {
        console.error("❌ Error al cargar progreso desde la nube:", error);
    }
}

// Reiniciar estado
function resetGameState() {
    if (confirm("¿Estás seguro de que quieres borrar todo tu progreso y empezar desde cero?")) {
        gameState = { ...DEFAULT_GAME_STATE };
        gameState.lessonsCompleted = [];
        saveGameState();
        loadGameState();
        updateDashboardNodes();
        initSandbox();
        showView("dashboard");
        alert("¡Aventura reiniciada con éxito! Mucha suerte.");
    }
}

// ==========================================================================
// 3. EFECTOS DE SONIDO SINTETIZADOS (Web Audio API)
// ==========================================================================
let audioCtx = null;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function playSound(type) {
    try {
        initAudio();
        if (!audioCtx) return;
        
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }

        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        const now = audioCtx.currentTime;

        if (type === 'correct') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(523.25, now); 
            osc.frequency.setValueAtTime(659.25, now + 0.08); 
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 0.25);
            osc.start(now);
            osc.stop(now + 0.25);
        } else if (type === 'incorrect') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(150, now);
            osc.frequency.linearRampToValueAtTime(70, now + 0.3);
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 0.3);
            osc.start(now);
            osc.stop(now + 0.3);
        } else if (type === 'victory') {
            const notes = [261.63, 329.63, 392.00, 523.25];
            notes.forEach((freq, idx) => {
                const noteOsc = audioCtx.createOscillator();
                const noteGain = audioCtx.createGain();
                noteOsc.connect(noteGain);
                noteGain.connect(audioCtx.destination);
                
                noteOsc.type = 'triangle';
                noteOsc.frequency.setValueAtTime(freq, now + idx * 0.12);
                noteGain.gain.setValueAtTime(0.12, now + idx * 0.12);
                noteGain.gain.linearRampToValueAtTime(0.01, now + idx * 0.12 + 0.3);
                
                noteOsc.start(now + idx * 0.12);
                noteOsc.stop(now + idx * 0.12 + 0.3);
            });
        } else if (type === 'click') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(600, now);
            gain.gain.setValueAtTime(0.05, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 0.05);
            osc.start(now);
            osc.stop(now + 0.05);
        }
    } catch (e) {
        console.warn("La API Web Audio no pudo inicializarse:", e);
    }
}

// ==========================================================================
// 4. BASE DE DATOS DE EJERCICIOS Y LECCIONES (RCTF, CREA, CREATE)
// ==========================================================================
const lessonsData = {
    // UNIDAD 1: FUNDAMENTOS
    "1_1": {
        id: "1_1",
        title: "Unidad 1 - Lección 1: ¿Qué es un Prompt?",
        questions: [
            {
                type: "multiple-choice",
                instruction: "¿Qué es un 'Prompt' en el contexto de la Inteligencia Artificial?",
                options: [
                    "Un virus de computadora que daña los archivos.",
                    "(Recomendado) La instrucción, texto o comando que le das a una IA para guiar su respuesta.",
                    "Un cable físico que conecta la tarjeta madre con el procesador.",
                    "El nombre de la empresa que creó a ChatGPT."
                ],
                correctAnswer: 1,
                explanation: "Un prompt es cualquier indicación, pregunta o instrucción en texto que escribimos para que un modelo de IA sepa exactamente qué queremos que haga."
            },
            {
                type: "multiple-choice",
                instruction: "Si ingresas un prompt vago y de mala calidad, ¿qué tipo de respuesta obtendrás de la IA?",
                options: [
                    "Una respuesta increíblemente detallada gracias a la magia de la tecnología.",
                    "La IA no responderá y se apagará tu computadora.",
                    "(Recomendado) Una respuesta vaga, genérica y de baja calidad debido al principio de GIGO.",
                    "Un poema sobre el invierno."
                ],
                correctAnswer: 2,
                explanation: "El principio 'Garbage In, Garbage Out' (basura entra, basura sale) significa que la calidad de la respuesta de una IA depende directamente de la calidad de tus instrucciones."
            },
            {
                type: "puzzle",
                instruction: "Ordena los bloques para construir un prompt simple pero claro:",
                blocks: ["Escribe", "un poema corto", "sobre un robot feliz", "en formato de lista"],
                correctOrder: ["Escribe", "un poema corto", "sobre un robot feliz", "en formato de lista"],
                explanation: "Los prompts organizados con la acción primero ('Escribe'), el tema ('un poema sobre un robot') y el formato ('en formato de lista') son mucho más efectivos."
            }
        ]
    },
    "1_2": {
        id: "1_2",
        title: "Unidad 1 - Lección 2: Claridad e Instrucciones",
        questions: [
            {
                type: "multiple-choice",
                instruction: "¿Cuál de los siguientes prompts es más ESPECÍFICO y claro?",
                options: [
                    "Háblame sobre los planetas.",
                    "Dame información de ciencias.",
                    "Escribe cosas del espacio exterior.",
                    "(Recomendado) Explica las diferencias entre Marte y la Tierra en un párrafo de 4 líneas."
                ],
                correctAnswer: 3,
                explanation: "Este prompt define exactamente el tema (diferencias entre Marte y la Tierra) y las restricciones de formato (un párrafo de 4 líneas)."
            },
            {
                type: "multiple-choice",
                instruction: "Al escribir un prompt, la especificidad consiste en:",
                options: [
                    "Escribir textos gigantescos con muchas palabras confusas.",
                    "(Recomendado) Entregar detalles claros, objetivos y límites precisos para guiar a la IA.",
                    "Preguntarle a la IA qué tal está su día.",
                    "Traducir las palabras al inglés para que se entiendan mejor."
                ],
                correctAnswer: 1,
                explanation: "Ser específico reduce la ambigüedad y le da un marco de trabajo preciso a la red neuronal."
            }
        ]
    },
    "1_3": {
        id: "1_3",
        title: "Unidad 1 - Lección 3: El peligro del GIGO",
        questions: [
            {
                type: "multiple-choice",
                instruction: "¿Qué significan las siglas 'GIGO'?",
                options: [
                    "Generative Intelligent Government Operator.",
                    "Gigabytes Input, Gigabytes Output.",
                    "(Recomendado) Garbage In, Garbage Out (Basura entra, Basura sale).",
                    "Gran Instrucción Genera Oro."
                ],
                correctAnswer: 2,
                explanation: "GIGO es un concepto informático clásico: si introduces datos basura o instrucciones confusas, el resultado obligatoriamente será de mala calidad."
            },
            {
                type: "checkbox",
                instruction: "Selecciona las DOS fallas que hacen que este prompt sea 'GIGO':\n\"Haz una tarea escolar\"",
                options: [
                    "No especifica la materia o el tema de la tarea.",
                    "Usa la palabra 'tarea' en minúsculas.",
                    "No indica qué formato de entrega necesita (resumen, lista, etc.).",
                    "Es demasiado largo para la IA."
                ],
                correctAnswer: [0, 2],
                explanation: "Un prompt como 'Haz una tarea escolar' no tiene contexto, no tiene un rol definido, no explica el tema de la tarea y no especifica el formato."
            }
        ]
    },

    // UNIDAD 2: FRAMEWORK RCTF
    "2_1": {
        id: "2_1",
        title: "Unidad 2 - Lección 1: Asignar un Rol",
        questions: [
            {
                type: "multiple-choice",
                instruction: "En el framework RCTF, ¿cuál es el objetivo del componente 'Rol' (R)?",
                options: [
                    "Controlar el tiempo que tarda la IA en responder.",
                    "Cambiar el idioma de la conversación.",
                    "(Recomendado) Darle una identidad, personalidad o profesión experta a la IA.",
                    "Crear un juego de rol con dados virtuales."
                ],
                correctAnswer: 2,
                explanation: "Asignar un rol ('Actúa como un experto en...') ayuda a la IA a priorizar palabras y conceptos propios de esa profesión en su base de datos."
            },
            {
                type: "puzzle",
                instruction: "Ordena los bloques para iniciar un prompt asignando un ROL perfecto:",
                blocks: ["Actúa como", "un programador experto en Python", "y diseña un juego simple"],
                correctOrder: ["Actúa como", "un programador experto en Python", "y diseña un juego simple"],
                explanation: "La fórmula ideal de rol es 'Actúa como [Identidad experta]' seguido de la tarea."
            },
            {
                type: "multiple-choice",
                instruction: "¿Qué opción define un mejor ROL para explicar la caída del Imperio Romano?",
                options: [
                    "Actúa como un robot divertido.",
                    "(Recomendado) Actúa como un profesor universitario experto en historia clásica.",
                    "Actúa como una persona que leyó un libro ayer.",
                    "Hola IA, cuéntame de Roma."
                ],
                correctAnswer: 1,
                explanation: "Un profesor experto en historia clásica le dará a la IA un tono académico, preciso y pedagógico ideal para este tema histórico."
            }
        ]
    },
    "2_2": {
        id: "2_2",
        title: "Unidad 2 - Lección 2: Contexto y Tarea",
        questions: [
            {
                type: "multiple-choice",
                instruction: "En RCTF, ¿cuál es la diferencia clave entre el Contexto (C) y la Tarea (T)?",
                options: [
                    "El contexto es la Tarea en inglés.",
                    "(Recomendado) La Tarea es la acción directa (ej: escribe un resumen), y el Contexto es la situación de fondo o público objetivo (ej: para estudiantes de primero medio).",
                    "La Tarea es opcional y el Contexto es obligatorio.",
                    "No hay diferencia, son exactamente lo mismo."
                ],
                correctAnswer: 1,
                explanation: "La tarea es el 'qué' (la acción), mientras que el contexto define el 'entorno, limitaciones o destinatarios' (el por qué o para quién)."
            },
            {
                type: "puzzle",
                instruction: "Une los bloques para definir ROL, CONTEXTO y TAREA en orden lógico:",
                blocks: ["Como entrenador deportivo,", "para estudiantes de primero medio,", "diseña una rutina de calentamiento de 5 minutos"],
                correctOrder: ["Como entrenador deportivo,", "para estudiantes de primero medio,", "diseña una rutina de calentamiento de 5 minutos"],
                explanation: "Al combinar Rol ('Como entrenador'), Contexto ('para alumnos de primero medio') y Tarea ('rutina de calentamiento'), la IA puede adaptar el nivel del ejercicio perfectamente."
            },
            {
                type: "checkbox",
                instruction: "Revisa este prompt: \"Actúa como chef y escríbeme una receta de tarta de manzana\". ¿Qué componente de RCTF FALTA de forma crítica?",
                options: [
                    "Falta la Tarea.",
                    "Falta el Rol.",
                    "Falta el Contexto (¿es para celíacos?, ¿para cuántas personas?, ¿cuál es la situación?).",
                    "Falta el Formato (¿tabla?, ¿lista de pasos?, ¿un párrafo?)."
                ],
                correctAnswer: [2, 3],
                explanation: "Falta el Contexto (por ejemplo: 'para personas sin horno' o 'alérgenas') y el Formato (por ejemplo: 'en una lista con tiempos de cocción'). ¡Por eso el prompt es incompleto!"
            }
        ]
    },
    "2_3": {
        id: "2_3",
        title: "Unidad 2 - Lección 3: Formatos de Salida",
        questions: [
            {
                type: "multiple-choice",
                instruction: "¿Por qué es importante definir el 'Formato' (F) en un prompt?",
                options: [
                    "(Recomendado) Porque le dice a la IA exactamente cómo estructurar y presentar visualmente la respuesta (tablas, código, listas, etc.).",
                    "Porque hace que la IA gaste menos internet.",
                    "Para formatear o borrar el disco duro del computador.",
                    "Para que la respuesta sea más romántica."
                ],
                correctAnswer: 0,
                explanation: "Especificar el formato ('en una tabla de dos columnas', 'en formato JSON', 'como una lista con viñetas') ahorra tiempo y nos entrega el resultado listo para copiar y usar."
            },
            {
                type: "puzzle",
                instruction: "Ordena los bloques para estructurar el FORMATO al final del prompt:",
                blocks: ["Como nutricionista,", "crea una minuta diaria saludable", "y preséntala en una tabla con columnas para desayuno, almuerzo y cena."],
                correctOrder: ["Como nutricionista,", "crea una minuta diaria saludable", "y preséntala en una tabla con columnas para desayuno, almuerzo y cena."],
                explanation: "El formato se añade de manera natural al final para sellar cómo deseamos recibir la información estructurada."
            }
        ]
    },
    "2_4": {
        id: "2_4",
        title: "Unidad 2 - Desafío: Armando un RCTF",
        questions: [
            {
                type: "checkbox",
                instruction: "Identifica qué elementos de RCTF están presentes en este prompt:\n\"Como profesor de música (R), diseña un quiz sobre bandas chilenas para mi clase de 14 años (C), escribiendo 5 preguntas (T) con opciones de la A a la D (F)\"",
                options: [
                    "Rol (R)",
                    "Contexto (C)",
                    "Tarea (T)",
                    "Formato (F)"
                ],
                correctAnswer: [0, 1, 2, 3],
                explanation: "¡Excelente! Este es un prompt perfecto de 100/100 porque contiene todos los componentes del framework RCTF de manera armónica."
            },
            {
                type: "puzzle",
                instruction: "Arma el prompt RCTF definitivo para estudiar ciencias:",
                blocks: ["Actúa como tutor de biología.", "Para alumnos que rinden la PAES.", "Explica el proceso de mitosis celular.", "Entrégalo en un mapa de conceptos en texto con viñetas."],
                correctOrder: ["Actúa como tutor de biología.", "Para alumnos que rinden la PAES.", "Explica el proceso de mitosis celular.", "Entrégalo en un mapa de conceptos en texto con viñetas."],
                explanation: "Este prompt tiene un Rol experto, un Contexto específico (la prueba PAES en Chile), una Tarea de ciencias y un Formato muy útil."
            }
        ]
    },

    // UNIDAD 3: FRAMEWORK CREA
    "3_1": {
        id: "3_1",
        title: "Unidad 3 - Lección 1: El poder del Ejemplo",
        questions: [
            {
                type: "multiple-choice",
                instruction: "En el framework CREA, ¿qué representa la letra 'E'?",
                options: [
                    "Energía de procesamiento.",
                    "(Recomendado) Ejemplo (darle muestras del resultado deseado).",
                    "Escribir rápido.",
                    "Evaluación final del prompt."
                ],
                correctAnswer: 1,
                explanation: "La 'E' es de **Ejemplo**. Al darle a la IA ejemplos del patrón que quieres que siga (llamado Few-Shot Prompting), limitas su creatividad y aseguras que siga un formato exacto."
            },
            {
                type: "multiple-choice",
                instruction: "¿Cómo se le llama en inteligencia artificial a la técnica de entrenar al modelo en el prompt dándole un par de ejemplos?",
                options: [
                    "Zero-Shot Prompting (cero ejemplos).",
                    "Machine Learning instantáneo.",
                    "(Recomendado) Few-Shot Prompting (pocos ejemplos).",
                    "Deep Prompting."
                ],
                correctAnswer: 2,
                explanation: "Few-shot significa darle 'pocos disparos' o ejemplos al modelo. Es la forma más poderosa de forzar un formato específico sin programar código."
            }
        ]
    },
    "3_2": {
        id: "3_2",
        title: "Unidad 3 - Lección 2: Acción y Contexto en CREA",
        questions: [
            {
                type: "puzzle",
                instruction: "Arma un prompt siguiendo el orden CREA (Contexto, Rol, Ejemplo, Acción):",
                blocks: ["Dado que soy estudiante de tecnología,", "sé mi mentor de IA.", "Ejemplo de tono: '¡Hola byte! Vamos a programar'.", "Escribe una bienvenida entusiasta."],
                correctOrder: ["Dado que soy estudiante de tecnología,", "sé mi mentor de IA.", "Ejemplo de tono: '¡Hola byte! Vamos a programar'.", "Escribe una bienvenida entusiasta."],
                explanation: "El framework CREA prioriza establecer la situación de fondo (C), la identidad (R), guiar con un patrón (E) y finalmente lanzar la acción concreta (A)."
            }
        ]
    },
    "3_3": {
        id: "3_3",
        title: "Unidad 3 - Desafío: Pocos Ejemplos",
        questions: [
            {
                type: "checkbox",
                instruction: "Imagina que quieres que la IA traduzca palabras al idioma 'Coa' (jerga chilena) con un formato especial. ¿Cuáles de estas opciones serían buenos EJEMPLOS para añadir en el prompt?",
                options: [
                    "Ejemplo: 'Amigo' -> 'Hermano/Partner'",
                    "Ejemplo: 'Trabajo' -> 'Pega'",
                    "Ejemplo: 'Escríbeme en español de Chile'",
                    "Ejemplo: 'No uses palabras formales'"
                ],
                correctAnswer: [0, 1],
                explanation: "Los ejemplos deben mostrar pares concretos de Entrada -> Salida ('Amigo' -> 'Hermano', 'Trabajo' -> 'Pega') para que la IA entienda el patrón exacto."
            }
        ]
    },

    // UNIDAD 4: FRAMEWORK CREATE
    "4_1": {
        id: "4_1",
        title: "Unidad 4 - Lección 1: Personaje y Petición (CREATE)",
        questions: [
            {
                type: "multiple-choice",
                instruction: "El framework CREATE es ideal para prompts profesionales complejos. ¿Qué representan las dos primeras letras, 'C' y 'R'?",
                options: [
                    "Computación y Redes.",
                    "(Recomendado) Character (Personaje/Rol) y Request (Petición/Tarea).",
                    "Contexto y Restricciones.",
                    "Creador y Receptor."
                ],
                correctAnswer: 1,
                explanation: "CREATE empieza con **Character** (Personaje, equivalente a Rol) y **Request** (Petición, equivalente a Tarea)."
            },
            {
                type: "puzzle",
                instruction: "Ordena los bloques para iniciar un prompt de CREATE (Character + Request):",
                blocks: ["Actúa como un experto en ciberseguridad.", "Audita el siguiente código en busca de contraseñas visibles."],
                correctOrder: ["Actúa como un experto en ciberseguridad.", "Audita el siguiente código en busca de contraseñas visibles."],
                explanation: "Comenzamos asignando la identidad del personaje experto y la petición técnica que debe auditar."
            }
        ]
    },
    "4_2": {
        id: "4_2",
        title: "Unidad 4 - Lección 2: Ajustes y Restricciones",
        questions: [
            {
                type: "multiple-choice",
                instruction: "En CREATE, ¿qué son los 'Adjustments' (A) y los 'Extras' (E)?",
                options: [
                    "Ajustar la velocidad de la IA y extras de cobro.",
                    "(Recomendado) Ajustes de tono, estilo o longitud (A) y Restricciones como exclusión de palabras o reglas estrictas (E).",
                    "Ajustar el brillo de la pantalla y extensiones del navegador.",
                    "No tienen utilidad en la ingeniería de prompts."
                ],
                correctAnswer: 1,
                explanation: "Los Adjustments modulan la voz (ej: 'usa un tono humorístico y no más de 100 palabras') y los Extras (o restricciones) ponen candados de seguridad (ej: 'no menciones marcas de la competencia')."
            },
            {
                type: "checkbox",
                instruction: "Revisa este prompt: \"Actúa como un guía turístico (C). Escribe un itinerario para Valparaíso (R). Usa tono alegre (A). Preséntalo en viñetas (T). Evita recomendar paseos en auto por el tráfico (E)\". ¿Qué partes de CREATE tiene?",
                options: [
                    "Character (C) y Request (R)",
                    "Examples (E) (No tiene ejemplos en este caso)",
                    "Adjustments (A) y Type (T) (Tipo/Formato)",
                    "Extras (E) (Restricción del auto)"
                ],
                correctAnswer: [0, 2, 3],
                explanation: "¡Correcto! Tiene casi todo el framework CREATE, excepto 'Examples' (que es opcional cuando no se requiere un patrón rígido). ¡Es un prompt sumamente robusto!"
            }
        ]
    },
    "4_3": {
        id: "4_3",
        title: "Unidad 4 - Gran Desafío: El Prompt Perfecto",
        questions: [
            {
                type: "puzzle",
                instruction: "Ordena este súper prompt con la estructura completa de CREATE:",
                blocks: [
                    "Actúa como un desarrollador web senior (C).",
                    "Crea un botón HTML/CSS moderno (R).",
                    "Como ejemplo, un botón hover de Duolingo (E).",
                    "Usa un tono técnico y código limpio (A).",
                    "Entrégalo en formato de bloque de código CSS (T).",
                    "Restricción: NO uses librerías externas como Bootstrap (E)."
                ],
                correctOrder: [
                    "Actúa como un desarrollador web senior (C).",
                    "Crea un botón HTML/CSS moderno (R).",
                    "Como ejemplo, un botón hover de Duolingo (E).",
                    "Usa un tono técnico y código limpio (A).",
                    "Entrégalo en formato de bloque de código CSS (T).",
                    "Restricción: NO uses librerías externas como Bootstrap (E)."
                ],
                explanation: "¡Felicidades! Has estructurado un prompt digno de un Ingeniero de Prompts profesional usando el framework CREATE al 100%."
            }
        ]
    }
};

// Mapeo de misiones en la Arena (Sandbox)
const sandboxMissions = {
    "1": {
        title: "Misión 1: El Tutor Histórico (RCTF)",
        description: "Crea un prompt para que la IA actúe como un historiador de Chile, te explique el combate naval de Iquique de forma sencilla y en un formato de lista de 3 puntos.",
        framework: "RCTF",
        requirements: {
            r: [/actua como|se un|eres un|rol de|como un/i, /historiador/i],
            c: [/sencilla|simple|estudiante|chile|facil/i],
            t: [/explica|escribe|cuenta|habla/i, /combate naval|iquique|arturo prat/i],
            f: [/lista|puntos|items|viñetas|tres|3/i]
        },
        successResponse: `<strong>[Simulación de IA Experta - Historiador de Chile]:</strong>
<br><br>
¡Hola! Como historiador, estaré encantado de explicarte este importante suceso histórico de forma muy simple:
<br><br>
1. <strong>¿Qué fue?:</strong> El Combate Naval de Iquique ocurrió el 21 de mayo de 1879 en el contexto de la Guerra del Pacífico, enfrentando a Chile y Perú.
2. <strong>El Capitán Prat:</strong> Arturo Prat, al mando de la frágil corbeta de madera <em>Esmeralda</em>, decidió no rendirse ante el poderoso acorazado peruano <em>Huáscar</em>, saltando al abordaje en un acto de gran valentía que le costó la vida.
3. <strong>El Legado:</strong> Aunque Chile perdió ese combate en particular, el heroísmo de Prat unió e inspiró a todo el país para ganar la guerra posteriormente.
<br><br>
<em>[Prompti dice: ¡Increíble! Incluiste Rol (Historiador), Contexto (Sencillo), Tarea (Explicar Iquique) y Formato (Lista en 3 puntos). ¡Misión 1 superada con éxito! +20 XP]</em>`,
        failResponse: `<strong>[Simulación de IA Genérica - Sin Formato ni Rol Adecuado]:</strong>
<br><br>
El Combate Naval de Iquique fue una batalla marina de 1879 en la Guerra del Pacífico. Murió Arturo Prat. Ganó el Huáscar de Perú. Fue en el norte.
<br><br>
<em>[Prompti dice: Hmmm... Tu prompt es un poco débil. Intenta usar mejor el framework RCTF. Asegúrate de pedirle que actúe como 'historiador', que lo explique de forma 'sencilla' y explícitamente dile que use un formato de 'lista de 3 puntos'. ¡Sigue intentando!]</em>`
    },
    "2": {
        title: "Misión 2: El Programador de Ejemplos (CREA)",
        description: "Pídele a la IA que traduzca frases al 'Chileno'. Dale al menos un ejemplo de traducción (ej: 'Estupendo' -> 'Bacán') antes de pedirle la acción final.",
        framework: "CREA",
        requirements: {
            r: [/traductor|diccionario|experto en modismos|chileno/i],
            c: [/jerga|modismos|chile|chileno/i],
            e: [/ejemplo|como por ejemplo|->|:|bacan|fome|chucha/i],
            a: [/traduce|escribe|pasa al/i]
        },
        successResponse: `<strong>[Simulación de IA Experta - Traductor de Jerga Chilena]:</strong>
<br><br>
¡Wena! Siguiendo tu patrón y los ejemplos proporcionados, aquí tienes la traducción solicitada de tus frases:
<br><br>
- <em>Frase formal:</em> "Esa fiesta estuvo muy aburrida y luego tuvimos problemas."
- <em>Traducción al chileno:</em> "El carrete estuvo terrible de fome y al final nos fuimos a las pailas."
<br><br>
¡El poder de pocos ejemplos (Few-Shot) ha hecho que siga tu formato de traducción a la perfección!
<br><br>
<em>[Prompti dice: ¡Espectacular! Usaste el framework CREA. Al darle ejemplos claros de traducción, la IA no se desvió y tradujo usando los modismos correctos chilenos. ¡Misión 2 superada! +25 XP]</em>`,
        failResponse: `<strong>[Simulación de IA Confundida - Sin ejemplos]:</strong>
<br><br>
Hola. Entiendo que quieres hablar en chileno. Chile es un país de Sudamérica. La traducción de 'excelente' es 'bueno'. Espero que te sirva.
<br><br>
<em>[Prompti dice: ¡Cuidado! La IA no sabe exactamente qué tipo de chileno quieres ni la estructura porque no le diste ningún EJEMPLO ('E' en CREA). Escribe en tu prompt algo como: "Ejemplo: Estupendo -> Bacán" para guiar su respuesta. ¡Tú puedes!]</em>`
    },
    "3": {
        title: "Misión 3: El Sommelier de Helados (CREATE)",
        description: "Usa CREATE: un experto en helados (C), que invente un sabor (R), dale ejemplos (E), ajusta a tono divertido (A), formato tabla de ingredientes (T) y con restricción de no usar chocolate (E).",
        framework: "CREATE",
        requirements: {
            r: [/sommelier|chef|experto en helados|creador de postres/i], 
            c: [/inventa|crea|diseña/i], 
            e: [/ejemplo|sabores como/i], 
            a: [/divertido|gracioso|loco|entusiasta/i], 
            t: [/tabla|columnas|cuadro/i], 
            f: [/no uses chocolate|sin chocolate|excluye el chocolate|cero chocolate/i] 
        },
        successResponse: `<strong>[Simulación de IA - Maestro Sommelier de Helados del Futuro]:</strong>
<br><br>
¡Prepárense, papilas gustativas! He creado un sabor ultra loco y fresco sin tocar una sola gota de chocolate. Presento: <strong>"¡Explosión Galáctica Frutal!"</strong>
<br><br>
Aquí tienes la tabla con sus ingredientes divertidos:
<br><br>
<table style="width:100%; border: 1px solid var(--color-border); border-collapse: collapse; margin: 10px 0;">
  <tr style="background-color: rgba(255,255,255,0.05);">
    <th style="padding: 8px; border: 1px solid var(--color-border);">Ingrediente Loco</th>
    <th style="padding: 8px; border: 1px solid var(--color-border);">Efecto Especial</th>
  </tr>
  <tr>
    <td style="padding: 8px; border: 1px solid var(--color-border);">Nieve de Frambuesa Ácida</td>
    <td style="padding: 8px; border: 1px solid var(--color-border);">Te hace cosquillas en la lengua.</td>
  </tr>
  <tr>
    <td style="padding: 8px; border: 1px solid var(--color-border);">Caramelo Explosivo de Limón</td>
    <td style="padding: 8px; border: 1px solid var(--color-border);">Estalla como fuegos artificiales espaciales.</td>
  </tr>
  <tr>
    <td style="padding: 8px; border: 1px solid var(--color-border);">Crema Batida Estelar</td>
    <td style="padding: 8px; border: 1px solid var(--color-border);">Suave como flotar en gravedad cero.</td>
  </tr>
</table>
<br><br>
¡Misión cumplida! Todo tu framework CREATE fue aplicado.
<br><br>
<em>[Prompti dice: ¡INCREÍBLE! Has completado el desafío definitivo de la Ingeniería de Prompts. Estructuraste los 6 elementos de CREATE, incluyendo la restricción crítica (sin chocolate). ¡Eres todo un experto! +30 XP]</em>`,
        failResponse: `<strong>[Simulación de IA Estándar]:</strong>
<br><br>
Aquí tienes una receta de helado de fresa:
Ingredientes: Fresas, azúcar, crema de leche. Licuar todo y congelar. Es un postre delicioso.
<br><br>
<em>[Prompti dice: Mmm, casi, pero no es lo que pedimos. Te saltaste componentes vitales de CREATE. Recuerda definir: 1. Personaje experto en helados (C). 2. Ejemplos de sabores locos (E). 3. Tono divertido (A). 4. Que te lo entregue en una TABLA (T). 5. ¡Y la restricción de que NO lleve chocolate (E)! Edita tu prompt para incluir todo.]</em>`
    }
};

// ==========================================================================
// 5. ALUMNOS SIMULADOS Y CONFIGURACIÓN DE LIGA
// ==========================================================================
const simulatedStudents = [
    { name: "Sofi_AI", emoji: "👩‍💻", streak: 5, xp: 2450, isPlayer: false },
    { name: "ByteMaster", emoji: "👾", streak: 8, xp: 2120, isPlayer: false },
    { name: "Matías_Pro", emoji: "🦊", streak: 3, xp: 1980, isPlayer: false },
    { name: "Cote_Prompt", emoji: "🦄", streak: 4, xp: 1650, isPlayer: false },
    { name: "Benja_Neural", emoji: "🦖", streak: 1, xp: 1200, isPlayer: false },
    { name: "Fran_Tech", emoji: "👨‍💻", streak: 2, xp: 950, isPlayer: false },
    { name: "Profe_Clara_Fan", emoji: "🐱", streak: 12, xp: 500, isPlayer: false }
];

// ==========================================================================
// 6. LISTA DE LOGROS
// ==========================================================================
const achievementsList = [
    {
        id: "first_lesson",
        title: "Bautizo de Fuego",
        desc: "Completa tu primera lección de Ingeniería de Prompts.",
        emoji: "🔥",
        check: () => gameState.lessonsCompleted.length >= 1
    },
    {
        id: "rctf_master",
        title: "Maestro del Rol",
        desc: "Domina el framework RCTF completando la Unidad 2.",
        emoji: "🎭",
        check: () => gameState.lessonsCompleted.includes("2_4")
    },
    {
        id: "crea_master",
        title: "Contextualizador Experto",
        desc: "Aprende a guiar con ejemplos en la Unidad 3 de CREA.",
        emoji: "💡",
        check: () => gameState.lessonsCompleted.includes("3_3")
    },
    {
        id: "create_master",
        title: "Creador Supremo",
        desc: "Domina el framework CREATE completo de la Unidad 4.",
        emoji: "💎",
        check: () => gameState.lessonsCompleted.includes("4_3")
    },
    {
        id: "xp_collector",
        title: "Acumulador de Bytes",
        desc: "Alcanza un total de 100 XP.",
        emoji: "⚡",
        check: () => gameState.xp >= 100
    }
];

// ==========================================================================
// 7. FUNCIONES DE RENDERIZADO Y UI GLOBALES
// ==========================================================================

function updateGlobalUIStats() {
    const elXp = document.getElementById("user-xp");
    const elStr = document.getElementById("user-streak");
    const elHrt = document.getElementById("user-hearts");
    const elLvl = document.getElementById("user-level");

    if (elXp) elXp.innerText = gameState.xp;
    if (elStr) elStr.innerText = gameState.streak;
    if (elHrt) elHrt.innerText = gameState.hearts;
    if (elLvl) elLvl.innerText = gameState.level;
}

function applyTheme(theme) {
    if (theme === 'light') {
        document.documentElement.classList.remove("dark-theme");
        document.documentElement.classList.add("light-theme");
        document.body.classList.remove("dark-theme");
        document.body.classList.add("light-theme");
        const icon = document.querySelector(".toggle-icon");
        const text = document.querySelector(".toggle-text");
        if (icon) icon.innerText = "☀️";
        if (text) text.innerText = "Modo Claro";
    } else {
        document.documentElement.classList.remove("light-theme");
        document.documentElement.classList.add("dark-theme");
        document.body.classList.remove("light-theme");
        document.body.classList.add("dark-theme");
        const icon = document.querySelector(".toggle-icon");
        const text = document.querySelector(".toggle-text");
        if (icon) icon.innerText = "🌙";
        if (text) text.innerText = "Modo Oscuro";
    }
}

function renderLeaderboard() {
    const tbody = document.getElementById("leaderboard-tbody");
    if (!tbody) return;
    tbody.innerHTML = "";

    const allPlayers = [
        ...simulatedStudents,
        { name: `${gameState.username} (Tú)`, emoji: gameState.avatarEmoji, streak: gameState.streak, xp: gameState.xp, isPlayer: true }
    ];

    allPlayers.sort((a, b) => b.xp - a.xp);

    allPlayers.forEach((player, idx) => {
        const tr = document.createElement("tr");
        if (player.isPlayer) {
            tr.className = "user-row";
        }

        const rank = idx + 1;
        let rankClass = "rank-col";
        if (rank === 1) rankClass += " rank-1";
        else if (rank === 2) rankClass += " rank-2";
        else if (rank === 3) rankClass += " rank-3";

        tr.innerHTML = `
            <td class="${rankClass}">#${rank}</td>
            <td class="user-col">
                <span class="user-avatar-sm">${player.emoji}</span>
                <span>${player.name}</span>
            </td>
            <td>🔥 ${player.streak}</td>
            <td style="font-weight: 700; color: var(--color-cyan)">⚡ ${player.xp}</td>
        `;
        tbody.appendChild(tr);
    });

    if (allPlayers.length >= 3) {
        const p1Name = document.getElementById("podium-1-name");
        const p1Xp = document.getElementById("podium-1-xp");
        const p2Name = document.getElementById("podium-2-name");
        const p2Xp = document.getElementById("podium-2-xp");
        const p3Name = document.getElementById("podium-3-name");
        const p3Xp = document.getElementById("podium-3-xp");

        if (p1Name) p1Name.innerText = allPlayers[0].name;
        if (p1Xp) p1Xp.innerText = `${allPlayers[0].xp} XP`;
        if (p2Name) p2Name.innerText = allPlayers[1].name;
        if (p2Xp) p2Xp.innerText = `${allPlayers[1].xp} XP`;
        if (p3Name) p3Name.innerText = allPlayers[2].name;
        if (p3Xp) p3Xp.innerText = `${allPlayers[2].xp} XP`;
    }
}

function renderAchievements() {
    const container = document.getElementById("achievements-grid-container");
    if (!container) return;
    container.innerHTML = "";

    achievementsList.forEach(ach => {
        const isUnlocked = ach.check();
        const card = document.createElement("div");
        card.className = `glass-card achievement-card ${isUnlocked ? 'unlocked' : ''}`;
        
        card.innerHTML = `
            <div class="badge-medal">
                ${isUnlocked ? ach.emoji : '🔒'}
            </div>
            <h4>${ach.title}</h4>
            <p>${ach.desc}</p>
            <div class="achievement-progress-bar">
                <div class="fill" style="width: ${isUnlocked ? 100 : 0}%"></div>
            </div>
        `;
        container.appendChild(card);
    });
}

function getUnlockedAchievementsCount() {
    return achievementsList.filter(ach => ach.check()).length;
}

function showView(viewId) {
    // Si no está autenticado y no intenta acceder al panel docente, forzar el login escolar
    if (!currentUser && viewId !== 'teacher') {
        const authModal = document.getElementById("auth-modal");
        if (authModal) authModal.classList.remove("hidden");
    }

    document.querySelectorAll(".view-section").forEach(sec => sec.classList.remove("active"));
    document.querySelectorAll(".nav-item").forEach(item => item.classList.remove("active"));

    const targetSection = document.getElementById(viewId);
    if (targetSection) {
        targetSection.classList.add("active");
    }

    const navBtn = document.querySelector(`.nav-item[data-target="${viewId}"]`);
    if (navBtn) {
        navBtn.classList.add("active");
    }

    gameState.activeView = viewId;
    saveGameState();

    if (viewId === 'dashboard') {
        updateDashboardNodes();
    } else if (viewId === 'sandbox') {
        initSandbox();
    } else if (viewId === 'leaderboard') {
        renderLeaderboard();
    } else if (viewId === 'achievements') {
        renderAchievements();
    } else if (viewId === 'profile') {
        initProfileView();
    } else if (viewId === 'teacher') {
        initTeacherView();
    }
}

function initProfileView() {
    const pUsername = document.getElementById("profile-username");
    const iUsername = document.getElementById("input-username");
    const pEmoji = document.getElementById("profile-emoji");
    const pXpTotal = document.getElementById("profile-xp-total");
    const pStreak = document.getElementById("profile-streak-days");
    const pLessons = document.getElementById("profile-lessons-completed");
    const pRank = document.getElementById("profile-rank-badge");
    const pSubDetails = document.getElementById("profile-sub-details");

    if (pUsername) pUsername.innerText = gameState.username;
    if (iUsername) iUsername.value = gameState.username;
    if (pEmoji) pEmoji.innerText = gameState.avatarEmoji;
    
    document.querySelectorAll(".avatar-opt").forEach(opt => {
        if (opt.getAttribute("data-emoji") === gameState.avatarEmoji) {
            opt.classList.add("selected");
        } else {
            opt.classList.remove("selected");
        }
    });

    if (pXpTotal) pXpTotal.innerText = gameState.xp;
    if (pStreak) pStreak.innerText = gameState.streak;
    if (pLessons) pLessons.innerText = gameState.lessonsCompleted.length;
    
    // Subtítulo del perfil con colegio y curso
    if (pSubDetails) {
        const cur = gameState.course || "Sin curso";
        const inst = gameState.institution || "Sin colegio";
        pSubDetails.innerText = `Estudiante | ${cur} | ${inst}`;
    }
    
    let rank = "Ingeniero Novato";
    if (gameState.xp >= 200) rank = "Maestro Prompter de Primero Medio";
    else if (gameState.xp >= 100) rank = "Ingeniero de Prompts Intermedio";
    else if (gameState.xp >= 40) rank = "Prompt Specialist Junior";
    
    if (pRank) pRank.innerText = rank;
    
    // Poblar selectores de perfil
    populateDropdowns();
}

function updateDashboardNodes() {
    let unit1UnlockedCount = 0;
    let unit2UnlockedCount = 0;
    let unit3UnlockedCount = 0;
    let unit4UnlockedCount = 0;

    const n11 = document.getElementById("node-1_1");
    if (n11) {
        n11.classList.remove("locked");
        n11.classList.add("active");
    }

    const completed = gameState.lessonsCompleted;

    if (completed.includes("1_1")) { unlockNode("1_2"); unit1UnlockedCount++; }
    if (completed.includes("1_2")) { unlockNode("1_3"); unit1UnlockedCount++; }
    if (completed.includes("1_3")) { unlockNode("2_1"); unit1UnlockedCount++; }

    if (completed.includes("2_1")) { unlockNode("2_2"); unit2UnlockedCount++; }
    if (completed.includes("2_2")) { unlockNode("2_3"); unit2UnlockedCount++; }
    if (completed.includes("2_3")) { unlockNode("2_4"); unit2UnlockedCount++; }
    if (completed.includes("2_4")) { unlockNode("3_1"); unit2UnlockedCount++; }

    if (completed.includes("3_1")) { unlockNode("3_2"); unit3UnlockedCount++; }
    if (completed.includes("3_2")) { unlockNode("3_3"); unit3UnlockedCount++; }
    if (completed.includes("3_3")) { unlockNode("4_1"); unit3UnlockedCount++; }

    if (completed.includes("4_1")) { unlockNode("4_2"); unit4UnlockedCount++; }
    if (completed.includes("4_2")) { unlockNode("4_3"); unit4UnlockedCount++; }
    if (completed.includes("4_3")) { unit4UnlockedCount++; }

    const pct1 = Math.round((unit1UnlockedCount / 3) * 100);
    const pct2 = Math.round((unit2UnlockedCount / 4) * 100);
    const pct3 = Math.round((unit3UnlockedCount / 3) * 100);
    const pct4 = Math.round((unit4UnlockedCount / 3) * 100);

    setCircleProgress("unit1", pct1);
    setCircleProgress("unit2", pct2);
    setCircleProgress("unit3", pct3);
    setCircleProgress("unit4", pct4);

    const totalLessons = 13;
    const compCount = completed.length;
    const statsLessonsText = document.getElementById("stats-lessons-count");
    const statsLessonsBar = document.getElementById("stats-lessons-bar");
    if (statsLessonsText) statsLessonsText.innerText = `${compCount} / ${totalLessons}`;
    if (statsLessonsBar) statsLessonsBar.style.width = `${(compCount / totalLessons) * 100}%`;
    
    let achievementsUnlocked = getUnlockedAchievementsCount();
    const statsAchCount = document.getElementById("stats-achieve-count");
    const statsAchBar = document.getElementById("stats-achieve-bar");
    if (statsAchCount) statsAchCount.innerText = `${achievementsUnlocked} / 5`;
    if (statsAchBar) statsAchBar.style.width = `${(achievementsUnlocked / 5) * 100}%`;
}

function unlockNode(nodeId) {
    const el = document.getElementById(`node-${nodeId}`);
    if (el) {
        el.classList.remove("locked");
        el.classList.add("active");
    }
}

function setCircleProgress(unitId, pct) {
    const circle = document.getElementById(`${unitId}-progress-circle`);
    const text = document.getElementById(`${unitId}-progress-text`);
    if (circle && text) {
        const offset = 163 - (pct / 100) * 163;
        circle.style.strokeDashoffset = offset;
        text.innerText = `${pct}%`;
    }
}

// ==========================================================================
// 8. MOTOR LECCIONES INTERACTIVAS
// ==========================================================================
let currentLesson = null;
let currentQuestionIndex = 0;
let lessonHearts = 5;
let selectedOptionIdx = null;
let selectedCheckboxIndices = [];

function startLesson(lessonId) {
    const data = lessonsData[lessonId];
    if (!data) return;

    currentLesson = data;
    currentQuestionIndex = 0;
    lessonHearts = 5;
    
    const hrtVal = document.getElementById("lesson-hearts-val");
    const barFill = document.getElementById("lesson-progress-bar");
    if (hrtVal) hrtVal.innerText = lessonHearts;
    if (barFill) barFill.style.width = "0%";
    
    const overlay = document.getElementById("lesson-overlay");
    if (overlay) overlay.classList.remove("hidden");
    loadQuestion(currentQuestionIndex);
}

function loadQuestion(index) {
    if (!currentLesson || index >= currentLesson.questions.length) {
        finishLessonSuccessfully();
        return;
    }

    selectedOptionIdx = null;
    selectedCheckboxIndices = [];

    const question = currentLesson.questions[index];
    
    const barFill = document.getElementById("lesson-progress-bar");
    if (barFill) {
        const progressPct = (index / currentLesson.questions.length) * 100;
        barFill.style.width = `${progressPct}%`;
    }

    const robotBubbles = [
        "¡Lee con atención! La precisión importa al hablarle a la IA.",
        "¡El framework correcto te dará el poder de domar a los modelos de lenguaje!",
        "Prompti cree en ti. ¡Analiza bien las opciones!",
        "GIGO: Si entra basura, sale basura. ¡Dale la mejor instrucción!",
        "¡Excelente! Vamos por la siguiente pregunta."
    ];
    const bubbleText = document.getElementById("prompti-bubble-text");
    if (bubbleText) bubbleText.innerText = robotBubbles[Math.min(index, robotBubbles.length - 1)];

    const instrText = document.getElementById("exercise-instruction-text");
    if (instrText) instrText.innerText = question.instruction;

    const area = document.getElementById("exercise-interactive-area");
    if (!area) return;
    area.innerHTML = "";

    const footer = document.getElementById("lesson-footer-bar");
    const feedbackBox = document.getElementById("footer-feedback-box");
    const checkBtn = document.getElementById("btn-check-answer");
    if (footer) footer.className = "lesson-footer-bar";
    if (feedbackBox) feedbackBox.classList.add("hidden");
    if (checkBtn) {
        checkBtn.innerText = "COMPROBAR";
        checkBtn.disabled = false;
    }

    if (question.type === "multiple-choice") {
        const grid = document.createElement("div");
        grid.className = "options-grid";
        
        question.options.forEach((opt, idx) => {
            const btn = document.createElement("button");
            btn.className = "option-btn";
            const cleanOptText = opt.replace("(Recomendado) ", "💡 ");
            btn.innerHTML = `<span class="option-badge">${String.fromCharCode(65 + idx)}</span> <span class="option-text">${cleanOptText}</span>`;
            
            btn.addEventListener("click", () => {
                playSound('click');
                selectedOptionIdx = idx;
                document.querySelectorAll(".option-btn").forEach(b => b.classList.remove("selected"));
                btn.classList.add("selected");
            });
            grid.appendChild(btn);
        });
        area.appendChild(grid);
        
    } else if (question.type === "puzzle") {
        const puzzleContainer = document.createElement("div");
        puzzleContainer.className = "puzzle-area";

        const slots = document.createElement("div");
        slots.className = "puzzle-slots-container";
        slots.id = "puzzle-slots";
        slots.innerHTML = `<span style="color: var(--color-text-muted); font-size: 0.85rem; font-style: italic; pointer-events: none;">Haz clic en los bloques de abajo para ordenarlos...</span>`;

        const pool = document.createElement("div");
        pool.className = "puzzle-blocks-pool";
        pool.id = "puzzle-pool";

        const shuffledBlocks = [...question.blocks].sort(() => Math.random() - 0.5);

        shuffledBlocks.forEach((word) => {
            const block = document.createElement("div");
            block.className = "puzzle-block";
            block.innerText = word;
            
            block.addEventListener("click", () => {
                playSound('click');
                if (!block.classList.contains("used")) {
                    block.classList.add("used");
                    
                    if (slots.querySelector("span")) {
                        slots.innerHTML = "";
                    }

                    const slotWord = document.createElement("div");
                    slotWord.className = "puzzle-block";
                    slotWord.innerText = word;
                    slotWord.addEventListener("click", () => {
                        playSound('click');
                        slotWord.remove();
                        block.classList.remove("used");
                        
                        if (slots.children.length === 0) {
                            slots.innerHTML = `<span style="color: var(--color-text-muted); font-size: 0.85rem; font-style: italic; pointer-events: none;">Haz clic en los bloques de abajo para ordenarlos...</span>`;
                        }
                    });
                    slots.appendChild(slotWord);
                }
            });
            pool.appendChild(block);
        });

        puzzleContainer.appendChild(slots);
        puzzleContainer.appendChild(pool);
        area.appendChild(puzzleContainer);

    } else if (question.type === "checkbox") {
        const grid = document.createElement("div");
        grid.className = "checkbox-grid";

        question.options.forEach((opt, idx) => {
            const btn = document.createElement("button");
            btn.className = "checkbox-btn";
            btn.innerHTML = `<div class="checkbox-indicator"></div> <span class="checkbox-text">${opt}</span>`;
            
            btn.addEventListener("click", () => {
                playSound('click');
                if (selectedCheckboxIndices.includes(idx)) {
                    selectedCheckboxIndices = selectedCheckboxIndices.filter(i => i !== idx);
                    btn.classList.remove("selected");
                } else {
                    selectedCheckboxIndices.push(idx);
                    btn.classList.add("selected");
                }
            });
            grid.appendChild(btn);
        });
        area.appendChild(grid);
    }
}

function animateRobotExpression(state) {
    const svg = document.getElementById("prompti-svg");
    if (!svg) return;

    const eyeL = svg.querySelector(".eye-left");
    const eyeR = svg.querySelector(".eye-right");
    const mouth = svg.querySelector(".robot-mouth");
    const screen = svg.querySelector(".robot-screen");

    if (state === 'happy') {
        if (eyeL) eyeL.setAttribute("ry", "1.5");
        if (eyeR) eyeR.setAttribute("ry", "1.5");
        if (mouth) {
            mouth.setAttribute("d", "M 42 63 Q 50 72 58 63");
            mouth.setAttribute("stroke", "var(--color-emerald)");
        }
        if (screen) screen.setAttribute("fill", "#112d24");
    } else if (state === 'sad') {
        if (eyeL) eyeL.setAttribute("ry", "3");
        if (eyeR) eyeR.setAttribute("ry", "3");
        if (mouth) {
            mouth.setAttribute("d", "M 44 65 Q 50 58 56 65");
            mouth.setAttribute("stroke", "var(--color-crimson)");
        }
        if (screen) screen.setAttribute("fill", "#2f141f");
    } else {
        if (eyeL) eyeL.setAttribute("ry", "4");
        if (eyeR) eyeR.setAttribute("ry", "4");
        if (mouth) {
            mouth.setAttribute("d", "M 45 64 Q 50 67 55 64");
            mouth.setAttribute("stroke", "var(--color-cyan)");
        }
        if (screen) screen.setAttribute("fill", "#1e1e38");
    }
}

function exitLesson() {
    const overlay = document.getElementById("lesson-overlay");
    if (overlay) overlay.classList.add("hidden");
    animateRobotExpression('normal');
    currentLesson = null;
}

function finishLessonSuccessfully() {
    playSound('victory');
    const overlay = document.getElementById("lesson-overlay");
    if (overlay) overlay.classList.add("hidden");
    
    if (!gameState.lessonsCompleted.includes(currentLesson.id)) {
        gameState.lessonsCompleted.push(currentLesson.id);
        gameState.xp += 15;
        
        const newLevel = Math.floor(gameState.xp / 45) + 1;
        if (newLevel > gameState.level) {
            gameState.level = newLevel;
            setTimeout(() => {
                alert(`🎉 ¡FELICIDADES! Has subido al Nivel ${newLevel} de Ingeniería de Prompts.`);
            }, 800);
        }
    }
    
    saveGameState();

    const victoryOverlay = document.getElementById("lesson-success-overlay");
    const nameEl = document.getElementById("success-lesson-name");
    const xpEl = document.getElementById("success-xp-gained");
    const accEl = document.getElementById("success-accuracy");
    const hrtEl = document.getElementById("success-hearts-left");

    if (nameEl) nameEl.innerText = currentLesson.title;
    if (xpEl) xpEl.innerText = "+15 XP";
    if (accEl) accEl.innerText = `${Math.round((lessonHearts / 5) * 100)}%`;
    if (hrtEl) hrtEl.innerText = `${lessonHearts} / 5`;
    
    if (victoryOverlay) victoryOverlay.classList.remove("hidden");
}

// ==========================================================================
// 9. ARENA DE PROMPTS (SANDBOX)
// ==========================================================================
let selectedMissionId = "1";

function initSandbox() {
    const missions = document.querySelectorAll(".mission-item");
    missions.forEach(m => {
        m.replaceWith(m.cloneNode(true));
    });

    const newMissions = document.querySelectorAll(".mission-item");
    newMissions.forEach(m => {
        m.addEventListener("click", () => {
            playSound('click');
            newMissions.forEach(x => x.classList.remove("active"));
            m.classList.add("active");
            selectedMissionId = m.getAttribute("data-mission");
            loadMissionDetails();
        });
    });

    loadMissionDetails();
}

function loadMissionDetails() {
    const mission = sandboxMissions[selectedMissionId];
    if (!mission) return;
    
    const chipR = document.getElementById("chip-r");
    const chipC = document.getElementById("chip-c");
    const chipT = document.getElementById("chip-t");
    const chipF = document.getElementById("chip-f");
    const titleEl = document.querySelector(".analyzer-title");

    if (mission.framework === "RCTF") {
        if (titleEl) titleEl.innerText = "Detección de Framework (RCTF):";
        if (chipR) chipR.innerHTML = `🎭 Rol <span class="chip-status">❌</span>`;
        if (chipC) chipC.innerHTML = `🌐 Contexto <span class="chip-status">❌</span>`;
        if (chipT) chipT.innerHTML = `🎯 Tarea <span class="chip-status">❌</span>`;
        if (chipF) chipF.innerHTML = `📋 Formato <span class="chip-status">❌</span>`;
    } else if (mission.framework === "CREA") {
        if (titleEl) titleEl.innerText = "Detección de Framework (CREA):";
        if (chipR) chipR.innerHTML = `🌐 Contexto <span class="chip-status">❌</span>`;
        if (chipC) chipC.innerHTML = `🎭 Rol <span class="chip-status">❌</span>`;
        if (chipT) chipT.innerHTML = `💡 Ejemplo <span class="chip-status">❌</span>`;
        if (chipF) chipF.innerHTML = `🚀 Acción <span class="chip-status">❌</span>`;
    } else if (mission.framework === "CREATE") {
        if (titleEl) titleEl.innerText = "Detección de Framework (CREATE):";
        if (chipR) chipR.innerHTML = `🎭 Personaje <span class="chip-status">❌</span>`;
        if (chipC) chipC.innerHTML = `💡 Ejemplos <span class="chip-status">❌</span>`;
        if (chipT) chipT.innerHTML = `📋 Tabla <span class="chip-status">❌</span>`;
        if (chipF) chipF.innerHTML = `⚠️ Sin Choc. <span class="chip-status">❌</span>`;
    }

    const input = document.getElementById("prompt-input");
    if (input) input.value = "";
    analyzePromptText("");
}

function analyzePromptText(text) {
    const mission = sandboxMissions[selectedMissionId];
    if (!mission) return false;

    let detected = { r: false, c: false, t: false, f: false };
    const reqs = mission.requirements;

    if (reqs.r) detected.r = reqs.r.every(regex => regex.test(text));
    if (reqs.c) detected.c = reqs.c.every(regex => regex.test(text));
    if (reqs.t) detected.t = reqs.t.every(regex => regex.test(text));
    if (reqs.f) detected.f = reqs.f.every(regex => regex.test(text));

    const chipR = document.getElementById("chip-r");
    const chipC = document.getElementById("chip-c");
    const chipT = document.getElementById("chip-t");
    const chipF = document.getElementById("chip-f");

    updateChipState(chipR, detected.r, "r");
    updateChipState(chipC, detected.c, "c");
    updateChipState(chipT, detected.t, "t");
    updateChipState(chipF, detected.f, "f");

    let count = 0;
    if (detected.r) count++;
    if (detected.c) count++;
    if (detected.t) count++;
    if (detected.f) count++;

    const scoreVal = document.getElementById("prompt-score-value");
    if (scoreVal) {
        if (count === 4) {
            scoreVal.innerText = "Excelente 💎";
            scoreVal.className = "score-indicator score-good";
        } else if (count >= 2) {
            scoreVal.innerText = "Regular 📈";
            scoreVal.className = "score-indicator score-medium";
        } else {
            scoreVal.innerText = "Baja ⚠️";
            scoreVal.className = "score-indicator score-bad";
        }
    }

    return count === 4;
}

function updateChipState(el, isDetected, code) {
    if (!el) return;
    const statusEl = el.querySelector(".chip-status");
    if (isDetected) {
        if (statusEl) statusEl.innerText = "✅";
        el.classList.add(`active-${code}`);
    } else {
        if (statusEl) statusEl.innerText = "❌";
        el.classList.remove(`active-${code}`);
    }
}

function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}

// ==========================================================================
// 10. FUNCIONES ESPECÍFICAS DEL PANEL DOCENTE (Seguridad y Renderizado)
// ==========================================================================

function initTeacherView() {
    const lockScreen = document.getElementById("teacher-lock-screen");
    const dashboardContent = document.getElementById("teacher-dashboard-content");
    const pinInput = document.getElementById("teacher-pin-input");
    const errEl = document.getElementById("lock-error-msg");

    if (pinInput) pinInput.value = "";
    if (errEl) errEl.classList.add("hidden");

    if (isTeacherAuthorized) {
        if (lockScreen) lockScreen.classList.add("hidden");
        if (dashboardContent) dashboardContent.classList.remove("hidden");
        fetchStudentList();
        fetchAuthorizedStudents(); // Cargar tabla CRUD de alumnos pre-autorizados
    } else {
        if (lockScreen) lockScreen.classList.remove("hidden");
        if (dashboardContent) dashboardContent.classList.add("hidden");
    }
}

async function fetchStudentList() {
    const tbody = document.getElementById("teacher-tbody");
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 32px; color: var(--color-cyan); font-weight:700;">Recuperando base de datos de alumnos... ☁️</td></tr>`;

    let allStudents = [];

    // Si Firebase está listo, consultar alumnos reales de Firestore
    if (isFirebaseEnabled) {
        try {
            const querySnapshot = await db.collection("users").get();
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                allStudents.push({
                    uid: doc.id,
                    name: data.username || "Alumno Anónimo",
                    email: data.email || "local@colegio.cl",
                    level: data.level || 1,
                    xp: data.xp || 0,
                    streak: data.streak || 1,
                    lessonsCompleted: data.lessonsCompleted || []
                });
            });
        } catch (error) {
            console.error("Error al obtener alumnos:", error);
            tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 32px; color: var(--color-crimson); font-weight:700;">⚠️ Error al conectar con Firestore. Asegúrate de tener conexión.</td></tr>`;
            return;
        }
    } else {
        // Modo Demo de respaldo pedagógico
        allStudents = simulatedStudents.map((s, idx) => ({
            uid: "demo_" + idx,
            name: s.name,
            email: s.name.toLowerCase() + "@colegio.cl",
            level: Math.floor(s.xp / 45) + 1,
            xp: s.xp,
            streak: s.streak,
            lessonsCompleted: ["1_1", "1_2", "1_3", "2_1", "2_2", "2_4"]
        }));
    }

    tbody.innerHTML = "";

    if (allStudents.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 32px; color: var(--color-text-muted);">Aún no hay alumnos registrados en el proyecto Firebase.</td></tr>`;
        return;
    }

    // Ordenar alumnos por XP de forma descendente
    allStudents.sort((a, b) => b.xp - a.xp);

    let totalXP = 0;
    let maxStreak = 0;
    let topStudentName = "-";

    allStudents.forEach((std) => {
        totalXP += std.xp;
        if (std.streak > maxStreak) {
            maxStreak = std.streak;
            topStudentName = std.name;
        }

        const tr = document.createElement("tr");
        tr.style.borderBottom = "1px solid var(--color-border)";

        // Generar insignias de módulos
        let badgesHTML = "";
        if (std.lessonsCompleted.includes("1_3")) badgesHTML += `<span class="badge-lesson-tag u1" title="Unidad 1 aprobada">U1</span>`;
        if (std.lessonsCompleted.includes("2_4")) badgesHTML += `<span class="badge-lesson-tag u2" title="Unidad 2 aprobada">U2</span>`;
        if (std.lessonsCompleted.includes("3_3")) badgesHTML += `<span class="badge-lesson-tag u3" title="Unidad 3 aprobada">U3</span>`;
        if (std.lessonsCompleted.includes("4_3")) badgesHTML += `<span class="badge-lesson-tag u4" title="Unidad 4 aprobada">U4</span>`;

        if (badgesHTML === "") {
            badgesHTML = `<span style="font-size: 0.78rem; color: var(--color-text-muted); font-style: italic;">Sin unidades listas</span>`;
        }

        // Crear botones interactivos inyectando uid
        tr.innerHTML = `
            <td style="padding: 16px 24px; text-align: left;">
                <div style="font-weight: 700; color: white;">${std.name}</div>
                <div style="font-size: 0.72rem; color: var(--color-text-muted);">${std.email}</div>
            </td>
            <td style="padding: 16px 24px; text-align: center; font-weight: 800; color: var(--color-purple); font-size: 1.1rem;">${std.level}</td>
            <td style="padding: 16px 24px; text-align: center; font-weight: 800; color: var(--color-cyan); font-size: 1.1rem;">${std.xp}</td>
            <td style="padding: 16px 24px; text-align: center;">🔥 ${std.streak}</td>
            <td style="padding: 16px 24px; text-align: left;">${badgesHTML}</td>
            <td style="padding: 16px 24px; text-align: center;" class="teacher-actions-cell">
                <button class="btn-teacher-action reward" onclick="rewardStudent('${std.uid}', 15)" ${std.uid.startsWith("demo_") ? "disabled style='opacity:0.4; cursor:not-allowed;'" : ""}>
                    <span>+15 XP ⚡</span>
                </button>
                <button class="btn-teacher-action delete" onclick="deleteStudent('${std.uid}')" ${std.uid.startsWith("demo_") ? "disabled style='opacity:0.4; cursor:not-allowed;'" : ""}>
                    <span>Eliminar ❌</span>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Actualizar tarjetas de resumen del curso
    const avgXP = Math.round(totalXP / allStudents.length);
    document.getElementById("teacher-total-students").innerText = allStudents.length;
    document.getElementById("teacher-average-xp").innerText = avgXP;
    document.getElementById("teacher-top-student").innerText = `${topStudentName} (🔥 ${maxStreak})`;

    // Actualizar Gráficos de Analítica con Chart.js
    updateTeacherCharts(allStudents);
}

// Recompensar XP en Caliente
async function rewardStudent(uid, xpAmount) {
    if (!isFirebaseEnabled || uid.startsWith("demo_")) return;
    playSound('click');
    
    const docRef = db.collection("users").doc(uid);
    try {
        const doc = await docRef.get();
        if (doc.exists) {
            const data = doc.data();
            const currentXP = data.xp || 0;
            const newXP = currentXP + xpAmount;
            const newLevel = Math.floor(newXP / 45) + 1;

            await docRef.update({
                xp: newXP,
                level: newLevel
            });

            playSound('correct');
            alert(`¡Excelente! Has otorgado +${xpAmount} XP a la cuenta de "${data.username || "el alumno"}".`);
            fetchStudentList();
        }
    } catch (e) {
        console.error("Error al dar recompensa:", e);
        alert("Ocurrió un error al actualizar la base de datos.");
    }
}

// Eliminar Cuenta de Alumno
async function deleteStudent(uid) {
    if (!isFirebaseEnabled || uid.startsWith("demo_")) return;
    playSound('click');
    
    if (confirm("⚠️ ¿Estás absolutamente seguro de que quieres eliminar la cuenta de este estudiante de la base de datos? Perderá todos sus progresos permanentemente.")) {
        try {
            await db.collection("users").doc(uid).delete();
            playSound('incorrect');
            alert("Cuenta eliminada con éxito.");
            fetchStudentList();
        } catch (e) {
            console.error("Error al eliminar cuenta:", e);
            alert("No se pudo eliminar la cuenta.");
        }
    }
}

// Copiar Notas a Excel
async function copyGradesToClipboard() {
    playSound('click');
    
    let csvContent = "Nombre\tCorreo\tNivel\tXP\tRacha\tModulos Aprobados\n";
    let allStudents = [];

    if (isFirebaseEnabled) {
        try {
            const querySnapshot = await db.collection("users").get();
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                let modules = [];
                if (data.lessonsCompleted.includes("1_3")) modules.push("Unidad 1");
                if (data.lessonsCompleted.includes("2_4")) modules.push("Unidad 2");
                if (data.lessonsCompleted.includes("3_3")) modules.push("Unidad 3");
                if (data.lessonsCompleted.includes("4_3")) modules.push("Unidad 4");

                allStudents.push({
                    name: data.username || "Alumno Anónimo",
                    email: data.email || "local@colegio.cl",
                    level: data.level || 1,
                    xp: data.xp || 0,
                    streak: data.streak || 1,
                    modulesStr: modules.join(", ") || "Ninguno"
                });
            });
        } catch (e) {
            alert("Error al cargar la información para exportar.");
            return;
        }
    } else {
        allStudents = simulatedStudents.map(s => ({
            name: s.name,
            email: s.name.toLowerCase() + "@colegio.cl",
            level: Math.floor(s.xp / 45) + 1,
            xp: s.xp,
            streak: s.streak,
            modulesStr: "Unidad 1, Unidad 2"
        }));
    }

    allStudents.sort((a,b) => b.xp - a.xp);

    allStudents.forEach(s => {
        csvContent += `${s.name}\t${s.email}\t${s.level}\t${s.xp}\t${s.streak}\t${s.modulesStr}\n`;
    });

    try {
        await navigator.clipboard.writeText(csvContent);
        playSound('correct');
        alert("📊 ¡Calificaciones copiadas al portapapeles con éxito!\n\nAbre Microsoft Excel o las Hojas de cálculo de Google y presiona 'Pegar' (Ctrl + V) para pegar los datos tabulados.");
    } catch (err) {
        console.error("Error al copiar portapapeles:", err);
        alert("No se pudo copiar de forma automática. Permite el acceso del navegador al portapapeles.");
    }
}

// --- SISTEMA CRUD DE PRE-AUTORIZACIONES DOCENTES ---

async function fetchAuthorizedStudents() {
    const tbody = document.getElementById("crud-tbody");
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 16px; color: var(--color-cyan); font-weight:700;">Recuperando alumnos autorizados...</td></tr>`;

    if (!isFirebaseEnabled) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 16px; color: var(--color-text-muted);">Firebase no configurado. Activa la base de datos para usar el CRUD.</td></tr>`;
        return;
    }

    try {
        const querySnapshot = await db.collection("authorized_students").orderBy("createdAt", "desc").get();
        tbody.innerHTML = "";
        
        if (querySnapshot.empty) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 16px; color: var(--color-text-muted); font-style: italic;">No hay alumnos pre-autorizados en la lista.</td></tr>`;
            return;
        }

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const tr = document.createElement("tr");
            tr.style.borderBottom = "1px solid var(--color-border)";
            tr.innerHTML = `
                <td style="padding: 12px 18px; color: white; font-weight: 700;">${escapeHTML(data.name || '')}</td>
                <td style="padding: 12px 18px; color: var(--color-text-muted);">${escapeHTML(data.email || '')}</td>
                <td style="padding: 12px 18px; color: var(--color-gold); font-family: monospace;">${escapeHTML(data.password || '')}</td>
                <td style="padding: 12px 18px; text-align: center;">
                    <button class="btn-teacher-action delete" onclick="deleteAuthorizedStudent('${doc.id}')">
                        <span>Eliminar ❌</span>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {
        console.error("Error al obtener autorizaciones:", e);
        tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 16px; color: var(--color-crimson); font-weight:700;">⚠️ Error al cargar autorizaciones.</td></tr>`;
    }
}

async function deleteAuthorizedStudent(id) {
    if (!isFirebaseEnabled) return;
    playSound('click');
    if (confirm("¿Estás seguro de que quieres eliminar a este estudiante de la lista de autorizados? Ya no podrá ingresar al juego.")) {
        try {
            await db.collection("authorized_students").doc(id).delete();
            playSound('incorrect');
            alert("Autorización eliminada con éxito.");
            fetchAuthorizedStudents();
        } catch (e) {
            console.error("Error al eliminar autorización:", e);
            alert("No se pudo eliminar la autorización.");
        }
    }
}

// Exponer funciones interactiva al scope global de la ventana
window.rewardStudent = rewardStudent;
window.deleteStudent = deleteStudent;
window.deleteAuthorizedStudent = deleteAuthorizedStudent;
window.fetchAuthorizedStudents = fetchAuthorizedStudents;

// ==========================================================================
// 11. BINDING DE EVENTOS DOCENTES
// ==========================================================================

document.addEventListener("DOMContentLoaded", () => {
    // 0. MENÚ MÓVIL (Sidebar Toggle)
    const mobileMenuBtn = document.getElementById("mobile-menu-btn");
    const sidebarOverlay = document.getElementById("sidebar-overlay");
    const sidebar = document.querySelector(".sidebar");

    function toggleMobileMenu() {
        if (sidebar && sidebarOverlay) {
            sidebar.classList.toggle("mobile-active");
            sidebarOverlay.classList.toggle("active");
        }
    }

    if (mobileMenuBtn) mobileMenuBtn.addEventListener("click", toggleMobileMenu);
    if (sidebarOverlay) sidebarOverlay.addEventListener("click", toggleMobileMenu);

    // 1. NAVEGACIÓN Y TEMA
    
    // Navegación Sidebar
    document.querySelectorAll(".nav-item").forEach(btn => {
        btn.addEventListener("click", () => {
            playSound('click');
            const viewId = btn.getAttribute("data-target");
            if (viewId) {
                showView(viewId);
                // Cerrar menú móvil al seleccionar una opción
                if (window.innerWidth <= 768 && sidebar && sidebar.classList.contains("mobile-active")) {
                    toggleMobileMenu();
                }
            }
        });
    });

    // Alternancia de Tema Claro/Oscuro
    const themeToggleBtn = document.getElementById("theme-toggle-btn");
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener("click", () => {
            playSound('click');
            const newTheme = gameState.theme === 'dark' ? 'light' : 'dark';
            gameState.theme = newTheme;
            saveGameState();
            applyTheme(newTheme);
        });
    }

    // 2. RETO DIARIO Y SANDBOX (ARENA)
    
    // Botón de Enviar Prompt en Sandbox y análisis interactivo en tiempo real
    const sendPromptBtn = document.getElementById("btn-send-prompt");
    const promptInput = document.getElementById("prompt-input");
    if (sendPromptBtn && promptInput) {
        // Analizar texto en tiempo real mientras el alumno escribe
        promptInput.addEventListener("input", (e) => {
            analyzePromptText(e.target.value);
        });

        sendPromptBtn.addEventListener("click", () => {
            playSound('click');
            const text = promptInput.value;
            if (!text.trim()) return;

            // Mostrar el mensaje del usuario en el chat
            const chatMessages = document.getElementById("chat-messages-container");
            if (chatMessages) {
                const userMsg = document.createElement("div");
                userMsg.className = "chat-message user";
                userMsg.innerHTML = `<div class="message-bubble"><p>${escapeHTML(text)}</p></div>`;
                chatMessages.appendChild(userMsg);
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }

            const isSuccess = analyzePromptText(text);
            
            // Simular respuesta del bot
            setTimeout(() => {
                const mission = sandboxMissions[selectedMissionId];
                if (!mission) return;

                const responseText = isSuccess ? mission.successResponse : mission.failResponse;

                if (isSuccess) {
                    playSound('victory');
                    let xpGained = 20;
                    if (selectedMissionId === "2") xpGained = 25;
                    if (selectedMissionId === "3") xpGained = 30;

                    gameState.xp += xpGained;
                    const newLevel = Math.floor(gameState.xp / 45) + 1;
                    if (newLevel > gameState.level) {
                        gameState.level = newLevel;
                        setTimeout(() => {
                            alert(`🎉 ¡FELICIDADES! Has subido al Nivel ${newLevel} de Ingeniería de Prompts.`);
                        }, 800);
                    }
                    saveGameState();
                } else {
                    playSound('incorrect');
                }

                if (chatMessages) {
                    const botMsg = document.createElement("div");
                    botMsg.className = "chat-message bot";
                    botMsg.innerHTML = `<div class="bot-avatar-chat">🤖</div><div class="message-bubble"><p>${responseText}</p></div>`;
                    chatMessages.appendChild(botMsg);
                    chatMessages.scrollTop = chatMessages.scrollHeight;
                }
            }, 1000);
        });
    }
    
    // Botón de Reto Diario a Sandbox
    const gotoSandboxBtn = document.getElementById("btn-goto-sandbox");
    if (gotoSandboxBtn) {
        gotoSandboxBtn.addEventListener("click", () => {
            playSound('click');
            showView("sandbox");
        });
    }

    // 3. MOTOR DE LECCIONES INTERACTIVAS
    
    // Nodos de Lección en el Mapa
    document.querySelectorAll(".node-btn").forEach(node => {
        node.addEventListener("click", () => {
            playSound('click');
            if (node.classList.contains("locked")) {
                alert("🔒 Esta lección está bloqueada. Debes completar las lecciones anteriores primero.");
                return;
            }
            const lessonId = node.getAttribute("data-lesson");
            if (lessonId) {
                startLesson(lessonId);
            }
        });
    });

    // Salir de Lección
    const exitLessonBtn = document.getElementById("btn-exit-lesson");
    if (exitLessonBtn) {
        exitLessonBtn.addEventListener("click", () => {
            playSound('click');
            exitLesson();
        });
    }

    // Comprobar Respuesta en Lección
    const checkAnswerBtn = document.getElementById("btn-check-answer");
    if (checkAnswerBtn) {
        checkAnswerBtn.addEventListener("click", () => {
            playSound('click');
            if (checkAnswerBtn.innerText === "CONTINUAR") {
                currentQuestionIndex++;
                loadQuestion(currentQuestionIndex);
                return;
            }

            const question = currentLesson.questions[currentQuestionIndex];
            let isCorrect = false;

            if (question.type === "multiple-choice") {
                if (selectedOptionIdx === null) {
                    alert("Por favor selecciona una opción antes de comprobar.");
                    return;
                }
                isCorrect = (selectedOptionIdx === question.correctAnswer);
            } else if (question.type === "puzzle") {
                const slots = document.getElementById("puzzle-slots");
                const orderedBlocks = Array.from(slots.children).map(c => c.innerText);
                isCorrect = (orderedBlocks.length === question.correctOrder.length && 
                             orderedBlocks.every((val, i) => val === question.correctOrder[i]));
            } else if (question.type === "checkbox") {
                if (selectedCheckboxIndices.length === 0) {
                    alert("Por favor selecciona al menos una opción.");
                    return;
                }
                const correctSet = new Set(question.correctAnswer);
                const selectedSet = new Set(selectedCheckboxIndices);
                isCorrect = (correctSet.size === selectedSet.size && 
                             [...correctSet].every(val => selectedSet.has(val)));
            }

            const footer = document.getElementById("lesson-footer-bar");
            const feedbackBox = document.getElementById("footer-feedback-box");
            const feedbackIcon = document.getElementById("feedback-icon-el");
            const feedbackTitle = document.getElementById("feedback-title-el");
            const feedbackDesc = document.getElementById("feedback-desc-el");

            if (feedbackBox) feedbackBox.classList.remove("hidden");

            if (isCorrect) {
                playSound('correct');
                animateRobotExpression('happy');
                if (footer) footer.classList.add("correct");
                if (feedbackIcon) feedbackIcon.innerText = "✅";
                if (feedbackTitle) feedbackTitle.innerText = "¡Excelente trabajo!";
                if (feedbackDesc) feedbackDesc.innerText = question.explanation || "Respuesta correcta.";
            } else {
                playSound('incorrect');
                animateRobotExpression('sad');
                lessonHearts--;
                const hrtVal = document.getElementById("lesson-hearts-val");
                if (hrtVal) hrtVal.innerText = lessonHearts;

                if (footer) footer.classList.add("incorrect");
                if (feedbackIcon) feedbackIcon.innerText = "❌";
                if (feedbackTitle) feedbackTitle.innerText = "Respuesta Incorrecta";
                if (feedbackDesc) feedbackDesc.innerText = question.explanation || "Sigue intentándolo.";

                if (lessonHearts <= 0) {
                    alert("💔 Te has quedado sin vidas. ¡No te rindas! Inténtalo de nuevo.");
                    exitLesson();
                    return;
                }
            }

            checkAnswerBtn.innerText = "CONTINUAR";
        });
    }

    // Botón Continuar en Éxito de Lección (Trophy Overlay)
    const finishLessonBtn = document.getElementById("btn-finish-lesson");
    if (finishLessonBtn) {
        finishLessonBtn.addEventListener("click", () => {
            playSound('click');
            const successOverlay = document.getElementById("lesson-success-overlay");
            if (successOverlay) successOverlay.classList.add("hidden");
            showView("dashboard");
        });
    }

    // 4. CONFIGURACIÓN DEL PERFIL (USUARIO Y AVATAR)
    
    // Guardar nombre de usuario manual
    const saveUsernameBtn = document.getElementById("btn-save-username");
    const usernameInput = document.getElementById("input-username");
    if (saveUsernameBtn && usernameInput) {
        saveUsernameBtn.addEventListener("click", () => {
            playSound('click');
            const val = usernameInput.value.trim();
            if (val) {
                gameState.username = val;
                saveGameState();
                initProfileView();
                renderLeaderboard();
                alert("¡Nombre de usuario actualizado exitosamente!");
            }
        });
    }

    // Selectores de Avatar
    const avatarOpts = document.querySelectorAll(".avatar-opt");
    avatarOpts.forEach(opt => {
        opt.addEventListener("click", () => {
            playSound('click');
            avatarOpts.forEach(o => o.classList.remove("selected"));
            opt.classList.add("selected");
            gameState.avatarEmoji = opt.getAttribute("data-emoji");
            saveGameState();
            const pEmoji = document.getElementById("profile-emoji");
            if (pEmoji) pEmoji.innerText = gameState.avatarEmoji;
            renderLeaderboard();
        });
    });

    // Botón de Reiniciar datos
    const resetDataBtn = document.getElementById("btn-reset-data");
    if (resetDataBtn) {
        resetDataBtn.addEventListener("click", () => {
            playSound('click');
            resetGameState();
        });
    }

    // 5. INTEGRACIÓN Y AUTENTICACIÓN FIREBASE CLOUD
    
    // Control de Estado de Sesión en Firebase (Nube) - Bloqueo Obligatorio
    if (isFirebaseEnabled) {
        firebase.auth().onAuthStateChanged(user => {
            const cloudBtn = document.getElementById("btn-nav-cloud");
            const cloudTxt = document.getElementById("cloud-status-text");
            const profConnected = document.getElementById("profile-cloud-status-connected");
            const profDisconnected = document.getElementById("profile-cloud-status-disconnected");
            const profEmail = document.getElementById("profile-cloud-email");

            if (user) {
                currentUser = user;
                
                // Ocultar pantalla de bloqueo obligatorio de forma inmediata
                const authModal = document.getElementById("auth-modal");
                if (authModal) authModal.classList.add("hidden");

                if (cloudBtn) {
                    cloudBtn.classList.remove("disconnected");
                    cloudBtn.classList.add("connected");
                }
                if (cloudTxt) cloudTxt.innerText = "Nube Conectada";
                if (profConnected) profConnected.classList.remove("hidden");
                if (profDisconnected) profDisconnected.classList.add("hidden");
                if (profEmail) profEmail.innerText = user.email;
                if (gameState.username === "Estudiante Prompter") {
                    gameState.username = user.email.split("@")[0];
                }
                loadCloudProgress(user);
            } else {
                currentUser = null;
                
                // Mostrar pantalla de bloqueo obligatorio (a menos que estemos en el Panel Docente)
                const authModal = document.getElementById("auth-modal");
                if (authModal && gameState.activeView !== "teacher") {
                    authModal.classList.remove("hidden");
                }

                if (cloudBtn) {
                    cloudBtn.classList.remove("connected");
                    cloudBtn.classList.add("disconnected");
                }
                if (cloudTxt) cloudTxt.innerText = "Conectar Nube";
                if (profConnected) profConnected.classList.add("hidden");
                if (profDisconnected) profDisconnected.classList.remove("hidden");
                loadGameState();
            }
        });
    }

    // Botón Conectar Nube en la Barra Lateral
    const navCloudBtn = document.getElementById("btn-nav-cloud");
    if (navCloudBtn) {
        navCloudBtn.addEventListener("click", () => {
            playSound('click');
            const authModal = document.getElementById("auth-modal");
            if (authModal) authModal.classList.remove("hidden");
        });
    }

    // Botón Conectar Nube en Perfil
    const profileConnectBtn = document.getElementById("btn-profile-connect-cloud");
    if (profileConnectBtn) {
        profileConnectBtn.addEventListener("click", () => {
            playSound('click');
            const authModal = document.getElementById("auth-modal");
            if (authModal) authModal.classList.remove("hidden");
        });
    }

    // Cerrar Modal de Autenticación
    const closeAuthBtn = document.getElementById("btn-close-auth");
    if (closeAuthBtn) {
        closeAuthBtn.addEventListener("click", () => {
            playSound('click');
            const authModal = document.getElementById("auth-modal");
            if (authModal) authModal.classList.add("hidden");
        });
    }

    // Botón de Cerrar Sesión en Perfil
    const profileLogoutBtn = document.getElementById("btn-profile-logout");
    if (profileLogoutBtn) {
        profileLogoutBtn.addEventListener("click", () => {
            playSound('click');
            if (confirm("¿Estás seguro de que deseas cerrar tu sesión en la nube en este computador?")) {
                if (isFirebaseEnabled) {
                    firebase.auth().signOut().then(() => {
                        alert("Sesión cerrada con éxito. El progreso continuará guardándose localmente.");
                    });
                }
            }
        });
    }

    // Cambiar de pestañas en modal de Autenticación (Login/Register)
    const tabLogin = document.getElementById("tab-login");
    const tabRegister = document.getElementById("tab-register");
    const formLogin = document.getElementById("form-login");
    const formRegister = document.getElementById("form-register");

    if (tabLogin && tabRegister && formLogin && formRegister) {
        tabLogin.addEventListener("click", () => {
            playSound('click');
            tabLogin.classList.add("active");
            tabRegister.classList.remove("active");
            formLogin.classList.remove("hidden");
            formRegister.classList.add("hidden");
        });

        tabRegister.addEventListener("click", () => {
            playSound('click');
            tabRegister.classList.add("active");
            tabLogin.classList.remove("active");
            formRegister.classList.remove("hidden");
            formLogin.classList.add("hidden");
        });
    }

    // Envío del Formulario de Inicio de Sesión (Con Auto-Registro de alumnos pre-autorizados)
    if (formLogin) {
        formLogin.addEventListener("submit", (e) => {
            e.preventDefault();
            playSound('click');
            const email = document.getElementById("login-email").value.trim().toLowerCase();
            const password = document.getElementById("login-password").value;
            const msg = document.getElementById("auth-message");

            if (isFirebaseEnabled) {
                if (msg) {
                    msg.classList.remove("hidden");
                    msg.className = "auth-message warning";
                    msg.innerText = "Conectando con la nube...";
                }

                // Intentar primeramente iniciar sesión directa
                firebase.auth().signInWithEmailAndPassword(email, password)
                    .then(() => {
                        if (msg) {
                            msg.className = "auth-message success";
                            msg.innerText = "¡Inicio de sesión exitoso! Descargando tu progreso...";
                        }
                        setTimeout(() => {
                            const authModal = document.getElementById("auth-modal");
                            if (authModal) authModal.classList.add("hidden");
                            if (msg) msg.classList.add("hidden");
                        }, 1500);
                    })
                    .catch((error) => {
                        console.log("Intento de login directo falló. Buscando pre-autorización escolar...", error.code);
                        
                        // Si el usuario no existe, o las credenciales no son válidas en Auth, verificar pre-autorización en Firestore
                        db.collection("authorized_students")
                            .where("email", "==", email)
                            .where("password", "==", password)
                            .get()
                            .then((snapshot) => {
                                if (!snapshot.empty) {
                                    // ¡Existe pre-autorización! Registrar al alumno de forma automática
                                    if (msg) {
                                        msg.className = "auth-message success";
                                        msg.innerText = "¡Primer ingreso escolar detectado! Creando tu cuenta segura...";
                                    }
                                    
                                    const authorizedDoc = snapshot.docs[0];
                                    const studentName = authorizedDoc.data().name;
                                    
                                    firebase.auth().createUserWithEmailAndPassword(email, password)
                                        .then((userCredential) => {
                                            const user = userCredential.user;
                                            
                                            // Inicializar el estado de juego directamente en la colección 'users' de Firestore
                                            const initialProfile = {
                                                ...DEFAULT_GAME_STATE,
                                                username: studentName,
                                                email: email
                                            };
                                            
                                            db.collection("users").doc(user.uid).set(initialProfile)
                                                .then(() => {
                                                    if (msg) {
                                                        msg.innerText = "¡Cuenta activada con éxito! Entrando al juego...";
                                                    }
                                                    setTimeout(() => {
                                                        const authModal = document.getElementById("auth-modal");
                                                        if (authModal) authModal.classList.add("hidden");
                                                        if (msg) msg.classList.add("hidden");
                                                    }, 1500);
                                                });
                                        })
                                        .catch((regError) => {
                                            console.error("Error al auto-registrar:", regError);
                                            if (msg) {
                                                msg.className = "auth-message error";
                                                msg.innerText = `Error de registro automático: ${regError.message}`;
                                            }
                                        });
                                } else {
                                    // No existe en autorizados tampoco. Credenciales incorrectas.
                                    if (msg) {
                                        msg.className = "auth-message error";
                                        msg.innerText = "Acceso Denegado. Correo o contraseña escolar incorrectos.";
                                    }
                                }
                            })
                            .catch((fsError) => {
                                console.error("Error al consultar autorizaciones:", fsError);
                                if (msg) {
                                    msg.className = "auth-message error";
                                    msg.innerText = "Error de red escolar al validar credenciales.";
                                }
                            });
                    });
            }
        });
    }

    // Botón de Pre-Autorización Escolar (CRUD Docente)
    const crudSaveBtn = document.getElementById("btn-crud-save-student");
    if (crudSaveBtn) {
        crudSaveBtn.addEventListener("click", () => {
            playSound('click');
            const nameInput = document.getElementById("crud-student-name");
            const emailInput = document.getElementById("crud-student-email");
            const passInput = document.getElementById("crud-student-password");
            
            const nameVal = nameInput ? nameInput.value.trim() : "";
            const emailVal = emailInput ? emailInput.value.trim().toLowerCase() : "";
            const passVal = passInput ? passInput.value : "";
            
            if (!nameVal || !emailVal || !passVal) {
                alert("⚠️ Por favor completa todos los campos del alumno.");
                return;
            }
            
            if (passVal.length < 6) {
                alert("⚠️ La contraseña debe tener al menos 6 caracteres por seguridad de Firebase.");
                return;
            }
            
            if (isFirebaseEnabled) {
                db.collection("authorized_students").add({
                    name: nameVal,
                    email: emailVal,
                    password: passVal,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                }).then(() => {
                    playSound('correct');
                    alert(`¡Estudiante "${nameVal}" pre-autorizado con éxito!`);
                    
                    // Limpiar campos
                    if (nameInput) nameInput.value = "";
                    if (emailInput) emailInput.value = "";
                    if (passInput) passInput.value = "";
                    
                    fetchAuthorizedStudents();
                }).catch((err) => {
                    console.error("Error al guardar autorización:", err);
                    alert("Error de base de datos al autorizar: " + err.message);
                });
            } else {
                alert("⚠️ No se puede autorizar al estudiante porque Firebase no está configurado.\n\nPor favor, abre el archivo 'app.js' en tu editor de código y actualiza la constante 'firebaseConfig' al inicio del archivo con tus credenciales reales de la consola de Firebase.");
            }
        });
    }

    // Botón de Bypass para el Docente en la pantalla de bloqueo
    const bypassTeacherBtn = document.getElementById("btn-login-bypass-teacher");
    if (bypassTeacherBtn) {
        bypassTeacherBtn.addEventListener("click", () => {
            playSound('click');
            showView("teacher");
            
            // Ocultar temporalmente el bloqueo de login para ver el formulario del PIN docente
            const authModal = document.getElementById("auth-modal");
            if (authModal) authModal.classList.add("hidden");
        });
    }

    // Toggle para mostrar/ocultar importación masiva
    const toggleMassiveImportBtn = document.getElementById("btn-toggle-massive-import");
    const massiveImportContainer = document.getElementById("massive-import-container");
    const massiveImportStatus = document.getElementById("toggle-massive-import-status");
    
    if (toggleMassiveImportBtn && massiveImportContainer && massiveImportStatus) {
        toggleMassiveImportBtn.addEventListener("click", () => {
            playSound('click');
            const isHidden = massiveImportContainer.classList.toggle("hidden");
            if (isHidden) {
                massiveImportStatus.innerText = "Hacer clic para expandir ⏷";
            } else {
                massiveImportStatus.innerText = "Hacer clic para colapsar ⏶";
            }
        });
    }

    // Procesar e importar lista masiva (Excel / Sheets)
    const massiveImportBtn = document.getElementById("btn-crud-massive-import");
    if (massiveImportBtn) {
        massiveImportBtn.addEventListener("click", () => {
            playSound('click');
            const massiveTextInput = document.getElementById("crud-massive-text");
            const textVal = massiveTextInput ? massiveTextInput.value.trim() : "";
            
            if (!textVal) {
                alert("⚠️ Por favor ingresa o pega el texto copiado de Excel.");
                return;
            }

            if (!isFirebaseEnabled) {
                alert("⚠️ Firebase no está configurado. Conéctalo para usar esta característica.");
                return;
            }

            const lines = textVal.split("\n");
            let successCount = 0;
            let skipCount = 0;
            const promises = [];

            lines.forEach((line) => {
                const cleanedLine = line.trim();
                if (!cleanedLine) return; // Fila vacía

                // Detectar el separador de forma inteligente (Tabulador, Punto y Coma o Coma)
                let parts = [];
                if (cleanedLine.includes("\t")) {
                    parts = cleanedLine.split("\t");
                } else if (cleanedLine.includes(";")) {
                    parts = cleanedLine.split(";");
                } else if (cleanedLine.includes(",")) {
                    parts = cleanedLine.split(",");
                } else {
                    parts = [cleanedLine];
                }
                
                if (parts.length >= 3) {
                    const name = parts[0].trim();
                    const email = parts[1].trim().toLowerCase();
                    const password = parts[2].trim();

                    // Validaciones rápidas
                    if (name && email.includes("@") && password.length >= 6) {
                        const promise = db.collection("authorized_students").add({
                            name: name,
                            email: email,
                            password: password,
                            createdAt: firebase.firestore.FieldValue.serverTimestamp()
                        }).then(() => {
                            successCount++;
                        }).catch((err) => {
                            console.error("Error al guardar fila masiva:", err);
                            skipCount++;
                        });
                        promises.push(promise);
                    } else {
                        skipCount++;
                    }
                } else if (parts.length === 2) {
                    // Si el profesor no copió clave, le asignamos una clave por defecto con prefijo y número aleatorio
                    const name = parts[0].trim();
                    const email = parts[1].trim().toLowerCase();
                    const password = "clave" + Math.floor(100 + Math.random() * 900); // Clave como 'clave345' para que el docente la vea en la tabla

                    if (name && email.includes("@")) {
                        const promise = db.collection("authorized_students").add({
                            name: name,
                            email: email,
                            password: password,
                            createdAt: firebase.firestore.FieldValue.serverTimestamp()
                        }).then(() => {
                            successCount++;
                        }).catch((err) => {
                            skipCount++;
                        });
                        promises.push(promise);
                    } else {
                        skipCount++;
                    }
                } else {
                    skipCount++;
                }
            });

            if (promises.length === 0) {
                alert("⚠️ Formato de datos no reconocido. Verifica el formato en el ejemplo e inténtalo nuevamente.");
                return;
            }

            massiveImportBtn.disabled = true;
            massiveImportBtn.innerText = "Procesando importación asíncrona... ⏳";

            Promise.all(promises).then(() => {
                playSound('victory');
                alert(`📊 Importación masiva completada.\n\n✔️ ${successCount} alumnos pre-autorizados con éxito.\n⚠️ ${skipCount} filas omitidas por formato inválido o claves menores a 6 caracteres.`);
                
                if (massiveTextInput) massiveTextInput.value = "";
                if (massiveImportContainer) massiveImportContainer.classList.add("hidden");
                if (massiveImportStatus) massiveImportStatus.innerText = "Hacer clic para expandir ⏷";
                
                massiveImportBtn.disabled = false;
                massiveImportBtn.innerText = "Procesando e Importar Lista Masiva 🚀";
                
                fetchAuthorizedStudents();
            }).catch((err) => {
                console.error("Error en la importación masiva paralela:", err);
                alert("Ocurrió un error al guardar los alumnos en la base de datos.");
                massiveImportBtn.disabled = false;
                massiveImportBtn.innerText = "Procesando e Importar Lista Masiva 🚀";
            });
        });
    }

// Lógica de Eliminación Masiva de Estudiantes
async function deleteAllStudents() {
    playSound('click');
    if (confirm("⚠️ ¿Estás COMPLETAMENTE SEGURO de que quieres eliminar a TODOS los estudiantes de la base de datos? Esta acción es irreversible y borrará el progreso de todos.")) {
        if (confirm("🚨 ÚLTIMA CONFIRMACIÓN: ¿Deseas proceder? Se perderán todos los datos de forma permanente.")) {
            if (isFirebaseEnabled && db) {
                try {
                    const querySnapshot = await db.collection("users").get();
                    const batch = db.batch();
                    let count = 0;
                    querySnapshot.forEach((doc) => {
                        batch.delete(doc.ref);
                        count++;
                    });
                    if (count > 0) {
                        await batch.commit();
                        playSound('incorrect');
                        alert("¡Todos los alumnos han sido eliminados de la nube de Firebase Firestore!");
                    } else {
                        alert("No hay alumnos registrados para eliminar.");
                    }
                    fetchStudentList();
                } catch (e) {
                    console.error("Error al borrar alumnos de la nube:", e);
                    alert("Ocurrió un error al intentar eliminar masivamente de la nube.");
                }
            } else {
                playSound('incorrect');
                alert("Estás en Modo Local de demostración. No se pueden eliminar los alumnos simulados permanentes.");
            }
        }
    }
}

    // 6. EVENTOS DEL PANEL DOCENTE
    
    // Vincular clic del Panel Docente en Sidebar
    const navTeacherBtn = document.getElementById("btn-nav-teacher");
    if (navTeacherBtn) {
        navTeacherBtn.addEventListener("click", () => {
            playSound('click');
            showView("teacher");
        });
    }

    // Botón de Desbloqueo del Panel
    const unlockBtn = document.getElementById("btn-unlock-teacher");
    if (unlockBtn) {
        unlockBtn.addEventListener("click", () => {
            playSound('click');
            const emailVal = document.getElementById("teacher-email-input").value.trim();
            const pinVal = document.getElementById("teacher-pin-input").value;
            const errEl = document.getElementById("lock-error-msg");
            
            const handleSuccess = () => {
                playSound('correct');
                isTeacherAuthorized = true;
                if (errEl) errEl.classList.add("hidden");
                initTeacherView();
            };
            const handleError = () => {
                playSound('incorrect');
                if (errEl) errEl.classList.remove("hidden");
                document.getElementById("teacher-pin-input").value = "";
            };

            if (emailVal === "andres.marin@falconcollege.cl" && pinVal === "amm050620@") {
                handleSuccess();
            } else if (isFirebaseEnabled && firebase.auth) {
                firebase.auth().signInWithEmailAndPassword(emailVal, pinVal).then((userCred) => {
                    handleSuccess();
                }).catch((err) => {
                    handleError();
                });
            } else {
                handleError();
            }
        });
    }

    // Enter en PIN input también dispara desbloqueo
    const pinInput = document.getElementById("teacher-pin-input");
    if (pinInput) {
        pinInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter") {
                if (unlockBtn) unlockBtn.click();
            }
        });
    }

    // Actualizar lista manual
    const refreshBtn = document.getElementById("btn-refresh-students");
    if (refreshBtn) {
        refreshBtn.addEventListener("click", () => {
            playSound('click');
            fetchStudentList();
        });
    }

    // Copiar notas
    const copyGradesBtn = document.getElementById("btn-copy-grades");
    if (copyGradesBtn) {
        copyGradesBtn.addEventListener("click", copyGradesToClipboard);
    }

    // Eliminar todos los estudiantes
    const deleteAllStudentsBtn = document.getElementById("btn-delete-all-students");
    if (deleteAllStudentsBtn) {
        deleteAllStudentsBtn.addEventListener("click", deleteAllStudents);
    }

    // Agregar nuevo establecimiento desde el panel docente
    const addInstitutionBtn = document.getElementById("btn-teacher-add-institution");
    if (addInstitutionBtn) {
        addInstitutionBtn.addEventListener("click", () => {
            playSound('click');
            const input = document.getElementById("teacher-new-institution");
            const newInstVal = input ? input.value.trim() : "";
            
            if (!newInstVal) {
                alert("⚠️ Por favor escribe el nombre de un establecimiento.");
                return;
            }
            
            if (institutionsList.includes(newInstVal)) {
                alert("⚠️ Este establecimiento ya existe en la lista.");
                return;
            }
            
            institutionsList.push(newInstVal);
            saveInstitutions().then(() => {
                if (input) input.value = "";
                playSound('correct');
                alert(`🏫 "${newInstVal}" ha sido agregado correctamente.`);
            });
        });
    }

    // Agregar nuevo curso desde el panel docente
    const addCourseBtn = document.getElementById("btn-teacher-add-course");
    if (addCourseBtn) {
        addCourseBtn.addEventListener("click", () => {
            playSound('click');
            const input = document.getElementById("teacher-new-course");
            const newCourVal = input ? input.value.trim() : "";
            
            if (!newCourVal) {
                alert("⚠️ Por favor escribe el nombre del curso.");
                return;
            }
            
            if (coursesList.includes(newCourVal)) {
                alert("⚠️ Este curso ya existe en la lista.");
                return;
            }
            
            coursesList.push(newCourVal);
            saveCourses().then(() => {
                if (input) input.value = "";
                playSound('correct');
                alert(`📚 "${newCourVal}" ha sido agregado correctamente.`);
            });
        });
    }

    // 7. EVENTOS DE ONBOARDING Y ACORDEONES
    
    // Guardar Onboarding de bienvenida
    const submitOnboardingBtn = document.getElementById("btn-submit-onboarding");
    if (submitOnboardingBtn) {
        submitOnboardingBtn.addEventListener("click", () => {
            playSound('click');
            const usernameInput = document.getElementById("onboarding-username");
            const selectInst = document.getElementById("select-onboarding-institution");
            const selectCour = document.getElementById("select-onboarding-course");
            
            const username = usernameInput ? usernameInput.value.trim() : "";
            const institution = selectInst ? selectInst.value : "";
            const course = selectCour ? selectCour.value : "";
            
            if (!username) {
                alert("⚠️ Por favor, ingresa tu nombre o alias.");
                return;
            }
            if (!institution) {
                alert("⚠️ Por favor, selecciona tu colegio o liceo.");
                return;
            }
            if (!course) {
                alert("⚠️ Por favor, selecciona tu curso.");
                return;
            }
            
            gameState.username = username;
            gameState.institution = institution;
            gameState.course = course;
            gameState.role = 'student';
            
            saveGameState().then(() => {
                const overlay = document.getElementById("onboarding-overlay");
                if (overlay) overlay.classList.add("hidden");
                
                // Actualizar vistas y estadísticas
                updateGlobalUIStats();
                renderLeaderboard();
                initProfileView();
                alert(`¡Excelente! Bienvenido(a) ${username}. Tu perfil ha sido configurado.`);
            });
        });
    }

    // Toggle para Onboarding: Estudiante vs Profesor
    const linkShowTeacherLogin = document.getElementById("link-show-teacher-login");
    const linkBackToStudent = document.getElementById("link-back-to-student");
    const onboardingStudentForm = document.getElementById("onboarding-student-form");
    const onboardingTeacherLogin = document.getElementById("onboarding-teacher-login");
    
    if (linkShowTeacherLogin && linkBackToStudent && onboardingStudentForm && onboardingTeacherLogin) {
        linkShowTeacherLogin.addEventListener("click", (e) => {
            e.preventDefault();
            playSound('click');
            onboardingStudentForm.classList.add("hidden");
            onboardingTeacherLogin.classList.remove("hidden");
        });
        
        linkBackToStudent.addEventListener("click", (e) => {
            e.preventDefault();
            playSound('click');
            onboardingTeacherLogin.classList.add("hidden");
            onboardingStudentForm.classList.remove("hidden");
        });
    }

    // Submit Teacher Login desde Onboarding
    const submitTeacherLoginBtn = document.getElementById("btn-submit-teacher-login");
    if (submitTeacherLoginBtn) {
        submitTeacherLoginBtn.addEventListener("click", () => {
            playSound('click');
            const emailVal = document.getElementById("onboarding-teacher-email").value.trim();
            const pinVal = document.getElementById("onboarding-teacher-pin").value;
            const errEl = document.getElementById("onboarding-teacher-error");
            
            const handleSuccess = () => {
                playSound('correct');
                if (errEl) errEl.classList.add("hidden");
                
                // Configurar como profesor
                gameState.role = 'teacher';
                gameState.username = 'Profesor / Administrador';
                
                saveGameState().then(() => {
                    const overlay = document.getElementById("onboarding-overlay");
                    if (overlay) overlay.classList.add("hidden");
                    
                    isTeacherAuthorized = true;
                    showView("teacher");
                    initTeacherView();
                });
            };
            const handleError = () => {
                playSound('incorrect');
                if (errEl) errEl.classList.remove("hidden");
                document.getElementById("onboarding-teacher-pin").value = "";
            };

            if (emailVal === "andres.marin@falconcollege.cl" && pinVal === "amm050620@") {
                handleSuccess();
            } else if (isFirebaseEnabled && firebase.auth) {
                firebase.auth().signInWithEmailAndPassword(emailVal, pinVal).then((userCred) => {
                    handleSuccess();
                }).catch((err) => {
                    handleError();
                });
            } else {
                handleError();
            }
        });
        
        // Enter en PIN de onboarding
        const onboardingPinInput = document.getElementById("onboarding-teacher-pin");
        if (onboardingPinInput) {
            onboardingPinInput.addEventListener("keypress", (e) => {
                if (e.key === "Enter") {
                    submitTeacherLoginBtn.click();
                }
            });
        }
    }

    // Acordeones de Objetivos y Competencias
    document.querySelectorAll(".btn-accordion-toggle").forEach(btn => {
        btn.addEventListener("click", () => {
            playSound('click');
            btn.classList.toggle("active");
            const unit = btn.getAttribute("data-unit");
            const panel = document.getElementById(`panel-${unit}`);
            if (panel) {
                panel.classList.toggle("active");
            }
        });
    });

    // Guardado automático al cambiar dropdowns en Perfil
    const selectProfileInst = document.getElementById("select-profile-institution");
    const selectProfileCour = document.getElementById("select-profile-course");
    if (selectProfileInst) {
        selectProfileInst.addEventListener("change", () => {
            playSound('click');
            gameState.institution = selectProfileInst.value;
            saveGameState();
            initProfileView();
        });
    }
    if (selectProfileCour) {
        selectProfileCour.addEventListener("change", () => {
            playSound('click');
            gameState.course = selectProfileCour.value;
            saveGameState();
            initProfileView();
        });
    }

    // ==========================================================================
    // LÓGICA DE GRÁFICOS Y ANALÍTICA DOCENTE CON CHART.JS
    // ==========================================================================
    let chartLevelsInstance = null;
    let chartLessonsInstance = null;

    window.updateTeacherCharts = function(allStudents) {
        if (typeof Chart === 'undefined') return;

        // 1. Destruir instancias previas para evitar bugs de hover en canvas
        if (chartLevelsInstance) chartLevelsInstance.destroy();
        if (chartLessonsInstance) chartLessonsInstance.destroy();

        // 2. Gráfico de Niveles (Barras)
        const levelsCount = {};
        allStudents.forEach(s => {
            levelsCount[s.level] = (levelsCount[s.level] || 0) + 1;
        });
        
        const maxLevel = Math.max(3, ...Object.keys(levelsCount).map(Number));
        const labelsLevels = [];
        const dataLevels = [];
        for (let i = 1; i <= maxLevel; i++) {
            labelsLevels.push(`Nivel ${i}`);
            dataLevels.push(levelsCount[i] || 0);
        }

        const ctxLevels = document.getElementById("chart-levels");
        if (ctxLevels) {
            chartLevelsInstance = new Chart(ctxLevels, {
                type: 'bar',
                data: {
                    labels: labelsLevels,
                    datasets: [{
                        label: 'Cantidad de Alumnos',
                        data: dataLevels,
                        backgroundColor: 'rgba(0, 242, 254, 0.45)',
                        borderColor: 'rgb(0, 242, 254)',
                        borderWidth: 2,
                        borderRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#8d99ae' } },
                        y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#8d99ae', stepSize: 1 } }
                    }
                }
            });
        }

        // 3. Gráfico de Tasa de Éxito de Lecciones (Dona/Circular)
        const completionCount = { 'U1': 0, 'U2': 0, 'U3': 0, 'U4': 0 };
        allStudents.forEach(s => {
            if (s.lessonsCompleted.includes("1_3")) completionCount['U1']++;
            if (s.lessonsCompleted.includes("2_4")) completionCount['U2']++;
            if (s.lessonsCompleted.includes("3_3")) completionCount['U3']++;
            if (s.lessonsCompleted.includes("4_3")) completionCount['U4']++;
        });
        
        const totalNum = allStudents.length || 1;
        const u1Percentage = Math.round((completionCount['U1'] / totalNum) * 100);
        const u2Percentage = Math.round((completionCount['U2'] / totalNum) * 100);
        const u3Percentage = Math.round((completionCount['U3'] / totalNum) * 100);
        const u4Percentage = Math.round((completionCount['U4'] / totalNum) * 100);

        const ctxLessons = document.getElementById("chart-lessons");
        if (ctxLessons) {
            chartLessonsInstance = new Chart(ctxLessons, {
                type: 'doughnut',
                data: {
                    labels: ['U1 (RCTF) %', 'U2 (CREA) %', 'U3 (CREATE) %', 'U4 (Final) %'],
                    datasets: [{
                        data: [u1Percentage, u2Percentage, u3Percentage, u4Percentage],
                        backgroundColor: [
                            'rgba(0, 242, 254, 0.55)',
                            'rgba(157, 78, 221, 0.55)',
                            'rgba(255, 183, 3, 0.55)',
                            'rgba(0, 230, 118, 0.55)'
                        ],
                        borderColor: [
                            'rgb(0, 242, 254)',
                            'rgb(157, 78, 221)',
                            'rgb(255, 183, 3)',
                            'rgb(0, 230, 118)'
                        ],
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'right',
                            labels: { color: '#ffffff', font: { size: 10 } }
                        }
                    }
                }
            });
        }
    };

    // ==========================================================================
    // LÓGICA DE IMPRESIÓN DE CREDENCIALES PDF RECORTABLES
    // ==========================================================================
    const printCredentialsBtn = document.getElementById("btn-print-credentials");
    if (printCredentialsBtn) {
        printCredentialsBtn.addEventListener("click", async () => {
            playSound('click');
            const printArea = document.getElementById("print-credentials-area");
            if (!printArea) return;

            printArea.innerHTML = `<div style="padding:40px; text-align:center; color:black; font-family:sans-serif;"><h3>Generando tarjetas de acceso... ⏳</h3></div>`;
            let students = [];

            if (isFirebaseEnabled) {
                try {
                    const querySnapshot = await db.collection("authorized_students").get();
                    querySnapshot.forEach(doc => {
                        students.push(doc.data());
                    });
                } catch (e) {
                    console.error("Error al obtener credenciales para imprimir:", e);
                    alert("Ocurrió un error al obtener las credenciales de Firestore.");
                    return;
                }
            } else {
                students = [
                    { name: "Estudiante de Prueba A", email: "alumnoa@colegio.cl", password: "claveprovisoria1" },
                    { name: "Estudiante de Prueba B", email: "alumnob@colegio.cl", password: "claveprovisoria2" }
                ];
            }

            if (students.length === 0) {
                alert("⚠️ No hay alumnos pre-autorizados o registrados para imprimir.");
                return;
            }

            // Construir cuadricula de tarjetas para impresión física
            let cardsHTML = `
                <div class="print-header" style="text-align:center; margin-bottom:24px; font-family:'Outfit', sans-serif; display:block;">
                    <h2 style="margin:0; font-size:24px; color:#1a1a1a;">Tarjetas de Acceso Escolar - PrompterQuest</h2>
                    <p style="margin:6px 0 0 0; font-size:13px; color:#555;">Entrega esta tarjeta a cada estudiante para ingresar al juego.</p>
                </div>
                <div class="print-cards-grid" style="display:grid; grid-template-columns: repeat(2, 1fr); gap:16px; page-break-inside:avoid;">
            `;

            students.forEach(std => {
                cardsHTML += `
                    <div class="print-card-item" style="border:2px dashed #9d4ede; border-radius:12px; padding:18px; background:#ffffff; font-family:sans-serif; color:#000000; box-sizing:border-box; page-break-inside:avoid; height:180px; display:flex; flex-direction:column; justify-content:space-between;">
                        <div>
                            <div style="font-size:14px; font-weight:800; color:#9d4ede; margin-bottom:8px; display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid #ddd; padding-bottom:6px;">
                                <span>🎮 PrompterQuest</span>
                                <span style="font-size:9px; background:#9d4ede; color:#fff; padding:2px 6px; border-radius:10px; font-weight:700;">Estudiante</span>
                            </div>
                            <div style="margin-bottom:6px;">
                                <span style="font-size:9px; color:#666; text-transform:uppercase; font-weight:700; display:block;">Alumno:</span>
                                <span style="font-size:13px; font-weight:800; color:#111;">${std.name}</span>
                            </div>
                            <div style="margin-bottom:6px;">
                                <span style="font-size:9px; color:#666; text-transform:uppercase; font-weight:700; display:block;">Correo:</span>
                                <span style="font-size:11px; font-family:monospace; font-weight:700; color:#222; word-break:break-all;">${std.email}</span>
                            </div>
                        </div>
                        <div style="display:flex; justify-content:space-between; align-items:center; background:#f5efff; padding:6px 10px; border-radius:6px; border:1px solid #dcd0ff;">
                            <div>
                                <span style="font-size:8px; color:#666; text-transform:uppercase; font-weight:700; display:block;">Contraseña Inicial:</span>
                                <span style="font-size:11px; font-family:monospace; font-weight:800; color:#4a0072;">${std.password}</span>
                            </div>
                            <span style="font-size:8px; color:#9d4ede; font-weight:700;">amarinmella.github.io</span>
                        </div>
                    </div>
                `;
            });

            cardsHTML += `</div>`;
            printArea.innerHTML = cardsHTML;

            // Esperar que el DOM renderice y disparar ventana de impresión
            setTimeout(() => {
                window.print();
            }, 300);
        });
    }

    // 8. CARGA DE INICIO LOCAL
    loadGameState();
    showView(gameState.activeView || "dashboard");
});

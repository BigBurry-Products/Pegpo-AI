import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const appId = window.__app_id || 'default-app-id';
const firebaseConfig = JSON.parse(window.__firebase_config || '{}');
const initialAuthToken = window.__initial_auth_token || null;

const appContainer = document.getElementById('appContainer');
const chatInput = document.getElementById('chatInput');
const sendButton = document.getElementById('sendButton');
const chatContent = document.getElementById('chat-content');
const newChatBtn = document.getElementById('newChatBtn');
const centerContainer = document.getElementById('initial-center-container');
const actionPills = document.getElementById('action-pills');
const menuToggle = document.getElementById('menuToggle');
const mainContentArea = document.getElementById('mainContentArea');
const pegpoLogo = document.getElementById('pegpoLogo');

let isProcessing = false;
let isChatActive = false;

// ===== Response Handler for formatting AI responses =====
const responseHandler = new ResponseHandler();
let currentResponseData = {
    query: '',
    answer: '',
    images: [],
    sources: [],
    relatedQuestions: []
};

// ===== Streaming / Stop control (Step 1) =====
let abortController = null;   // controls fetch cancel
let isStreaming = false;     // true while AI is responding
let stopRequested = false;   // user pressed stop


let auth;
let db;
// ===== Send / Stop button UI helpers (Step 2) =====
function setSendMode() {
    sendButton.innerHTML = '<i class="bi bi-send-fill"></i>';
}

function setStopMode() {
    sendButton.innerHTML = '<i class="bi bi-stop-fill"></i>';
}

async function initializeFirebaseAndAuth() {
    if (Object.keys(firebaseConfig).length === 0) {
        console.error("Firebase config is missing. Cannot initialize Firebase.");
        return;
    }

    const app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);

    try {
        if (initialAuthToken) {
            await signInWithCustomToken(auth, initialAuthToken);
        } else {
            await signInAnonymously(auth);
        }
        console.log("Firebase Authentication successful.");
    } catch (error) {
        console.error("Firebase Authentication failed:", error);
    }
}

// --- 2. LAYOUT MANAGEMENT ---
function centerInputBox() {
    centerContainer.classList.remove('bottom-fixed');
    actionPills.classList.remove('hidden');
    chatContent.classList.remove('active-chat');
    chatContent.innerHTML = '';
    isChatActive = false;

    // Move logo back to center container and ensure class is centered
    centerContainer.prepend(pegpoLogo);
    pegpoLogo.classList.add('centered-logo');
    pegpoLogo.classList.remove('top-left-logo');

    // Scroll to top
    const mainArea = document.querySelector('.main-area');
    if (mainArea) {
        mainArea.scrollTop = 0;
    }
}

function moveInputBoxToBottom() {
    if (!isChatActive) {
        centerContainer.classList.add('bottom-fixed');
        setTimeout(() => {
            actionPills.classList.add('hidden');
        }, 300);
        chatContent.classList.add('active-chat');
        isChatActive = true;

        // Move logo DOM element to fixed header container
        const headerLogoContainer = document.getElementById('headerLogoContainer');
        if (headerLogoContainer) {
            headerLogoContainer.appendChild(pegpoLogo);
        } else {
            // Fallback if header container missing
            mainContentArea.prepend(pegpoLogo);
        }

        pegpoLogo.classList.remove('centered-logo');
        pegpoLogo.classList.add('top-left-logo');

        // Auto-scroll to bottom after transition - REMOVED
        /*setTimeout(() => {
            const mainArea = document.querySelector('.main-area');
            if (mainArea) {
                mainArea.scrollTop = mainArea.scrollHeight;
            }
        }, 350);*/
    }
}

function toggleSidebar(shouldOpen) {
    if (shouldOpen === true) {
        appContainer.classList.add('sidebar-open');
    } else if (shouldOpen === false) {
        appContainer.classList.remove('sidebar-open');
    } else {
        appContainer.classList.toggle('sidebar-open');
    }
}

// --- 3. TYPING SIMULATION ---
function simulateTyping(element, text) {
    return new Promise(resolve => {
        const typingSpeed = 25;
        let i = 0;
        element.innerHTML = '';

        function typeChar() {
            if (i < text.length) {
                element.innerHTML += text.charAt(i);
                // Auto-scroll to bottom - REMOVED
                /*const mainArea = document.querySelector('.main-area');
                if (mainArea) {
                    mainArea.scrollTop = mainArea.scrollHeight;
                }*/
                i++;
                setTimeout(typeChar, typingSpeed);
            } else {
                resolve();
            }
        }
        typeChar();
    });
}

// ===== ChatGPT-style typing queue =====
let typingQueue = [];
let isTyping = false;

async function startTyping(element) {
    if (isTyping) return;
    isTyping = true;

    while (typingQueue.length > 0 && !stopRequested) {
        element.textContent += typingQueue.shift();

        // Auto-scroll to bottom - REMOVED
        /*const mainArea = document.querySelector('.main-area');
        if (mainArea) {
            mainArea.scrollTop = mainArea.scrollHeight;
        }*/

        await new Promise(r => setTimeout(r, 12)); // typing speed
    }

    isTyping = false;

    // ✅ Typing fully finished → restore SEND
    if (!stopRequested && typingQueue.length === 0) {
        isStreaming = false;
        setSendMode();
        sendButton.disabled = false;

    }

}


// --- 4. UI RENDERING ---
function createMessageElement(role, text, isTyping = false) {
    const wrapper = document.createElement('div');
    wrapper.className = `d-flex ${role === 'user' ? 'justify-content-end' : 'justify-content-start'}`;

    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${role}`;

    if (isTyping) {
        bubble.id = 'aiTypingIndicator';
        bubble.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div>';
    } else {
        bubble.innerText = text;
    }

    chatContent.appendChild(wrapper);
    wrapper.appendChild(bubble);

    // Auto-scroll to bottom - REMOVED AS REQUESTED
    // const mainArea = document.querySelector('.main-area');
    // if (mainArea) {
    //     mainArea.scrollTop = mainArea.scrollHeight;
    // }

    return bubble;
}

// --- 5. GEMINI API CALL (via Django backend) ---
async function fetchGeminiResponse(prompt) {
    isStreaming = true;
    setStopMode();
    isProcessing = true;
    sendButton.disabled = false;

    moveInputBoxToBottom();

    // Initialize response data with dummy content immediately
    currentResponseData = {
        query: prompt,
        answer: '',
        images: [],
        sources: ResponseHandler.generateDummySources(10), // Dummy sources
        relatedQuestions: ResponseHandler.generateDummyRelatedQuestions()
    };

    // Create a temporary container for the response
    const responseWrapper = document.createElement('div');
    responseWrapper.className = 'response-wrapper';
    chatContent.appendChild(responseWrapper);

    // Render the response layout immediately (Heading, Tabs, Sidebar)
    let responseHTML = responseHandler.createResponse(prompt, currentResponseData);
    responseWrapper.innerHTML = responseHTML;

    // Initialize event listeners for the response section
    const responseElement = responseWrapper.querySelector('.response-container');
    if (responseElement) {
        responseHandler.initializeEventListeners(responseElement);
    }

    try {
        const resp = await fetch("/api/chat/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: prompt }),
            signal: abortController.signal
        });

        if (!resp.ok) {
            throw new Error(`Server error ${resp.status}`);
        }

        // Get the answer text element for streaming
        const answerElement = responseWrapper.querySelector('.response-answer-text');
        if (!answerElement) {
            throw new Error('Response element not found');
        }

        answerElement.textContent = ''; // Start empty

        const reader = resp.body.getReader();
        const decoder = new TextDecoder("utf-8");

        let buffer = "";
        let fullAnswer = "";

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            const lines = buffer.split("\n");
            buffer = lines.pop(); // keep incomplete line

            for (const line of lines) {
                if (!line.startsWith("data:")) continue;

                const chunk = line.replace("data:", "").trim();

                if (chunk === "[DONE]") {
                    reader.cancel();
                    break;
                }

                // Add chunk to typing queue
                fullAnswer += chunk;
                typingQueue.push(...chunk);
                startTyping(answerElement);

                // Auto-scroll to bottom - REMOVED
                /*const mainArea = document.querySelector('.main-area');
                if (mainArea) {
                    mainArea.scrollTop = mainArea.scrollHeight;
                }*/
            }
        }

        // Store the full answer
        currentResponseData.answer = fullAnswer;

    } catch (err) {
        console.error("Streaming error:", err);

        // Show error in a simple bubble
        responseWrapper.innerHTML = '';
        const errorBubble = document.createElement('div');
        errorBubble.className = 'chat-bubble ai';
        errorBubble.textContent = "Sorry — couldn't get a response.";
        errorBubble.style.color = '#e74c3c';
        responseWrapper.appendChild(errorBubble);
    } finally {
        isProcessing = false;
    }
}


// --- 6. EVENT HANDLERS ---
async function handleUserInput() {
    // If currently streaming, treat click as STOP
    if (isStreaming) {
        stopRequested = true;

        typingQueue.length = 0;   // 🔥 clear queued text
        isTyping = false;         // 🔥 halt typing loop

        if (abortController) {
            abortController.abort();
        }

        setSendMode();
        isStreaming = false;
        sendButton.disabled = chatInput.value.trim() === '';

        return;
    }


    if (isProcessing) return;

    const prompt = chatInput.value.trim();
    if (prompt === "") return;

    chatInput.value = '';
    sendButton.disabled = false;

    // createMessageElement('user', prompt); // User bubble removed as per design request

    if (appContainer.classList.contains('sidebar-open')) {
        toggleSidebar(false);
    }

    stopRequested = false;
    abortController = new AbortController();
    isStreaming = true;
    setStopMode();

    await fetchGeminiResponse(prompt);

}

sendButton.addEventListener('click', handleUserInput);

chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleUserInput();
    }
});

chatInput.addEventListener('input', () => {
    // 🔒 NEVER disable button while streaming (STOP must stay clickable)
    if (isStreaming) return;

    sendButton.disabled = chatInput.value.trim() === '';
});



newChatBtn.addEventListener('click', () => {
    if (!isProcessing) {
        centerInputBox();
        toggleSidebar(false);
        console.log("New chat started.");
    }
});

menuToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleSidebar(true);
});

// REMOVED old document click listener to avoid duplicates. It's now handled below.

window.onload = () => {
    initializeFirebaseAndAuth();
    centerInputBox();
    setSendMode();
    console.log("Application loaded and initialized.");
};

// --- 7. NEW PROJECTS UI LOGIC (Modified to handle Explore Panel too) ---
const navProjects = document.getElementById('nav-projects');
const projectsPanel = document.getElementById('projects-sidebar-panel');
const closeProjectsPanelBtn = document.getElementById('closeProjectsPanel');
const addProjectBtnSidebar = document.getElementById('addProjectBtnSidebar');
const createProjectModalOverlay = document.getElementById('createProjectModalOverlay');
const createProjectConfirmBtn = document.getElementById('createProjectConfirmBtn');
const projectPillSelects = document.querySelectorAll('.project-pill-select');
const newProjectNameInput = document.getElementById('newProjectName');

// Explore Elements
const navExplore = document.getElementById('nav-explore');
const explorePanel = document.getElementById('explore-sidebar-panel');

function closeAllPanels() {
    if (projectsPanel) projectsPanel.classList.remove('active');
    if (explorePanel) explorePanel.classList.remove('active');
    document.querySelectorAll('.nav-link-item').forEach(el => el.classList.remove('active'));
}

if (navProjects && projectsPanel) {
    navProjects.addEventListener('click', (e) => {
        e.preventDefault();

        const wasActive = projectsPanel.classList.contains('active');
        closeAllPanels();

        if (!wasActive) {
            projectsPanel.classList.add('active');
            navProjects.classList.add('active');
        }
    });

    closeProjectsPanelBtn.addEventListener('click', () => {
        projectsPanel.classList.remove('active');
        navProjects.classList.remove('active');
    });
}

if (navExplore && explorePanel) {
    navExplore.addEventListener('click', (e) => {
        e.preventDefault();

        const wasActive = explorePanel.classList.contains('active');
        closeAllPanels();

        if (!wasActive) {
            explorePanel.classList.add('active');
            navExplore.classList.add('active');
        }
    });
}

// Close panels if clicking outside logic
// Close panels if clicking outside logic (Includes Main Sidebar for Mobile)
document.addEventListener('click', (e) => {
    const sidebar = document.getElementById('sidebar');
    const menuBtn = document.getElementById('menuToggle');

    // --- 1. Handle Main Sidebar (Mobile) ---
    if (window.innerWidth < 992 && appContainer.classList.contains('sidebar-open')) {
        const isClickInsideSidebar = sidebar.contains(e.target);
        const isClickOnToggle = menuBtn && menuBtn.contains(e.target);

        if (!isClickInsideSidebar && !isClickOnToggle) {
            toggleSidebar(false);
        }
    }

    // --- 2. Handle Projects / Explore Panels ---
    const isInsideSidebar = sidebar.contains(e.target);
    const isInsideProjects = projectsPanel && projectsPanel.contains(e.target);
    const isInsideExplore = explorePanel && explorePanel.contains(e.target);
    const isModal = createProjectModalOverlay && createProjectModalOverlay.contains(e.target) && createProjectModalOverlay.classList.contains('active');

    // If modal is active, don't close panels (modal overlay handles its own close)
    if (isModal) return;

    if (!isInsideSidebar && !isInsideProjects && !isInsideExplore) {
        if (projectsPanel && projectsPanel.classList.contains('active')) {
            closeAllPanels();
        }
        if (explorePanel && explorePanel.classList.contains('active')) {
            closeAllPanels();
        }
    }
});

function closeCreateProjectModal() {
    createProjectModalOverlay.classList.remove('active');
    setTimeout(() => {
        createProjectModalOverlay.classList.add('hidden');
    }, 300);
}

if (addProjectBtnSidebar && createProjectModalOverlay) {
    // Show Create Project Modal
    addProjectBtnSidebar.addEventListener('click', () => {
        createProjectModalOverlay.classList.remove('hidden');
        // slight delay to allow display:block to apply before opacity transition
        setTimeout(() => {
            createProjectModalOverlay.classList.add('active');
        }, 10);
        if (newProjectNameInput) newProjectNameInput.focus();
    });

    // Close Modal on Overlay Click
    createProjectModalOverlay.addEventListener('click', (e) => {
        if (e.target === createProjectModalOverlay) {
            closeCreateProjectModal();
        }
    });

    // Handle Pill Selection
    projectPillSelects.forEach(pill => {
        pill.addEventListener('click', () => {
            projectPillSelects.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
        });
    });

    // Confirm Create Project
    if (createProjectConfirmBtn) {
        createProjectConfirmBtn.addEventListener('click', () => {
            const name = newProjectNameInput.value.trim();
            if (!name) return; // Validation

            const activePill = document.querySelector('.project-pill-select.active');
            const color = activePill ? activePill.getAttribute('data-color') : 'green';
            const iconEl = activePill ? activePill.querySelector('i') : null;
            const iconClass = iconEl ? iconEl.className : 'bi bi-folder';

            // Create new project item in sidebar (Dummy implementation)
            const newItem = document.createElement('div');
            newItem.className = 'project-item d-flex align-items-center p-2 rounded mb-2';
            newItem.style.cursor = 'pointer';

            newItem.innerHTML = `
                <div class="project-icon-circle ${color} me-3">
                    <i class="${iconClass}"></i>
                </div>
                <span class="text-white small">${name}</span>
            `;

            // Insert before the LAST div (which is the button container)
            const lastChild = projectsPanel.lastElementChild;
            projectsPanel.insertBefore(newItem, lastChild);

            // Clear input and close
            newProjectNameInput.value = '';
            closeCreateProjectModal();
        });
    }
}

// --- 8. RESPONSE SECTION EVENT LISTENERS ---
// Handle related question clicks
window.addEventListener('new-query', (event) => {
    const query = event.detail.query;
    if (query) {
        chatInput.value = query;
        handleUserInput();
    }
});

// Handle rewrite requests
window.addEventListener('rewrite-query', (event) => {
    const query = event.detail.query;
    if (query) {
        chatInput.value = `Please rewrite your previous response about: ${query}`;
        handleUserInput();
    }
});


/**
 * INTEGRATION EXAMPLE FOR chat_app.js
 * 
 * This file shows how to integrate the ResponseHandler into your existing chat application.
 * Copy the relevant parts into your actual chat_app.js file.
 */

// ============================================================================
// STEP 1: Initialize ResponseHandler at the top of your file
// ============================================================================

const responseHandler = new ResponseHandler();

// ============================================================================
// STEP 2: Modify your message sending function
// ============================================================================

async function sendMessage() {
    const chatInput = document.getElementById('chatInput');
    const userMessage = chatInput.value.trim();

    if (!userMessage) return;

    // Clear input
    chatInput.value = '';

    // Add user message to chat (your existing code)
    addUserMessage(userMessage);

    // Show typing indicator (your existing code)
    showTypingIndicator();

    try {
        // Send to backend
        const response = await fetch('/chat/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ message: userMessage })
        });

        // Collect streamed response
        let fullAnswer = '';
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data === '[DONE]') break;
                    if (data.startsWith('[ERROR]')) {
                        console.error('API Error:', data);
                        continue;
                    }
                    fullAnswer += data;
                }
            }
        }

        // Hide typing indicator
        hideTypingIndicator();

        // Create response using ResponseHandler
        const responseData = {
            answer: fullAnswer,
            images: [], // Add images if available from your API
            sources: ResponseHandler.generateDummySources(10), // Use dummy sources
            relatedQuestions: ResponseHandler.generateDummyRelatedQuestions()
        };

        const responseHTML = responseHandler.createResponse(userMessage, responseData);

        // Add to chat content
        const chatContent = document.getElementById('chat-content');
        const responseWrapper = document.createElement('div');
        responseWrapper.innerHTML = responseHTML;
        chatContent.appendChild(responseWrapper);

        // Initialize event listeners
        const responseElement = responseWrapper.querySelector('.response-container');
        responseHandler.initializeEventListeners(responseElement);

        // Scroll to bottom
        scrollToBottom();

    } catch (error) {
        console.error('Error sending message:', error);
        hideTypingIndicator();
        addErrorMessage('Failed to get response. Please try again.');
    }
}

// ============================================================================
// STEP 3: Add helper functions (if not already present)
// ============================================================================

function addUserMessage(message) {
    const chatContent = document.getElementById('chat-content');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-bubble user';
    messageDiv.textContent = message;
    chatContent.appendChild(messageDiv);
}

function showTypingIndicator() {
    const chatContent = document.getElementById('chat-content');
    const typingDiv = document.createElement('div');
    typingDiv.className = 'chat-bubble ai typing-indicator';
    typingDiv.id = 'typing-indicator';
    typingDiv.innerHTML = '<span></span><span></span><span></span>';
    chatContent.appendChild(typingDiv);
    scrollToBottom();
}

function hideTypingIndicator() {
    const typingIndicator = document.getElementById('typing-indicator');
    if (typingIndicator) {
        typingIndicator.remove();
    }
}

function addErrorMessage(message) {
    const chatContent = document.getElementById('chat-content');
    const errorDiv = document.createElement('div');
    errorDiv.className = 'chat-bubble ai';
    errorDiv.style.color = '#e74c3c';
    errorDiv.textContent = message;
    chatContent.appendChild(errorDiv);
}

function scrollToBottom() {
    const chatContent = document.getElementById('chat-content');
    chatContent.scrollTop = chatContent.scrollHeight;
}

// ============================================================================
// STEP 4: Listen for custom events from ResponseHandler
// ============================================================================

// Handle related question clicks
window.addEventListener('new-query', (event) => {
    const query = event.detail.query;
    const chatInput = document.getElementById('chatInput');
    chatInput.value = query;
    sendMessage();
});

// Handle rewrite requests
window.addEventListener('rewrite-query', (event) => {
    const query = event.detail.query;
    const chatInput = document.getElementById('chatInput');
    chatInput.value = `Please rewrite your previous response about: ${query}`;
    sendMessage();
});

// ============================================================================
// STEP 5: Update your existing event listeners
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    const sendButton = document.getElementById('sendButton');
    const chatInput = document.getElementById('chatInput');

    // Send button click
    sendButton.addEventListener('click', sendMessage);

    // Enter key press
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Enable/disable send button based on input
    chatInput.addEventListener('input', () => {
        sendButton.disabled = !chatInput.value.trim();
    });
});

// ============================================================================
// OPTIONAL: Add image support
// ============================================================================

/**
 * If your Gemini API returns images, you can extract them like this:
 */
function extractImagesFromResponse(geminiResponse) {
    // This is a placeholder - adjust based on your actual API response
    const images = [];

    // Example: If Gemini returns image URLs in the response
    if (geminiResponse.images && Array.isArray(geminiResponse.images)) {
        geminiResponse.images.forEach(img => {
            images.push({
                url: img.url || img,
                alt: img.alt || 'Generated image'
            });
        });
    }

    return images;
}

// ============================================================================
// OPTIONAL: Add real sources support
// ============================================================================

/**
 * If you want to fetch real sources instead of dummy data
 */
async function fetchSourcesForQuery(query) {
    // This is a placeholder - implement based on your needs
    try {
        const response = await fetch(`/api/sources?q=${encodeURIComponent(query)}`);
        const data = await response.json();

        return data.sources.map(source => ({
            name: source.name,
            url: source.url,
            favicon: source.favicon || source.name.charAt(0).toUpperCase(),
            title: source.title,
            description: source.description
        }));
    } catch (error) {
        console.error('Error fetching sources:', error);
        return ResponseHandler.generateDummySources(5);
    }
}

// ============================================================================
// USAGE EXAMPLE WITH REAL SOURCES
// ============================================================================

async function sendMessageWithRealSources() {
    const chatInput = document.getElementById('chatInput');
    const userMessage = chatInput.value.trim();

    if (!userMessage) return;

    chatInput.value = '';
    addUserMessage(userMessage);
    showTypingIndicator();

    try {
        // Fetch answer and sources in parallel
        const [answerResponse, sources] = await Promise.all([
            fetch('/chat/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: userMessage })
            }),
            fetchSourcesForQuery(userMessage)
        ]);

        // Process answer (same as before)
        let fullAnswer = '';
        const reader = answerResponse.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data === '[DONE]') break;
                    fullAnswer += data;
                }
            }
        }

        hideTypingIndicator();

        // Create response with real sources
        const responseData = {
            answer: fullAnswer,
            images: [],
            sources: sources, // Use real sources
            relatedQuestions: ResponseHandler.generateDummyRelatedQuestions()
        };

        const responseHTML = responseHandler.createResponse(userMessage, responseData);

        const chatContent = document.getElementById('chat-content');
        const responseWrapper = document.createElement('div');
        responseWrapper.innerHTML = responseHTML;
        chatContent.appendChild(responseWrapper);

        const responseElement = responseWrapper.querySelector('.response-container');
        responseHandler.initializeEventListeners(responseElement);

        scrollToBottom();

    } catch (error) {
        console.error('Error:', error);
        hideTypingIndicator();
        addErrorMessage('Failed to get response. Please try again.');
    }
}

// ============================================================================
// NOTES
// ============================================================================

/**
 * 1. Make sure response.css and response.js are loaded before chat_app.js
 * 2. The ResponseHandler class is available globally
 * 3. Dummy data is used for sources by default
 * 4. Related questions use dummy data - customize as needed
 * 5. Images array is empty by default - add if your API supports it
 * 6. All event listeners are automatically set up by initializeEventListeners()
 * 7. The response section is fully responsive out of the box
 */

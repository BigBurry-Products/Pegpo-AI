/**
 * Response Section Handler
 * Manages the display and interaction of AI responses with tabs, gallery, and sources
 */

class ResponseHandler {
    constructor() {
        this.currentTab = 'answer';
        this.sourcesCollapsed = false;
    }

    /**
     * Create and display a response
     * @param {string} query - The user's query
     * @param {Object} data - Response data containing answer, images, videos, sources
     */
    createResponse(query, data) {
        const responseHTML = this.generateResponseHTML(query, data);
        return responseHTML;
    }

    /**
     * Generate the complete HTML for a response
     */
    generateResponseHTML(query, data) {
        const {
            answer = '',
            images = [],
            videos = [],
            sources = [],
            relatedQuestions = []
        } = data;

        return `
            <div class="response-container">
                <!-- Main Response Area -->
                <div class="response-main">
                    <!-- Response Header -->
                    <div class="response-header d-flex justify-content-between align-items-start gap-3">
                        <h1 class="response-query-text mb-0">${this.escapeHtml(query)}</h1>
                        
                        <!-- Mobile Sources Toggle (Icon Button) -->
                        <button class="mobile-sources-toggle icon-btn">
                            <i class="bi bi-layout-text-sidebar-reverse"></i>
                        </button>
                    </div>

                    <!-- Tab Navigation -->
                    <div class="response-tabs">
                        <button class="response-tab active" data-tab="answer">
                            <i class="bi bi-chat-left-text"></i>
                            Answer
                        </button>
                        <button class="response-tab" data-tab="image">
                            <i class="bi bi-image"></i>
                            Image
                        </button>
                        <button class="response-tab" data-tab="video">
                            <i class="bi bi-play-circle"></i>
                            Video
                        </button>
                    </div>

                    <!-- Answer Tab Content -->
                    <div class="response-tab-content active" data-content="answer">
                        <!-- Image gallery removed as per user request -->
                        
                        <div class="response-answer-text">
                            ${this.formatAnswerText(answer)}
                        </div>

                        <!-- Action Buttons -->
                        <div class="response-actions">
                            <button class="response-action-btn" data-action="share">
                                <i class="bi bi-share"></i>
                                Share
                            </button>
                            <button class="response-action-btn" data-action="rewrite">
                                <i class="bi bi-arrow-clockwise"></i>
                                Rewrite
                            </button>
                        </div>

                        <!-- Related Questions -->
                        ${relatedQuestions.length > 0 ? this.generateRelatedSection(relatedQuestions) : ''}
                    </div>

                    <!-- Image Tab Content -->
                    <div class="response-tab-content" data-content="image">
                        <div class="response-answer-text">
                            Image search results will be displayed here.
                        </div>
                    </div>

                    <!-- Video Tab Content -->
                    <div class="response-tab-content" data-content="video">
                        <div class="response-answer-text">
                            Video search results will be displayed here.
                        </div>
                    </div>
                </div>

                <!-- Sources Sidebar -->
                ${sources.length > 0 ? this.generateSourcesSidebar(sources) : ''}
            </div>
        `;
    }

    /**
     * Generate image gallery HTML
     */
    generateImageGallery(images) {
        const galleryItems = images.map(img => `
            <div class="response-gallery-item">
                <img src="${img.url}" alt="${this.escapeHtml(img.alt || 'Image')}" loading="lazy">
            </div>
        `).join('');

        return `
            <div class="response-image-gallery">
                ${galleryItems}
            </div>
        `;
    }

    /**
     * Format answer text with proper line breaks
     */
    formatAnswerText(text) {
        return this.escapeHtml(text).replace(/\n/g, '<br>');
    }

    /**
     * Generate related questions section
     */
    generateRelatedSection(questions) {
        const questionItems = questions.map(q => `
            <div class="response-related-item" data-question="${this.escapeHtml(q)}">
                <span class="response-related-item-text">${this.escapeHtml(q)}</span>
                <div class="response-related-item-icon">
                    <i class="bi bi-plus-lg"></i>
                </div>
            </div>
        `).join('');

        return `
            <div class="response-related">
                <h3 class="response-related-title">Related</h3>
                <div class="response-related-list">
                    ${questionItems}
                </div>
            </div>
        `;
    }

    /**
     * Generate sources sidebar
     */
    generateSourcesSidebar(sources) {
        const sourceCards = sources.map(source => `
            <div class="response-source-card" data-url="${this.escapeHtml(source.url)}">
                <div class="response-source-header">
                    <div class="response-source-favicon">${source.favicon || 'R'}</div>
                    <div class="response-source-name">${this.escapeHtml(source.name)}</div>
                </div>
                <div class="response-source-title">${this.escapeHtml(source.title)}</div>
                <div class="response-source-description">${this.escapeHtml(source.description)}</div>
            </div>
        `).join('');

        return `
            <aside class="response-sources-sidebar">
                <div class="response-sources-header">
                    <div class="d-flex align-items-center gap-2">
                        <div class="response-sources-icon">
                            <i class="bi bi-link-45deg"></i>
                        </div>
                        <h3 class="response-sources-title mb-0">Sources</h3>
                        <span class="response-sources-count">${sources.length}</span>
                    </div>
                    <!-- Mobile Close Button -->
                    <button class="mobile-sources-close">
                        <i class="bi bi-x-lg"></i>
                    </button>
                </div>
                <div class="response-sources-list">
                    ${sourceCards}
                </div>
            </aside>
        `;
    }

    /**
     * Initialize event listeners for a response element
     */
    initializeEventListeners(responseElement) {
        // Tab switching
        const tabs = responseElement.querySelectorAll('.response-tab');
        const tabContents = responseElement.querySelectorAll('.response-tab-content');

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.dataset.tab;

                // Update active tab
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                // Update active content
                tabContents.forEach(content => {
                    if (content.dataset.content === tabName) {
                        content.classList.add('active');
                    } else {
                        content.classList.remove('active');
                    }
                });
            });
        });

        // Action buttons
        const actionButtons = responseElement.querySelectorAll('.response-action-btn');
        actionButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.action;
                this.handleAction(action, responseElement);
            });
        });

        // Related questions
        const relatedItems = responseElement.querySelectorAll('.response-related-item');
        relatedItems.forEach(item => {
            item.addEventListener('click', () => {
                const question = item.dataset.question;
                this.handleRelatedQuestion(question);
            });
        });

        // Source cards
        const sourceCards = responseElement.querySelectorAll('.response-source-card');
        sourceCards.forEach(card => {
            card.addEventListener('click', () => {
                const url = card.dataset.url;
                if (url) {
                    window.open(url, '_blank');
                }
            });
        });

        // Image gallery items
        const galleryItems = responseElement.querySelectorAll('.response-gallery-item');
        galleryItems.forEach(item => {
            item.addEventListener('click', () => {
                const img = item.querySelector('img');
                if (img) {
                    this.openImageModal(img.src, img.alt);
                }
            });
        });

        // Mobile Sources Toggle
        const mobileSourcesToggle = responseElement.querySelector('.mobile-sources-toggle');
        const sourcesSidebar = responseElement.querySelector('.response-sources-sidebar');
        const mobileSourcesClose = responseElement.querySelector('.mobile-sources-close');

        if (mobileSourcesToggle && sourcesSidebar) {
            mobileSourcesToggle.addEventListener('click', () => {
                sourcesSidebar.classList.add('active');
                // Create overlay
                const overlay = document.createElement('div');
                overlay.className = 'mobile-sources-overlay';
                document.body.appendChild(overlay);

                // Overlay click to close
                overlay.addEventListener('click', () => {
                    sourcesSidebar.classList.remove('active');
                    overlay.remove();
                });

                // Handle Close Button
                if (mobileSourcesClose) {
                    mobileSourcesClose.addEventListener('click', () => {
                        sourcesSidebar.classList.remove('active');
                        overlay.remove();
                    });
                }
            });
        }
    }

    /**
     * Handle action button clicks
     */
    handleAction(action, responseElement) {
        switch (action) {
            case 'share':
                this.shareResponse(responseElement);
                break;
            case 'rewrite':
                this.rewriteResponse(responseElement);
                break;
        }
    }

    /**
     * Share response
     */
    shareResponse(responseElement) {
        const queryText = responseElement.querySelector('.response-query-text')?.textContent;
        const answerText = responseElement.querySelector('.response-answer-text')?.textContent;

        if (navigator.share) {
            navigator.share({
                title: queryText,
                text: answerText
            }).catch(err => console.log('Share cancelled'));
        } else {
            // Fallback: copy to clipboard
            const textToCopy = `${queryText}\n\n${answerText}`;
            navigator.clipboard.writeText(textToCopy).then(() => {
                alert('Response copied to clipboard!');
            });
        }
    }

    /**
     * Rewrite response
     */
    rewriteResponse(responseElement) {
        const queryText = responseElement.querySelector('.response-query-text')?.textContent;
        if (queryText) {
            // Trigger a new query with rewrite instruction
            console.log('Rewriting response for:', queryText);
            // You can dispatch a custom event or call your chat handler
            window.dispatchEvent(new CustomEvent('rewrite-query', { detail: { query: queryText } }));
        }
    }

    /**
     * Handle related question click
     */
    handleRelatedQuestion(question) {
        console.log('Related question clicked:', question);
        // Dispatch event to send new query
        window.dispatchEvent(new CustomEvent('new-query', { detail: { query: question } }));
    }

    /**
     * Open image in modal (placeholder)
     */
    openImageModal(src, alt) {
        console.log('Open image modal:', src, alt);
        // Implement image modal/lightbox if needed
    }

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Generate dummy sources data for testing
     */
    static generateDummySources(count = 20) {
        const sources = [];
        const sourceTemplates = [
            {
                name: 'Reuters',
                domain: 'reuters.com',
                favicon: 'R'
            },
            {
                name: 'NASA',
                domain: 'nasa.gov',
                favicon: 'N'
            },
            {
                name: 'BBC News',
                domain: 'bbc.com',
                favicon: 'B'
            },
            {
                name: 'The Guardian',
                domain: 'theguardian.com',
                favicon: 'G'
            },
            {
                name: 'CNN',
                domain: 'cnn.com',
                favicon: 'C'
            }
        ];

        for (let i = 0; i < count; i++) {
            const template = sourceTemplates[i % sourceTemplates.length];
            sources.push({
                name: template.name,
                url: `https://${template.domain}/business/aerospace/...`,
                favicon: template.favicon,
                title: "NASA's X-59 supersonic jet completed its maiden flight on...",
                description: "NASA's X-59 supersonic-but-quiet jet airplane soared over the Southern California desert on Tuesday in the first test flight of an experimental aircraft designed to break the sound barrier without the noise."
            });
        }

        return sources;
    }

    /**
     * Generate dummy related questions
     */
    static generateDummyRelatedQuestions() {
        return [
            "List the top mountain for each common height definition",
            "Which mountain is highest above sea level",
            "Which mountain is tallest from earths center",
            "List the top mountain for each common height definition"
        ];
    }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ResponseHandler;
}

/**
 * Konverza AI Chatbot Widget
 * Embeddable chat widget with streaming responses
 *
 * Usage:
 * <script src="konverza-widget.js"></script>
 * <script>KonverzaWidget.init({apiKey: 'bh_pk_...', apiUrl: 'https://dev.konverza.co.uk'});</script>
 */
(function() {
    'use strict';

    // Session Manager Class
    class SessionManager {
        constructor(apiKey) {
            this.apiKey = apiKey;
            this.storageKey = `${this.hashApiKey(apiKey)}`;
            this.SESSION_TTL = 30 * 60 * 1000; // 30 minutes
        }

        hashApiKey(apiKey) {
            return btoa(apiKey.substring(0, 20)).replace(/[^a-zA-Z0-9]/g, '').substring(0, 10);
        }

        getOrCreateSession() {
            const stored = this.getStoredSession();

            if (stored && !this.isExpired(stored)) {
                stored.lastActivity = Date.now();
                this.saveSession(stored);
                console.log('Konverza: Restored session', stored.sessionId);
                return stored.sessionId;
            }

            const newSession = {
                sessionId: this.generateSessionId(),
                createdAt: Date.now(),
                lastActivity: Date.now()
            };

            this.saveSession(newSession);
            console.log('Konverza: New session', newSession.sessionId);
            return newSession.sessionId;
        }

        generateSessionId() {
            if (crypto && crypto.randomUUID) {
                return 'session_' + crypto.randomUUID();
            }
            return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        }

        getStoredSession() {
            try {
                const data = localStorage.getItem(this.storageKey);
                return data ? JSON.parse(data) : null;
            } catch (e) {
                return null;
            }
        }

        saveSession(session) {
            try {
                localStorage.setItem(this.storageKey, JSON.stringify(session));
            } catch (e) {
                console.error('Konverza: Failed to save session', e);
            }
        }

        isExpired(session) {
            return (Date.now() - session.lastActivity) > this.SESSION_TTL;
        }

        updateActivity() {
            const session = this.getStoredSession();
            if (session) {
                session.lastActivity = Date.now();
                this.saveSession(session);
            }
        }
    }

    // Widget Class
    class KonverzaWidget {
        constructor(config) {
            this.apiKey = config.apiKey;
            this.apiUrl = config.apiUrl;
            this.inline = config.inline || null; // Selector for inline mode
            this.sessionManager = new SessionManager(this.apiKey);
            this.sessionId = this.sessionManager.getOrCreateSession();
            this.isOpen = false;

            this.injectStyles();
            this.createWidget();
            this.attachEventListeners();
        }

        injectStyles() {
            const styles = `
                .konverza-inline-container {
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                    width: 100%;
                }
                #konverza-chat-button {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    width: 60px;
                    height: 60px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
                    border: none;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                    z-index: 9998;
                    transition: transform 0.2s;
                    color: white;
                    font-size: 28px;
                }
                #konverza-chat-button:hover {
                    transform: scale(1.1);
                }
                #konverza-chat-window {
                    position: fixed;
                    bottom: 90px;
                    right: 20px;
                    width: 380px;
                    height: 550px;
                    background: white;
                    border-radius: 16px;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
                    z-index: 9999;
                    display: none;
                    flex-direction: column;
                    overflow: hidden;
                }
                #konverza-chat-window.open {
                    display: flex;
                }
                #konverza-chat-header {
                    background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
                    color: white;
                    padding: 16px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                }
                #konverza-chat-header-title {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                #konverza-chat-header h3 {
                    margin: 0;
                    font-size: 16px;
                    font-weight: 600;
                }
                #konverza-chat-header p {
                    margin: 0;
                    font-size: 12px;
                    opacity: 0.9;
                }
                #konverza-close-btn {
                    background: transparent;
                    border: none;
                    color: white;
                    font-size: 24px;
                    cursor: pointer;
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                #konverza-close-btn:hover {
                    background: rgba(255, 255, 255, 0.2);
                }
                #konverza-chat-messages {
                    flex: 1;
                    padding: 16px;
                    overflow-y: auto;
                    background: #f8fafc;
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }
                .konverza-message {
                    display: flex;
                    gap: 8px;
                }
                .konverza-message.user {
                    justify-content: flex-end;
                }
                .konverza-message-bubble {
                    max-width: 75%;
                    padding: 12px;
                    border-radius: 16px;
                    font-size: 14px;
                    line-height: 1.4;
                }
                .konverza-message.user .konverza-message-bubble {
                    background: #3b82f6;
                    color: white;
                    border-bottom-right-radius: 4px;
                }
                .konverza-message.bot .konverza-message-bubble {
                    background: #e2e8f0;
                    color: #1e293b;
                    border-bottom-left-radius: 4px;
                }
                #konverza-typing-indicator {
                    background: #e2e8f0;
                    color: #64748b;
                    padding: 12px;
                    border-radius: 16px;
                    border-bottom-left-radius: 4px;
                    font-size: 14px;
                    font-style: italic;
                    max-width: 75%;
                }
                #konverza-chat-input-container {
                    padding: 16px;
                    background: white;
                    border-top: 1px solid #e2e8f0;
                    display: flex;
                    gap: 8px;
                }
                #konverza-chat-input {
                    flex: 1;
                    padding: 10px 14px;
                    border: 1px solid #cbd5e1;
                    border-radius: 24px;
                    font-size: 14px;
                    outline: none;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                }
                #konverza-chat-input:focus {
                    border-color: #3b82f6;
                }
                #konverza-send-btn {
                    background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
                    color: white;
                    border: none;
                    border-radius: 50%;
                    width: 40px;
                    height: 40px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 18px;
                    transition: opacity 0.2s;
                }
                #konverza-send-btn:hover {
                    opacity: 0.9;
                }
                #konverza-send-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
                @media (max-width: 480px) {
                    #konverza-chat-window {
                        bottom: 0;
                        right: 0;
                        left: 0;
                        width: 100%;
                        height: 100%;
                        border-radius: 0;
                    }
                }
            `;

            const styleEl = document.createElement('style');
            styleEl.textContent = styles;
            document.head.appendChild(styleEl);
        }

        createWidget() {
            if (this.inline) {
                // Inline mode: render into existing container
                const container = document.querySelector(this.inline);
                if (!container) {
                    console.error('Konverza: Inline container not found:', this.inline);
                    return;
                }

                container.classList.add('konverza-inline-container');
                container.innerHTML = `
                    <div id="konverza-chat-header">
                        <div id="konverza-chat-header-title">
                            <div style="font-size: 24px;">🤖</div>
                            <div>
                                <h3>AI Assistant</h3>
                                <p>Online</p>
                            </div>
                        </div>
                    </div>
                    <div id="konverza-chat-messages" style="flex: 1; overflow-y: auto; padding: 16px; background: #f8fafc; display: flex; flex-direction: column; gap: 12px;">
                        <div class="konverza-message bot">
                            <div class="konverza-message-bubble">
                                Hi! 👋 How can I help you today?
                            </div>
                        </div>
                    </div>
                    <div id="konverza-chat-input-container" style="padding: 16px; background: white; border-top: 1px solid #e2e8f0; display: flex; gap: 8px;">
                        <input type="text" id="konverza-chat-input" placeholder="Type your message..." />
                        <button id="konverza-send-btn" aria-label="Send message">→</button>
                    </div>
                `;

                this.button = null;
                this.chatWindow = container;
                this.messages = container.querySelector('#konverza-chat-messages');
                this.input = container.querySelector('#konverza-chat-input');
                this.sendBtn = container.querySelector('#konverza-send-btn');
                this.closeBtn = null;
                this.isOpen = true; // Always open in inline mode
            } else {
                // Floating mode: create button and popup
                const button = document.createElement('button');
                button.id = 'konverza-chat-button';
                button.innerHTML = '💬';
                button.setAttribute('aria-label', 'Open chat');

                const chatWindow = document.createElement('div');
                chatWindow.id = 'konverza-chat-window';
                chatWindow.innerHTML = `
                    <div id="konverza-chat-header">
                        <div id="konverza-chat-header-title">
                            <div style="font-size: 24px;">🤖</div>
                            <div>
                                <h3>AI Assistant</h3>
                                <p>Online</p>
                            </div>
                        </div>
                        <button id="konverza-close-btn" aria-label="Close chat">×</button>
                    </div>
                    <div id="konverza-chat-messages">
                        <div class="konverza-message bot">
                            <div class="konverza-message-bubble">
                                Hi! 👋 How can I help you today?
                            </div>
                        </div>
                    </div>
                    <div id="konverza-chat-input-container">
                        <input type="text" id="konverza-chat-input" placeholder="Type your message..." />
                        <button id="konverza-send-btn" aria-label="Send message">→</button>
                    </div>
                `;

                document.body.appendChild(button);
                document.body.appendChild(chatWindow);

                this.button = button;
                this.chatWindow = chatWindow;
                this.messages = chatWindow.querySelector('#konverza-chat-messages');
                this.input = chatWindow.querySelector('#konverza-chat-input');
                this.sendBtn = chatWindow.querySelector('#konverza-send-btn');
                this.closeBtn = chatWindow.querySelector('#konverza-close-btn');
            }
        }

        attachEventListeners() {
            if (this.button) {
                this.button.addEventListener('click', () => this.toggleChat());
            }
            if (this.closeBtn) {
                this.closeBtn.addEventListener('click', () => this.toggleChat());
            }
            this.sendBtn.addEventListener('click', () => this.sendMessage());
            this.input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.sendMessage();
            });
        }

        toggleChat() {
            this.isOpen = !this.isOpen;
            if (this.isOpen) {
                this.chatWindow.classList.add('open');
                this.input.focus();
            } else {
                this.chatWindow.classList.remove('open');
            }
        }

        addMessage(text, type = 'bot') {
            const msgDiv = document.createElement('div');
            msgDiv.className = `konverza-message ${type}`;
            msgDiv.innerHTML = `<div class="konverza-message-bubble">${text}</div>`;
            this.messages.appendChild(msgDiv);
            this.messages.scrollTop = this.messages.scrollHeight;
            return msgDiv.querySelector('.konverza-message-bubble');
        }

        showTyping() {
            const typing = document.createElement('div');
            typing.id = 'konverza-typing-indicator';
            typing.textContent = 'Typing...';
            this.messages.appendChild(typing);
            this.messages.scrollTop = this.messages.scrollHeight;
        }

        hideTyping() {
            const typing = this.messages.querySelector('#konverza-typing-indicator');
            if (typing) typing.remove();
        }

        async sendMessage() {
            const message = this.input.value.trim();
            if (!message) return;

            this.input.value = '';
            this.sendBtn.disabled = true;

            this.addMessage(message, 'user');
            this.showTyping();
            this.sessionManager.updateActivity();

            try {
                const response = await fetch(`${this.apiUrl}/api/v1/chat/stream`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.apiKey}`
                    },
                    body: JSON.stringify({
                        session_id: this.sessionId,
                        message: message
                    })
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                this.hideTyping();
                const botBubble = this.addMessage('', 'bot');

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let botResponse = '';
                let currentEvent = '';

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value);
                    const lines = chunk.split('\n');

                    for (const line of lines) {
                        if (line.startsWith('event: ')) {
                            currentEvent = line.slice(7).trim();
                        } else if (line.startsWith('data: ') && currentEvent === 'token') {
                            const data = line.slice(6).trim();
                            if (data && !data.startsWith('{')) {
                                botResponse += data;
                                botBubble.textContent = botResponse;
                                this.messages.scrollTop = this.messages.scrollHeight;
                            }
                        }
                    }
                }

                if (!botResponse) {
                    botBubble.textContent = 'Sorry, I had trouble processing that.';
                }

            } catch (error) {
                this.hideTyping();
                this.addMessage('Sorry, something went wrong. Please try again.', 'bot');
                console.error('Konverza error:', error);
            } finally {
                this.sendBtn.disabled = false;
            }
        }

        resetChat(greeting = 'Hi! 👋 How can I help you today?') {
            // Generate new session
            this.sessionId = this.sessionManager.generateSessionId();
            console.log('Konverza: New session', this.sessionId);

            // Clear messages
            this.messages.innerHTML = `
                <div class="konverza-message bot">
                    <div class="konverza-message-bubble">${greeting}</div>
                </div>
            `;
        }
    }

    // Global API
    let widgetInstance = null;

    window.KonverzaWidget = {
        init: function(config) {
            if (!config.apiKey || !config.apiUrl) {
                console.error('Konverza: apiKey and apiUrl are required');
                return;
            }

            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => {
                    widgetInstance = new KonverzaWidget(config);
                });
            } else {
                widgetInstance = new KonverzaWidget(config);
            }
        },
        reset: function(greeting) {
            if (widgetInstance) {
                widgetInstance.resetChat(greeting);
            }
        }
    };

})();

/**
 * Bellhop AI Chatbot Widget - Simple Integration
 * Just include this script and call BellhopWidget.init() with your API key.
 */
(function() {
    'use strict';

    // Session Manager Class
    class BellhopSessionManager {
        constructor(apiKey) {
            this.apiKey = apiKey;
            this.storageKey = `bellhop_session_${this.hashApiKey(apiKey)}`;
            this.SESSION_TTL = 30 * 60 * 1000; // 30 minutes in milliseconds
        }

        hashApiKey(apiKey) {
            // Create a hash of API key for storage key (don't store raw API key)
            return btoa(apiKey.substring(0, 20)).replace(/[^a-zA-Z0-9]/g, '').substring(0, 10);
        }

        getOrCreateSession() {
            const stored = this.getStoredSession();

            if (stored && !this.isExpired(stored)) {
                // Update last activity
                stored.lastActivity = Date.now();
                this.saveSession(stored);
                return stored.sessionId;
            }

            // Create new session
            const newSession = {
                sessionId: this.generateSessionId(),
                createdAt: Date.now(),
                lastActivity: Date.now()
            };

            this.saveSession(newSession);
            return newSession.sessionId;
        }

        generateSessionId() {
            // Use crypto API for secure random session ID
            if (crypto && crypto.randomUUID) {
                return 'session_' + crypto.randomUUID();
            }
            // Fallback for older browsers
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
                // Silent fail if localStorage unavailable
            }
        }

        isExpired(session) {
            const now = Date.now();
            return (now - session.lastActivity) > this.SESSION_TTL;
        }

        clearSession() {
            try {
                localStorage.removeItem(this.storageKey);
            } catch (e) {
                // Silent fail
            }
        }

        updateActivity() {
            const session = this.getStoredSession();
            if (session) {
                session.lastActivity = Date.now();
                this.saveSession(session);
            }
        }

        checkLocalStorageAvailable() {
            try {
                localStorage.setItem('test', 'test');
                localStorage.removeItem('test');
                return true;
            } catch(e) {
                return false;
            }
        }
    }

    window.BellhopWidget = {
        init: function(config) {
            const apiKey = config.apiKey;
            const apiUrl = config.apiUrl || 'https://api.bellhop.ai';

            if (!apiKey) {
                console.error('Bellhop Widget: API key is required');
                return;
            }

            // Initialize session manager
            const sessionManager = new BellhopSessionManager(apiKey);
            const hasLocalStorage = sessionManager.checkLocalStorageAvailable();

            // Get or create persistent session ID
            let sessionId;
            if (hasLocalStorage) {
                sessionId = sessionManager.getOrCreateSession();
            } else {
                // Fallback to non-persistent session
                sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
            }

            // Add CSS
            const style = document.createElement('style');
            style.textContent = `
                #bellhop-btn{position:fixed;bottom:20px;right:20px;width:60px;height:60px;border-radius:50%;background:#e74c3c;border:none;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.2);z-index:9999;display:flex;align-items:center;justify-content:center;color:white;font-size:24px;transition:transform 0.2s}
                #bellhop-btn:hover{transform:scale(1.05)}
                #bellhop-chat-window{position:fixed;bottom:90px;right:20px;width:350px;height:500px;background:white;border-radius:10px;box-shadow:0 8px 30px rgba(0,0,0,0.3);z-index:9999;display:none;flex-direction:column;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
                #bellhop-chat-header{background:#e74c3c;color:white;padding:15px;border-radius:10px 10px 0 0;display:flex;justify-content:space-between;align-items:center}
                #bellhop-chat-header h3{margin:0;font-size:16px;font-weight:600}
                #bellhop-close{background:none;border:none;color:white;font-size:20px;cursor:pointer;padding:0;width:24px;height:24px;display:flex;align-items:center;justify-content:center}
                #bellhop-close:hover{background:rgba(255,255,255,0.1);border-radius:50%}
                #bellhop-messages{flex:1;padding:15px;overflow-y:auto;max-height:350px}
                .bellhop-message{margin-bottom:10px;display:flex}
                .bellhop-user{justify-content:flex-end}
                .bellhop-bot{justify-content:flex-start}
                .bellhop-msg{max-width:80%;padding:8px 12px;border-radius:15px;word-wrap:break-word;font-size:14px;line-height:1.4}
                .bellhop-user .bellhop-msg{background:#e74c3c;color:white}
                .bellhop-bot .bellhop-msg{background:#f1f1f1;color:#333}
                #bellhop-input-area{padding:15px;border-top:1px solid #eee;display:flex;gap:8px}
                #bellhop-input{flex:1;padding:8px 12px;border:1px solid #ddd;border-radius:20px;outline:none;font-size:14px}
                #bellhop-input:focus{border-color:#e74c3c}
                #bellhop-send{padding:8px 16px;background:#e74c3c;color:white;border:none;border-radius:20px;cursor:pointer;font-size:14px;transition:background 0.2s}
                #bellhop-send:hover:not(:disabled){background:#c0392b}
                #bellhop-send:disabled{background:#ccc;cursor:not-allowed}
                .bellhop-typing{padding:10px;text-align:center;font-size:12px;color:#666;font-style:italic}
                @media(max-width:480px){#bellhop-chat-window{width:300px;right:10px}#bellhop-btn{right:10px}}
            `;
            document.head.appendChild(style);

            // Add HTML
            const chatHtml = `
                <button id="bellhop-btn">💬</button>
                <div id="bellhop-chat-window">
                    <div id="bellhop-chat-header">
                        <h3>Chat with us</h3>
                        <button id="bellhop-close">×</button>
                    </div>
                    <div id="bellhop-messages">
                        <div class="bellhop-message bellhop-bot">
                            <div class="bellhop-msg">Hi! How can I help you today?</div>
                        </div>
                    </div>
                    <div id="bellhop-input-area">
                        <input type="text" id="bellhop-input" placeholder="Type your message..." maxlength="500">
                        <button id="bellhop-send">Send</button>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', chatHtml);

            // Get elements
            const btn = document.getElementById('bellhop-btn');
            const window = document.getElementById('bellhop-chat-window');
            const close = document.getElementById('bellhop-close');
            const input = document.getElementById('bellhop-input');
            const send = document.getElementById('bellhop-send');
            const messages = document.getElementById('bellhop-messages');

            // Load chat history
            const loadChatHistory = async () => {
                try {
                    const response = await fetch(
                        `${apiUrl}/api/v1/sessions/history/${sessionId}`,
                        {
                            method: 'GET',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${apiKey}`
                            }
                        }
                    );

                    if (response.ok) {
                        const history = await response.json();
                        return history.messages || [];
                    } else if (response.status === 404) {
                        // Session expired on backend, create new one
                        sessionManager.clearSession();
                        sessionId = sessionManager.getOrCreateSession();
                        return [];
                    } else {
                        return [];
                    }
                } catch (error) {
                    return [];
                }
            };

            // Display chat history
            const displayHistory = (history) => {
                if (history.length === 0) return;

                // Clear default message
                messages.innerHTML = '';

                history.forEach(msg => {
                    const messageClass = msg.role === 'user' ? 'bellhop-user' : 'bellhop-bot';
                    messages.innerHTML += `<div class="bellhop-message ${messageClass}"><div class="bellhop-msg">${msg.content}</div></div>`;
                });

                messages.scrollTop = messages.scrollHeight;
            };

            // Toggle chat
            btn.onclick = async () => {
                if (window.style.display === 'flex') {
                    window.style.display = 'none';
                } else {
                    window.style.display = 'flex';
                    input.focus();

                    // Load and display history only if we have a restored session
                    const storedSession = sessionManager.getStoredSession();
                    if (storedSession && !sessionManager.isExpired(storedSession)) {
                        const history = await loadChatHistory();
                        displayHistory(history);
                    }
                }
            };

            close.onclick = () => window.style.display = 'none';

            // Send message
            const sendMessage = async () => {
                const text = input.value.trim();
                if(!text) return;

                // Update session activity
                if (hasLocalStorage) {
                    sessionManager.updateActivity();
                }

                // Add user message
                messages.innerHTML += `<div class="bellhop-message bellhop-user"><div class="bellhop-msg">${text}</div></div>`;
                input.value = '';
                send.disabled = true;

                // Show typing
                const typing = document.createElement('div');
                typing.className = 'bellhop-typing';
                typing.textContent = 'Typing...';
                messages.appendChild(typing);
                messages.scrollTop = messages.scrollHeight;

                try {
                    const response = await fetch(`${apiUrl}/api/v1/chat/stream`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${apiKey}`
                        },
                        body: JSON.stringify({
                            session_id: sessionId,
                            message: text
                        })
                    });

                    if (!response.ok) throw new Error('Network response was not ok');

                    const reader = response.body.getReader();
                    const decoder = new TextDecoder();
                    let botResponse = '';

                    typing.remove();

                    // Add empty bot message that we'll update
                    const botMessage = document.createElement('div');
                    botMessage.className = 'bellhop-message bellhop-bot';
                    botMessage.innerHTML = '<div class="bellhop-msg"></div>';
                    messages.appendChild(botMessage);
                    const botMsgDiv = botMessage.querySelector('.bellhop-msg');

                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;

                        const chunk = decoder.decode(value);
                        const lines = chunk.split('\n');

                        let currentEvent = '';
                        for (const line of lines) {
                            if (line.startsWith('event: ')) {
                                currentEvent = line.slice(7).trim();
                            } else if (line.startsWith('data: ') && currentEvent === 'token') {
                                const data = line.slice(6).trim();
                                if (data && !data.startsWith('{')) {
                                    botResponse += data;
                                    botMsgDiv.textContent = botResponse;
                                    messages.scrollTop = messages.scrollHeight;
                                }
                            }
                        }
                    }

                    if (!botResponse) {
                        botMsgDiv.textContent = 'Sorry, I had trouble processing that.';
                    }

                    // Update session activity after successful response
                    if (hasLocalStorage) {
                        sessionManager.updateActivity();
                    }

                } catch(error) {
                    typing.remove();
                    messages.innerHTML += `<div class="bellhop-message bellhop-bot"><div class="bellhop-msg">Sorry, I'm having connection issues. Please try again.</div></div>`;
                } finally {
                    send.disabled = false;
                    messages.scrollTop = messages.scrollHeight;
                }
            };

            send.onclick = sendMessage;
            input.onkeypress = (e) => {
                if(e.key === 'Enter') sendMessage();
            };

            console.log('Bellhop Widget v2.0 loaded successfully');
        }
    };
})();

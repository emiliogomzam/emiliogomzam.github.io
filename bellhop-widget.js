/**
 * Bellhop AI Chatbot Widget - Simple Integration
 * Just include this script and call BellhopWidget.init() with your customer ID
 */
(function() {
    'use strict';
    
    window.BellhopWidget = {
        init: function(config) {
            const customerId = config.customerId || 'demo';
            const apiUrl = config.apiUrl || 'http://localhost:8080';
            const sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
            
            // Add CSS
            const style = document.createElement('style');
            style.textContent = `
                #bellhop-chat-btn{position:fixed;bottom:20px;right:20px;width:60px;height:60px;border-radius:50%;background:#e74c3c;border:none;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.2);z-index:9999;display:flex;align-items:center;justify-content:center;color:white;font-size:24px}
                #bellhop-chat-btn:hover{transform:scale(1.05)}
                #bellhop-chat-window{position:fixed;bottom:90px;right:20px;width:350px;height:500px;background:white;border-radius:10px;box-shadow:0 8px 30px rgba(0,0,0,0.3);z-index:9999;display:none;flex-direction:column;font-family:Arial,sans-serif}
                #bellhop-chat-header{background:#e74c3c;color:white;padding:15px;border-radius:10px 10px 0 0;display:flex;justify-content:space-between;align-items:center}
                #bellhop-chat-header h3{margin:0;font-size:16px}
                #bellhop-close{background:none;border:none;color:white;font-size:20px;cursor:pointer}
                #bellhop-messages{flex:1;padding:15px;overflow-y:auto;max-height:350px}
                .bellhop-message{margin-bottom:10px;display:flex}
                .bellhop-user{justify-content:flex-end}
                .bellhop-bot{justify-content:flex-start}
                .bellhop-msg{max-width:80%;padding:8px 12px;border-radius:15px;word-wrap:break-word;font-size:14px}
                .bellhop-user .bellhop-msg{background:#e74c3c;color:white}
                .bellhop-bot .bellhop-msg{background:#f1f1f1;color:#333}
                #bellhop-input-area{padding:15px;border-top:1px solid #eee;display:flex;gap:8px}
                #bellhop-input{flex:1;padding:8px 12px;border:1px solid #ddd;border-radius:20px;outline:none;font-size:14px}
                #bellhop-send{padding:8px 16px;background:#e74c3c;color:white;border:none;border-radius:20px;cursor:pointer;font-size:14px}
                #bellhop-send:disabled{background:#ccc}
                .bellhop-typing{padding:10px;text-align:center;font-size:12px;color:#666}
                @media(max-width:480px){#bellhop-chat-window{width:300px;right:10px}#bellhop-chat-btn{right:10px}}
            `;
            document.head.appendChild(style);
            
            // Add HTML
            const chatHtml = `
                <button id="bellhop-chat-btn">💬</button>
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
            const btn = document.getElementById('bellhop-chat-btn');
            const window = document.getElementById('bellhop-chat-window');
            const close = document.getElementById('bellhop-close');
            const input = document.getElementById('bellhop-input');
            const send = document.getElementById('bellhop-send');
            const messages = document.getElementById('bellhop-messages');
            
            // Toggle chat
            btn.onclick = () => {
                window.style.display = window.style.display === 'flex' ? 'none' : 'flex';
                if(window.style.display === 'flex') input.focus();
            };
            close.onclick = () => window.style.display = 'none';
            
            // Send message
            const sendMessage = async () => {
                const text = input.value.trim();
                if(!text) return;
                
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
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({
                            customer_id: customerId,
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
            
            console.log('Bellhop Widget loaded for customer:', customerId);
        }
    };
})();

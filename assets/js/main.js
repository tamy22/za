// Tâm Ý - Main Application File
import { 
  saveMessage, 
  getMessages, 
  saveUserProfile, 
  getUserProfile, 
  saveAiProfile, 
  getAiProfile,
  registerForPushNotifications,
  setupNotificationListener
} from './firebase-integration.js';
import { generateAiResponse } from './deepseek-api.js';

// App state
let currentUserId = null;
let userProfile = null;
let aiProfile = null;
let messages = [];
let remainingChats = 30; // Default value
let isAiTyping = false;

// DOM elements (will be initialized after DOM loads)
let chatContainer;
let messageInput;
let sendButton;
let loadingScreen;
let messagesElement;
let aiNameElement;
let aiAvatarElement;
let remainingChatsElement;
let typingIndicator;

// Initialize the app
document.addEventListener('DOMContentLoaded', async () => {
  initializeElements();
  setupEventListeners();
  
  // Check if user is already logged in
  const storedUserId = localStorage.getItem('userId');
  if (storedUserId) {
    currentUserId = storedUserId;
    await loadUserData();
    showChatInterface();
  } else {
    showAuthInterface();
  }
  
  // Setup FCM notifications
  setupNotificationListener();
});

// Initialize DOM elements
function initializeElements() {
  loadingScreen = document.querySelector('.loading-screen');
  chatContainer = document.getElementById('chat-container');
  messagesElement = document.getElementById('messages');
  messageInput = document.getElementById('message-input');
  sendButton = document.getElementById('send-button');
  aiNameElement = document.getElementById('ai-name');
  aiAvatarElement = document.getElementById('ai-avatar');
  remainingChatsElement = document.getElementById('remaining-chats');
  typingIndicator = document.getElementById('typing-indicator');
  
  // Create app container structure if it doesn't exist
  createAppStructure();
}

// Create the HTML structure for the app
function createAppStructure() {
  const appDiv = document.getElementById('app');
  
  // If the loading screen is the only content
  if (appDiv.children.length === 1 && appDiv.children[0].classList.contains('loading-screen')) {
    appDiv.innerHTML = `
      <div class="loading-screen">
        <div class="loading-logo">
          <img src="./assets/images/logo.png" alt="Tâm Ý Logo">
        </div>
        <div class="loading-spinner"></div>
        <div class="loading-text">Đang tải Tâm Ý...</div>
      </div>
      
      <div id="auth-container" class="auth-container hidden">
        <div class="auth-panel">
          <div class="auth-header">
            <h1>Tâm Ý</h1>
            <p>Đăng nhập để trò chuyện với người bạn AI hiểu lòng bạn</p>
          </div>
          
          <div class="auth-tabs">
            <button id="login-tab" class="auth-tab active">Đăng nhập</button>
            <button id="register-tab" class="auth-tab">Đăng ký</button>
          </div>
          
          <div id="login-form" class="auth-form">
            <div class="form-group">
              <label for="login-username">Tên đăng nhập</label>
              <input type="text" id="login-username" placeholder="Nhập tên đăng nhập">
            </div>
            <div class="form-group">
              <label for="login-password">Mật khẩu</label>
              <input type="password" id="login-password" placeholder="Nhập mật khẩu">
            </div>
            <button id="login-button" class="auth-button">Đăng nhập</button>
          </div>
          
          <div id="register-form" class="auth-form hidden">
            <div class="form-group">
              <label for="register-username">Tên đăng nhập</label>
              <input type="text" id="register-username" placeholder="Tạo tên đăng nhập">
            </div>
            <div class="form-group">
              <label for="register-email">Email</label>
              <input type="email" id="register-email" placeholder="Nhập email">
            </div>
            <div class="form-group">
              <label for="register-password">Mật khẩu</label>
              <input type="password" id="register-password" placeholder="Tạo mật khẩu">
            </div>
            <button id="register-button" class="auth-button">Đăng ký</button>
          </div>
        </div>
      </div>
      
      <div id="chat-container" class="chat-container hidden">
        <header class="chat-header">
          <div class="ai-info">
            <div class="ai-avatar">
              <img id="ai-avatar" src="./assets/images/default-avatar.png" alt="AI Avatar">
            </div>
            <div class="ai-details">
              <h2 id="ai-name">Tâm Ý</h2>
              <p class="ai-status">Đang hoạt động</p>
            </div>
          </div>
          <div class="chat-actions">
            <div class="remaining-chats">
              <span id="remaining-chats">30</span> tin nhắn còn lại
            </div>
            <button id="add-credits-button" class="icon-button">
              <span class="material-icons">add_circle</span>
            </button>
            <button id="profile-button" class="icon-button">
              <span class="material-icons">person</span>
            </button>
            <button id="menu-button" class="icon-button">
              <span class="material-icons">more_vert</span>
            </button>
          </div>
        </header>
        
        <div id="menu-dropdown" class="menu-dropdown hidden">
          <button id="edit-profile-button" class="menu-item">
            <span class="material-icons">edit</span>
            Chỉnh sửa hồ sơ
          </button>
          <button id="buy-credits-button" class="menu-item">
            <span class="material-icons">shopping_cart</span>
            Mua thêm lượt chat
          </button>
          <button id="settings-button" class="menu-item">
            <span class="material-icons">settings</span>
            Cài đặt
          </button>
          <button id="logout-button" class="menu-item">
            <span class="material-icons">logout</span>
            Đăng xuất
          </button>
        </div>
        
        <div id="messages" class="messages">
          <!-- Messages will be inserted here -->
        </div>
        
        <div id="typing-indicator" class="typing-indicator hidden">
          <div class="typing-bubble">
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
          </div>
        </div>
        
        <div class="chat-input">
          <input type="text" id="message-input" placeholder="Nhập tin nhắn cho Tâm Ý..." autocomplete="off">
          <button id="send-button" class="send-button">
            <span class="material-icons">send</span>
          </button>
        </div>
      </div>
      
      <div id="profile-container" class="profile-container hidden">
        <!-- Profile editor will be here -->
      </div>
      
      <div id="payment-container" class="payment-container hidden">
        <!-- Payment interface will be here -->
      </div>
    `;
    
    // Re-initialize elements after creating structure
    initializeElements();
  }
}

// Setup event listeners
function setupEventListeners() {
  // Chat interface
  sendButton.addEventListener('click', handleSendMessage);
  messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  });
  
  // Menu
  document.getElementById('menu-button').addEventListener('click', toggleMenu);
  document.getElementById('edit-profile-button').addEventListener('click', showProfileEditor);
  document.getElementById('buy-credits-button').addEventListener('click', showPaymentInterface);
  document.getElementById('logout-button').addEventListener('click', handleLogout);
  
  // Auth tabs
  document.getElementById('login-tab').addEventListener('click', () => {
    document.getElementById('login-tab').classList.add('active');
    document.getElementById('register-tab').classList.remove('active');
    document.getElementById('login-form').classList.remove('hidden');
    document.getElementById('register-form').classList.add('hidden');
  });
  
  document.getElementById('register-tab').addEventListener('click', () => {
    document.getElementById('register-tab').classList.add('active');
    document.getElementById('login-tab').classList.remove('active');
    document.getElementById('register-form').classList.remove('hidden');
    document.getElementById('login-form').classList.add('hidden');
  });
  
  // Auth buttons
  document.getElementById('login-button').addEventListener('click', handleLogin);
  document.getElementById('register-button').addEventListener('click', handleRegister);
  
  // Add credits button
  document.getElementById('add-credits-button').addEventListener('click', showPaymentInterface);
}

// Authentication and User Management
async function handleLogin() {
  const username = document.getElementById('login-username').value;
  const password = document.getElementById('login-password').value;
  
  if (!username || !password) {
    showAlert('Vui lòng nhập đầy đủ thông tin đăng nhập.');
    return;
  }
  
  try {
    // In this static version, we'll implement a simple login flow
    // In a real app, you'd verify credentials with Firebase Auth
    
    // For now, we'll generate a UUID to use as userId
    currentUserId = generateUUID();
    
    // Save to localStorage
    localStorage.setItem('userId', currentUserId);
    
    // Create a basic user profile if first time
    const existingProfile = await getUserProfile(currentUserId);
    if (!existingProfile) {
      await saveUserProfile(currentUserId, {
        username,
        name: username,
        gender: 'Nam', // Default
        age: 25, // Default
        job: 'Chưa cập nhật', // Default
        createdAt: new Date()
      });
    }
    
    await loadUserData();
    showChatInterface();
  } catch (error) {
    console.error('Login error:', error);
    showAlert('Đăng nhập thất bại. Vui lòng thử lại sau.');
  }
}

async function handleRegister() {
  const username = document.getElementById('register-username').value;
  const email = document.getElementById('register-email').value;
  const password = document.getElementById('register-password').value;
  
  if (!username || !email || !password) {
    showAlert('Vui lòng nhập đầy đủ thông tin đăng ký.');
    return;
  }
  
  try {
    // Similar to login, we'll implement a simple flow
    currentUserId = generateUUID();
    
    // Save to localStorage
    localStorage.setItem('userId', currentUserId);
    
    // Create user profile
    await saveUserProfile(currentUserId, {
      username,
      email,
      name: username,
      gender: 'Nam', // Default
      age: 25, // Default
      job: 'Chưa cập nhật', // Default
      createdAt: new Date()
    });
    
    await loadUserData();
    showChatInterface();
    
    // Show create AI profile interface
    showCreateAiProfileInterface();
  } catch (error) {
    console.error('Registration error:', error);
    showAlert('Đăng ký thất bại. Vui lòng thử lại sau.');
  }
}

async function handleLogout() {
  // Clear local data
  localStorage.removeItem('userId');
  localStorage.removeItem('authToken');
  
  // Reset app state
  currentUserId = null;
  userProfile = null;
  aiProfile = null;
  messages = [];
  
  // Show auth interface
  showAuthInterface();
  
  // Hide menu dropdown
  document.getElementById('menu-dropdown').classList.add('hidden');
}

// UI Management
function showAuthInterface() {
  hideLoadingScreen();
  document.getElementById('auth-container').classList.remove('hidden');
  document.getElementById('chat-container').classList.add('hidden');
  document.getElementById('profile-container').classList.add('hidden');
  document.getElementById('payment-container').classList.add('hidden');
}

function showChatInterface() {
  hideLoadingScreen();
  document.getElementById('auth-container').classList.add('hidden');
  document.getElementById('chat-container').classList.remove('hidden');
  document.getElementById('profile-container').classList.add('hidden');
  document.getElementById('payment-container').classList.add('hidden');
  
  // Update UI with user data
  updateChatInterface();
  
  // Scroll to bottom of chat
  scrollToBottom();
}

function showProfileEditor() {
  document.getElementById('auth-container').classList.add('hidden');
  document.getElementById('chat-container').classList.add('hidden');
  document.getElementById('profile-container').classList.remove('hidden');
  document.getElementById('payment-container').classList.add('hidden');
  
  // Hide menu dropdown
  document.getElementById('menu-dropdown').classList.add('hidden');
  
  // TODO: Implement profile editor
}

function showPaymentInterface() {
  document.getElementById('auth-container').classList.add('hidden');
  document.getElementById('chat-container').classList.add('hidden');
  document.getElementById('profile-container').classList.add('hidden');
  document.getElementById('payment-container').classList.remove('hidden');
  
  // Hide menu dropdown
  document.getElementById('menu-dropdown').classList.add('hidden');
  
  // TODO: Implement payment interface
}

function hideLoadingScreen() {
  document.querySelector('.loading-screen').classList.add('hidden');
}

function toggleMenu() {
  document.getElementById('menu-dropdown').classList.toggle('hidden');
}

function updateChatInterface() {
  // Update AI info
  if (aiProfile) {
    aiNameElement.textContent = aiProfile.name || 'Tâm Ý';
    if (aiProfile.avatarUrl) {
      aiAvatarElement.src = aiProfile.avatarUrl;
    }
  }
  
  // Update remaining chats
  remainingChatsElement.textContent = remainingChats === Infinity ? '∞' : remainingChats.toString();
  
  // Render messages
  renderMessages();
}

// Data Loading
async function loadUserData() {
  try {
    // Load user profile
    userProfile = await getUserProfile(currentUserId);
    
    // Load AI profile or create default if none exists
    aiProfile = await getAiProfile(currentUserId);
    
    if (!aiProfile) {
      // Create default AI profile
      aiProfile = {
        name: 'Tâm Ý',
        gender: 'Nữ',
        age: 20,
        job: 'Trợ lý ảo',
        hobbies: ['Trò chuyện', 'Lắng nghe', 'Chia sẻ'],
        personalityType: 'gentle',
        avatarUrl: './assets/images/default-avatar.png'
      };
      
      await saveAiProfile(currentUserId, aiProfile);
    }
    
    // Load message history
    messages = await getMessages(currentUserId);
    
    // Calculate remaining chats (in a real app, this would come from the server)
    remainingChats = 30;
    
    // Register for push notifications
    await registerForPushNotifications(currentUserId);
  } catch (error) {
    console.error('Error loading user data:', error);
  }
}

// Chat functionality
async function handleSendMessage() {
  const messageText = messageInput.value.trim();
  if (!messageText || isAiTyping) return;
  
  // Add user message to UI
  const userMessage = {
    id: generateUUID(),
    content: messageText,
    isFromAi: false,
    timestamp: new Date()
  };
  
  // Clear input
  messageInput.value = '';
  
  // Add to messages array
  messages.push(userMessage);
  
  // Save to Firebase
  await saveMessage(currentUserId, messageText, false);
  
  // Render messages
  renderMessages();
  
  // Scroll to bottom
  scrollToBottom();
  
  // Show typing indicator
  showTypingIndicator();
  
  // Generate AI response with delay to simulate typing
  setTimeout(async () => {
    try {
      // Get recent conversation for context
      const conversationHistory = messages.slice(-10).map(msg => msg.content);
      
      // Calculate whether to use short response (40% chance)
      const shouldUseShortResponse = Math.random() < 0.4;
      
      // Generate response
      const aiResponseText = await generateAiResponse(
        messageText,
        aiProfile,
        userProfile,
        conversationHistory,
        shouldUseShortResponse
      );
      
      // Create AI message
      const aiMessage = {
        id: generateUUID(),
        content: aiResponseText,
        isFromAi: true,
        timestamp: new Date()
      };
      
      // Add to messages array
      messages.push(aiMessage);
      
      // Save to Firebase
      await saveMessage(currentUserId, aiResponseText, true);
      
      // Hide typing indicator
      hideTypingIndicator();
      
      // Render messages
      renderMessages();
      
      // Scroll to bottom
      scrollToBottom();
    } catch (error) {
      console.error('Error generating AI response:', error);
      
      // Hide typing indicator
      hideTypingIndicator();
      
      // Show error message
      const errorMessage = {
        id: generateUUID(),
        content: "Xin lỗi, tôi đang gặp vấn đề kết nối. Vui lòng thử lại sau.",
        isFromAi: true,
        timestamp: new Date()
      };
      
      messages.push(errorMessage);
      renderMessages();
      scrollToBottom();
    }
  }, Math.random() * 1000 + 500); // Random delay between 500ms and 1500ms
}

function renderMessages() {
  if (!messagesElement) return;
  
  // Clear current messages
  messagesElement.innerHTML = '';
  
  // If no messages, show welcome message
  if (messages.length === 0) {
    const welcomeMessage = document.createElement('div');
    welcomeMessage.className = 'message ai-message';
    welcomeMessage.innerHTML = `
      <div class="message-avatar">
        <img src="${aiProfile?.avatarUrl || './assets/images/default-avatar.png'}" alt="${aiProfile?.name || 'Tâm Ý'}">
      </div>
      <div class="message-content">
        <p>Xin chào ${userProfile?.name || 'bạn'}! Mình là ${aiProfile?.name || 'Tâm Ý'}, rất vui được trò chuyện với bạn. Bạn có thể chia sẻ với mình bất cứ điều gì nhé! 😊</p>
      </div>
    `;
    messagesElement.appendChild(welcomeMessage);
    return;
  }
  
  // Render all messages
  messages.forEach(message => {
    const messageElement = document.createElement('div');
    messageElement.className = message.isFromAi ? 'message ai-message' : 'message user-message';
    
    if (message.isFromAi) {
      messageElement.innerHTML = `
        <div class="message-avatar">
          <img src="${aiProfile?.avatarUrl || './assets/images/default-avatar.png'}" alt="${aiProfile?.name || 'Tâm Ý'}">
        </div>
        <div class="message-content">
          <p>${formatMessageContent(message.content)}</p>
          <div class="message-time">${formatTime(message.timestamp)}</div>
        </div>
      `;
    } else {
      messageElement.innerHTML = `
        <div class="message-content">
          <p>${formatMessageContent(message.content)}</p>
          <div class="message-time">${formatTime(message.timestamp)}</div>
        </div>
      `;
    }
    
    messagesElement.appendChild(messageElement);
  });
}

function showTypingIndicator() {
  isAiTyping = true;
  typingIndicator.classList.remove('hidden');
  scrollToBottom();
}

function hideTypingIndicator() {
  isAiTyping = false;
  typingIndicator.classList.add('hidden');
}

function scrollToBottom() {
  if (messagesElement) {
    messagesElement.scrollTop = messagesElement.scrollHeight;
  }
}

// Utility functions
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function formatMessageContent(content) {
  // Convert line breaks to <br>
  return content.replace(/\n/g, '<br>');
}

function formatTime(timestamp) {
  if (!timestamp) return '';
  
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  
  // Format time as HH:MM
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function showAlert(message) {
  alert(message); // In a real app, use a nicer UI component
}

// PWA installation prompt
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
  // Prevent Chrome 67 and earlier from automatically showing the prompt
  e.preventDefault();
  // Stash the event so it can be triggered later
  deferredPrompt = e;
  
  // Show the install button or banner
  document.getElementById('install-button')?.classList.remove('hidden');
});

// Function to show installation prompt
function installApp() {
  if (!deferredPrompt) return;
  
  // Show the install prompt
  deferredPrompt.prompt();
  
  // Wait for the user to respond to the prompt
  deferredPrompt.userChoice.then((choiceResult) => {
    if (choiceResult.outcome === 'accepted') {
      console.log('User accepted the install prompt');
    } else {
      console.log('User dismissed the install prompt');
    }
    
    // Clear the saved prompt since it can't be used again
    deferredPrompt = null;
    
    // Hide the install button
    document.getElementById('install-button')?.classList.add('hidden');
  });
}
// Tâm Ý - Service Worker
const CACHE_NAME = 'tamy-cache-v1';

// Tài nguyên cần cache khi cài đặt
const CACHE_ASSETS = [
  '/',
  '/index.html',
  '/assets/css/main.css',
  '/assets/js/main.js',
  '/assets/js/firebase.js',
  '/assets/js/deepseek-api.js',
  '/assets/images/logo.png',
  '/assets/images/default-avatar.png',
  '/assets/images/chat-background.png',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png',
  '/manifest.json',
  'https://fonts.googleapis.com/icon?family=Material+Icons',
  'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js',
  'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js',
  'https://www.gstatic.com/firebasejs/11.6.1/firebase-analytics.js'
];

// Cài đặt Service Worker
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing Service Worker...');
  
  // Skip waiting và force activate trên các client hiện tại
  self.skipWaiting();
  
  // Cache các tài nguyên cần thiết
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Caching app shell and content');
        return cache.addAll(CACHE_ASSETS);
      })
      .catch((error) => {
        console.error('[Service Worker] Error caching app shell:', error);
      })
  );
});

// Activate event - Dọn dẹp cache cũ
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating Service Worker...');
  
  // Nhận quyền kiểm soát các client không có controller ngay lập tức
  self.clients.claim();
  
  // Xóa các cache cũ
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  
  return self.clients.claim();
});

// Chiến lược fetch: Network first, fallback to cache
self.addEventListener('fetch', (event) => {
  // Bỏ qua các yêu cầu không phải HTTP/HTTPS
  if (!event.request.url.startsWith('http')) return;
  
  // Bỏ qua các yêu cầu tới API DeepSeek (sẽ không cache)
  if (event.request.url.includes('api.deepseek.com')) {
    return;
  }
  
  // Bỏ qua các yêu cầu Firebase (sẽ được xử lý bởi Firebase SDK)
  if (event.request.url.includes('firestore.googleapis.com') || 
      event.request.url.includes('firebase')) {
    return;
  }
  
  // Phản hồi với chiến lược Network first, cache fallback
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Nếu fetch thành công, cache lại phản hồi
        const clonedResponse = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          // Chỉ cache các yêu cầu GET
          if (event.request.method === 'GET') {
            cache.put(event.request, clonedResponse);
          }
        });
        return response;
      })
      .catch(() => {
        // Nếu fetch thất bại, trả về từ cache
        return caches.match(event.request)
          .then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            
            // Nếu là yêu cầu HTML, trả về trang index
            if (event.request.headers.get('accept').includes('text/html')) {
              return caches.match('/index.html');
            }
            
            // Không tìm thấy trong cache, báo lỗi
            return new Response('Không thể kết nối đến mạng và không tìm thấy tài nguyên trong cache.', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: new Headers({
                'Content-Type': 'text/plain'
              })
            });
          });
      })
  );
});

// Xử lý thông báo đẩy
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push Received');
  
  let notificationData = {};
  
  try {
    notificationData = event.data.json();
  } catch (e) {
    notificationData = {
      title: 'Tâm Ý',
      message: event.data ? event.data.text() : 'Có thông báo mới',
      icon: '/assets/icons/icon-192.png',
      badge: '/assets/icons/badge-icon.png'
    };
  }
  
  const options = {
    body: notificationData.message || notificationData.body || 'Có thông báo mới từ Tâm Ý',
    icon: notificationData.icon || '/assets/icons/icon-192.png',
    badge: notificationData.badge || '/assets/icons/badge-icon.png',
    vibrate: [100, 50, 100],
    data: {
      url: notificationData.url || notificationData.click_action || '/'
    }
  };
  
  event.waitUntil(
    self.registration.showNotification(notificationData.title || 'Tâm Ý', options)
  );
});

// Xử lý sự kiện click vào thông báo
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification click:', event);
  event.notification.close();
  
  const urlToOpen = event.notification.data.url || '/';
  
  // Mở trang nếu người dùng click vào thông báo
  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then((windowClients) => {
      // Kiểm tra xem có tab nào đã mở URL này chưa
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // Mở URL trong tab mới nếu không có tab nào đã mở
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Đồng bộ dữ liệu nền (background sync)
self.addEventListener('sync', (event) => {
  console.log('[Service Worker] Background Sync', event.tag);
  
  if (event.tag === 'sync-messages') {
    event.waitUntil(syncMessages());
  } else if (event.tag === 'sync-profile') {
    event.waitUntil(syncProfile());
  }
});

// Đồng bộ tin nhắn
async function syncMessages() {
  try {
    const pendingMessages = await getPendingMessages();
    
    for (const message of pendingMessages) {
      try {
        // Thực hiện đồng bộ
        await sendMessageToServer(message);
        // Đánh dấu tin nhắn đã đồng bộ
        await markMessageSynced(message.id);
      } catch (error) {
        console.error('[Service Worker] Failed to sync message:', error);
      }
    }
  } catch (error) {
    console.error('[Service Worker] Error in syncMessages:', error);
    throw error;
  }
}

// Đồng bộ hồ sơ
async function syncProfile() {
  try {
    const pendingProfiles = await getPendingProfiles();
    
    for (const profile of pendingProfiles) {
      try {
        // Thực hiện đồng bộ
        await sendProfileToServer(profile);
        // Đánh dấu hồ sơ đã đồng bộ
        await markProfileSynced(profile.id);
      } catch (error) {
        console.error('[Service Worker] Failed to sync profile:', error);
      }
    }
  } catch (error) {
    console.error('[Service Worker] Error in syncProfile:', error);
    throw error;
  }
}

// Các hàm trợ giúp để làm việc với DB trong Service Worker
// Sẽ được triển khai thông qua IndexedDB
// Để đơn giản, các hàm này sẽ chỉ là placeholder

function getPendingMessages() {
  return Promise.resolve([]);
}

function markMessageSynced(id) {
  return Promise.resolve();
}

function sendMessageToServer(message) {
  return Promise.resolve();
}

function getPendingProfiles() {
  return Promise.resolve([]);
}

function markProfileSynced(id) {
  return Promise.resolve();
}

function sendProfileToServer(profile) {
  return Promise.resolve();
}

// Thông báo đã sẵn sàng cho client
console.log('[Service Worker] Service Worker registered successfully!');
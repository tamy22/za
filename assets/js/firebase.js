// Tâm Ý - Firebase Integration
// Module này tích hợp Firebase Firestore và Analytics
// Import trực tiếp từ CDN để tránh sử dụng npm

// Import Firebase từ CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAnalytics, logEvent } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-analytics.js";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit, 
  serverTimestamp, 
  doc, 
  getDoc, 
  setDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Cấu hình Firebase từ dự án của bạn
const firebaseConfig = {
  apiKey: "AIzaSyBL2Hne8HaLVHltVGID8mDFqrR5W26QDNg",
  authDomain: "tamy-8e4ba.firebaseapp.com",
  projectId: "tamy-8e4ba",
  storageBucket: "tamy-8e4ba.firebasestorage.app",
  messagingSenderId: "1035136959921",
  appId: "1:1035136959921:web:bcab300ea400d9512be990",
  measurementId: "G-TYV81ND75N"
};

// Khởi tạo Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);

// ---------------------------
// Hàm thao tác với tin nhắn
// ---------------------------

/**
 * Lưu tin nhắn và phản hồi vào Firestore
 * @param {string} userId - ID người dùng
 * @param {string} userMessage - Nội dung tin nhắn của người dùng
 * @param {string} aiReply - Phản hồi từ AI
 * @returns {Promise<Object>} - Thông tin về tin nhắn đã lưu
 */
export async function saveChat(userId, userMessage, aiReply) {
  try {
    // Tạo tham chiếu đến collection chats
    const chatsRef = collection(db, "chats");
    
    // Lưu tin nhắn của người dùng
    const userMessageDoc = await addDoc(chatsRef, {
      userId: userId,
      content: userMessage,
      isFromAi: false,
      timestamp: serverTimestamp()
    });
    
    // Lưu phản hồi của AI
    const aiMessageDoc = await addDoc(chatsRef, {
      userId: userId,
      content: aiReply,
      isFromAi: true,
      timestamp: serverTimestamp()
    });
    
    // Cập nhật số lượng tin nhắn của người dùng
    await updateChatCount(userId);
    
    // Ghi event vào Analytics
    logEvent(analytics, "message_sent", {
      userId: userId,
      messageLength: userMessage.length
    });
    
    return {
      userMessageId: userMessageDoc.id,
      aiMessageId: aiMessageDoc.id,
      timestamp: new Date()
    };
  } catch (error) {
    console.error("Error saving chat:", error);
    throw error;
  }
}

/**
 * Lấy lịch sử tin nhắn của người dùng
 * @param {string} userId - ID người dùng
 * @param {number} limitCount - Số lượng tin nhắn tối đa cần lấy
 * @returns {Promise<Array>} - Mảng tin nhắn
 */
export async function getMessages(userId, limitCount = 50) {
  try {
    // Tạo query để lấy tin nhắn của người dùng, sắp xếp theo thời gian
    const q = query(
      collection(db, "chats"),
      where("userId", "==", userId),
      orderBy("timestamp", "asc"),
      limit(limitCount)
    );
    
    // Thực hiện query
    const querySnapshot = await getDocs(q);
    
    // Chuyển đổi kết quả thành mảng
    const messages = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      messages.push({
        id: doc.id,
        content: data.content,
        isFromAi: data.isFromAi,
        timestamp: data.timestamp ? data.timestamp.toDate() : new Date()
      });
    });
    
    return messages;
  } catch (error) {
    console.error("Error getting messages:", error);
    return [];
  }
}

// ---------------------------
// Hàm thao tác với hồ sơ người dùng
// ---------------------------

/**
 * Lưu thông tin hồ sơ người dùng
 * @param {string} userId - ID người dùng
 * @param {Object} profileData - Dữ liệu hồ sơ
 * @returns {Promise<Object>} - Hồ sơ đã lưu
 */
export async function saveUserProfile(userId, profileData) {
  try {
    const userRef = doc(db, "users", userId);
    
    // Thêm timestamp
    const dataToSave = {
      ...profileData,
      updatedAt: serverTimestamp()
    };
    
    // Nếu là tạo mới, thêm createdAt
    const userDoc = await getDoc(userRef);
    if (!userDoc.exists()) {
      dataToSave.createdAt = serverTimestamp();
      // Mặc định cho số lượng chat còn lại
      dataToSave.remainingChats = 30;
      dataToSave.totalChats = 0;
    }
    
    // Lưu dữ liệu
    await setDoc(userRef, dataToSave, { merge: true });
    
    return {
      id: userId,
      ...dataToSave
    };
  } catch (error) {
    console.error("Error saving user profile:", error);
    throw error;
  }
}

/**
 * Lấy thông tin hồ sơ người dùng
 * @param {string} userId - ID người dùng
 * @returns {Promise<Object|null>} - Hồ sơ người dùng
 */
export async function getUserProfile(userId) {
  try {
    const userRef = doc(db, "users", userId);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      return {
        id: userId,
        ...userData,
        createdAt: userData.createdAt ? userData.createdAt.toDate() : new Date(),
        updatedAt: userData.updatedAt ? userData.updatedAt.toDate() : new Date()
      };
    } else {
      return null;
    }
  } catch (error) {
    console.error("Error getting user profile:", error);
    return null;
  }
}

// ---------------------------
// Hàm thao tác với hồ sơ AI
// ---------------------------

/**
 * Lưu thông tin hồ sơ AI
 * @param {string} userId - ID người dùng sở hữu AI
 * @param {Object} aiProfileData - Dữ liệu hồ sơ AI
 * @returns {Promise<Object>} - Hồ sơ AI đã lưu
 */
export async function saveAiProfile(userId, aiProfileData) {
  try {
    const aiProfileRef = doc(db, "aiProfiles", userId);
    
    // Thêm timestamp
    const dataToSave = {
      ...aiProfileData,
      updatedAt: serverTimestamp()
    };
    
    // Nếu là tạo mới, thêm createdAt
    const aiProfileDoc = await getDoc(aiProfileRef);
    if (!aiProfileDoc.exists()) {
      dataToSave.createdAt = serverTimestamp();
    }
    
    // Lưu dữ liệu
    await setDoc(aiProfileRef, dataToSave, { merge: true });
    
    return {
      id: userId,
      ...dataToSave
    };
  } catch (error) {
    console.error("Error saving AI profile:", error);
    throw error;
  }
}

/**
 * Lấy thông tin hồ sơ AI
 * @param {string} userId - ID người dùng sở hữu AI
 * @returns {Promise<Object|null>} - Hồ sơ AI
 */
export async function getAiProfile(userId) {
  try {
    const aiProfileRef = doc(db, "aiProfiles", userId);
    const aiProfileDoc = await getDoc(aiProfileRef);
    
    if (aiProfileDoc.exists()) {
      const aiProfileData = aiProfileDoc.data();
      return {
        id: userId,
        ...aiProfileData,
        createdAt: aiProfileData.createdAt ? aiProfileData.createdAt.toDate() : new Date(),
        updatedAt: aiProfileData.updatedAt ? aiProfileData.updatedAt.toDate() : new Date()
      };
    } else {
      return null;
    }
  } catch (error) {
    console.error("Error getting AI profile:", error);
    return null;
  }
}

// ---------------------------
// Quản lý số lượng tin nhắn
// ---------------------------

/**
 * Cập nhật số lượng tin nhắn của người dùng
 * @param {string} userId - ID người dùng
 * @returns {Promise<number>} - Số lượng tin nhắn còn lại
 */
async function updateChatCount(userId) {
  try {
    const userRef = doc(db, "users", userId);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      const totalChats = (userData.totalChats || 0) + 1;
      const remainingChats = Math.max(0, (userData.remainingChats || 30) - 1);
      
      // Cập nhật dữ liệu
      await updateDoc(userRef, {
        totalChats,
        remainingChats,
        updatedAt: serverTimestamp()
      });
      
      return remainingChats;
    } else {
      // Nếu không tìm thấy hồ sơ, tạo mới
      await setDoc(userRef, {
        totalChats: 1,
        remainingChats: 29, // 30 - 1
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      return 29;
    }
  } catch (error) {
    console.error("Error updating chat count:", error);
    return 0;
  }
}

/**
 * Lấy số lượng tin nhắn còn lại của người dùng
 * @param {string} userId - ID người dùng
 * @returns {Promise<number>} - Số lượng tin nhắn còn lại
 */
export async function getRemainingChats(userId) {
  try {
    const userRef = doc(db, "users", userId);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      return userData.remainingChats || 0;
    } else {
      return 30; // Mặc định cho người dùng mới
    }
  } catch (error) {
    console.error("Error getting remaining chats:", error);
    return 0;
  }
}

/**
 * Thêm số lượng tin nhắn cho người dùng (sau khi mua thêm)
 * @param {string} userId - ID người dùng
 * @param {number} count - Số lượng tin nhắn cần thêm
 * @returns {Promise<number>} - Tổng số tin nhắn còn lại
 */
export async function addChats(userId, count) {
  try {
    const userRef = doc(db, "users", userId);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      const remainingChats = (userData.remainingChats || 0) + count;
      
      // Cập nhật dữ liệu
      await updateDoc(userRef, {
        remainingChats,
        updatedAt: serverTimestamp()
      });
      
      // Ghi event vào Analytics
      logEvent(analytics, "purchase_chats", {
        userId: userId,
        count: count
      });
      
      return remainingChats;
    } else {
      // Nếu không tìm thấy hồ sơ, tạo mới
      await setDoc(userRef, {
        totalChats: 0,
        remainingChats: count,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      return count;
    }
  } catch (error) {
    console.error("Error adding chats:", error);
    return 0;
  }
}

// ---------------------------
// Hàm tiện ích khác
// ---------------------------

/**
 * Ghi log event
 */
function logEvent(analyticsInstance, eventName, eventParams) {
  try {
    if (analyticsInstance && typeof analyticsInstance.logEvent === 'function') {
      analyticsInstance.logEvent(eventName, eventParams);
    } else {
      console.warn("Analytics instance not available");
    }
  } catch (error) {
    console.error("Error logging event:", error);
  }
}

// Export Firebase instances để sử dụng ở nơi khác nếu cần
export const firebaseApp = app;
export const firebaseAnalytics = analytics;
export const firestore = db;

// Xuất một hàm khởi tạo để tái sử dụng trong ứng dụng
export function initializeFirebase() {
  return {
    app,
    analytics,
    db
  };
}
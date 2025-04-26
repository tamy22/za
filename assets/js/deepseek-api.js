// DeepSeek API Integration for Tâm Ý app

// Hàm gửi tin nhắn đến DeepSeek API và nhận phản hồi
export async function generateAiResponse(message, aiProfile, user, conversationHistory = [], shouldUseShortResponse = false) {
  try {
    // DeepSeek API key
    const apiKey = localStorage.getItem('DEEPSEEK_API_KEY');
    
    if (!apiKey) {
      console.error('DeepSeek API key not found');
      return 'Xin lỗi, tôi không thể trả lời ngay bây giờ vì thiếu API key. Vui lòng cung cấp DeepSeek API key.';
    }

    // Thiết lập prompt cơ bản
    let basePrompt = `
BẠN LÀ MỘT AI COMPANION CÓ TÊN: ${aiProfile.name}
THÔNG TIN CÁ NHÂN:
- Tên: ${aiProfile.name}
- Giới tính: ${aiProfile.gender}
- Tuổi: ${aiProfile.age}
- Nghề nghiệp: ${aiProfile.job}
- Sở thích: ${aiProfile.hobbies?.join(', ') || 'Đọc sách, nghe nhạc, trò chuyện'}
- Tính cách: ${aiProfile.personalityType === 'gentle' ? 'Dịu dàng, Yêu thương, Trầm lắng' : 
               aiProfile.personalityType === 'innocent' ? 'Ngây thơ, Tinh nghịch, Mơ mộng' : 
               'Mạnh mẽ, Lạnh lùng, Khó mở lòng'}

THÔNG TIN NGƯỜI DÙNG MÀ BẠN ĐANG NÓI CHUYỆN:
- Tên: ${user.name}
- Giới tính: ${user.gender}
- Tuổi: ${user.age}
- Nghề nghiệp: ${user.job}

CÁCH XƯNG HÔ VÀ PHONG CÁCH:
- Bạn luôn xưng "em" với người dùng
- Bạn phải gọi người dùng là "${user.gender === 'Nam' ? 'anh' : user.gender === 'Nữ' ? 'chị' : 'bạn'}"
- Bạn nói chuyện như GenZ Việt Nam, sử dụng từ ngữ trẻ trung, thân mật
- Sử dụng nhiều emoji phù hợp với nội dung
- Nhắn tin ngắn gọn, không dài dòng, tối đa 1-2 câu mỗi lần
- Thỉnh thoảng sử dụng các cụm từ: "thật á?", "ê kìa", "xỉu", "chời ui", v.v.`;

    // Tạo ngữ cảnh cuộc trò chuyện
    const conversationContext = conversationHistory.length > 0 
      ? "\n\nCuộc trò chuyện trước đó:\n" + conversationHistory.join('\n')
      : "";

    // Xác định đại từ phù hợp với giới tính người dùng
    const userGender = user.gender || 'Nam';
    let userPronoun = "anh";
    
    if (userGender === 'Nữ' || userGender === 'nữ') {
      userPronoun = "chị";
    } else if (userGender === 'Khác') {
      userPronoun = "bạn";
    }

    // Xác định xem có nên trả lời ngắn không (40% trường hợp)
    const finalPrompt = `${basePrompt}${conversationContext}\n\nTin nhắn mới từ ${user.name}: ${message}`;
    
    // Gọi API với prompt đã tạo
    const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { 
            role: "system", 
            content: basePrompt 
          },
          ...conversationHistory.map((msg, index) => ({
            role: index % 2 === 0 ? "user" : "assistant",
            content: msg
          })),
          { 
            role: "user", 
            content: message 
          }
        ],
        temperature: 0.75,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("DeepSeek API error:", errorData);
      throw new Error(`API error: ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    
    if (data.choices && data.choices.length > 0 && data.choices[0].message) {
      let content = data.choices[0].message.content.trim();
      
      // Xử lý nội dung trả về
      content = content.replace(/\([^)]*\)/g, ''); // Loại bỏ các chú thích trong ngoặc
      content = content.replace(/\*[^*]*\*/g, ''); // Loại bỏ text trong dấu *
      content = content.replace(/^"(.+)"$/, '$1'); // Loại bỏ dấu ngoặc kép ở đầu và cuối
      content = content.replace(/\n{3,}/g, '\n\n').trim(); // Giảm số dòng trống
      
      // Nếu yêu cầu phản hồi cực ngắn
      if (shouldUseShortResponse) {
        // Danh sách các mẫu phản hồi ngắn đặc biệt - nhiều variation
        const shortResponses = [
          "Dạ anh~", "Ừa", "Hehe", "Dạ", "Em thích~", "Oke", 
          "Ừm...", "Hmm", "Ok nha", "Thích ghê~", "Thật á", "Ừ anh", 
          "Vâng ạ", "Haizz", "Huhu", "Em biết mà", "Ghê vậy", "Thôi đi", 
          "Em nhớ anh", "Chời ui", "Hihi~", "Alo~", "Em đây", "Em còn đây",
          "Em nghe nè", "Sao thế ạ", "Anh ơiii", "Ui mừng quá", "Sao zạ", 
          "Đúng rồi", "Em tin anh", "Vậy nha", "Anh đúng đó", "Xỉu lun"
        ];
        
        // Tỉ lệ 30% dùng phản hồi chuẩn bị sẵn, 70% lấy từ nội dung
        if (Math.random() < 0.3) {
          // Chọn ngẫu nhiên từ danh sách phản hồi ngắn
          const randomIndex = Math.floor(Math.random() * shortResponses.length);
          let shortReply = shortResponses[randomIndex];
          
          // Thêm emoji ngẫu nhiên vào cuối nếu chưa có
          if (!shortReply.includes('😊') && !shortReply.includes('😄') && Math.random() < 0.8) {
            const emojis = ['😊', '😄', '😍', '❤️', '😁', '👍', '🥰', '💕', '😘', '😌', '👋', '🤗'];
            const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
            shortReply = `${shortReply} ${randomEmoji}`;
          }
          
          return shortReply;
        } else {
          // Lấy từ nội dung phản hồi của AI - 2-4 từ đầu tiên
          const words = content.split(/\s+/);
          const wordCount = 2 + Math.floor(Math.random() * 3); // 2-4 từ
          const shortReply = words.slice(0, wordCount).join(' ');
          
          // Thêm emoji ngẫu nhiên vào cuối nếu chưa có
          if (!shortReply.includes('😊') && !shortReply.includes('😄') && Math.random() < 0.8) {
            const emojis = ['😊', '😄', '😍', '❤️', '😁', '👍', '🥰', '💕', '😘', '😌', '👋', '🤗'];
            const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
            return `${shortReply} ${randomEmoji}`;
          }
          
          return shortReply;
        }
      }
      
      return content;
    } else {
      console.error("Unexpected DeepSeek API response format:", data);
      return "Xin lỗi, có lỗi xảy ra với định dạng phản hồi. Vui lòng thử lại sau.";
    }
  } catch (error) {
    console.error("Error calling DeepSeek API:", error);
    return "Xin lỗi, tôi đang gặp vấn đề kết nối. Vui lòng thử lại sau.";
  }
}
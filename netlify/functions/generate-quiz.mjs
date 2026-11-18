const json = (statusCode, body) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*'
  },
  body: JSON.stringify(body)
});

const normalize = value => String(value || '')
  .toLocaleLowerCase('vi')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, ' ').trim();

function similarity(a, b) {
  const A = new Set(normalize(a).split(/\s+/).filter(x => x.length > 1));
  const B = new Set(normalize(b).split(/\s+/).filter(x => x.length > 1));
  if (!A.size || !B.size) return 0;
  let intersection = 0;
  for (const token of A) if (B.has(token)) intersection++;
  return intersection / (A.size + B.size - intersection);
}

function hasNearDuplicate(quiz, avoid) {
  const fresh = [...quiz.mc.map(q => q.q), ...quiz.short.map(q => q.q)];
  for (let i = 0; i < fresh.length; i++) {
    if (avoid.some(old => similarity(fresh[i], old) >= 0.78)) return true;
    for (let j = 0; j < i; j++) if (similarity(fresh[i], fresh[j]) >= 0.82) return true;
  }
  return false;
}

function extractQuiz(raw) {
  const text = raw?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
  try { return JSON.parse(text); } catch { return null; }
}

function validQuiz(quiz) {
  if (!Array.isArray(quiz?.mc) || quiz.mc.length !== 15 || !Array.isArray(quiz?.short) || quiz.short.length !== 5) return false;
  const mc = quiz.mc.every(q => q && typeof q.q === 'string' && q.q.trim() && Array.isArray(q.opts) && q.opts.length === 4 && q.opts.every(x => typeof x === 'string' && x.trim()) && ['A','B','C','D'].includes(q.ans) && typeof q.exp === 'string' && q.exp.trim());
  const short = quiz.short.every(q => q && typeof q.q === 'string' && q.q.trim() && typeof q.answer === 'string' && q.answer.trim());
  return mc && short;
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }, body: '' };
  if (event.httpMethod !== 'POST') return json(405, { error: 'Phương thức không được hỗ trợ. Hãy tạo đề bằng nút trong website, không mở đường dẫn API trực tiếp.' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return json(503, { error: 'Netlify chưa được cấu hình GEMINI_API_KEY. Hãy kiểm tra Environment variables và deploy lại.' });

  let payload;
  try { payload = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Dữ liệu gửi lên không hợp lệ.' }); }
  const lesson = payload.lesson || {};
  const knowledge = String(lesson.knowledge || '').trim();
  if (!lesson.title || knowledge.length < 100) return json(400, { error: 'Không nhận được nội dung bài học từ Sổ tay kiến thức.' });

  const avoid = Array.isArray(payload.avoidQuestions) ? payload.avoidQuestions.filter(x => typeof x === 'string').slice(-100) : [];
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const makePrompt = (extra = '') => `Bạn là chuyên gia biên soạn đề kiểm tra môn Vật lí 10 theo định hướng phát triển năng lực.

NHIỆM VỤ: Tạo một đề kiểm tra mới cho ${lesson.title}.
Mô tả bài: ${lesson.description || ''}

NGUỒN KIẾN THỨC DUY NHẤT (phải bám sát nội dung này, không tự mở rộng sang bài khác):
${knowledge.slice(0, 18000)}

YÊU CẦU ĐỀ:
A. PHẦN I – 15 CÂU TRẮC NGHIỆM:
- Mỗi câu có đúng 4 phương án A, B, C, D và chỉ một đáp án đúng.
- Phân bố cân đối: khoảng 5 câu nhận biết, 5 câu thông hiểu, 5 câu vận dụng; có câu đọc hiểu dữ kiện/đồ thị nếu bài học có nội dung hỗ trợ.
- Các câu không được hỏi trùng một ý; phương án nhiễu phải hợp lí, không mơ hồ.
- Mỗi câu có giải thích ngắn gọn, nêu căn cứ kiến thức hoặc phép tính.
B. PHẦN II – 5 CÂU TRẢ LỜI NGẮN:
- Ưu tiên bài tập tính toán, giải thích hiện tượng hoặc vận dụng kiến thức vào tình huống thực tế đúng với bài học.
- Dữ kiện phải đầy đủ, thống nhất đơn vị, có thể giải được và có đáp số xác định.
- Mỗi câu phải có lời giải tham khảo theo từng bước: công thức/định luật, thay số, kết quả và đơn vị; câu định tính cần nêu lập luận.
C. CHẤT LƯỢNG VÀ CHỐNG LẶP:
- Tự kiểm tra lại đáp án và phép tính trước khi trả kết quả.
- Không sao chép, không đổi vài con số hoặc chỉ diễn đạt lại các câu trong danh sách cần tránh dưới đây. Hãy thay đổi ngữ cảnh, dữ kiện và cách tư duy nhưng vẫn đúng phạm vi kiến thức.
- Danh sách câu đã xuất hiện gần đây cần tránh: ${JSON.stringify(avoid)}
${extra}

CHỈ trả về JSON hợp lệ, không có markdown hay văn bản ngoài JSON, theo cấu trúc chính xác:
{"mc":[{"q":"Nội dung câu hỏi","opts":["Phương án A","Phương án B","Phương án C","Phương án D"],"ans":"A","exp":"Giải thích đáp án"}],"short":[{"q":"Nội dung câu hỏi","answer":"Lời giải từng bước và đáp số"}]}
Số lượng bắt buộc: mc đúng 15 phần tử; short đúng 5 phần tử.`;

  let lastMessage = 'Gemini API không xử lý được yêu cầu.';
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: makePrompt(attempt ? 'LẦN TẠO LẠI: ưu tiên câu hỏi và tình huống hoàn toàn khác với lần trước.' : '') }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.85, topP: 0.92, maxOutputTokens: 8500 }
        })
      });
      const raw = await upstream.json().catch(() => ({}));
      if (!upstream.ok) {
        lastMessage = raw?.error?.message || `Gemini API trả về mã lỗi ${upstream.status}.`;
        if (upstream.status === 429) return json(429, { error: 'Gemini đã chạm giới hạn lượt gọi hoặc lưu lượng. Hãy chờ hạn mức hồi phục rồi thử lại.' });
        if (upstream.status === 404 || /not found|not supported/i.test(lastMessage)) return json(502, { error: `Không gọi được model ${model}. Hãy kiểm tra model ID và quyền truy cập của API key trong Google AI Studio. Chi tiết: ${lastMessage}` });
        if (![500,502,503,504].includes(upstream.status) || attempt === 2) return json(502, { error: lastMessage });
        await new Promise(resolve => setTimeout(resolve, 600 * (attempt + 1)));
        continue;
      }
      const quiz = extractQuiz(raw);
      if (!validQuiz(quiz)) {
        lastMessage = 'Gemini trả về đề chưa đúng cấu trúc 15 câu trắc nghiệm và 5 câu trả lời ngắn.';
        if (attempt < 2) continue;
        return json(502, { error: lastMessage + ' Vui lòng nhấn tạo đề lại.' });
      }
      if (hasNearDuplicate(quiz, avoid) && attempt < 2) {
        lastMessage = 'Đề mới có câu gần giống đề đã tạo.';
        continue;
      }
      return json(200, { quiz, model, lessonId: lesson.id });
    } catch (error) {
      lastMessage = error?.message || lastMessage;
      if (attempt === 2) return json(502, { error: 'Không kết nối được Gemini API. Vui lòng kiểm tra mạng hoặc thử lại sau.' });
      await new Promise(resolve => setTimeout(resolve, 600 * (attempt + 1)));
    }
  }
  return json(502, { error: lastMessage });
}

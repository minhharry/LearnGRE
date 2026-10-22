# BẢN ĐẶC TẢ YÊU CẦU PHẦN MỀM (SRS)

**HỆ THỐNG LUYỆN THI TỪ VỰNG GRE CẤP TỐC (ZERO-FRICTION DESKTOP-WEB APP)**

---

## 1. Kiến trúc Hệ thống & Triển khai (Architecture & Deployment)

* **Mô hình hoạt động:** 100% Client-side Static Web Application, triển khai trực tiếp trên GitHub Pages (Zero-build pipeline).
* **Công nghệ cốt lõi:**
  * **HTML5:** Semantic HTML, hỗ trợ `aria-*` và điều hướng bàn phím toàn diện (100% Mouseless operation).
  * **CSS3:** Flexbox/CSS Grid, CSS Variables, chuyển cảnh tức thì (`120ms ease-out`) tối ưu phản xạ học tập.
  * **Vanilla JavaScript (ES6+ Modules):** Kiến trúc module hướng sự kiện kết hợp State Machine điều phối phiên học.
* **Môi trường Sinh dữ liệu ngoại tuyến (Offline LLM Data Pipeline):**
  * Script Python được quản lý độc quyền bởi `uv` (`uv run python -m scripts.generate_data`).
  * Kết nối trực tiếp với Local LLM Server (`http://localhost:9931/v1/chat/completions`) áp dụng JSON Schema có streaming checkpoint.

* **Cấu trúc thư mục nguồn:**

```text
├── index.html                  # Giao diện chính (Top bar, Split containers, Modals)
├── data/
│   ├── vocab.jsonl              # 960 từ vựng (32 Groups, 30 từ/Group) dạng JSON Lines
│   └── question_templates.jsonl # Kho câu hỏi ngữ cảnh Text Completion (TC 4 lựa chọn)
├── scripts/
│   ├── config.json             # File cấu hình tham số LLM, số lượng câu hỏi, SRS, session
│   └── generate_data.py        # Pipeline sinh dữ liệu từ wordbank.csv sang vocab.jsonl và question_templates.jsonl
├── css/
│   ├── base.css                # Biến màu, CSS reset, typography, animation
│   ├── layout.css              # Window frame, draggable split-pane, drawer
│   ├── components.css          # Progress bar, option cards, rationales, keycap badges
│   └── responsive.css          # Breakpoints thích ứng đa thiết bị
└── js/
    ├── app.js                  # Entry point, quản lý Group Progression & phím tắt toàn cục
    ├── storage.js              # Quản lý localStorage, Export/Import JSON
    ├── srs.js                  # Cram-Mode SRS 4 cấp độ, Implicit Telemetry
    ├── distractor.js           # Engine lọc distractor cho Flash Recall
    ├── session.js              # Bộ sinh câu hỏi phiên học linh hoạt (Adaptive Session Generator) & Redemption Loop
    └── ui.js                   # Render DOM tức thời, Zero-click evaluation, visual feedback
```

---

## 2. Đặc tả Giao diện & Trải nghiệm Người dùng (Zero-Friction UI/UX)

### 2.1. Thẩm mỹ Thiết kế (Desktop Minimalist Aesthetic)

* **Bảng màu:**
  * **Nền chính:** Trắng sáng `#ffffff` và nền phụ `#f8fafc`.
  * **Đường viền:** Xám nhạt `#e5e7eb` (`1px solid`).
  * **Typography:** Tiêu đề `#0f172a`, nội dung câu hỏi `#1e293b` (`font-size: 18px`, `line-height: 1.6`), nhãn phụ `#64748b`.
  * **Phản hồi tức thì (Instant Feedback):**
    * **Đúng (Success):** Nền `#ecfdf5`, viền `#10b981`, chữ `#065f46`.
    * **Sai (Error):** Nền `#fef2f2`, viền `#ef4444`, chữ `#991b1b`.
  * **Accent Color:** Xanh dương `#3b82f6` (chuyển Cam `#f97316` khi đạt Streak >= 5).
* **Thanh tiến độ phiên học:** Segmented Progress Bar hiển thị trực quan các câu trong phiên kèm bộ đếm Streak.

### 2.2. Cơ chế Tương tác Tức thời (Auto-Submit & Zero-Click Submit)

Loại bỏ toàn bộ các nút bấm xác nhận rườm rà ("Submit", "Chắc chắn", "Đoán"). Thao tác lựa chọn kích hoạt chấm điểm ngay lập tức:

| Loại câu hỏi | Cơ chế Tương tác & Chấm điểm Tự động | Hành động Chuyển câu |
| --- | --- | --- |
| **1. Speed Match** (Ghép 4 cặp từ - nghĩa) | Nhấp chuột hoặc bấm phím: Cho phép chọn 2 chiều (Từ vựng -> Nghĩa HOẶC Nghĩa -> Từ vựng). Phím `1-4` chọn Từ vựng, `Q, W, E, R` chọn Nghĩa. Đúng: Cặp thẻ mờ đi (`opacity: 0.2`). Sai: Nháy đỏ `200ms` và hủy chọn. | Hoàn tất 4 cặp: Tự động chuyển câu tiếp theo sau `350ms`. |
| **2. Flash Recall** (Trắc nghiệm nghĩa nhanh, 4 lựa chọn) | Hiển thị 1 từ vựng (hoặc định nghĩa) cùng 4 phương án. **Bấm chọn 1 đáp án là chấm điểm ngay lập tức.** | Đúng: Tự động chuyển tiếp sau `500ms`. Sai: Dừng lại hiện định nghĩa, bấm `Space/Enter` để tiếp tục. |
| **3. Text Completion (TC)** (1 chỗ trống, 4 lựa chọn) | **Single-Action Trigger:** Click chuột hoặc bấm phím `1-4`, hệ thống khóa đáp án, chấm điểm, điền từ vào chỗ trống và hiển thị rationale phân tích ngữ cảnh. | Bấm `Space`, `Enter` hoặc click nút "Tiếp tục". |

### 2.3. Hệ thống Phím tắt Thống nhất (Unified Mouseless Workflow)

Tất cả các dạng trắc nghiệm đơn đều chuẩn hóa về dãy phím `1-4`:

| Phím tắt | Chức năng trong Phiên học |
| --- | --- |
| **`1` - `4`** | Chọn phương án tương ứng trong câu **Flash Recall** (chấm điểm tức thì). |
| **`1` - `4`** | Chọn phương án tương ứng trong câu **Text Completion (TC)** (chấm điểm tức thì). |
| **`1` - `4`** & **`Q, W, E, R`** | Trong câu **Speed Match**: Phím `1-4` chọn cột Từ vựng bên trái; phím `Q, W, E, R` chọn cột Định nghĩa bên phải (cho phép chọn linh hoạt 2 chiều). |
| **`P`** | Phát âm từ vựng hiện tại (Text-to-Speech qua Web Speech API native của trình duyệt). |
| **`Space`** hoặc **`Enter`** | Chuyển sang câu hỏi tiếp theo sau khi bảng giải thích/kết quả đã hiển thị. |
| **`S`** | Gắn cờ hoặc bỏ cờ từ vựng vào Sổ tay câu sai (Error Notebook). |
| **`Esc`** | Tạm dừng phiên học hoặc đóng hộp thoại Modal. |

### 2.4. Khả năng thích ứng Đa màn hình (Responsive Design)

* **Desktop (>= 1024px):** Giao diện 2 cột dạng Split-Pane có thể kéo giãn chiều rộng. Cột trái hiển thị danh sách 32 Group và tiến độ Mastery; cột phải là không gian thực hành.
* **Tablet (768px - 1023px):** Cột trái thu gọn vào Collapsible Drawer.
* **Mobile (< 768px):** Giao diện 1 cột tối ưu cho cảm ứng, chiều cao nút lựa chọn tối thiểu `52px`. Nút "Tiếp tục" dạng full-width cố định sát đáy màn hình khi hiển thị giải thích.

---

## 3. Cấu trúc Dữ liệu & Lưu trữ (Data Specifications)

### 3.1. Lược đồ Từ vựng (`data/vocab.jsonl`)

Mỗi dòng trong `data/vocab.jsonl` là một đối tượng JSON biểu diễn một mục từ vựng hoàn chỉnh:

```json
{"id": "g1_w01", "word": "abound", "group": 1, "pos": "verb", "forms": {"noun": ["abundance"], "verb": ["abound"], "adj": ["abundant"], "adv": ["abundantly"]}, "definitions": ["be present in large quantities"], "vi_gloss": "nhiều, tràn ngập, phong phú", "synonyms": ["proliferate", "teem", "flourish"], "antonyms": ["dwindle", "lack", "wane"]}
{"id": "g1_w02", "word": "amorphous", "group": 1, "pos": "adj", "forms": {"noun": ["amorphousness"], "verb": [], "adj": ["amorphous"], "adv": ["amorphously"]}, "definitions": ["lacking structure; unclear"], "vi_gloss": "vô định hình, không rõ cấu trúc", "synonyms": ["shapeless", "unstructured", "vague"], "antonyms": ["structured", "defined", "distinct"]}
```

### 3.2. Lược đồ Kho Câu hỏi Text Completion (`data/question_templates.jsonl`)

Mỗi dòng là một câu hỏi học thuật Text Completion hoàn chỉnh (1 chỗ trống `[BLANK]`, đúng 4 lựa chọn gồm 1 đáp án đúng và 3 distractors sinh sẵn kèm rationale):

```json
{"id": "q_abound_tc01", "target_id": "g1_w01", "type": "TC", "domain": "Natural Sciences", "sentence": "Although early expeditions reported the island to be barren, subsequent ecological surveys revealed that wildlife and rare flora [BLANK] in its secluded interior valleys.", "pos_required": "verb", "form_required": "base", "clue": "wildlife and rare flora ... secluded interior valleys", "correct_answer": "abound", "distractors": ["belie", "flout", "placate"], "rationale": "Liên từ tương phản 'Although' đối lập tính chất cằn cỗi ('barren') với thực tế hệ sinh thái trù phú. 'Abound' (có rất nhiều) là động từ phù hợp duy nhất miêu tả sự phong phú của hệ động thực vật."}
{"id": "q_amorphous_tc01", "target_id": "g1_w02", "type": "TC", "domain": "Social Sciences", "sentence": "Because the nascent organization operated without formal bylaws, its leadership structure remained entirely [BLANK], resulting in overlapping responsibilities.", "pos_required": "adj", "form_required": "base", "clue": "operated without formal bylaws ... overlapping responsibilities", "correct_answer": "amorphous", "distractors": ["austere", "didactic", "homogeneous"], "rationale": "Cụm 'without formal bylaws' chỉ việc thiếu cấu trúc quy chuẩn, dẫn tới bộ máy lãnh đạo 'amorphous' (vô định hình, không rõ ràng)."}
```

### 3.3. Lược đồ Lưu trữ Trình duyệt (`localStorage` – Key: `GRE_PROGRESS_DATA_V4`)

Đơn giản hóa lược đồ theo dõi tiến độ, loại bỏ mảng `formats_cleared` để tập trung vào số lần đúng liên tiếp và phản xạ:

```json
{
  "version": "4.0",
  "last_backup": "2026-10-22T06:00:00Z",
  "progression": {
    "current_group": 1,
    "unlocked_groups": [1],
    "daily_streak": 4
  },
  "ui_prefs": {
    "sidebar_width": 340
  },
  "words": {
    "g1_w01": {
      "level": 3,
      "status": "reviewing",
      "next_review": "2026-10-23T18:00:00Z",
      "avg_response_ms": 3200,
      "consecutive_correct": 4,
      "mistake_count": 0,
      "flagged_error": false
    },
    "g1_w02": {
      "level": 1,
      "status": "learning",
      "next_review": "2026-10-22T17:30:00Z",
      "avg_response_ms": 7500,
      "consecutive_correct": 1,
      "mistake_count": 1,
      "flagged_error": true
    }
  }
}
```

---

## 4. Hệ thống Đánh giá Sự thông thuộc & Nhận diện Đoán mò (Implicit Telemetry)

### 4.1. Phân tích Tốc độ Phản hồi (Behavioral Telemetry)

Hệ thống đo thời gian thực tế từ khi câu hỏi hiển thị đến khi người dùng chốt đáp án ($\Delta t$):

* **Thời gian kỳ vọng ($T_{\text{expected}}$):**
  * Câu **Flash Recall**: $T_{\text{expected}} = 3.0\text{s}$.
  * Câu **Text Completion (TC)**: $T_{\text{expected}} = 3.5\text{s} + (\text{Số từ của câu} \times 0.18\text{s})$.

* **Phân loại trạng thái phản xạ (Khi trả lời ĐÚNG):**
  1. **Fluent Recall (Nhuần nhuyễn):** $\Delta t \le 1.8 \times T_{\text{expected}}$.
  2. **Hesitant Recall (Ngập ngừng / Nghi ngờ đoán mò):** $\Delta t > 1.8 \times T_{\text{expected}}$.
  3. **Blind Tap (Bấm bừa không đọc đề):** $\Delta t < 1.2\text{s}$ ở câu TC dài (chỉ xét ở lần đầu gặp câu hỏi).

### 4.2. Quy tắc Đánh giá Thành thạo Đơn giản hóa (Streamlined Mastery Rule)

* Loại bỏ hoàn toàn ràng buộc `formats_cleared`.
* **Điều kiện đạt Level 4 (Mastered):**
  1. Đạt tối thiểu số lần trả lời đúng liên tiếp quy định trong cấu hình (`consecutive_correct >= 3`).
  2. Lần trả lời gần nhất phải đạt chuẩn **Fluent Recall** (phản xạ nhanh, không ngập ngừng).
* **Giới hạn thăng cấp 1 Level/Phiên (Per-Session Level Cap):** Trong phạm vi một phiên học, mỗi từ vựng chỉ được tăng tối đa 1 bậc Level để duy trì tính kỷ luật của Spaced Repetition.

### 4.3. Phản ứng Xử lý Ngầm của Hệ thống

* **Đúng + Fluent Recall:** Tăng `consecutive_correct`, tăng Level SRS (nếu chưa chạm mốc trần phiên), cập nhật `next_review`.
* **Đúng + Hesitant Recall (hoặc Blind Tap):** Giao diện vẫn hiển thị màu Xanh (Đúng), nhưng giữ nguyên Level hiện tại, không tăng bậc SRS và đưa từ này vào hàng đợi kiểm tra lại ở cuối phiên.
* **Sai (Incorrect):** Giáng cấp SRS theo bảng Leitner, tăng `mistake_count`, reset `consecutive_correct = 0`, đẩy từ vào **Redemption Loop** với câu hỏi TC khác hoặc Flash Recall.

---

## 5. Lộ trình Học theo Group & Cấu trúc Phiên học Linh hoạt (Adaptive Session)

### 5.1. Cơ chế Học theo Group & Chế độ Luyện tập Linh hoạt

* Kho từ 960 từ được chia thành **32 Groups** (chuẩn hóa chính xác 30 từ/Group từ `wordbank.csv`).
* **Hai chế độ điều hướng Group linh hoạt:**
  * **Chế độ Lộ trình Chuẩn (Guided Mastery Mode - Mặc định):** Bắt đầu tuần tự từ `Group 1`. Tự động mở khóa `Group N + 1` khi **>= 85% số từ trong Group hiện tại đạt từ Level 3 trở lên** và không còn từ nào ở Level 0.
  * **Chế độ Cấp tốc / Tự do (Cram Override / Diagnostic Mode):** Cho phép người học chuẩn bị thi gấp trong thời gian ngắn có thể chủ động chọn bất kỳ Group nào để luyện tập ngay lập tức mà không bị khóa cứng, đồng thời dữ liệu SRS vẫn được ghi nhận độc lập theo từng từ.

### 5.2. Cấu trúc Phiên học Linh hoạt (Adaptive Session Generator)

Không áp đặt 4 nhịp sóng cứng nhắc. Thuật toán phân bổ câu hỏi linh hoạt dựa trên danh sách từ cần ôn tập và học mới:

1. **Phân bổ Nhóm từ Mục tiêu cho mỗi Phiên:**
   * **Review Pool (Ưu tiên cao):** Các từ đến hạn ôn tập (`next_review <= Now`) hoặc đang bị gắn cờ trong `Error Notebook`.
   * **Active Learning Pool:** Các từ đang ở Level 1 hoặc Level 2 thuộc Group hiện tại.
   * **New Words Pool:** Các từ mới tinh (Level 0) thuộc Group hiện tại.
2. **Cơ chế Điều phối Dạng câu hỏi:**
   * **Làm nóng (Warm-up):** Bắt đầu bằng 1 bài Speed Match (ghép 4 cặp) hoặc 2 câu Flash Recall để kích hoạt trí nhớ nhanh với các từ mới nạp.
   * **Trọng tâm (Core):** Đan xen linh hoạt giữa Text Completion (đọc hiểu ngữ cảnh sâu) và Flash Recall (phản xạ từ - nghĩa).
   * **Vòng lặp Gỡ lỗi (Redemption Loop):** Xuất hiện ở cuối phiên nếu có câu trả lời sai. Hệ thống chọn một biến thể câu hỏi TC mới hoặc bài tập recall để người học sửa sai ngay lập tức trước khi hoàn tất phiên.
3. **Màn hình Tổng kết Phiên (Session Summary):**
   * Hiển thị tỷ lệ chính xác (%), tốc độ phản hồi trung bình, số từ đã thăng cấp và tiến độ mở khóa Group.

### 5.3. Chiến lược Distractor Chuẩn hóa cho Text Completion (4 Lựa chọn)

* **Nguyên tắc cốt lõi: Phân tách Trách nhiệm (Separation of Concerns):**
  * **Local LLM 35B:** Đảm nhiệm duy nhất việc sáng tác câu ngữ cảnh học thuật tự nhiên, trích xuất manh mối (`clue`), vị trí `[BLANK]`, từ loại (`pos_required`), hình thái (`form_required`) và giải thích lý do từ đúng (`rationale`). LLM hoàn toàn không phải chọn distractor từ danh sách ràng buộc phức tạp, giúp tránh quá tải ngữ cảnh, loại bỏ nguy cơ hallucination và đảm bảo tốc độ sinh nhanh khi tắt `thinking`.
  * **Engine lọc Python (`scripts/generate_data.py`):** Đảm nhiệm thuật toán chọn và gán 3 distractors theo các ràng buộc sư phạm và thuật toán kiểm tra nghiêm ngặt.

* **Ràng buộc Nguồn Distractor theo Nhóm (Curriculum-Constrained Distractor Pool):**
  * Toàn bộ 3 distractor **bắt buộc phải thuộc kho 960 từ** trong `wordbank.csv` hoặc danh mục `academic_fallback_words`.
  * **Ưu tiên 1 (Nội nhóm - Intra-Group):** Bốc từ các từ trong CÙNG Group với từ mục tiêu có cùng `pos_required`. Đảm bảo cả 4 lựa chọn đều có mức độ quen thuộc ngang nhau trong phiên học, triệt tiêu hoàn toàn mẹo đoán mò nhận diện mặt chữ (Familiarity Bias / "3 lạ 1 quen").
  * **Ưu tiên 2 (Lũy tiến - Cumulative Prior-Groups):** Nếu Group hiện tại không đủ số từ cùng từ loại, lấy bổ sung từ các Group đã mở khóa trước đó (`Group < N`).
  * **Ưu tiên 3 (Dự phòng Cốt lõi - Academic Core Fallback):** Khi Group hiện tại và các Group trước không đủ từ cùng từ loại (ví dụ: Group 1 chỉ có 3 danh từ gồm *misnomer, proclivity, spendthrift*), tự động bổ sung distractor từ danh mục tĩnh ~25 từ học thuật thông dụng chuẩn GRE được cấu hình trong `scripts/config.json` (ví dụ: *paradox, controversy, hypothesis, dilemma, catalyst, dichotomy*...), tuyệt đối không bốc từ các Group chưa học (`Group > N`).

* **Thuật toán Chống Trùng Nghĩa Tuyệt đối & Chuẩn hóa Ngữ pháp:**
  Để ngăn ngừa tuyệt đối nguy cơ câu hỏi có 2 đáp án đúng hoặc lệch cấu trúc ngữ pháp:
  1. **Đồ thị Đồng nghĩa Hai chiều (Bidirectional Synonym Graph):**
     * Xây dựng đồ thị liên thông từ mảng `synonyms` trong `vocab.jsonl`. Nếu $A \in \text{synonyms}(B)$ hoặc $B \in \text{synonyms}(A)$, $A$ và $B$ thuộc cùng một cụm đồng nghĩa.
     * Mọi từ thuộc cùng cụm liên thông đồng nghĩa với từ mục tiêu bị **loại trừ 100%** khỏi danh sách ứng viên distractor.
  2. **Ràng buộc Hình thái Ngữ pháp Song song (Grammatical Parallelism):**
     * Prompt sinh câu Text Completion của LLM bắt buộc ngữ cảnh tại vị trí `[BLANK]` phải nhận dạng nguyên mẫu (`form_required: "base"`) của từ mục tiêu (ví dụ: sau *to-infinitive*, *modal verb*, hoặc vị ngữ của chủ ngữ số nhiều). Điều này đảm bảo từ đúng và 3 distractor dạng nguyên mẫu đều hoàn toàn song song và tương thích ngữ pháp khi thế vào câu.
  3. **Loại trừ Biến thể Từ vựng (Lemma & Family Forms Exclusion):**
     * Toàn bộ các hình thái chia từ trong trường `forms` của từ mục tiêu (noun, verb, adj, adv) đều bị loại bỏ, tránh việc từ đúng là `abound` mà distractor là `abundant`.
  4. **Ưu tiên Từ Đối nghĩa (Antonym / Polarity Inversion Preference):**
     * Thuật toán ưu tiên bốc tối thiểu 1 từ trong mảng `antonyms` của từ đúng (nếu có từ cùng từ loại trong nhóm) làm distractor. Đây là bẫy tư duy kinh điển của bài thi GRE (thử thách người học nhận diện từ đảo nghĩa như *although, despite, however*), đồng thời đảm bảo 100% không bao giờ bị trùng nét nghĩa với đáp án đúng.
  5. **Kiểm tra Giao thoa Từ khóa Định nghĩa (Definition Keyword Overlap Filter with Stopwords):**
     * Hệ thống loại trừ danh sách stopwords học thuật thông dụng (ví dụ: *lacking, without, person, quality, state, feeling, make, cause, having, tendency, related*) trước khi so sánh từ khóa trong `definitions` và `vi_gloss`. Sau khi loại stopwords, nếu xuất hiện giao thoa từ khóa cốt lõi, từ đó bị loại khỏi ứng viên distractor.

* **Cơ chế Hiển thị Rationale Tích hợp (Hybrid Rationale Display):**
  * Khi người học hoàn thành câu hỏi, giao diện hiển thị:
    * **Phân tích Ngữ cảnh:** Đoạn văn giải thích mối liên kết giữa `clue` và từ đúng (do LLM viết).
    * **Bảng tra cứu Nghĩa 4 Lựa chọn:** Tự động hiển thị `vi_gloss` và định nghĩa ngắn của cả 4 từ được tra cứu tức thì từ `vocab.jsonl` (không cần LLM phải giải thích dài dòng cho từng distractor sai).
* Phía client thực hiện xáo trộn ngẫu nhiên 4 lựa chọn (Fisher-Yates) và ánh xạ cố định vào các phím số `1`, `2`, `3`, `4`.

---

## 6. Thuật toán Lặp lại Ngắt quãng (Cram-Mode SRS) & Sổ tay Câu sai

### 6.1. Bảng Trạng thái Leitner 4 Cấp độ

Tối ưu cho việc học cấp tốc với chu kỳ tính theo Giờ ở cấp độ đầu:

| Cấp độ (Level) | Trạng thái (`status`) | Chu kỳ Ôn tập (`next_review`) | Điều kiện Thăng hạng (Trong phiên học) | Điều kiện Giữ nguyên / Giáng hạng |
| --- | --- | --- | --- | --- |
| **Level 0** | Chưa học (`unseen`) | — | Trả lời Đúng lần đầu tiên -> **Lên Level 1** | Trả lời Sai -> **Vào Level 1** (`mistake_count = 1`) |
| **Level 1** | Mới nạp / Đang yếu (`learning`) | **4 giờ** *(Ôn lại trong ngày)* | Đúng + *Fluent Recall* -> **Lên Level 2** | • Đúng nhưng *Hesitant* -> Giữ Level 1 (4 giờ)<br>• Sai -> Giữ Level 1 (Reset về **1 giờ**) |
| **Level 2** | Đang củng cố (`learning`) | **24 giờ (1 ngày)** | Đúng + *Fluent Recall* -> **Lên Level 3** | • Đúng nhưng *Hesitant* -> Giữ Level 2 (24 giờ)<br>• Sai -> **Giáng về Level 1** (4 giờ) |
| **Level 3** | Nắm vững (`reviewing`) | **3 ngày** | Đúng + *Fluent Recall* + đạt chỉ tiêu `consecutive_correct` -> **Lên Level 4** | • Đúng nhưng *Hesitant* -> Giữ Level 3 (3 ngày)<br>• Sai -> **Giáng về Level 1** (4 giờ) |
| **Level 4** | Thành thạo (`mastered`) | **7 ngày** *(Duy trì trước kỳ thi)* | Đúng + *Fluent Recall* -> Gia hạn Level 4 (+10 ngày) | • Đúng nhưng *Hesitant* -> Giữ nguyên Level 4 (giữ chu kỳ hiện tại)<br>• Sai -> **Giáng về Level 2** (1 ngày) |

### 6.2. Quy tắc Sổ tay Câu sai Tự động (Error Notebook)

Từ vựng được tự động gắn cờ `flagged_error: true` khi:
1. **Sai Tốc độ cao (False Confidence):** Chọn sai ở câu TC nhưng thời gian chọn rất nhanh ($\Delta t \le 3.5\text{s}$), báo hiệu việc nhớ nhầm mặt chữ.
2. **Sai Lặp lại:** Có `mistake_count >= 2` hoặc từ đang ở Level 3, 4 bị trả lời sai.
3. **Thao tác Thủ công:** Người dùng bấm phím `S` trên bàn phím.
* **Tự động Bỏ cờ (Auto-Unflag):** Khi từ đạt `consecutive_correct >= 3` ở trạng thái *Fluent Recall*, cờ lỗi tự động được gỡ bỏ.

---

## 7. An toàn Dữ liệu & Lưu trữ (Data Persistence & Backup)

1. **Auto-Save từng Câu hỏi (Per-Question Checkpoint):** Lưu tiến độ vào `localStorage` ngay khi kết thúc mỗi câu hỏi, không lo mất dữ liệu khi đóng tab bất ngờ.
2. **Nhắc nhở Sao lưu Định kỳ (Backup Reminder):** Cảnh báo sao lưu sau mỗi 3 ngày (`last_backup > 3 ngày`) bằng huy hiệu trên thanh điều hướng.
3. **Quản lý Cấu hình Tập trung (`scripts/config.json`):** Mọi tham số vận hành (số câu hỏi TC cần sinh mỗi từ, kích thước phiên học, ngưỡng SRS) được lưu trong file cấu hình, không hardcode trong mã nguồn.

---

## 8. Quy trình Sinh Dữ liệu Ngoại tuyến bằng Local LLM (Offline Data Generation Pipeline)

### 8.1. Kiến trúc Pipeline & Cấu hình Tập trung

* **Môi trường Python:** Chạy độc quyền với `uv` (`uv run python -m scripts.generate_data`).
* **Kết nối Local LLM:** Endpoint `http://localhost:9931/v1/chat/completions` (OpenAI-compatible).
* **Tùy chọn sinh văn bản:** Áp dụng `response_format` kiểu `json_schema`, tắt suy nghĩ (`"chat_template_kwargs": { "enable_thinking": false }`) để đạt tốc độ tối đa trên local model 35B.
* **File cấu hình (`scripts/config.json`):**
  * Lưu trữ linh hoạt: `api_url`, `model_name`, `timeout_seconds`, `max_retries`, `tc_questions_per_word`, `temperature`, `academic_fallback_words`, `definition_stopwords`.
* **Xử lý `wordbank.csv`:**
  * Mở file với encoding `utf-8-sig` (xử lý triệt để UTF-8 BOM `\xef\xbb\xbf`).
  * Chuẩn hóa ký tự khoảng trắng không ngắt (`\xa0`) thành khoảng trắng thường.
  * Parser nhận diện dòng header nhóm (`Group N,`), tự động gom các dòng định nghĩa đa dòng (dòng tiếp theo bắt đầu bằng `,2.`, `,3.`) thành một bản ghi hoàn chỉnh cho mỗi từ trước khi chuyển sang pipeline.

### 8.2. Quy trình Thực thi Pipeline 3 Bước & Chiến lược Triển khai

Pipeline sinh dữ liệu ngoại tuyến phân tách rõ ràng vai trò và phụ thuộc thứ tự:

1. **Bước 1 – Sinh Chuẩn hóa Toàn bộ Từ vựng (`data/vocab.jsonl`):**
   * LLM nhận thông tin từ vựng và định nghĩa gốc từ `wordbank.csv` cho tất cả 960 từ (32 Groups).
   * LLM chuẩn hóa và sinh: `pos`, họ từ `forms` (noun, verb, adj, adv), định nghĩa chuẩn, `vi_gloss` súc tích, danh sách `synonyms` và `antonyms`.
   * Áp dụng cơ chế checkpoint theo `id` (`g{group}_w{index}`): Nếu bản ghi đã tồn tại trong `vocab.jsonl`, tự động bỏ qua để cho phép tiếp tục chạy (resume) mà không gọi lại LLM.
2. **Bước 2 – Sinh Ngữ cảnh Text Completion (LLM Context Authoring):**
   * LLM chỉ nhận từ mục tiêu và định nghĩa, sinh câu học thuật tự nhiên có chứa `[BLANK]` (vị trí nhận `base form`), trích xuất `clue`, `pos_required`, `form_required: "base"` và `rationale` giải thích từ đúng.
   * LLM hoàn toàn không phải chọn distractor, đảm bảo không quá tải ngữ cảnh và không bị lỗi định dạng.
   * Áp dụng cơ chế checkpoint theo `target_id`.
3. **Bước 3 – Gán Distractor & Kiểm định Toàn vẹn Tự động (Python Engine & Integrity Assertion):**
   * Python nạp toàn bộ `data/vocab.jsonl` đã hoàn tất ở Bước 1 để xây dựng **Bidirectional Synonym Graph** và bảng tra cứu từ loại toàn diện.
   * Python tự động chọn 3 distractors theo thứ tự ưu tiên: Cùng Group (Intra-Group) $\rightarrow$ Các Group trước $\rightarrow$ Academic Core Fallback (`scripts/config.json`).
   * **Bộ lọc loại trừ nghiêm ngặt:** Loại bỏ toàn bộ từ trong cùng cụm liên thông đồng nghĩa, cùng họ từ (`forms`) với từ đúng, và giao thoa từ khóa cốt lõi (sau khi lọc stopwords).
   * **Kiểm định Toàn vẹn (Automated Integrity Assertion):** Script tự động quét 100% câu hỏi trước khi ghi ra `data/question_templates.jsonl`:
     * Khẳng định không có distractor nào chia sẻ nhánh đồng nghĩa với từ đúng.
     * Khẳng định đúng 4 lựa chọn duy nhất không trùng lặp và cùng từ loại.
     * Báo lỗi và dừng ngay lập tức nếu phát hiện bất kỳ câu hỏi nào có khả năng xuất hiện 2 đáp án đúng.

* **Chiến lược Triển khai 2 Giai đoạn:**
  * **Giai đoạn 1 – Pilot Validation (Thử nghiệm Hoàn chỉnh Group 1):** Chạy và kiểm thử trực quan trên web với 30 từ của Group 1.
  * **Giai đoạn 2 – Batch Production (Tự động hóa 31 Groups còn lại):** Chạy hàng loạt với cơ chế ghi lũy tiến (append-only JSONL streaming checkpoint) và thanh tiến trình `tqdm`.
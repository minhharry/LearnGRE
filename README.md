# LearnGRE - Hệ thống Luyện thi Từ vựng GRE Cấp tốc

Hệ thống web học từ vựng GRE dựa trên đặc tả SRS (`SPEC.md`) với Pipeline sinh dữ liệu từ Local LLM.

## 1. Tổng quan Pipeline Sinh Dữ liệu Ngoại tuyến

Pipeline sinh dữ liệu (`scripts/generate_data.py`) đọc kho 960 từ vựng từ `wordbank.csv`, kết nối Local LLM (OpenAI-compatible tại `http://localhost:9931/v1/chat/completions`) và thực thi qua 3 bước:

1. **Bước 1 - Chuẩn hóa Từ vựng (`data/vocab.jsonl`):**
* Gọi Local LLM với JSON Schema để trích xuất từ loại (`pos`), họ từ (`forms`), định nghĩa học thuật chuẩn, nghĩa tiếng Việt (`vi_gloss`), đồng nghĩa (`synonyms`) và trái nghĩa (`antonyms`).
* Áp dụng cơ chế lưu vết (checkpoint) theo khóa `id` (`g{group}_w{index}`). Nếu bản ghi đã tồn tại trong `vocab.jsonl`, hệ thống tự động bỏ qua để resume tức thì.


2. **Bước 2 - Sáng tác Câu ngữ cảnh Text Completion:**
* Local LLM sáng tác câu học thuật tự nhiên chứa `[BLANK]`, đảm bảo vị trí `[BLANK]` nhận dạng nguyên mẫu (`form_required: "base"`), xác định manh mối (`clue`), lĩnh vực học thuật (`domain`) và giải thích lý do (`rationale`).
* LLM không cần phải chọn distractor, tránh hallucination và quá tải ngữ cảnh.


3. **Bước 3 - Động cơ Phân bổ Distractor & Kiểm định Toàn vẹn (Python Engine):**
* Xây dựng đồ thị đồng nghĩa hai chiều (Bidirectional Synonym Graph) để loại bỏ 100% từ thuộc cụm đồng nghĩa với từ đúng.
* Phân bổ 3 distractors theo cấp độ ưu tiên sư phạm:
* Ưu tiên 1: Nội nhóm (Intra-Group, cùng nhóm và cùng từ loại).
* Ưu tiên 2: Lũy tiến từ các nhóm đã học trước (`group < current_group`). Tuyệt đối không lấy từ các nhóm chưa mở khóa.
* Ưu tiên 3: Danh mục dự phòng cốt lõi (`academic_fallback_words` trong `scripts/config.json`).


* Ưu tiên chọn từ đối nghĩa (`antonyms`) làm distractor để tạo bẫy logic đặc trưng của đề GRE.
* Bộ lọc từ khóa định nghĩa loại bỏ từ gây nhầm lẫn sau khi loại stopwords.
* Tự động quét 100% câu hỏi (`Automated Integrity Assertion`) để xác nhận không có distractor trùng đáp án hoặc chia sẻ cụm đồng nghĩa.



## 2. Cấu trúc Thư mục

```text
├── data/
│   ├── vocab.jsonl              # Danh sách từ vựng chuẩn hóa dạng JSON Lines
│   └── question_templates.jsonl # Kho câu hỏi ngữ cảnh Text Completion (4 lựa chọn)
├── scripts/
│   ├── __init__.py
│   ├── config.json             # Cấu hình tập trung: endpoint LLM, fallback words, stopwords, SRS
│   └── generate_data.py        # Script pipeline sinh dữ liệu
├── wordbank.csv                # 960 từ vựng GRE gốc (32 groups x 30 từ)
├── pyproject.toml
└── SPEC.md                     # Bản đặc tả yêu cầu phần mềm chi tiết

```

## 3. Hướng dẫn Thực thi

Mỗi lệnh được chạy thông qua `uv` theo chuẩn quy định:

### Chạy thử nghiệm Pilot (Group 1 - 30 từ):

```bash
uv run python -m scripts.generate_data --group 1

```

### Chạy thử nhanh một vài từ (ví dụ 2 từ):

```bash
uv run python -m scripts.generate_data --group 1 --limit 2

```

### Chạy hàng loạt toàn bộ 32 Groups (Giai đoạn 2 Batch Production):

```bash
uv run python -m scripts.generate_data --group all

```

### Chỉ chạy Bước 1 (Chuẩn hóa từ vựng):

```bash
uv run python -m scripts.generate_data --step 1 --group 1

```

### Chỉ chạy Bước 2 & 3 (Sinh câu hỏi TC và gán distractor):

```bash
uv run python -m scripts.generate_data --step 2 --group 1

```

### Ghi đè dữ liệu đã có (Force overwrite):

```bash
uv run python -m scripts.generate_data --group 1 --force

```

### Chỉ chạy kiểm tra toàn vẹn dữ liệu (Integrity assertion):

```bash
uv run python -m scripts.generate_data --verify

```

## 4. Cấu hình Tập trung (`scripts/config.json`)

Mỗi tham số được quản lý tập trung, không hardcode trong code:

* `llm`: URL endpoint (`http://localhost:9931/v1/chat/completions`), timeout, retry count, temperature.
* `generation`: Số câu hỏi mỗi từ (`tc_questions_per_word`), danh sách academic domains.
* `distractors`: Danh sách từ dự phòng `academic_fallback_words` chia theo từ loại, và `definition_stopwords`.
* `srs`: Chu kỳ ôn tập theo giờ, ngưỡng độ tốc độ và mastery.
* `paths`: Đường dẫn tới file CSV và các file JSONL.
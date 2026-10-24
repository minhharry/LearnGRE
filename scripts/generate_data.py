#!/usr/bin/env python3
"""
Offline Data Generation Pipeline for GRE Vocabulary Learning Application.
Connects to Local LLM (OpenAI-compatible endpoint) with structured JSON Schema output,
streaming JSONL checkpointing, and pedagogical distractor selection with integrity assertion.
"""

import argparse
import csv
import json
import re
import sys
import time
from collections import Counter, defaultdict, deque
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
import threading
from typing import Dict, List, Optional, Set, Tuple

import httpx
from nltk.corpus import wordnet as wn
from nltk.stem import WordNetLemmatizer
from tqdm import tqdm
from word_forms.word_forms import get_word_forms


def configure_terminal_encoding() -> None:
    """Ensure standard output and error streams use UTF-8 encoding on Windows."""
    if sys.stdout and hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if sys.stderr and hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8")


def load_runtime_configuration(configuration_file_path: Path) -> dict:
    """Load and parse the central runtime configuration JSON file."""
    if not configuration_file_path.is_file():
        raise FileNotFoundError(
            f"Configuration file not found at: {configuration_file_path}"
        )
    with open(configuration_file_path, mode="r", encoding="utf-8") as file_handle:
        return json.load(file_handle)


def parse_wordbank_csv(wordbank_csv_path: Path) -> Dict[int, List[Tuple[str, str]]]:
    """
    Parse wordbank.csv with UTF-8 BOM awareness and multi-line definition handling.
    Returns a mapping of group number to list of tuples: (word, raw_definition).
    """
    if not wordbank_csv_path.is_file():
        raise FileNotFoundError(
            f"Wordbank CSV file not found at: {wordbank_csv_path}"
        )

    with open(wordbank_csv_path, mode="r", encoding="utf-8-sig") as file_handle:
        raw_lines = file_handle.readlines()

    groups_dictionary: Dict[int, List[Tuple[str, str]]] = defaultdict(list)
    current_group_number: Optional[int] = None
    current_word: Optional[str] = None
    current_definition_segments: List[str] = []

    for raw_line in raw_lines:
        cleaned_line = raw_line.replace("\xa0", " ").strip()
        if not cleaned_line:
            continue

        # Detect group header row, for example: 'Group 1,' or 'Group 1'
        group_header_match = re.match(
            r"^Group\s+(\d+)\s*,?.*$", cleaned_line, re.IGNORECASE
        )
        if group_header_match:
            # Commit previous word before switching group
            if current_word and current_group_number is not None:
                full_definition = " ".join(current_definition_segments).strip()
                groups_dictionary[current_group_number].append(
                    (current_word, full_definition)
                )
                current_word = None
                current_definition_segments = []
            current_group_number = int(group_header_match.group(1))
            continue

        # Parse CSV line
        csv_reader = csv.reader([cleaned_line])
        parsed_row = next(csv_reader, [])
        if not parsed_row:
            continue

        column_first = parsed_row[0].strip() if len(parsed_row) > 0 else ""
        column_second = parsed_row[1].strip() if len(parsed_row) > 1 else ""

        if column_first == "":
            # Continuation row of definition for current word
            if column_second:
                current_definition_segments.append(column_second)
        else:
            # New word detected
            if current_word and current_group_number is not None:
                full_definition = " ".join(current_definition_segments).strip()
                groups_dictionary[current_group_number].append(
                    (current_word, full_definition)
                )
            current_word = column_first
            current_definition_segments = [column_second] if column_second else []

    # Commit the final word record
    if current_word and current_group_number is not None:
        full_definition = " ".join(current_definition_segments).strip()
        groups_dictionary[current_group_number].append(
            (current_word, full_definition)
        )

    return groups_dictionary


def load_existing_jsonl_records(
    jsonl_file_path: Path, primary_key_field: str
) -> Dict[str, dict]:
    """Read existing JSONL file and return dictionary indexed by primary key."""
    records_dictionary: Dict[str, dict] = {}
    if not jsonl_file_path.is_file():
        return records_dictionary

    with open(jsonl_file_path, mode="r", encoding="utf-8") as file_handle:
        for line_number, raw_line in enumerate(file_handle, start=1):
            stripped_line = raw_line.strip()
            if not stripped_line:
                continue
            try:
                record = json.loads(stripped_line)
                if primary_key_field in record:
                    records_dictionary[str(record[primary_key_field])] = record
            except json.JSONDecodeError as decode_error:
                sys.stderr.write(
                    f"Warning: Corrupted JSON line {line_number} in {jsonl_file_path}: {decode_error}\n"
                )
    return records_dictionary


def append_jsonl_record(jsonl_file_path: Path, record: dict) -> None:
    """Append a single JSON record to the specified JSONL file and immediately flush."""
    jsonl_file_path.parent.mkdir(parents=True, exist_ok=True)
    with open(jsonl_file_path, mode="a", encoding="utf-8") as file_handle:
        json_line = json.dumps(record, ensure_ascii=False)
        file_handle.write(json_line + "\n")
        file_handle.flush()


def rewrite_jsonl_file(jsonl_file_path: Path, records: List[dict]) -> None:
    """Rewrite entire JSONL file with updated records list."""
    jsonl_file_path.parent.mkdir(parents=True, exist_ok=True)
    with open(jsonl_file_path, mode="w", encoding="utf-8") as file_handle:
        for record in records:
            json_line = json.dumps(record, ensure_ascii=False)
            file_handle.write(json_line + "\n")
        file_handle.flush()


def call_local_language_model(
    api_url: str,
    model_name: str,
    system_instruction: str,
    user_prompt: str,
    schema_name: str,
    json_schema: dict,
    temperature: float,
    timeout_seconds: float,
    max_retries: int,
    retry_delay_seconds: float,
    enable_thinking: bool,
    top_p: float = 0.80,
    presence_penalty: float = 1.5,
) -> dict:
    """
    Execute POST request to OpenAI-compatible Local LLM endpoint enforcing JSON Schema output.
    Retries automatically with exponential backoff on network failures or malformed responses.
    """
    request_payload = {
        "model": model_name,
        "messages": [
            {"role": "system", "content": system_instruction},
            {"role": "user", "content": user_prompt},
        ],
        "response_format": {
            "type": "json_schema",
            "json_schema": {
                "name": schema_name,
                "schema": json_schema,
            },
        },
        "chat_template_kwargs": {
            "enable_thinking": enable_thinking,
        },
        "temperature": temperature,
        "top_p": top_p,
        "presence_penalty": presence_penalty,
    }

    last_error: Optional[Exception] = None

    for attempt_index in range(1, max_retries + 1):
        try:
            with httpx.Client(timeout=timeout_seconds) as http_client:
                response = http_client.post(
                    api_url,
                    json=request_payload,
                    headers={"Content-Type": "application/json"},
                )
                response.raise_for_status()
                response_json = response.json()
                content_string = response_json["choices"][0]["message"]["content"]
                parsed_data = json.loads(content_string)
                return parsed_data
        except (httpx.HTTPError, json.JSONDecodeError, KeyError, IndexError) as exception:
            last_error = exception
            if attempt_index < max_retries:
                backoff_delay = retry_delay_seconds * (2 ** (attempt_index - 1))
                time.sleep(backoff_delay)

    raise RuntimeError(
        f"Failed to obtain valid JSON from LLM after {max_retries} attempts: {last_error}"
    )


def clean_string_list(
    raw_list: Optional[List[str]], disallowed_tokens: Optional[Set[str]] = None
) -> List[str]:
    """Clean, lowercase, and deduplicate a list of string tokens, excluding disallowed ones."""
    if not raw_list:
        return []
    disallowed_set = {token.lower().strip() for token in (disallowed_tokens or set())}
    cleaned_tokens: List[str] = []
    seen_tokens: Set[str] = set()

    for item in raw_list:
        if not isinstance(item, str):
            continue
        cleaned_token = item.strip().lower()
        if not cleaned_token:
            continue
        if cleaned_token in disallowed_set:
            continue
        if cleaned_token not in seen_tokens:
            seen_tokens.add(cleaned_token)
            cleaned_tokens.append(cleaned_token)

    return cleaned_tokens


def sanitize_vocabulary_forms(
    raw_forms: Optional[dict], target_word: str, target_pos: str
) -> Dict[str, List[str]]:
    """Sanitize word forms dictionary ensuring standard POS keys exist and contain clean lists."""
    standard_pos_keys = ["noun", "verb", "adj", "adv"]
    sanitized_forms: Dict[str, List[str]] = {key: [] for key in standard_pos_keys}

    if isinstance(raw_forms, dict):
        for pos_key in standard_pos_keys:
            candidate_list = raw_forms.get(pos_key, [])
            sanitized_forms[pos_key] = clean_string_list(candidate_list)

    # Ensure target word itself is present in its primary part of speech form list
    if target_pos in sanitized_forms:
        if target_word.lower() not in sanitized_forms[target_pos]:
            sanitized_forms[target_pos].insert(0, target_word.lower())

    return sanitized_forms


WORDNET_LEMMATIZER = WordNetLemmatizer()

FALLBACK_VIETNAMESE_GLOSS: Dict[str, str] = {
    "arcane": "bí ẩn, huyền bí, khó hiểu",
    "hodgepodge": "mớ hỗn tạp, mớ linh tinh, mớ xà bần",
    "elitist": "tinh hoa, coi mình là tinh hoa, phân biệt giai cấp",
    "exploitative": "bóc lột, lợi dụng, trục lợi",
    "crestfallen": "ỉu xìu, nản lòng, thất vọng, ủ rũ",
    "cataclysmic": "thảm họa, biến động dữ dội, tàn khốc",
    "duplicitous": "gian dối, hai mặt, lừa gạt",
    "serendipitous": "tình cờ may mắn, ngẫu nhiên may mắn",
}


def load_anhviet_dictionary(file_path: Path) -> Dict[str, List[str]]:
    """
    Parse StarDict format anhviet109K.txt dictionary file into an in-memory dictionary.
    Maps lowercase English headwords to lists of cleaned Vietnamese definition strings.
    """
    if not file_path.is_file():
        sys.stderr.write(
            f"Warning: Anh-Viet dictionary file not found at: {file_path}\n"
        )
        return {}

    dictionary: Dict[str, List[str]] = {}
    current_headword: Optional[str] = None
    current_meanings: List[str] = []

    with open(file_path, mode="r", encoding="utf-8", errors="ignore") as file_handle:
        for raw_line in file_handle:
            cleaned_line = raw_line.strip()
            if not cleaned_line:
                continue
            if cleaned_line.startswith("@"):
                if current_headword and current_meanings:
                    dictionary[current_headword] = current_meanings
                header_parts = cleaned_line[1:].split("/", 1)
                current_headword = header_parts[0].strip().lower()
                current_meanings = []
            elif cleaned_line.startswith("-"):
                raw_meaning = cleaned_line[1:].strip()
                # Remove parenthetical contextual or grammatical notes e.g. (+ in, with)
                without_parentheses = re.sub(r"\([^)]*\)", "", raw_meaning).strip()
                cleaned_meaning = re.sub(r"^[+]\s*", "", without_parentheses).strip()
                if cleaned_meaning and not cleaned_meaning.startswith("xem "):
                    current_meanings.append(cleaned_meaning)

        if current_headword and current_meanings:
            dictionary[current_headword] = current_meanings

    return dictionary


def clean_vietnamese_gloss_text(raw_gloss_text: str) -> str:
    """Normalize whitespace and strip leading or trailing punctuation from a gloss segment."""
    normalized_whitespace = re.sub(r"\s+", " ", raw_gloss_text).strip()
    cleaned_delimiters = re.sub(r"\s*;\s*", ", ", normalized_whitespace)
    return re.sub(r"^[;,.\s]+|[;,.\s]+$", "", cleaned_delimiters)


def get_vietnamese_gloss(
    target_word: str,
    anhviet_dictionary: Dict[str, List[str]],
    lemmatizer: WordNetLemmatizer,
    max_gloss_senses: int = 2,
) -> str:
    """
    Retrieve concise, natural Vietnamese gloss from the loaded Anh-Viet dictionary.
    Applies hyphenation, British/American spelling normalization, lemmatization, and curated fallbacks.
    """
    normalized_word = target_word.lower().strip()

    candidate_lookup_keys = [
        normalized_word,
        normalized_word.replace("-", " "),
        normalized_word.replace(" ", "-"),
        normalized_word.replace("or", "our"),
        normalized_word.replace("our", "or"),
        normalized_word.replace("ize", "ise"),
        normalized_word.replace("ise", "ize"),
        lemmatizer.lemmatize(normalized_word, "v"),
        lemmatizer.lemmatize(normalized_word, "n"),
        lemmatizer.lemmatize(normalized_word, "a"),
    ]

    matched_meanings: List[str] = []
    for candidate_key in candidate_lookup_keys:
        if candidate_key in anhviet_dictionary and anhviet_dictionary[candidate_key]:
            matched_meanings = anhviet_dictionary[candidate_key]
            break

    if not matched_meanings and normalized_word in FALLBACK_VIETNAMESE_GLOSS:
        return FALLBACK_VIETNAMESE_GLOSS[normalized_word]

    cleaned_meanings: List[str] = []
    for raw_meaning in matched_meanings:
        cleaned_meaning = clean_vietnamese_gloss_text(raw_meaning)
        if cleaned_meaning and cleaned_meaning not in cleaned_meanings:
            cleaned_meanings.append(cleaned_meaning)
            if len(cleaned_meanings) >= max_gloss_senses:
                break

    if not cleaned_meanings and normalized_word in FALLBACK_VIETNAMESE_GLOSS:
        return FALLBACK_VIETNAMESE_GLOSS[normalized_word]

    return ", ".join(cleaned_meanings)


def execute_datamuse_request(
    api_url: str,
    parameters: dict,
    http_client: httpx.Client,
    max_retries: int = 3,
    retry_delay_seconds: float = 1.0,
) -> list:
    """Execute GET request to Datamuse API with automatic exponential backoff."""
    for attempt_index in range(1, max_retries + 1):
        try:
            response = http_client.get(api_url, params=parameters)
            response.raise_for_status()
            parsed_json = response.json()
            if isinstance(parsed_json, list):
                return parsed_json
            return []
        except (httpx.HTTPError, json.JSONDecodeError):
            if attempt_index < max_retries:
                time.sleep(retry_delay_seconds * (2 ** (attempt_index - 1)))
    return []


def fetch_datamuse_lexical_data(
    target_word: str,
    api_url: str,
    http_client: httpx.Client,
    max_synonyms: int = 4,
    max_antonyms: int = 3,
    disallowed_tokens: Optional[Set[str]] = None,
) -> Tuple[str, List[str], List[str]]:
    """
    Query Datamuse API and WordNet to determine primary part of speech, synonyms, and antonyms.
    Guarantees strict part-of-speech alignment and complete disjointness from morphological family forms.
    """
    disallowed_set = {token.lower().strip() for token in (disallowed_tokens or set())}
    disallowed_set.add(target_word.lower().strip())

    # Step A: Determine primary part of speech from Datamuse, falling back to WordNet
    detected_pos = "noun"
    word_info_results = execute_datamuse_request(
        api_url=api_url,
        parameters={"sp": target_word, "md": "dp"},
        http_client=http_client,
    )

    if word_info_results and "tags" in word_info_results[0]:
        available_tags = word_info_results[0].get("tags", [])
        if available_tags and available_tags[0] in ("v", "adj", "adv", "n"):
            pos_mapping = {"v": "verb", "adj": "adj", "adv": "adv", "n": "noun"}
            detected_pos = pos_mapping[available_tags[0]]
        else:
            for tag in available_tags:
                if tag in ("v", "adj", "adv", "n"):
                    pos_mapping = {"v": "verb", "adj": "adj", "adv": "adv", "n": "noun"}
                    detected_pos = pos_mapping[tag]
                    break
    else:
        wordnet_synsets = wn.synsets(target_word)
        if wordnet_synsets:
            first_synset_pos = wordnet_synsets[0].pos()
            pos_mapping = {"v": "verb", "a": "adj", "s": "adj", "r": "adv", "n": "noun"}
            detected_pos = pos_mapping.get(first_synset_pos, "noun")

    datamuse_pos_tag = {"verb": "v", "adj": "adj", "adv": "adv", "noun": "n"}.get(
        detected_pos, "n"
    )

    # Step B: Retrieve academic synonyms matching the part of speech
    collected_synonyms: List[str] = []

    direct_synonym_results = execute_datamuse_request(
        api_url=api_url,
        parameters={"rel_syn": target_word, "md": "p"},
        http_client=http_client,
    )
    for result_item in direct_synonym_results:
        candidate_word = result_item.get("word", "").lower().strip()
        candidate_tags = result_item.get("tags", [])
        if (
            candidate_word
            and candidate_word not in disallowed_set
            and candidate_word not in collected_synonyms
            and datamuse_pos_tag in candidate_tags
            and " " not in candidate_word
        ):
            collected_synonyms.append(candidate_word)

    # If direct synonyms are insufficient, augment with high-similarity academic terms (means like)
    if len(collected_synonyms) < 3:
        means_like_results = execute_datamuse_request(
            api_url=api_url,
            parameters={"ml": target_word, "md": "p"},
            http_client=http_client,
        )
        for result_item in means_like_results:
            candidate_word = result_item.get("word", "").lower().strip()
            candidate_tags = result_item.get("tags", [])
            if (
                candidate_word
                and candidate_word not in disallowed_set
                and candidate_word not in collected_synonyms
                and datamuse_pos_tag in candidate_tags
                and " " not in candidate_word
            ):
                collected_synonyms.append(candidate_word)
            if len(collected_synonyms) >= max_synonyms:
                break

    # If still insufficient, augment with WordNet synsets
    if len(collected_synonyms) < 2:
        wordnet_pos_codes = {"verb": ("v",), "adj": ("a", "s"), "adv": ("r",), "noun": ("n",)}[detected_pos]
        for synset in wn.synsets(target_word):
            if synset.pos() in wordnet_pos_codes:
                for lemma in synset.lemmas():
                    lemma_token = lemma.name().lower().replace("_", "")
                    if (
                        lemma_token not in disallowed_set
                        and lemma_token not in collected_synonyms
                        and lemma_token != target_word.lower()
                    ):
                        collected_synonyms.append(lemma_token)

    collected_synonyms = collected_synonyms[:max_synonyms]

    # Step C: Retrieve antonyms matching the part of speech
    collected_antonyms: List[str] = []

    direct_antonym_results = execute_datamuse_request(
        api_url=api_url,
        parameters={"rel_ant": target_word, "md": "p"},
        http_client=http_client,
    )
    for result_item in direct_antonym_results:
        candidate_word = result_item.get("word", "").lower().strip()
        candidate_tags = result_item.get("tags", [])
        if (
            candidate_word
            and candidate_word not in disallowed_set
            and candidate_word not in collected_antonyms
            and datamuse_pos_tag in candidate_tags
            and " " not in candidate_word
        ):
            collected_antonyms.append(candidate_word)

    # Augment with WordNet lemma antonyms
    wordnet_pos_codes = {"verb": ("v",), "adj": ("a", "s"), "adv": ("r",), "noun": ("n",)}[detected_pos]
    for synset in wn.synsets(target_word):
        if synset.pos() in wordnet_pos_codes:
            for lemma in synset.lemmas():
                for antonym_lemma in lemma.antonyms():
                    antonym_token = antonym_lemma.name().lower().replace("_", "")
                    if (
                        antonym_token not in disallowed_set
                        and antonym_token not in collected_antonyms
                        and antonym_token != target_word.lower()
                    ):
                        collected_antonyms.append(antonym_token)

    collected_antonyms = collected_antonyms[:max_antonyms]

    return detected_pos, collected_synonyms, collected_antonyms


def normalize_vocabulary_entries(
    target_groups: List[int],
    parsed_wordbank: Dict[int, List[Tuple[str, str]]],
    vocab_jsonl_path: Path,
    configuration: dict,
    force_overwrite: bool,
    limit_words: Optional[int] = None,
) -> Dict[str, dict]:
    """
    Step 1: Normalize vocabulary entries using 100% Non-LLM deterministic lexical pipeline.
    Combines WordNet morphology (word_forms), Datamuse lexical API, and Anh-Viet dictionary.
    Returns in-memory dictionary of all vocabulary records.
    """
    vocab_gen_config = configuration.get("vocab_generation", {})
    datamuse_api_url = vocab_gen_config.get(
        "datamuse_api_url", "https://api.datamuse.com/words"
    )
    http_timeout_seconds = float(vocab_gen_config.get("http_timeout_seconds", 15.0))
    max_synonyms = int(vocab_gen_config.get("max_synonyms", 4))
    max_antonyms = int(vocab_gen_config.get("max_antonyms", 3))
    max_vi_gloss_senses = int(vocab_gen_config.get("max_vi_gloss_senses", 2))

    paths_config = configuration.get("paths", {})
    anhviet_dictionary_path = Path(
        paths_config.get("anhviet_dict", "scripts/anhviet109K.txt")
    )

    sys.stdout.write(f"Loading Anh-Viet dictionary from {anhviet_dictionary_path}...\n")
    anhviet_dictionary = load_anhviet_dictionary(anhviet_dictionary_path)
    sys.stdout.write(
        f"Loaded {len(anhviet_dictionary)} dictionary entries into memory.\n"
    )

    existing_vocab_records = load_existing_jsonl_records(
        vocab_jsonl_path, primary_key_field="id"
    )

    words_to_process: List[Tuple[int, int, str, str, str]] = []
    for group_number in target_groups:
        word_entries = parsed_wordbank.get(group_number, [])
        for word_index, (word, raw_definition) in enumerate(word_entries, start=1):
            target_id = f"g{group_number}_w{word_index:02d}"
            words_to_process.append(
                (group_number, word_index, word, raw_definition, target_id)
            )

    if limit_words is not None and limit_words > 0:
        words_to_process = words_to_process[:limit_words]

    progress_bar = tqdm(
        words_to_process,
        desc="Step 1: Normalizing Vocabulary Entries (Non-LLM)",
        unit="word",
    )

    needs_file_rewrite = force_overwrite and bool(existing_vocab_records)

    with httpx.Client(timeout=http_timeout_seconds) as http_client:
        for group_number, word_index, word, raw_definition, target_id in progress_bar:
            if not force_overwrite and target_id in existing_vocab_records:
                continue

            progress_bar.set_postfix({"word": word, "group": group_number})

            # 1. Generate morphological forms using word_forms (pure linguistic morphology)
            raw_word_forms = get_word_forms(word)
            sanitized_forms: Dict[str, List[str]] = {
                "noun": sorted(list(raw_word_forms.get("n", set()))),
                "verb": sorted(list(raw_word_forms.get("v", set()))),
                "adj": sorted(list(raw_word_forms.get("a", set()))),
                "adv": sorted(list(raw_word_forms.get("r", set()))),
            }

            all_family_words: Set[str] = {word.lower().strip()}
            for form_list in sanitized_forms.values():
                all_family_words.update(form_list)

            # 2. Query Datamuse and WordNet for POS, synonyms, and antonyms
            detected_pos, collected_synonyms, collected_antonyms = (
                fetch_datamuse_lexical_data(
                    target_word=word,
                    api_url=datamuse_api_url,
                    http_client=http_client,
                    max_synonyms=max_synonyms,
                    max_antonyms=max_antonyms,
                    disallowed_tokens=all_family_words,
                )
            )

            # Ensure target word itself is listed in its primary POS form list
            if detected_pos in sanitized_forms:
                if word.lower().strip() not in sanitized_forms[detected_pos]:
                    sanitized_forms[detected_pos].insert(0, word.lower().strip())

            # 3. Clean and parse definitions from wordbank
            cleaned_raw_definition = raw_definition.replace("\xa0", " ").strip()
            numbered_definition_segments = re.split(
                r"(?:^|\s+)\d+\.\s+", cleaned_raw_definition
            )
            cleaned_definitions = [
                segment.strip()
                for segment in numbered_definition_segments
                if segment and segment.strip()
            ]
            if not cleaned_definitions:
                cleaned_definitions = [cleaned_raw_definition]

            # 4. Extract Vietnamese gloss from Anh-Viet dictionary
            cleaned_vi_gloss = get_vietnamese_gloss(
                target_word=word,
                anhviet_dictionary=anhviet_dictionary,
                lemmatizer=WORDNET_LEMMATIZER,
                max_gloss_senses=max_vi_gloss_senses,
            )

            vocabulary_record = {
                "id": target_id,
                "word": word.lower().strip(),
                "group": group_number,
                "pos": detected_pos,
                "forms": sanitized_forms,
                "definitions": cleaned_definitions,
                "vi_gloss": cleaned_vi_gloss,
                "synonyms": collected_synonyms,
                "antonyms": collected_antonyms,
            }

            if not force_overwrite:
                append_jsonl_record(vocab_jsonl_path, vocabulary_record)
            existing_vocab_records[target_id] = vocabulary_record

    progress_bar.close()

    if needs_file_rewrite:
        # Rewrite the complete JSONL file in sorted order to ensure zero duplicate IDs
        sorted_records = sorted(
            existing_vocab_records.values(),
            key=lambda r: (r.get("group", 0), r.get("id", "")),
        )
        rewrite_jsonl_file(vocab_jsonl_path, sorted_records)

    return existing_vocab_records


def build_bidirectional_synonym_graph(
    vocabulary_records: List[dict],
) -> Dict[str, Set[str]]:
    """
    Construct a bidirectional graph connecting words that share direct synonym links.
    Returns mapping from word to its direct synonym neighborhood (1-hop bidirectional),
    preventing transitive small-world network percolation across unrelated polysemous senses.
    """
    adjacency_graph: Dict[str, Set[str]] = defaultdict(set)

    for record in vocabulary_records:
        word = record["word"].lower().strip()
        synonyms = record.get("synonyms", [])
        adjacency_graph[word].add(word)
        for synonym in synonyms:
            synonym_clean = synonym.lower().strip()
            if synonym_clean:
                adjacency_graph[word].add(synonym_clean)
                adjacency_graph[synonym_clean].add(word)

    # Return direct 1-hop bidirectional synonym neighborhood
    synonym_clusters: Dict[str, Set[str]] = {
        word: set(neighbors) for word, neighbors in adjacency_graph.items()
    }
    return synonym_clusters


def extract_definition_content_keywords(
    definitions: List[str], vi_gloss: str, stopwords: Set[str]
) -> Set[str]:
    """Extract content words from English definitions and Vietnamese gloss, excluding stopwords."""
    combined_text = " ".join(definitions) + " " + vi_gloss
    extracted_tokens = re.findall(r"[\w]+", combined_text.lower())
    content_keywords: Set[str] = set()
    for token in extracted_tokens:
        if len(token) >= 3 and token not in stopwords:
            content_keywords.add(token)
    return content_keywords


def select_text_completion_distractors(
    target_record: dict,
    all_vocabulary_records: List[dict],
    synonym_clusters: Dict[str, Set[str]],
    academic_fallback_words: Dict[str, List[str]],
    definition_stopwords: Set[str],
    word_to_group: Optional[Dict[str, int]] = None,
) -> List[str]:
    """
    Select exactly 3 pedagogically sound distractors for Text Completion question:
    - Same part of speech.
    - Priority 1: Intra-Group (same group).
    - Priority 2: Cumulative Prior-Groups (group < target_group). Never future groups!
    - Priority 3: Academic Core Fallback from config (excluding any that belong to future groups).
    - Exclusion filters:
      1. Not the target word itself.
      2. Not in target word's family forms; target not in candidate forms.
      3. Not in target word's bidirectional synonym cluster.
      4. No definition keyword overlap after removing stopwords.
      5. Distractors must not share synonym relations with each other.
    - Polarity inversion preference: prioritize selecting at least 1 antonym if eligible.
    """
    target_word = target_record["word"].lower().strip()
    target_pos = target_record["pos"]
    target_group = int(target_record["group"])

    if word_to_group is None:
        word_to_group = {
            rec["word"].lower().strip(): int(rec["group"])
            for rec in all_vocabulary_records
            if "word" in rec and "group" in rec
        }

    # Disallowed set of words
    disallowed_words: Set[str] = {target_word}

    # Add all lemma forms of target word
    for form_list in target_record.get("forms", {}).values():
        for form_word in form_list:
            disallowed_words.add(form_word.lower().strip())

    # Add all words in the bidirectional synonym cluster
    target_synonym_cluster = synonym_clusters.get(target_word, {target_word})
    disallowed_words.update(target_synonym_cluster)

    # Compute target definition keywords
    target_content_keywords = extract_definition_content_keywords(
        target_record.get("definitions", []),
        target_record.get("vi_gloss", ""),
        definition_stopwords,
    )

    # Target antonyms set
    target_antonyms: Set[str] = {
        antonym.lower().strip()
        for antonym in target_record.get("antonyms", [])
        if antonym.strip()
    }

    # Partition vocabulary records into Priority 1 and Priority 2 pools
    priority_one_candidates: List[dict] = []
    priority_two_candidates: List[dict] = []

    for candidate_record in all_vocabulary_records:
        candidate_word = candidate_record["word"].lower().strip()
        if candidate_record.get("pos") != target_pos:
            continue
        if candidate_word in disallowed_words:
            continue

        # Check if target word appears in candidate forms
        candidate_forms: Set[str] = set()
        for form_list in candidate_record.get("forms", {}).values():
            for form_word in form_list:
                candidate_forms.add(form_word.lower().strip())
        if target_word in candidate_forms:
            continue

        # Check definition keyword overlap
        candidate_content_keywords = extract_definition_content_keywords(
            candidate_record.get("definitions", []),
            candidate_record.get("vi_gloss", ""),
            definition_stopwords,
        )
        keyword_overlap = target_content_keywords.intersection(
            candidate_content_keywords
        )
        if keyword_overlap:
            continue

        candidate_group = int(candidate_record.get("group", 999))
        if candidate_group == target_group:
            priority_one_candidates.append(candidate_record)
        elif candidate_group < target_group:
            priority_two_candidates.append(candidate_record)

    selected_distractors: List[str] = []
    selected_distractor_set: Set[str] = set()

    # Rule: Polarity Inversion (Antonym) Preference
    # Try to find at least one eligible antonym from Priority 1 or Priority 2 candidates
    for candidate_record in priority_one_candidates + priority_two_candidates:
        candidate_word = candidate_record["word"].lower().strip()
        if candidate_word in target_antonyms:
            selected_distractors.append(candidate_word)
            selected_distractor_set.add(candidate_word)
            break

    # Helper function to add candidate word if eligible
    def try_add_distractor(candidate_word: str) -> bool:
        cleaned = candidate_word.lower().strip()
        if (
            cleaned
            and cleaned not in disallowed_words
            and cleaned not in selected_distractor_set
        ):
            # Check that candidate does not share synonym link with existing selected distractors
            cand_syns = synonym_clusters.get(cleaned, {cleaned})
            if any(existing in cand_syns for existing in selected_distractors):
                return False
            selected_distractors.append(cleaned)
            selected_distractor_set.add(cleaned)
            return True
        return False

    # Priority 1: Fill from intra-group candidates
    for candidate_record in priority_one_candidates:
        if len(selected_distractors) >= 3:
            break
        try_add_distractor(candidate_record["word"])

    # Priority 2: Fill from prior-group candidates
    if len(selected_distractors) < 3:
        for candidate_record in priority_two_candidates:
            if len(selected_distractors) >= 3:
                break
            try_add_distractor(candidate_record["word"])

    # Priority 3: Fill from academic core fallback words (avoiding future groups)
    if len(selected_distractors) < 3:
        fallback_pool = academic_fallback_words.get(target_pos, [])
        for fallback_word in fallback_pool:
            if len(selected_distractors) >= 3:
                break
            fw_clean = fallback_word.lower().strip()
            fw_group = word_to_group.get(fw_clean)
            if fw_group is not None and fw_group > target_group:
                continue
            try_add_distractor(fallback_word)

    # Fallback to general academic fallback words if POS list is exhausted
    if len(selected_distractors) < 3:
        for pos_key, word_list in academic_fallback_words.items():
            for fallback_word in word_list:
                if len(selected_distractors) >= 3:
                    break
                fw_clean = fallback_word.lower().strip()
                fw_group = word_to_group.get(fw_clean)
                if fw_group is not None and fw_group > target_group:
                    continue
                try_add_distractor(fallback_word)

    # Verification: Ensure exactly 3 distractors
    if len(selected_distractors) != 3:
        raise ValueError(
            f"Could not find exactly 3 distractors for word '{target_word}' (found {len(selected_distractors)})."
        )

    return selected_distractors


def generate_text_completion_questions(
    target_groups: List[int],
    all_vocabulary_records: Dict[str, dict],
    question_templates_jsonl_path: Path,
    configuration: dict,
    force_overwrite: bool,
    limit_words: Optional[int] = None,
    concurrency: Optional[int] = None,
) -> Dict[str, dict]:
    """
    Step 2 & 3: Generate academic Text Completion questions with Local LLM
    and assign pedagogically validated distractors via Python engine.
    Supports multithreaded concurrent API calls to the local LLM endpoint.
    """
    llm_config = configuration["llm"]
    api_url = llm_config["api_url"]
    model_name = llm_config["model_name"]
    timeout_seconds = float(llm_config["timeout_seconds"])
    max_retries = int(llm_config["max_retries"])
    retry_delay_seconds = float(llm_config["retry_delay_seconds"])
    temperature = float(llm_config["temperature"])
    top_p = float(llm_config.get("top_p", 0.80))
    presence_penalty = float(llm_config.get("presence_penalty", 1.5))
    enable_thinking = bool(llm_config["enable_thinking"])
    effective_concurrency = int(concurrency if concurrency is not None else llm_config.get("concurrency", 4))

    distractor_config = configuration["distractors"]
    academic_fallback_words: Dict[str, List[str]] = distractor_config.get(
        "academic_fallback_words", {}
    )
    definition_stopwords: Set[str] = set(
        distractor_config.get("definition_stopwords", [])
    )

    tc_questions_per_word = int(
        configuration["generation"].get("tc_questions_per_word", 1)
    )
    target_domains = configuration["generation"].get(
        "academic_domains",
        [
            "Natural Sciences",
            "Social Sciences",
            "Arts and Humanities",
            "Philosophy and Literature",
            "History and Politics",
        ],
    )

    existing_question_records = load_existing_jsonl_records(
        question_templates_jsonl_path, primary_key_field="id"
    )

    # Build bidirectional synonym graph from all available vocabulary entries
    synonym_clusters = build_bidirectional_synonym_graph(
        list(all_vocabulary_records.values())
    )

    tc_json_schema = {
        "type": "object",
        "properties": {
            "domain": {
                "type": "string",
                "enum": target_domains,
            },
            "logic_blueprint": {
                "type": "string",
                "description": "1 sentence defining the contrast or causal pivot that strictly forces the target word.",
            },
            "complete_sentence": {
                "type": "string",
                "description": "The complete academic GRE sentence containing the EXACT uninflected target word. Do not use [BLANK] here.",
            },
            "clue": {
                "type": "string",
                "description": "The exact clause or keywords from complete_sentence that serve as the context clue.",
            },
            "rationale": {
                "type": "string",
                "description": "Insightful Vietnamese rationale (2-3 sentences) analyzing why the target word is the only semantically fitting choice.",
            },
        },
        "required": [
            "domain",
            "logic_blueprint",
            "complete_sentence",
            "clue",
            "rationale",
        ],
    }

    system_instruction = (
        "You are an expert GRE Verbal test writer for ETS.\n"
        "Your objective is to author an advanced academic GRE sentence that provides airtight context clues for a specific target word.\n\n"
        "Strict Editorial & Construction Rules:\n"
        "1. High-Constraint Clues: The sentence must contain a structural pivot (e.g., 'Although [X]... [TARGET]', 'Rather than [X], it was [TARGET]', '[CAUSE]... rendered it [TARGET]') so that the sentence's internal logic strictly dictates the target word.\n"
        "2. EXACT BASE UNINFLECTED FORM (CRITICAL):\n"
        "   - Write 'complete_sentence' containing the EXACT base uninflected target word.\n"
        "   - DO NOT inflect the target word (NEVER use -ed, -ing, -s, or other suffixes).\n"
        "   - Grammatical positioning to guarantee base form:\n"
        "     * If VERB: MUST be placed after an infinitive ('to [TARGET]'), modal verb ('could/might/would [TARGET]'), or with plural subject ('scholars consistently [TARGET]').\n"
        "     * If ADJECTIVE: after linking verb ('remained entirely [TARGET]', 'rendered the policy [TARGET]', 'deemed [TARGET]').\n"
        "     * If NOUN: singular uninflected noun ('a profound [TARGET]').\n"
        "     * If ADVERB: modifying base verb or adjective ('proceeded [TARGET]').\n"
        "3. ZERO-LEAKAGE: Never use any other forms, stems, or derivations of the target word anywhere in the sentence.\n"
        "4. Rationale: Write an insightful Vietnamese rationale (2-3 sentences) analyzing why the target word is the only semantically fitting choice.\n"
        "5. Adhere strictly to the JSON schema."
    )

    # Filter target vocabulary records for requested groups
    records_to_process: List[dict] = []
    for record in all_vocabulary_records.values():
        if int(record.get("group", -1)) in target_groups:
            records_to_process.append(record)

    records_to_process.sort(key=lambda item: (item["group"], item["id"]))

    if limit_words is not None and limit_words > 0:
        records_to_process = records_to_process[:limit_words]

    file_write_lock = threading.Lock()
    all_vocab_list = list(all_vocabulary_records.values())

    progress_bar = tqdm(
        total=len(records_to_process),
        desc="Step 2 & 3: Generating Text Completion Items",
        unit="word",
    )

    def process_single_vocabulary_target(target_record: dict) -> None:
        target_id = target_record["id"]
        target_word = target_record["word"]
        target_group = int(target_record["group"])
        target_pos = target_record["pos"]
        target_definitions_text = "; ".join(target_record.get("definitions", []))
        target_vi_gloss = target_record.get("vi_gloss", "")

        generated_sentences_for_word: List[str] = []

        for question_index in range(1, tc_questions_per_word + 1):
            # Disambiguate duplicate words in wordbank (e.g., cumbersome in Group 11 and Group 22)
            word_duplicate_instances = [
                r for r in all_vocab_list if r.get("word", "").lower() == target_word.lower()
            ]
            if len(word_duplicate_instances) > 1:
                question_id = f"q_{target_word}_g{target_group}_tc{question_index:02d}"
            else:
                question_id = f"q_{target_word}_tc{question_index:02d}"

            # Check if record already exists
            with file_write_lock:
                existing_record = existing_question_records.get(question_id)

            if not force_overwrite and existing_record is not None:
                # Validate whether existing record has leakage or invalid formatting
                existing_sentence = existing_record.get("sentence", "")
                existing_without_blank = existing_sentence.replace("[BLANK]", " ").lower()
                leakage_detected = bool(
                    re.search(
                        rf"\b{re.escape(target_word.lower())}\b",
                        existing_without_blank,
                    )
                )
                if not leakage_detected and existing_sentence not in generated_sentences_for_word:
                    generated_sentences_for_word.append(existing_sentence)
                    continue

            with file_write_lock:
                progress_bar.set_postfix({"word": target_word, "qid": question_id})

            # Cycle or randomize target domain to guarantee variety across questions
            assigned_domain = target_domains[
                (question_index - 1) % len(target_domains)
            ]

            previous_sentences_context = ""
            if generated_sentences_for_word:
                previous_sentences_context = (
                    "Diversity Constraint - Previously generated sentence(s) for this word:\n"
                    + "\n".join(
                        f"- \"{sent}\"" for sent in generated_sentences_for_word
                    )
                    + f"\nYou MUST choose a COMPLETELY DIFFERENT academic scenario, topic, and context. Do NOT repeat phrasing.\n\n"
                )

            # Structure user prompt: constant instruction prefix first, dynamic data last for high cache hits
            base_prompt = (
                f"Author a GRE Text Completion item for the target word.\n\n"
                f"Target Word: {target_word}\n"
                f"Part of Speech: {target_pos}\n"
                f"Assigned Domain: {assigned_domain}\n"
                f"English Definitions: {target_definitions_text}\n"
                f"Vietnamese Meaning: {target_vi_gloss}\n\n"
                f"Reminder: 'complete_sentence' must contain the EXACT uninflected lemma '{target_word}' without -ed, -ing, -s suffixes.\n\n"
                f"{previous_sentences_context}"
            )

            # Extract word family derivatives for leakage protection
            forms_dict = target_record.get("forms", {})
            forbidden_derivations = {
                derivative.lower().strip()
                for form_category, form_list in forms_dict.items()
                for derivative in form_list
                if isinstance(derivative, str) and derivative.lower().strip() != target_word.lower()
            }

            max_sentence_attempts = 3
            normalized_sentence = ""
            final_clue = ""
            final_rationale = ""
            final_domain = assigned_domain

            for sentence_attempt in range(1, max_sentence_attempts + 1):
                attempt_prompt = base_prompt
                if sentence_attempt > 1:
                    attempt_prompt += f"\nPrevious attempt had formatting or lemma errors. You MUST use the exact uninflected word '{target_word}'."

                llm_response = call_local_language_model(
                    api_url=api_url,
                    model_name=model_name,
                    system_instruction=system_instruction,
                    user_prompt=attempt_prompt,
                    schema_name="gre_tc_question",
                    json_schema=tc_json_schema,
                    temperature=temperature,
                    timeout_seconds=timeout_seconds,
                    max_retries=max_retries,
                    retry_delay_seconds=retry_delay_seconds,
                    enable_thinking=enable_thinking,
                    top_p=top_p,
                    presence_penalty=presence_penalty,
                )

                raw_complete_sentence = llm_response.get("complete_sentence", "").strip()
                final_clue = llm_response.get("clue", "").strip()
                final_rationale = llm_response.get("rationale", "").strip()
                final_domain = llm_response.get("domain", assigned_domain)

                # Tier 1: Check exact base uninflected match
                exact_pattern = re.compile(rf"\b{re.escape(target_word)}\b", re.IGNORECASE)
                if not exact_pattern.search(raw_complete_sentence):
                    # Check if inflected with -ed, -ing, -s, etc.
                    inflection_pattern = re.compile(
                        rf"\b{re.escape(target_word)}(ed|ing|s|es|d)\b", re.IGNORECASE
                    )
                    if inflection_pattern.search(raw_complete_sentence) and sentence_attempt < max_sentence_attempts:
                        continue

                # Tier 2: Replace target word with [BLANK]
                if exact_pattern.search(raw_complete_sentence):
                    candidate_sentence = exact_pattern.sub("[BLANK]", raw_complete_sentence, count=1)
                else:
                    candidate_sentence = re.sub(r"_{2,}", "[BLANK]", raw_complete_sentence)
                    if "[BLANK]" not in candidate_sentence:
                        candidate_sentence = f"{candidate_sentence} [BLANK]"

                # Tier 3: Leakage Assertion (neither root word nor forms may remain outside [BLANK])
                sentence_remainder = candidate_sentence.replace("[BLANK]", " ").lower()
                leak_detected = bool(exact_pattern.search(sentence_remainder))
                derivation_leak = any(
                    bool(re.search(rf"\b{re.escape(deriv)}\b", sentence_remainder))
                    for deriv in forbidden_derivations
                    if len(deriv) > 2
                )

                if (leak_detected or derivation_leak) and sentence_attempt < max_sentence_attempts:
                    continue

                # Normalize articles: "a [BLANK]" / "an [BLANK]" -> "a/an [BLANK]"
                candidate_sentence = re.sub(
                    r"\b(?:a/an|an/a|a/a/an|an/an/a|a\s*/\s*an)\s+\[BLANK\]",
                    "a/an [BLANK]",
                    candidate_sentence,
                    flags=re.IGNORECASE,
                )
                candidate_sentence = re.sub(
                    r"(?<!/)\b(?:a|an)\s+\[BLANK\]",
                    "a/an [BLANK]",
                    candidate_sentence,
                    flags=re.IGNORECASE,
                )
                # Clean whitespace & punctuation
                candidate_sentence = re.sub(r"[ \t]{2,}", " ", candidate_sentence)
                candidate_sentence = re.sub(r"\s+([,.:;?!])", r"\1", candidate_sentence)

                normalized_sentence = candidate_sentence
                break

            generated_sentences_for_word.append(normalized_sentence)

            # Python Engine Distractor Assignment (Step 3)
            distractors = select_text_completion_distractors(
                target_record=target_record,
                all_vocabulary_records=all_vocab_list,
                synonym_clusters=synonym_clusters,
                academic_fallback_words=academic_fallback_words,
                definition_stopwords=definition_stopwords,
            )

            # Automated Integrity Assertion
            assert len(distractors) == 3, f"Must have exactly 3 distractors for {question_id}"
            four_choices = [target_word] + distractors
            assert (
                len(set(four_choices)) == 4
            ), f"Distractors must be unique and distinct from answer for {question_id}: {four_choices}"

            target_cluster = synonym_clusters.get(target_word, {target_word})
            for distractor in distractors:
                assert (
                    distractor not in target_cluster
                ), f"Distractor '{distractor}' shares synonym cluster with target '{target_word}' in {question_id}!"

            question_record = {
                "id": question_id,
                "target_id": target_id,
                "type": "TC",
                "domain": final_domain,
                "sentence": normalized_sentence,
                "pos_required": target_pos,
                "form_required": "base",
                "clue": final_clue,
                "correct_answer": target_word,
                "distractors": distractors,
                "rationale": final_rationale,
            }

            # Thread-safe append-only streaming write to minimize disk I/O and SSD wear
            with file_write_lock:
                append_jsonl_record(question_templates_jsonl_path, question_record)
                existing_question_records[question_id] = question_record

        with file_write_lock:
            progress_bar.update(1)

    if effective_concurrency > 1 and len(records_to_process) > 1:
        with ThreadPoolExecutor(max_workers=effective_concurrency) as executor:
            worker_futures = [
                executor.submit(process_single_vocabulary_target, target_record)
                for target_record in records_to_process
            ]
            for future in as_completed(worker_futures):
                future.result()
    else:
        for target_record in records_to_process:
            process_single_vocabulary_target(target_record)

    progress_bar.close()

    # Perform a single cleanup sort at the end of the entire batch run if necessary
    all_questions_list = list(existing_question_records.values())
    all_questions_list.sort(key=lambda item: item["id"])
    with open(question_templates_jsonl_path, "w", encoding="utf-8") as file_handle:
        for item in all_questions_list:
            file_handle.write(json.dumps(item, ensure_ascii=False) + "\n")

    return existing_question_records






def run_comprehensive_integrity_check(
    vocab_jsonl_path: Path,
    question_templates_jsonl_path: Path,
) -> None:
    """Validate 100% of generated records for consistency, schema adherence, and synonym disjointness."""

    sys.stdout.write("Running automated integrity assertion on generated files...\n")

    vocab_records = load_existing_jsonl_records(
        vocab_jsonl_path, primary_key_field="id"
    )
    question_records = load_existing_jsonl_records(
        question_templates_jsonl_path, primary_key_field="id"
    )

    sys.stdout.write(
        f"Loaded {len(vocab_records)} vocabulary records and {len(question_records)} question templates.\n"
    )

    synonym_clusters = build_bidirectional_synonym_graph(
        list(vocab_records.values())
    )

    validation_errors: List[str] = []

    # Check question templates
    for question_id, question in question_records.items():
        correct_answer = question.get("correct_answer", "").strip().lower()
        distractors = [d.strip().lower() for d in question.get("distractors", [])]
        sentence = question.get("sentence", "")

        if "[BLANK]" not in sentence:
            validation_errors.append(
                f"{question_id}: Missing '[BLANK]' placeholder in sentence."
            )

        if len(distractors) != 3:
            validation_errors.append(
                f"{question_id}: Distractor count is {len(distractors)}, expected 3."
            )

        all_options = [correct_answer] + distractors
        if len(set(all_options)) != 4:
            validation_errors.append(
                f"{question_id}: Options are not 4 unique words: {all_options}."
            )

        target_cluster = synonym_clusters.get(correct_answer, {correct_answer})
        for distractor in distractors:
            if distractor in target_cluster:
                validation_errors.append(
                    f"{question_id}: Distractor '{distractor}' is a synonym of '{correct_answer}'."
                )

        # Assertion: Check answer leakage
        sentence_without_blank = sentence.replace("[BLANK]", " ").lower()
        if re.search(rf"\b{re.escape(correct_answer)}\b", sentence_without_blank):
            validation_errors.append(
                f"{question_id}: Target answer '{correct_answer}' leaked in sentence text!"
            )

    # Assertion: Check sentence uniqueness across question items
    seen_sentence_map: Dict[str, str] = {}
    for question_id, question in question_records.items():
        sent = question.get("sentence", "").strip()
        if sent in seen_sentence_map:
            validation_errors.append(
                f"{question_id}: Duplicate sentence identical to {seen_sentence_map[sent]}."
            )
        else:
            seen_sentence_map[sent] = question_id


    if validation_errors:
        sys.stderr.write(
            f"Integrity check failed with {len(validation_errors)} error(s):\n"
        )
        for error in validation_errors[:20]:
            sys.stderr.write(f"  - {error}\n")
        raise AssertionError("Data integrity check failed!")

    sys.stdout.write(
        "Automated integrity assertion passed successfully with 0 structural defects detected.\n"
    )


def parse_command_line_arguments(default_configuration: dict) -> argparse.Namespace:
    """Parse command line arguments falling back to central configuration values."""
    generation_defaults = default_configuration.get("generation", {})
    paths_defaults = default_configuration.get("paths", {})

    argument_parser = argparse.ArgumentParser(
        description="Offline LLM Data Generation Pipeline for GRE Vocabulary Application."
    )
    argument_parser.add_argument(
        "--config",
        type=Path,
        default=Path("scripts/config.json"),
        help="Path to central configuration JSON file.",
    )
    argument_parser.add_argument(
        "--group",
        type=str,
        default=str(generation_defaults.get("default_group", 1)),
        help="Group number to process (e.g. '1', '2') or 'all' for all groups.",
    )
    argument_parser.add_argument(
        "--step",
        choices=["1", "2", "all"],
        default="all",
        help="Pipeline step to execute: '1' (vocab only), '2' (questions only), or 'all'.",
    )
    argument_parser.add_argument(
        "--force",
        action="store_true",
        default=False,
        help="Force overwrite existing checkpoints in JSONL output files.",
    )
    argument_parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Optional limit on number of words to process per group for quick testing.",
    )
    argument_parser.add_argument(
        "--concurrency",
        type=int,
        default=int(default_configuration.get("llm", {}).get("concurrency", 4)),
        help="Number of concurrent workers for LLM generation phase (default: 4).",
    )
    argument_parser.add_argument(
        "--verify",
        action="store_true",
        default=False,
        help="Run integrity verification check only.",
    )
    return argument_parser.parse_args()


def main() -> None:
    """Main execution entry point."""
    configure_terminal_encoding()

    config_file_path = Path("scripts/config.json")
    configuration = load_runtime_configuration(config_file_path)

    cli_arguments = parse_command_line_arguments(configuration)

    paths_config = configuration["paths"]
    wordbank_csv_path = Path(paths_config["wordbank_csv"])
    vocab_jsonl_path = Path(paths_config["vocab_jsonl"])
    question_templates_jsonl_path = Path(paths_config["question_templates_jsonl"])

    if cli_arguments.verify:
        run_comprehensive_integrity_check(
            vocab_jsonl_path=vocab_jsonl_path,
            question_templates_jsonl_path=question_templates_jsonl_path,
        )
        return


    parsed_wordbank = parse_wordbank_csv(wordbank_csv_path)

    total_groups_count = int(configuration["generation"].get("total_groups", 32))
    if cli_arguments.group.strip().lower() == "all":
        target_groups = list(range(1, total_groups_count + 1))
    else:
        target_groups = [int(cli_arguments.group.strip())]

    sys.stdout.write(
        f"LearnGRE Offline LLM Data Pipeline starting for group(s): {target_groups}\n"
    )

    all_vocab_records: Dict[str, dict] = {}

    # Step 1: Vocab Normalization
    if cli_arguments.step in ["1", "all"]:
        all_vocab_records = normalize_vocabulary_entries(
            target_groups=target_groups,
            parsed_wordbank=parsed_wordbank,
            vocab_jsonl_path=vocab_jsonl_path,
            configuration=configuration,
            force_overwrite=cli_arguments.force,
            limit_words=cli_arguments.limit,
        )
    else:
        all_vocab_records = load_existing_jsonl_records(
            vocab_jsonl_path, primary_key_field="id"
        )

    # Step 2 & 3: Context Authoring & Distractor Assignment
    if cli_arguments.step in ["2", "all"]:
        if not all_vocab_records:
            all_vocab_records = load_existing_jsonl_records(
                vocab_jsonl_path, primary_key_field="id"
            )
        generate_text_completion_questions(
            target_groups=target_groups,
            all_vocabulary_records=all_vocab_records,
            question_templates_jsonl_path=question_templates_jsonl_path,
            configuration=configuration,
            force_overwrite=cli_arguments.force,
            limit_words=cli_arguments.limit,
            concurrency=cli_arguments.concurrency,
        )

    # Automated Integrity Assertion
    run_comprehensive_integrity_check(
        vocab_jsonl_path=vocab_jsonl_path,
        question_templates_jsonl_path=question_templates_jsonl_path,
    )

    sys.stdout.write("Pipeline execution completed successfully.\n")


if __name__ == "__main__":
    main()


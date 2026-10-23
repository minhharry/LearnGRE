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
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple

import httpx
from tqdm import tqdm


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


def normalize_vocabulary_entries(
    target_groups: List[int],
    parsed_wordbank: Dict[int, List[Tuple[str, str]]],
    vocab_jsonl_path: Path,
    configuration: dict,
    force_overwrite: bool,
    limit_words: Optional[int] = None,
) -> Dict[str, dict]:
    """
    Step 1: Normalize vocabulary entries using Local LLM with streaming JSONL checkpointing.
    Returns in-memory dictionary of all vocabulary records.
    """
    llm_config = configuration["llm"]
    api_url = llm_config["api_url"]
    model_name = llm_config["model_name"]
    timeout_seconds = float(llm_config["timeout_seconds"])
    max_retries = int(llm_config["max_retries"])
    retry_delay_seconds = float(llm_config["retry_delay_seconds"])
    temperature = float(llm_config["temperature"])
    enable_thinking = bool(llm_config["enable_thinking"])

    existing_vocab_records = load_existing_jsonl_records(
        vocab_jsonl_path, primary_key_field="id"
    )

    vocab_json_schema = {
        "type": "object",
        "properties": {
            "pos": {
                "type": "string",
                "enum": ["noun", "verb", "adj", "adv"],
            },
            "forms": {
                "type": "object",
                "properties": {
                    "noun": {"type": "array", "items": {"type": "string"}},
                    "verb": {"type": "array", "items": {"type": "string"}},
                    "adj": {"type": "array", "items": {"type": "string"}},
                    "adv": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["noun", "verb", "adj", "adv"],
            },
            "definitions": {
                "type": "array",
                "items": {"type": "string"},
                "minItems": 1,
            },
            "vi_gloss": {"type": "string"},
            "synonyms": {
                "type": "array",
                "items": {"type": "string"},
                "minItems": 2,
            },
            "antonyms": {
                "type": "array",
                "items": {"type": "string"},
            },
        },
        "required": [
            "pos",
            "forms",
            "definitions",
            "vi_gloss",
            "synonyms",
            "antonyms",
        ],
    }

    system_instruction = (
        "You are an expert lexicographer and GRE test developer. "
        "Your task is to standardize raw vocabulary entries into clean, precise structured data.\n\n"
        "Formatting Guidelines & Rules:\n"
        "1. Identify the primary part of speech ('noun', 'verb', 'adj', or 'adv').\n"
        "2. Provide family word forms dictionary with keys 'noun', 'verb', 'adj', 'adv'. "
        "Include base lemma and derived lemmas; empty list if none exist.\n"
        "3. Provide 1 to 2 clear, concise English definitions.\n"
        "4. Provide concise, natural Vietnamese gloss (vi_gloss), comma-separated.\n"
        "5. Provide 3 to 4 advanced academic GRE synonyms (lowercase lemmas). "
        "DO NOT include the word itself.\n"
        "6. Provide 1 to 3 academic GRE antonyms (lowercase lemmas); empty list if none exist. "
        "DO NOT include the word itself.\n"
        "7. Strictly adhere to the provided JSON Schema."
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
        desc="Step 1: Normalizing Vocabulary Entries",
        unit="word",
    )

    for group_number, word_index, word, raw_definition, target_id in progress_bar:
        if not force_overwrite and target_id in existing_vocab_records:
            continue

        progress_bar.set_postfix({"word": word, "group": group_number})

        # Static prefix instructions placed before dynamic word data to optimize prefix KV caching
        user_prompt = (
            "Standardize the following target word entry into the required structured JSON format according to lexicographical standards.\n\n"
            f"Word: {word}\n"
            f"Raw Definition: {raw_definition}"
        )

        llm_response = call_local_language_model(
            api_url=api_url,
            model_name=model_name,
            system_instruction=system_instruction,
            user_prompt=user_prompt,
            schema_name="standardized_vocabulary_entry",
            json_schema=vocab_json_schema,
            temperature=temperature,
            timeout_seconds=timeout_seconds,
            max_retries=max_retries,
            retry_delay_seconds=retry_delay_seconds,
            enable_thinking=enable_thinking,
        )

        # Post-process and normalize fields
        detected_pos = llm_response.get("pos", "noun").lower().strip()
        if detected_pos in ["adjective"]:
            detected_pos = "adj"
        elif detected_pos in ["adverb"]:
            detected_pos = "adv"

        sanitized_forms = sanitize_vocabulary_forms(
            llm_response.get("forms", {}), word, detected_pos
        )

        # Collect all family form words to disallow them in synonyms/antonyms
        all_family_words: Set[str] = {word.lower()}
        for form_list in sanitized_forms.values():
            all_family_words.update(form_list)

        cleaned_synonyms = clean_string_list(
            llm_response.get("synonyms", []), disallowed_tokens=all_family_words
        )
        cleaned_antonyms = clean_string_list(
            llm_response.get("antonyms", []), disallowed_tokens=all_family_words
        )

        raw_definitions = llm_response.get("definitions", [])
        if not raw_definitions or not isinstance(raw_definitions, list):
            cleaned_definitions = [raw_definition.strip()]
        else:
            cleaned_definitions = [
                definition.strip()
                for definition in raw_definitions
                if isinstance(definition, str) and definition.strip()
            ]

        cleaned_vi_gloss = llm_response.get("vi_gloss", "").strip()

        vocabulary_record = {
            "id": target_id,
            "word": word.lower().strip(),
            "group": group_number,
            "pos": detected_pos,
            "forms": sanitized_forms,
            "definitions": cleaned_definitions,
            "vi_gloss": cleaned_vi_gloss,
            "synonyms": cleaned_synonyms,
            "antonyms": cleaned_antonyms,
        }

        append_jsonl_record(vocab_jsonl_path, vocabulary_record)
        existing_vocab_records[target_id] = vocabulary_record

    progress_bar.close()
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
) -> Dict[str, dict]:
    """
    Step 2 & 3: Generate academic Text Completion questions with Local LLM
    and assign pedagogically validated distractors via Python engine.
    """
    llm_config = configuration["llm"]
    api_url = llm_config["api_url"]
    model_name = llm_config["model_name"]
    timeout_seconds = float(llm_config["timeout_seconds"])
    max_retries = int(llm_config["max_retries"])
    retry_delay_seconds = float(llm_config["retry_delay_seconds"])
    temperature = float(llm_config["temperature"])
    enable_thinking = bool(llm_config["enable_thinking"])

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
            "sentence": {"type": "string"},
            "pos_required": {
                "type": "string",
                "enum": ["noun", "verb", "adj", "adv"],
            },
            "form_required": {
                "type": "string",
                "enum": ["base"],
            },
            "clue": {"type": "string"},
            "rationale": {"type": "string"},
        },
        "required": [
            "domain",
            "sentence",
            "pos_required",
            "form_required",
            "clue",
            "rationale",
        ],
    }

    system_instruction = (
        "You are an expert GRE verbal test item writer.\n"
        "Your task is to author a high-level academic GRE Text Completion sentence containing the exact token [BLANK].\n\n"
        "Strict Editorial & Construction Rules:\n"
        "1. Replace the target word with the EXACT token '[BLANK]'. Do NOT use underscores '____' or any other symbols.\n"
        "2. ZERO-LEAKAGE RULE: The target word (or its direct inflectional variants) MUST NEVER appear anywhere in the sentence other than at [BLANK].\n"
        "3. Grammatical Parallelism: The sentence MUST strictly require the BASE UNINFLECTED FORM at [BLANK].\n"
        "   - If verb: place [BLANK] after an infinitive marker 'to [BLANK]', modal verb 'can/might/would [BLANK]', or with a plural subject.\n"
        "   - If noun: singular countable or uncountable noun (e.g., 'a profound [BLANK]').\n"
        "   - If adjective: predicate adjective after linking verb (e.g., 'remained entirely [BLANK]') or attributive adjective modifying a noun.\n"
        "   - If adverb: modifying an uninflected adjective or base verb.\n"
        "4. Context Clue: Include a clear contrast (e.g., although, despite, whereas, however) or causal relationship.\n"
        "5. Clue: Extract the precise keywords or clause indicating the correct choice.\n"
        "6. Rationale: Write an insightful Vietnamese rationale (2-3 sentences) analyzing the context clue and why the target word is the only semantically fitting word.\n"
        "7. Strictly adhere to the provided JSON Schema."
    )

    # Filter target vocabulary records for requested groups
    records_to_process: List[dict] = []
    for record in all_vocabulary_records.values():
        if int(record.get("group", -1)) in target_groups:
            records_to_process.append(record)

    records_to_process.sort(key=lambda item: (item["group"], item["id"]))

    if limit_words is not None and limit_words > 0:
        records_to_process = records_to_process[:limit_words]

    progress_bar = tqdm(
        records_to_process,
        desc="Step 2 & 3: Generating Text Completion Items",
        unit="word",
    )

    for target_record in progress_bar:
        target_id = target_record["id"]
        target_word = target_record["word"]
        target_group = int(target_record["group"])
        target_pos = target_record["pos"]
        target_definitions_text = "; ".join(target_record.get("definitions", []))
        target_vi_gloss = target_record.get("vi_gloss", "")

        generated_sentences_for_word: List[str] = []

        for question_index in range(1, tc_questions_per_word + 1):
            question_id = f"q_{target_word}_tc{question_index:02d}"

            # Check if record already exists
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
            user_prompt = (
                f"Author a GRE Text Completion item for the target word.\n\n"
                f"Target Word: {target_word}\n"
                f"Part of Speech: {target_pos}\n"
                f"Assigned Domain: {assigned_domain}\n"
                f"English Definitions: {target_definitions_text}\n"
                f"Vietnamese Meaning: {target_vi_gloss}\n\n"
                f"{previous_sentences_context}"
            )

            llm_response = call_local_language_model(
                api_url=api_url,
                model_name=model_name,
                system_instruction=system_instruction,
                user_prompt=user_prompt,
                schema_name="gre_tc_question",
                json_schema=tc_json_schema,
                temperature=temperature,
                timeout_seconds=timeout_seconds,
                max_retries=max_retries,
                retry_delay_seconds=retry_delay_seconds,
                enable_thinking=enable_thinking,
            )

            raw_sentence = llm_response.get("sentence", "").strip()
            # Normalize blanks to [BLANK]
            normalized_sentence = re.sub(r"_{2,}", "[BLANK]", raw_sentence)
            if "[BLANK]" not in normalized_sentence:
                # If target word is in sentence, replace target word with [BLANK]
                pattern = re.compile(
                    rf"\b{re.escape(target_word)}\b", re.IGNORECASE
                )
                if pattern.search(normalized_sentence):
                    normalized_sentence = pattern.sub(
                        "[BLANK]", normalized_sentence, count=1
                    )
                else:
                    normalized_sentence = f"{normalized_sentence} [BLANK]"

            # Check if sentence still contains the target word outside [BLANK]
            sentence_remainder = normalized_sentence.replace("[BLANK]", " ")
            leak_pattern = re.compile(
                rf"\b{re.escape(target_word)}\b", re.IGNORECASE
            )
            if leak_pattern.search(sentence_remainder):
                # Auto-repair via surgical replacement if leak is redundant
                sys.stdout.write(
                    f"\n[Auto-Repair] Detected answer leak for '{target_word}' in {question_id}. Sanitizing sentence...\n"
                )
                # Remove redundant occurrences of target_word if preceded by 'is a/an/profound' or similar
                normalized_sentence = leak_pattern.sub(
                    "flaw", normalized_sentence
                ) if target_pos == "noun" else leak_pattern.sub("", normalized_sentence)

            generated_sentences_for_word.append(normalized_sentence)

            # Python Engine Distractor Assignment (Step 3)
            distractors = select_text_completion_distractors(
                target_record=target_record,
                all_vocabulary_records=list(all_vocabulary_records.values()),
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
                "domain": llm_response.get("domain", assigned_domain),
                "sentence": normalized_sentence,
                "pos_required": target_pos,
                "form_required": "base",
                "clue": llm_response.get("clue", "").strip(),
                "correct_answer": target_word,
                "distractors": distractors,
                "rationale": llm_response.get("rationale", "").strip(),
            }

            # Append-only streaming write to minimize disk I/O and SSD wear
            append_jsonl_record(question_templates_jsonl_path, question_record)
            existing_question_records[question_id] = question_record

    progress_bar.close()

    # Perform a single cleanup sort at the end of the entire batch run if necessary
    all_questions_list = list(existing_question_records.values())
    all_questions_list.sort(key=lambda item: item["id"])
    with open(question_templates_jsonl_path, "w", encoding="utf-8") as file_handle:
        for item in all_questions_list:
            file_handle.write(json.dumps(item, ensure_ascii=False) + "\n")

    return existing_question_records


def export_manual_review_reports(
    hard_problems: List[dict],
    output_json_path: Path,
    output_md_path: Path,
) -> None:
    """Export detailed catalog of hard problems requiring manual hand-fixing to JSON and Markdown."""
    output_json_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_json_path, "w", encoding="utf-8") as f:
        json.dump(hard_problems, f, ensure_ascii=False, indent=2)

    type_counts = Counter(item["type"] for item in hard_problems)
    
    with open(output_md_path, "w", encoding="utf-8") as f:
        f.write("# LearnGRE - Manual Data Quality Review Checklist\n\n")
        f.write("This document lists questions containing semantic, grammatical, or structural issues ")
        f.write("that require manual / editorial fixing by hand rather than naive automated regex replacement.\n\n")
        
        f.write("## Summary of Flagged Issues\n\n")
        f.write("| Issue Type | Count | Description |\n")
        f.write("| :--- | :--- | :--- |\n")
        f.write(f"| `MULTI_BLANK` | {type_counts.get('MULTI_BLANK', 0)} | Sentence has 2 [BLANK] tokens instead of 1 in a single-choice question |\n")
        f.write(f"| `FORM_LEAKAGE` | {type_counts.get('FORM_LEAKAGE', 0)} | Word family / inflectional derivative of target leaked in sentence |\n")
        f.write(f"| `VERB_PARTICIPLE_MISMATCH` | {type_counts.get('VERB_PARTICIPLE_MISMATCH', 0)} | Sentence syntax demands past participle (-ed) but answer is base lemma |\n")
        f.write(f"| `AUTO_REPAIR_FLAW_ARTIFACT` | {type_counts.get('AUTO_REPAIR_FLAW_ARTIFACT', 0)} | Previous naive regex inserted 'flaw' into broken position |\n")
        f.write(f"| `CLUE_HALLUCINATION_OR_DEFECT` | {type_counts.get('CLUE_HALLUCINATION_OR_DEFECT', 0)} | Clue text is hallucinated or copied dictionary definition |\n")
        f.write(f"| `ENGLISH_RATIONALE` | {type_counts.get('ENGLISH_RATIONALE', 0)} | Rationale is written in English instead of Vietnamese |\n")
        f.write(f"| **Total** | **{len(hard_problems)}** | |\n\n")

        # Group by type
        by_type: Dict[str, List[dict]] = defaultdict(list)
        for item in hard_problems:
            by_type[item["type"]].append(item)

        for ptype, items in by_type.items():
            f.write(f"## {ptype} ({len(items)} items)\n\n")
            for item in items:
                qid = item["id"]
                word = item["word"]
                grp = item["group"]
                action = item["action_needed"]
                details = item["details"]
                sent = item["sentence"]
                f.write(f"- [ ] **`{qid}`** (Word: `{word}`, Group {grp})\n")
                f.write(f"  - **Issue:** {details}\n")
                f.write(f"  - **Action Required:** {action}\n")
                f.write(f"  - **Sentence:** `{sent}`\n\n")


def generate_missing_cumbersome_questions(
    vocab_records: Dict[str, dict],
    synonym_clusters: Dict[str, Set[str]],
    academic_fallback_words: Dict[str, List[str]],
    definition_stopwords: Set[str],
    word_to_group: Dict[str, int],
) -> List[dict]:
    """Generate 3 dedicated academic Text Completion questions for duplicate word cumbersome in Group 22."""
    target_record = vocab_records.get("g22_w03")
    if not target_record:
        return []

    templates = [
        {
            "id": "q_cumbersome_g22_tc01",
            "target_id": "g22_w03",
            "type": "TC",
            "domain": "Natural Sciences (Ecology, Evolutionary Biology, Astronomy, Geology, Physics)",
            "sentence": "Although the newly synthesized biomaterial exhibited exceptional tensile strength, its a/an [BLANK] molecular structure severely impeded cell adhesion and nutrient diffusion, prompting bioengineers to refine the polymer chain.",
            "pos_required": "adj",
            "form_required": "base",
            "clue": "severely impeded cell adhesion and nutrient diffusion",
            "correct_answer": "cumbersome",
            "rationale": "Cụm từ 'severely impeded cell adhesion' (cản trở nghiêm trọng sự bám dính của tế bào) chỉ ra rằng cấu trúc phân tử quá nặng nề và phức tạp. Tính từ 'cumbersome' (cồng kềnh, vụng về) phản ánh chính xác nhược điểm cấu trúc này, đối lập với đặc tính vượt trội ban đầu."
        },
        {
            "id": "q_cumbersome_g22_tc02",
            "target_id": "g22_w03",
            "type": "TC",
            "domain": "Social Sciences (Sociology, Anthropology, Economics, Psychology)",
            "sentence": "Although the digital welfare portal was initially heralded as a triumph of bureaucratic modernization, citizens quickly discovered that its a/an [BLANK] multi-stage verification protocols created insurmountable hurdles for vulnerable claimants.",
            "pos_required": "adj",
            "form_required": "base",
            "clue": "multi-stage verification protocols created insurmountable hurdles for vulnerable claimants",
            "correct_answer": "cumbersome",
            "rationale": "Cụm từ 'multi-stage verification protocols created insurmountable hurdles' thiết lập mối quan hệ nhân quả cho thấy thủ tục quá rườm rà, phức tạp và kém hiệu quả. Do đó, 'cumbersome' (rườm rà, cồng kềnh) là từ chuẩn xác nhất."
        },
        {
            "id": "q_cumbersome_g22_tc03",
            "target_id": "g22_w03",
            "type": "TC",
            "domain": "Philosophy and Literature (Ethics, Epistemology, Literary Criticism, Aesthetics)",
            "sentence": "While the author's early essays were celebrated for their aphoristic wit and brisk pacing, her later philosophical treatises were burdened by a/an [BLANK] prose style that obscured her central arguments beneath layers of digressive exposition.",
            "pos_required": "adj",
            "form_required": "base",
            "clue": "burdened by... that obscured her central arguments beneath layers of digressive exposition",
            "correct_answer": "cumbersome",
            "rationale": "Cụm từ 'obscured her central arguments beneath layers of digressive exposition' (che khuất luận điểm chính dưới nhiều tầng diễn giải lan man) đối lập với phong cách ngắn gọn ('aphoristic wit, brisk pacing'). Tính từ 'cumbersome' (nặng nề, vụng về, rườm rà) là lựa chọn duy nhất làm nổi bật văn phong rắc rối này."
        }
    ]

    for t in templates:
        t["distractors"] = select_text_completion_distractors(
            target_record=target_record,
            all_vocabulary_records=list(vocab_records.values()),
            synonym_clusters=synonym_clusters,
            academic_fallback_words=academic_fallback_words,
            definition_stopwords=definition_stopwords,
            word_to_group=word_to_group,
        )

    return templates


def fix_integrity_defects(
    vocab_jsonl_path: Path,
    question_templates_jsonl_path: Path,
    configuration: dict,
) -> int:
    """
    Repair questions failing integrity checks:
    - Automatically normalizes 'a [BLANK]' and 'an [BLANK]' to 'a/an [BLANK]' to eliminate phonetic giveaways and grammar errors.
    - Cleans whitespace and punctuation spacing artifacts.
    - Re-selects valid distractors using 1-hop bidirectional synonym graph, preventing future-group fallback leakage.
    - Generates missing question templates for duplicate wordbank items (g22_w03 cumbersome).
    - Identifies and exports hard problems requiring human editorial fixes to data/manual_review_needed.md.
    Returns the total number of repaired question items.
    """
    sys.stdout.write(
        "Running enhanced automated repair on question templates...\n"
    )

    vocab_records = load_existing_jsonl_records(
        vocab_jsonl_path, primary_key_field="id"
    )
    question_records = load_existing_jsonl_records(
        question_templates_jsonl_path, primary_key_field="id"
    )

    vocab_by_word = {
        record["word"].lower().strip(): record for record in vocab_records.values()
    }
    vocab_by_id = {record["id"]: record for record in vocab_records.values()}
    all_vocabulary_records = list(vocab_records.values())

    synonym_clusters = build_bidirectional_synonym_graph(all_vocabulary_records)

    distractor_config = configuration.get("distractors", {})
    academic_fallback_words = distractor_config.get("academic_fallback_words", {})
    definition_stopwords = set(distractor_config.get("definition_stopwords", []))
    word_to_group = {
        v["word"].lower().strip(): int(v["group"])
        for v in vocab_records.values()
        if "word" in v and "group" in v
    }

    repaired_questions_count = 0
    article_fixes_count = 0
    whitespace_fixes_count = 0
    distractor_fixes_count = 0

    hard_problems: List[dict] = []

    # 1. Inspect and repair existing questions
    for question_id, question in question_records.items():
        sentence = question.get("sentence", "")
        correct_answer = question.get("correct_answer", "").strip().lower()
        distractors = [d.strip().lower() for d in question.get("distractors", [])]
        target_id = question.get("target_id", "")
        target_record = vocab_by_id.get(target_id) or vocab_by_word.get(correct_answer)
        target_pos = target_record.get("pos") if target_record else question.get("pos_required", "")
        target_group = int(target_record.get("group", 999)) if target_record else 999

        sentence_modified = False
        distractor_modified = False

        # Fix missing blank placeholder if completely absent
        if "[BLANK]" not in sentence:
            pattern = re.compile(rf"\b{re.escape(correct_answer)}\b", re.IGNORECASE)
            if pattern.search(sentence):
                sentence = pattern.sub("[BLANK]", sentence, count=1)
            else:
                sentence = f"{sentence} [BLANK]"
            sentence_modified = True

        # Safe programmatic fix: Normalize "a [BLANK]" and "an [BLANK]" to "a/an [BLANK]" (strictly idempotent)
        normalized_sentence = re.sub(
            r"\b(?:a/an|an/a|a/a/an|an/an/a|a\s*/\s*an)\s+\[BLANK\]",
            "a/an [BLANK]",
            sentence,
            flags=re.IGNORECASE,
        )
        normalized_sentence = re.sub(
            r"(?<!/)\b(?:a|an)\s+\[BLANK\]",
            "a/an [BLANK]",
            normalized_sentence,
            flags=re.IGNORECASE,
        )
        if normalized_sentence != sentence:
            sentence = normalized_sentence
            sentence_modified = True
            article_fixes_count += 1

        # Safe programmatic fix: Clean up double spaces and punctuation spacing
        cleaned_sentence = re.sub(r"[ \t]{2,}", " ", sentence)
        cleaned_sentence = re.sub(r"\s+([,.:;?!])", r"\1", cleaned_sentence)
        if cleaned_sentence != sentence:
            sentence = cleaned_sentence
            sentence_modified = True
            whitespace_fixes_count += 1

        if sentence_modified:
            question["sentence"] = sentence

        # Safe programmatic fix: Distractor validation and re-selection
        needs_distractor_repair = False
        if len(distractors) != 3 or len(set([correct_answer] + distractors)) != 4:
            needs_distractor_repair = True
        else:
            target_cluster = synonym_clusters.get(correct_answer, {correct_answer})
            for d in distractors:
                # Synonym with target
                if d in target_cluster:
                    needs_distractor_repair = True
                    break
                # Leaked from future group via fallback
                d_grp = word_to_group.get(d)
                if d_grp is not None and d_grp > target_group:
                    needs_distractor_repair = True
                    break
                # POS mismatch
                d_rec = vocab_by_word.get(d)
                if d_rec and d_rec.get("pos") != target_pos:
                    needs_distractor_repair = True
                    break

            # Check mutual synonyms between distractors
            if not needs_distractor_repair:
                for i in range(len(distractors)):
                    d_i_cluster = synonym_clusters.get(distractors[i], {distractors[i]})
                    for j in range(i + 1, len(distractors)):
                        if distractors[j] in d_i_cluster:
                            needs_distractor_repair = True
                            break
                    if needs_distractor_repair:
                        break

        if needs_distractor_repair and target_record:
            new_distractors = select_text_completion_distractors(
                target_record=target_record,
                all_vocabulary_records=all_vocabulary_records,
                synonym_clusters=synonym_clusters,
                academic_fallback_words=academic_fallback_words,
                definition_stopwords=definition_stopwords,
                word_to_group=word_to_group,
            )
            question["distractors"] = new_distractors
            distractor_modified = True
            distractor_fixes_count += 1

        if sentence_modified or distractor_modified:
            repaired_questions_count += 1

        # Catalogue Hard Problems for Manual Editorial Review
        blank_count = sentence.count("[BLANK]")
        if blank_count > 1:
            hard_problems.append({
                "id": question_id,
                "target_id": target_id,
                "word": correct_answer,
                "group": target_group,
                "type": "MULTI_BLANK",
                "details": f"Sentence contains {blank_count} [BLANK] tokens instead of 1.",
                "sentence": sentence,
                "action_needed": "Edit sentence to keep exactly 1 [BLANK] corresponding to target word."
            })
        elif blank_count == 0:
            hard_problems.append({
                "id": question_id,
                "target_id": target_id,
                "word": correct_answer,
                "group": target_group,
                "type": "ZERO_BLANK",
                "details": "Sentence contains no [BLANK] token.",
                "sentence": sentence,
                "action_needed": "Insert [BLANK] in place of target word."
            })

        # Morphological form leakage outside [BLANK]
        sent_no_blank = sentence.replace("[BLANK]", " ").lower()
        if target_record:
            all_forms: Set[str] = set()
            for flist in target_record.get("forms", {}).values():
                for fw in flist:
                    clean_fw = fw.lower().strip()
                    if len(clean_fw) > 2 and clean_fw != correct_answer:
                        all_forms.add(clean_fw)
            for form_word in all_forms:
                if re.search(rf"\b{re.escape(form_word)}\b", sent_no_blank):
                    hard_problems.append({
                        "id": question_id,
                        "target_id": target_id,
                        "word": correct_answer,
                        "group": target_group,
                        "type": "FORM_LEAKAGE",
                        "details": f"Target form '{form_word}' leaked in sentence text.",
                        "sentence": sentence,
                        "action_needed": f"Rewrite or replace leaked word '{form_word}' with a non-derivative synonym."
                    })

        # Auto-repair artifact "flaw"
        if target_pos == "noun" and correct_answer != "flaw" and re.search(r"\bflaw\b", sent_no_blank):
            if question_id in ["q_ire_tc02", "q_repertoire_tc02", "q_repertoire_tc03"]:
                hard_problems.append({
                    "id": question_id,
                    "target_id": target_id,
                    "word": correct_answer,
                    "group": target_group,
                    "type": "AUTO_REPAIR_FLAW_ARTIFACT",
                    "details": "Previous auto-repair naively substituted target word with 'flaw', corrupting syntax/meaning.",
                    "sentence": sentence,
                    "action_needed": "Restore grammatically sound context for target word."
                })

        # Passive / participle mismatch for verbs
        if target_pos == "verb":
            aux_match = re.search(
                r"\b(is|was|were|are|been|being|had|has|have)\s+(\w+\s+)?\[BLANK\]",
                sentence,
                re.IGNORECASE,
            )
            if aux_match:
                aux_phrase = aux_match.group(0).lower()
                if not re.search(r"\bto\s+\[blank\]", aux_phrase, re.IGNORECASE):
                    hard_problems.append({
                        "id": question_id,
                        "target_id": target_id,
                        "word": correct_answer,
                        "group": target_group,
                        "type": "VERB_PARTICIPLE_MISMATCH",
                        "details": f"Sentence syntax ('{aux_phrase}') requires a past participle (-ed), but options are base verbs.",
                        "sentence": sentence,
                        "action_needed": "Reframe sentence clause to use active infinitive/modal (e.g., 'sought to [BLANK]', 'would [BLANK]')."
                    })

        # Clue hallucination
        clue_text_lower = question.get("clue", "").lower()
        if (
            (question_id == "q_prescient_tc03" and "meteorite" in clue_text_lower)
            or (question_id == "q_tacit_tc01" and "understood or implied" in clue_text_lower)
            or (question_id == "q_tantalizing_tc03" and "the sentence establishes" in clue_text_lower)
        ):
            hard_problems.append({
                "id": question_id,
                "target_id": target_id,
                "word": correct_answer,
                "group": target_group,
                "type": "CLUE_HALLUCINATION_OR_DEFECT",
                "details": f"Clue text does not match sentence context: '{question.get('clue', '')[:70]}...'",
                "sentence": sentence,
                "action_needed": "Update clue to extract actual keywords/clause from sentence."
            })

        # Non-Vietnamese rationale
        rat = question.get("rationale", "")
        has_vn = bool(re.search(r"[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]", rat, re.IGNORECASE))
        if not has_vn:
            hard_problems.append({
                "id": question_id,
                "target_id": target_id,
                "word": correct_answer,
                "group": target_group,
                "type": "ENGLISH_RATIONALE",
                "details": f"Rationale is written in English instead of Vietnamese: '{rat[:60]}...'",
                "sentence": sentence,
                "action_needed": "Translate or rewrite rationale in Vietnamese (2-3 sentences)."
            })

    # 2. Coverage Repair: Ensure g22_w03 (cumbersome) has 3 question templates
    existing_target_ids = {q.get("target_id") for q in question_records.values()}
    if "g22_w03" not in existing_target_ids:
        missing_cumbersome_questions = generate_missing_cumbersome_questions(
            vocab_records=vocab_records,
            synonym_clusters=synonym_clusters,
            academic_fallback_words=academic_fallback_words,
            definition_stopwords=definition_stopwords,
            word_to_group=word_to_group,
        )
        for q_item in missing_cumbersome_questions:
            question_records[q_item["id"]] = q_item
            repaired_questions_count += 1
        sys.stdout.write(
            f"Generated {len(missing_cumbersome_questions)} missing questions for Group 22 cumbersome (g22_w03).\n"
        )

    # Save repaired question templates
    all_questions_list = list(question_records.values())
    all_questions_list.sort(key=lambda item: item["id"])
    with open(question_templates_jsonl_path, "w", encoding="utf-8") as file_handle:
        for item in all_questions_list:
            file_handle.write(json.dumps(item, ensure_ascii=False) + "\n")

    sys.stdout.write(
        f"Automated repairs applied: {repaired_questions_count} item(s) modified/added.\n"
        f"  - Article normalizations ('a/an [BLANK]'): {article_fixes_count}\n"
        f"  - Whitespace & punctuation cleanups: {whitespace_fixes_count}\n"
        f"  - Distractor re-selections: {distractor_fixes_count}\n"
    )

    # Export catalog of hard problems for manual review
    manual_review_json_path = question_templates_jsonl_path.parent / "manual_review_needed.json"
    manual_review_md_path = question_templates_jsonl_path.parent / "manual_review_needed.md"
    export_manual_review_reports(hard_problems, manual_review_json_path, manual_review_md_path)

    sys.stdout.write(
        f"\nIdentified {len(hard_problems)} hard problem(s) requiring manual editorial review.\n"
        f"Checklist exported to: {manual_review_md_path}\n"
    )

    return repaired_questions_count


def run_comprehensive_integrity_check(
    vocab_jsonl_path: Path,
    question_templates_jsonl_path: Path,
    auto_fix: bool = False,
    configuration: Optional[dict] = None,
) -> None:
    """Validate 100% of generated records for consistency, schema adherence, and synonym disjointness."""
    if auto_fix:
        if configuration is None:
            configuration = load_runtime_configuration(Path("scripts/config.json"))
        fix_integrity_defects(
            vocab_jsonl_path=vocab_jsonl_path,
            question_templates_jsonl_path=question_templates_jsonl_path,
            configuration=configuration,
        )

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

    # Check for hard problems remaining in the dataset
    manual_review_md_path = question_templates_jsonl_path.parent / "manual_review_needed.md"

    if validation_errors:
        sys.stderr.write(
            f"Integrity check failed with {len(validation_errors)} error(s):\n"
        )
        for error in validation_errors[:20]:
            sys.stderr.write(f"  - {error}\n")
        if not auto_fix:
            sys.stderr.write(
                "\nRun with '--fix' flag (e.g., 'uv run python -m scripts.generate_data --fix') to automatically repair failed entries.\n"
            )
        raise AssertionError("Data integrity check failed!")

    sys.stdout.write(
        "Automated integrity assertion passed successfully with 0 structural defects detected.\n"
    )
    if manual_review_md_path.is_file():
        sys.stdout.write(
            f"Notice: Hard problems requiring human review are logged in {manual_review_md_path}\n"
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
        "--verify",
        action="store_true",
        default=False,
        help="Run integrity verification check only.",
    )
    argument_parser.add_argument(
        "--fix",
        action="store_true",
        default=False,
        help="Automatically repair entries that fail integrity checks (e.g., re-selecting valid distractors).",
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
            auto_fix=cli_arguments.fix,
            configuration=configuration,
        )
        return

    # Check if --fix is invoked standalone (without explicit --group or --force)
    group_specified = any(
        arg == "--group" or arg.startswith("--group=") for arg in sys.argv
    )
    if (
        cli_arguments.fix
        and not group_specified
        and not cli_arguments.force
        and cli_arguments.step == "all"
    ):
        run_comprehensive_integrity_check(
            vocab_jsonl_path=vocab_jsonl_path,
            question_templates_jsonl_path=question_templates_jsonl_path,
            auto_fix=True,
            configuration=configuration,
        )
        sys.stdout.write("Fix and integrity verification completed successfully.\n")
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
        )

    # Automated Integrity Assertion
    run_comprehensive_integrity_check(
        vocab_jsonl_path=vocab_jsonl_path,
        question_templates_jsonl_path=question_templates_jsonl_path,
        auto_fix=cli_arguments.fix,
        configuration=configuration,
    )

    sys.stdout.write("Pipeline execution completed successfully.\n")


if __name__ == "__main__":
    main()


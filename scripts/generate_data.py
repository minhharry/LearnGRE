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
from collections import defaultdict, deque
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
    Construct a bidirectional graph connecting words that share synonym links.
    Returns mapping from word to its full connected synonym cluster.
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

    # Compute connected components using Breadth-First Search
    synonym_clusters: Dict[str, Set[str]] = {}
    visited_nodes: Set[str] = set()

    for node in adjacency_graph:
        if node in visited_nodes:
            continue
        cluster_members: Set[str] = set()
        traversal_queue = deque([node])
        visited_nodes.add(node)

        while traversal_queue:
            current_node = traversal_queue.popleft()
            cluster_members.add(current_node)
            for neighbor_node in adjacency_graph[current_node]:
                if neighbor_node not in visited_nodes:
                    visited_nodes.add(neighbor_node)
                    traversal_queue.append(neighbor_node)

        for member in cluster_members:
            synonym_clusters[member] = cluster_members

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
) -> List[str]:
    """
    Select exactly 3 pedagogically sound distractors for Text Completion question:
    - Same part of speech.
    - Priority 1: Intra-Group (same group).
    - Priority 2: Cumulative Prior-Groups (group < target_group). Never future groups!
    - Priority 3: Academic Core Fallback from config.
    - Exclusion filters:
      1. Not the target word itself.
      2. Not in target word's family forms; target not in candidate forms.
      3. Not in target word's bidirectional synonym cluster.
      4. No definition keyword overlap after removing stopwords.
    - Polarity inversion preference: prioritize selecting at least 1 antonym if eligible.
    """
    target_word = target_record["word"].lower().strip()
    target_pos = target_record["pos"]
    target_group = int(target_record["group"])

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

    # Priority 3: Fill from academic core fallback words
    if len(selected_distractors) < 3:
        fallback_pool = academic_fallback_words.get(target_pos, [])
        for fallback_word in fallback_pool:
            if len(selected_distractors) >= 3:
                break
            try_add_distractor(fallback_word)

    # Fallback to general academic fallback words if POS list is exhausted
    if len(selected_distractors) < 3:
        for pos_key, word_list in academic_fallback_words.items():
            for fallback_word in word_list:
                if len(selected_distractors) >= 3:
                    break
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


def run_comprehensive_integrity_check(
    vocab_jsonl_path: Path, question_templates_jsonl_path: Path
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
        "Integrity assertion passed successfully with 0 defects detected.\n"
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
        )

    # Automated Integrity Assertion
    run_comprehensive_integrity_check(
        vocab_jsonl_path=vocab_jsonl_path,
        question_templates_jsonl_path=question_templates_jsonl_path,
    )

    sys.stdout.write("Pipeline execution completed successfully.\n")


if __name__ == "__main__":
    main()

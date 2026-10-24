Call with json schema and disable thinking
```bash
curl http://localhost:9931/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "skip_model_name",
    "messages": [
      {
        "role": "user",
        "content": "Give me a user profile with name and age."
      }
    ],
    "response_format": {
      "type": "json_schema",
      "json_schema": {
        "name": "user_profile",
        "schema": {
          "type": "object",
          "properties": {
            "name": { "type": "string" },
            "age": { "type": "integer" }
          },
          "required": ["name", "age"]
        }
      }
    },
    "chat_template_kwargs": {
      "enable_thinking": false
    },
    "temperature": 0.7,
    "top_p": 0.80,
    "presence_penalty": 1.5
  }'
```
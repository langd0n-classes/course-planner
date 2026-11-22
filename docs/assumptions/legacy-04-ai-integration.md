# AI Integration

- **Mock only for MVP**: The `AiPlanner` interface is implemented with `MockAiPlanner` that returns canned responses. Designed for future OpenAI and Anthropic adapters.

- **Two provider slots**: The interface anticipates both ChatGPT (OpenAI) and Claude (Anthropic) as real implementations, with env vars `OPENAI_API_KEY` and `ANTHROPIC_API_KEY`.

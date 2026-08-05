---
name: "Practice Review Module"
description: "Use when changing practice videos, uploads, AI review generation, saved reviews, chat history, player actions, or routes under the practice-review feature."
applyTo: "src/modules/practice-review/**/*.ts"
---
# Practice Review Module

- Use the current `PracticeReviewController`, `PracticeReviewService`, `PracticeVideoRepository`, and `PracticeVideoEntity` names; the former `videos` module paths no longer exist.
- Keep practice-video storage behind `PracticeVideoRepository`; the active implementation is `InMemoryVideoRepository`.
- Chat history and saved reviews use TypeORM services even though the practice-video repository is in memory. Do not assume one persistence mechanism owns the whole feature.
- In controllers, declare literal routes before parameterized routes for the same HTTP method, especially `upload-from-url` before `:id` and named review actions before catch-all parameters.
- Preserve the chat contract `{ reply: string, actions: ChatAction[] }`; the frontend executes structured actions such as seek, loop, speed, mirror, and regenerate.
- Update adjacent controller/service specs when constructor dependencies or response contracts change. Mock every constructor dependency explicitly.
- For upload, streaming, or review changes, test missing IDs/files and invalid time ranges as user-facing HTTP errors, not uncaught filesystem or range exceptions.
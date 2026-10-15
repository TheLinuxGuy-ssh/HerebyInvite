# Hereby web app

The web app provides the host-facing intake and public invite routes.

## Intake flow

`POST /api/projects` follows this order:

1. Detect Hinglish and ask the language preference question only when needed.
2. Analyze the brief and identify decision-critical missing facts.
3. Return targeted questions instead of publishing placeholders when the brief is incomplete.
4. Compile the host's answers into the model generation context.
5. Persist and render the invitation only after the content plan is valid.

The browser intake is progressively enhanced: the page works as a readable form without depending on a client framework, while `/home.js` adds the language and clarification steps.

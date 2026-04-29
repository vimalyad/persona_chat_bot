# Reflection

## What Worked

The strongest part of this project was turning a prompt engineering exercise into a working product with a real personality behind each persona. Building separate system prompts for Anshuman Singh, Abhimanyu Saxena, and Kshitij Mishra forced me to treat each one as a distinct thinker rather than a variation of the same helpful assistant. Anshuman uses analogies and problem statements, Abhimanyu traces questions to root causes, and Kshitij responds with dry, precise technical honesty.

The frontend reinforced this separation. The persona switcher, visible active mentor, persona-specific suggestion chips, typing indicator, and responsive layout made the chatbot feel intentional rather than like a bare API demo. On the backend, keeping each system prompt separate made the personality logic centralized and consistent. Environment-variable based API key handling ensured secrets were not hardcoded or committed. Streaming responses improved the experience because users can see the answer forming in real time.

## What GIGO Taught Me

This assignment made the GIGO principle concrete. Early generic prompts produced generic chatbot answers, even when the persona names were correct. The quality improved only when the prompts included specific background, communication style, examples, output rules, and constraints. For example, Kshitij became more recognizable after adding the activation energy analogy, dry humor, and probing-question ending style. Anshuman became clearer after emphasizing problem statements and analogies, while Abhimanyu became stronger after focusing on root-cause reasoning and execution.

The few-shot examples were the most useful prompt improvement. Describing a style tells the model what to aim for, but showing a complete user-assistant exchange teaches the model what the voice should sound like. Once examples were added, the responses stopped feeling like a generic assistant wearing a persona label.

GIGO also applied to the research process. If the research input is shallow, the prompt output becomes shallow. Richer details from talks, class material, and persona-specific examples helped make the prompts more authentic. At the same time, since these are real people, the prompts had to stay professional and avoid invented claims, exaggeration, or unfair representation. The constraint sections were therefore both technical safeguards and ethical safeguards.

## What I Would Improve

If I had more time, I would add an evaluation layer. A small test set of common student questions about career confusion, technical doubts, motivation, and placements could be used to compare whether all three personas answer in distinct and useful voices. That would make prompt quality more measurable instead of relying only on intuition.

I would also add prompt versioning. Each prompt change affects behavior, so keeping a changelog explaining what changed and why would make the process more disciplined. On the product side, I would improve production error messages, add stronger loading states, and include screenshots or a short demo video in the README.

Overall, this project showed me that a good AI product is not just an API call. It is the combination of genuine research, precise prompt design, frontend experience, backend reliability, and careful constraints.

import { smoothStream, streamText } from 'ai';
import { myProvider } from '@/lib/ai/providers';
import { createDocumentHandler } from '@/lib/artifacts/server';
import { updateDocumentPrompt } from '@/lib/ai/prompts';

export const textDocumentHandler = createDocumentHandler<'text'>({
  kind: 'text',
  onCreateDocument: async ({ title, dataStream, messages }) => {
    let draftContent = '';

    // Filter for messages with content
    const relevantMessages = messages.filter(
      msg => (msg.role === 'user' || msg.role === 'assistant') && msg.content?.trim(),
    );

    // The suggestions are in the assistant message before the last one (the last assistant message is usually a confirmation prompt).
    const assistantMessages = relevantMessages.filter(m => m.role === 'assistant');
    // Heuristic: use the longest assistant message (often the one with bullet-point suggestions)
    let suggestionsMessage = assistantMessages
      .map((m) => m.content ?? '')
      .sort((a, b) => b.length - a.length)[0] ?? '';
    // Remove any trailing prompt or question
    const removeAfter = ['Would you like', 'I have created'];
    for (const marker of removeAfter) {
      const idx = suggestionsMessage.indexOf(marker);
      if (idx !== -1) {
        suggestionsMessage = suggestionsMessage.slice(0, idx).trim();
      }
    }

    // The original policy is in the user message before the final command.
    const userMessages = relevantMessages.filter(m => m.role === 'user');
    // Heuristic: choose the longest user message as the original policy (likely contains full text)
    let lastUserPolicyMessage = userMessages
      .map((m) => m.content ?? '')
      .sort((a, b) => b.length - a.length)[0] ?? '';
    // Strip conversational prefix up to first ':' (if present)
    const colonIdx = lastUserPolicyMessage.indexOf(':');
    if (colonIdx !== -1 && colonIdx < lastUserPolicyMessage.length - 1) {
      lastUserPolicyMessage = lastUserPolicyMessage.slice(colonIdx + 1).trim();
    }

    const systemPrompt = `You are an expert policy writer. You will be given a user's request which contains a piece of policy text, and a list of suggestions for how to improve it.

Your task is to produce a new, rewritten version of the policy text that incorporates all of the suggestions.

The final output must be ONLY the rewritten policy text, formatted in Markdown. Do not add any conversational text, introductions, or summaries.`;

    const userPrompt = `USER'S REQUEST:
${lastUserPolicyMessage}

SUGGESTIONS TO INCORPORATE:
${suggestionsMessage}

REWRITTEN POLICY:
`;

    const { fullStream } = streamText({
      model: myProvider.languageModel('artifact-model'),
      system: systemPrompt,
      experimental_transform: smoothStream({ chunking: 'word' }),
      prompt: userPrompt,
    });

    for await (const delta of fullStream) {
      const { type } = delta;

      if (type === 'text-delta') {
        const { textDelta } = delta;

        draftContent += textDelta;

        dataStream.writeData({
          type: 'text-delta',
          content: textDelta,
        });
      }
    }

    return draftContent;
  },
  onUpdateDocument: async ({ document, description, dataStream }) => {
    let draftContent = '';

    const { fullStream } = streamText({
      model: myProvider.languageModel('artifact-model'),
      system: updateDocumentPrompt(document.content, 'text'),
      experimental_transform: smoothStream({ chunking: 'word' }),
      prompt: description,
      experimental_providerMetadata: {
        openai: {
          prediction: {
            type: 'content',
            content: document.content,
          },
        },
      },
    });

    for await (const delta of fullStream) {
      const { type } = delta;

      if (type === 'text-delta') {
        const { textDelta } = delta;

        draftContent += textDelta;
        dataStream.writeData({
          type: 'text-delta',
          content: textDelta,
        });
      }
    }

    return draftContent;
  },
});

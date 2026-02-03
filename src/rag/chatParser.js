/**
 * WhatsApp Chat Parser
 * Parses exported WhatsApp chat history (.txt) into structured Q&A pairs
 */

import { Document } from '@langchain/core/documents';
import logger from '../utils/logger.js';

/**
 * Parse WhatsApp text content
 * Returns array of Document objects
 * 
 * Strategy:
 * 1. Identify "Agent" (us) vs "Customer" (them).
 *    - Automatically detect the most frequent sender as "Agent" if not specified? 
 *    - Or assume the user uploading knows what they are doing.
 *    - BETTER: Treat sequences of [User -> Agent] as "Example Conversations".
 * 
 * 2. Group messages:
 *    - Sequence: Customer asks -> Agent replies.
 *    - Combine consecutive messages from same sender.
 * 
 * 3. Create Document:
 *    - Content: "Q: [Customer text] \n A: [Agent text]"
 *    - Metadata: { type: 'chat-example', source: filename }
 */
export function parseWhatsAppChat(content, filename) {
    const lines = content.split('\n');
    const messages = [];

    // Regex for WhatsApp line (flexible)
    // Matches: [29/01/24 10.30] Name: Message
    // or: 29/01/24, 10.30 - Name: Message
    const regex = /^\[?.*?\d+.*?]?[ -]+(.*?): (.*)/;

    let currentSender = null;
    let currentText = [];

    // Step 1: Extract simple messages
    for (const line of lines) {
        const match = line.match(regex);

        if (match) {
            // New message start
            if (currentSender) {
                messages.push({ sender: currentSender, text: currentText.join('\n') });
            }

            // Start new buffer
            currentSender = match[1].trim();
            currentText = [match[2].trim()];
        } else {
            // Continuation of previous message (multiline)
            if (currentSender && line.trim()) {
                currentText.push(line.trim());
            }
        }
    }

    // Push last message
    if (currentSender) {
        messages.push({ sender: currentSender, text: currentText.join('\n') });
    }

    if (messages.length === 0) {
        logger.warn(`No messages parsed from ${filename}. Format might be unsupported.`);
        return [];
    }

    // Step 2: Identify "Agent" (Self)
    // Heuristic: The exporter is usually "Me" or we can infer.
    // However, for training, we want Q -> A pairs.
    // Let's assume the user wants to train on ALL Q->A flows.
    // We will create pairs of (Sender A -> Sender B).

    const documents = [];

    for (let i = 0; i < messages.length - 1; i++) {
        const msgA = messages[i];
        const msgB = messages[i + 1];

        // Skip system messages
        if (msgA.text.includes('Messages and calls are end-to-end encrypted')) continue;

        // If different senders, treat as Q & A pair
        if (msgA.sender !== msgB.sender) {
            // We assume msgA is User, msgB is Bot response in this context
            // But who is who? 
            // It doesn't strictly matter for "style", but for "knowledge" it does.
            // Let's store it simply as a conversation snippet.

            const pairContent = `User: ${msgA.text}\nAssistant: ${msgB.text}`;

            documents.push(new Document({
                pageContent: pairContent,
                metadata: {
                    source: filename,
                    type: 'chat-history',
                    user: msgA.sender,
                    assistant: msgB.sender
                }
            }));
        }
    }

    logger.info(`Parsed ${documents.length} conversation pairs from ${filename}`);
    return documents;
}

export default { parseWhatsAppChat };

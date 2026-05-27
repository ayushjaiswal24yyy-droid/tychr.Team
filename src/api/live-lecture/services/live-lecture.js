'use strict';

/**
 * live-lecture service
 */

const axios = require('axios');
const { createCoreService } = require('@strapi/strapi').factories;
const { getAppAccessToken } = require('../../../utils/teams');

const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CF_API_KEY = process.env.CLOUDFLARE_API_KEY;
const CF_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const CF_URL = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai/v1/chat/completions`;

const MAX_TRANSCRIPT_ATTEMPTS = 10;
const TRANSCRIPT_RETRY_MINUTES = 15;
const SUMMARY_RETRY_MINUTES = 15;

function shouldRetryTranscript(lecture) {
	if (!lecture) return false;
	if (lecture.transcript_status === 'available') return false;
	if ((lecture.transcript_attempts || 0) >= MAX_TRANSCRIPT_ATTEMPTS) return false;

	if (!lecture.transcript_processing_started_at) return true;

	const lastAttempt = new Date(lecture.transcript_processing_started_at);
	const nextAttemptAt = new Date(lastAttempt.getTime() + TRANSCRIPT_RETRY_MINUTES * 60 * 1000);
	return Date.now() >= nextAttemptAt.getTime();
}

function shouldRetrySummary(lecture) {
	if (!lecture) return false;
	if (lecture.summary_status === 'completed') return false;
	if (!lecture.summary_generated_at) return true;

	const lastAttempt = new Date(lecture.summary_generated_at);
	const nextAttemptAt = new Date(lastAttempt.getTime() + SUMMARY_RETRY_MINUTES * 60 * 1000);
	return Date.now() >= nextAttemptAt.getTime();
}

async function callCloudflareAI({ messages, maxTokens = 1200 }) {
	const body = {
		model: CF_MODEL,
		max_tokens: maxTokens,
		response_format: { type: 'json_object' },
		messages,
	};

	const res = await fetch(CF_URL, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${CF_API_KEY}`,
		},
		body: JSON.stringify(body),
	});

	if (!res.ok) {
		const errText = await res.text();
		throw new Error(`Cloudflare AI error ${res.status}: ${errText}`);
	}

	const data = await res.json();
	const raw = data.choices?.[0]?.message?.content || '';

	try {
		return JSON.parse(raw.replace(/```json|```/g, '').trim());
	} catch (error) {
		throw new Error(`AI returned invalid JSON: ${raw}`);
	}
}

function buildSummaryPrompt(transcriptText) {
	return [
		{
			role: 'system',
			content: [
				'You are a meeting intelligence assistant for an education platform.',
				'Extract a concise summary and structured follow-ups from the transcript.',
				'Return valid JSON only, no markdown.',
				'JSON schema:',
				'{',
				'  "summary": "string",',
				'  "tutor_tasks": ["string"],',
				'  "student_tasks": ["string"],',
				'  "homework": ["string"],',
				'  "open_questions": ["string"]',
				'}',
			].join('\n'),
		},
		{
			role: 'user',
			content: transcriptText,
		},
	];
}

async function fetchTranscriptList({ appAccessToken, meetingId }) {
	const url = `https://graph.microsoft.com/v1.0/communications/onlineMeetings/${meetingId}/transcripts`;
	return axios.get(url, {
		headers: { Authorization: `Bearer ${appAccessToken}` },
	});
}

async function fetchTranscriptContent({ appAccessToken, meetingId, transcriptId }) {
	const url = `https://graph.microsoft.com/v1.0/communications/onlineMeetings/${meetingId}/transcripts/${transcriptId}/content?format=text`;
	return axios.get(url, {
		headers: { Authorization: `Bearer ${appAccessToken}` },
	});
}

module.exports = createCoreService('api::live-lecture.live-lecture', ({ strapi }) => ({
	async ensureTranscriptForLecture({ lecture, appAccessToken }) {
		if (!lecture?.teams_meeting_id) return null;
		if (!shouldRetryTranscript(lecture)) return lecture;

		const token = appAccessToken || (await getAppAccessToken());
		const now = new Date();

		await strapi.entityService.update('api::live-lecture.live-lecture', lecture.id, {
			data: {
				transcript_processing_started_at: now,
			},
		});

		try {
			const listRes = await fetchTranscriptList({ appAccessToken: token, meetingId: lecture.teams_meeting_id });
			const transcripts = listRes.data?.value || [];
			const transcriptItem = transcripts[0];

			if (!transcriptItem) {
				const attempts = (lecture.transcript_attempts || 0) + 1;
				const shouldStop = attempts >= MAX_TRANSCRIPT_ATTEMPTS;
				const nextStatus = shouldStop ? 'no_transcript' : 'pending';

				return strapi.entityService.update('api::live-lecture.live-lecture', lecture.id, {
					data: {
						transcript_status: nextStatus,
						transcript_attempts: attempts,
						transcript_last_error: shouldStop ? 'No transcript available after retries.' : null,
						transcript_processed_at: shouldStop ? new Date() : null,
					},
				});
			}

			const transcriptId = transcriptItem.id;
			const contentRes = await fetchTranscriptContent({
				appAccessToken: token,
				meetingId: lecture.teams_meeting_id,
				transcriptId,
			});

			const transcriptText = contentRes.data || '';

			return strapi.entityService.update('api::live-lecture.live-lecture', lecture.id, {
				data: {
					transcript_provider_meeting_id: lecture.teams_meeting_id,
					transcript_provider_transcript_id: transcriptId,
					transcript_status: 'available',
					transcript_text: transcriptText,
					transcript_language: transcriptItem?.language || null,
					transcript_retrieved_at: new Date(),
					transcript_attempts: (lecture.transcript_attempts || 0) + 1,
					transcript_last_error: null,
					transcript_processed_at: new Date(),
				},
			});
		} catch (error) {
			const errorMessage = error?.response?.data
				? JSON.stringify(error.response.data)
				: error.message;

			return strapi.entityService.update('api::live-lecture.live-lecture', lecture.id, {
				data: {
					transcript_status: 'failed',
					transcript_attempts: (lecture.transcript_attempts || 0) + 1,
					transcript_last_error: errorMessage,
					transcript_processed_at: new Date(),
				},
			});
		}
	},

	async ensureSummaryForLecture({ lecture, transcriptText }) {
		if (!lecture || !transcriptText) return null;
		if (!shouldRetrySummary(lecture)) return lecture;

		const now = new Date();

		await strapi.entityService.update('api::live-lecture.live-lecture', lecture.id, {
			data: {
				summary_status: 'pending',
				summary_generated_at: now,
				summary_last_error: null,
			},
		});

		try {
			const parsed = await callCloudflareAI({
				messages: buildSummaryPrompt(transcriptText),
			});

			return strapi.entityService.update('api::live-lecture.live-lecture', lecture.id, {
				data: {
					summary_status: 'completed',
					summary_text: parsed.summary || null,
					summary_tutor_tasks: parsed.tutor_tasks || [],
					summary_student_tasks: parsed.student_tasks || [],
					summary_homework: parsed.homework || [],
					summary_open_questions: parsed.open_questions || [],
					summary_model: CF_MODEL,
					summary_generated_at: new Date(),
					summary_last_error: null,
				},
			});
		} catch (error) {
			return strapi.entityService.update('api::live-lecture.live-lecture', lecture.id, {
				data: {
					summary_status: 'failed',
					summary_last_error: error.message,
					summary_generated_at: new Date(),
				},
			});
		}
	},
}));

/**
 * Welcome to Cloudflare Workers!
 *
 * This is a template for a Scheduled Worker: a Worker that can run on a
 * configurable interval:
 * https://developers.cloudflare.com/workers/platform/triggers/cron-triggers/
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Run `curl "http://localhost:8787/__scheduled?cron=*+*+*+*+*"` to see your Worker in action
 * - Run `npm run deploy` to publish your Worker
 *
 * Bind resources to your Worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

async function sendMessageToSlack(env) {
    console.log('send to slack')
    const botAccessToken = env.SLACK_BOT_ACCESS_TOKEN
    const slackWebhookUrl = 'https://slack.com/api/chat.postMessage';

    const payload = {
	    channel: env.SLACK_BOT_ACCESS_CHANNEL,
	    attachments: [
		    {
			    title: "Cloudflare Workers Cron Trigger",
			    text: "This is Japan Standard Time now",
			    author_name: "arXiv-bot",
			    color: "#00FF00",
		    },
	    ],
    };

    await fetch(slackWebhookUrl, {
	    method: "POST",
	    body: JSON.stringify(payload),
	    headers: {
		    "Content-Type": "application/json; charset=utf-8",
		    Authorization: `Bearer ${botAccessToken}`,
		    Accept: "application/json",
	    },
    }).then((res) => {
	    if (!res.ok) {
		    throw new Error(`Server error ${res.status}`);
	    }
	    return res.json();
    }).then((data) => {
	    console.log("Slack response:", data);
    }).catch((error) => {
	    console.log("Error:", error);
    });
}

export default {
	async fetch(req) {
		const url = new URL(req.url);
		url.pathname = '/__scheduled';
		url.searchParams.append('cron', '* * * * *');
		return new Response(`To test the scheduled handler, ensure you have used the "--test-scheduled" then try running "curl ${url.href}".`);
	},

	// The scheduled handler is invoked at the interval set in our wrangler.jsonc's
	// [[triggers]] configuration.
	async scheduled(event, env, ctx): Promise<void> {
		// A Cron Trigger can make requests to other endpoints on the Internet,
		// publish to a Queue, query a D1 Database, and much more.
		//
		// We'll keep it simple and make an API call to a Cloudflare API:
		let resp = await fetch('https://api.cloudflare.com/client/v4/ips');
		let wasSuccessful = resp.ok ? 'success' : 'fail';

		// You could store this result in KV, write to a D1 Database, or publish to a Queue.
		// In this template, we'll just log the result:
		console.log(`trigger fired at ${event.cron}: ${wasSuccessful}`);

        await sendMessageToSlack(env);

	},
} satisfies ExportedHandler<Env>;

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

import { XMLParser } from 'fast-xml-parser';

async function getArXivInfo() {
    const apiUrl = `http://export.arxiv.org/api/query?search_query=cat:cs.RO&sortBy=submittedDate&sortOrder=descending&max_results=100`;
    const res = await fetch(apiUrl);
    const xml = await res.text();

    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '',
        trimValues: true,
    });

    const json = parser.parse(xml);
    const rawEntries = json.feed.entry;
    const entries = Array.isArray(rawEntries) ? rawEntries : [rawEntries];

    const yesterday = new Date();
    console.log(yesterday)
    yesterday.setUTCDate(yesterday.getUTCDate() - 2);
    const ymd = yesterday.toISOString().split('T')[0];

    const filtered = entries
        .filter(e => {
            const publishedDate = e.published?.split('T')[0];
            const categories = Array.isArray(e.category)
                             ? e.category.map(c => c.term)
                             : [e.category?.term];
            console.log(publishedDate, 'ymd: ', ymd)
            return publishedDate === ymd && categories.includes('cs.RO');
            // return categories.includes('cs.RO');
        })
        .map(e => ({
            title: e.title,
            id: e.id,
            published: e.published,
            summary: e.summary,
            authors: Array.isArray(e.author)
                   ? e.author.map(a => a.name)
                   : [e.author?.name],
            pdf_url: Array.isArray(e.link)
                   ? e.link.find(l => l.title === 'pdf')?.href
                   : e.link?.title === 'pdf' ? e.link.href : '',
            categories: Array.isArray(e.category)
                      ? e.category.map(c => c.term)
                      : [],
        }));
    return new Response(JSON.stringify(filtered, null, 2), {
        headers: { "Content-Type": "application/json" },
    });
}

async function sendMessageToSlack(env, contents) {
    const botAccessToken = env.SLACK_BOT_ACCESS_TOKEN
    const slackWebhookUrl = 'https://slack.com/api/chat.postMessage';

    const payload = {
	    channel: env.SLACK_BOT_ACCESS_CHANNEL,
        attachments: contents,
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

async function parseDataForSlack(entries) {
    return entries.map(entry => {
        const { title, id, published, summary, authors, pdf_url, categories } = entry;

        // const formatted = `*<${id}|${title}>*\n` +
        //                   `*Published:* ${published.split('T')[0]}\n` +
        //                   `*Authors:* ${authors.join(', ')}\n` +
        //                   `*Categories:* ${categories.join(', ')}\n` +
        //                   `*PDF:* <${pdf_url}|Download PDF>\n` +
        //                   `*Summary:*\n${summary.replace(/\s+/g, ' ').trim().slice(0, 500)}...`;

        const formatted = `*Published:* ${published.split('T')[0]}\n` +
                          `*Authors:* ${authors.join(', ')}\n` +
                          `*Categories:* ${categories.join(', ')}\n` +
                          `*PDF:* <${pdf_url}|Download PDF>\n` +
                          `*Summary:*\n${summary.replace(/\s+/g, ' ').trim().slice(0, 500)}...`;

        return {
            color: '#36a64f',
            author_name: 'arXiv cs.RO bot',
            title: title,
            title_link: id,
            text: formatted,
        };
    });
}

export default {
	async fetch(req, env) {

        // const res = await getArXivInfo();
        // const data = await res.json();
        // const message = await parseDataForSlack(data)
        // await sendMessageToSlack(env, message);
        
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
		// let resp = await fetch('https://api.cloudflare.com/client/v4/ips');
		// let wasSuccessful = resp.ok ? 'success' : 'fail';

		// You could store this result in KV, write to a D1 Database, or publish to a Queue.
		// In this template, we'll just log the result:
		// console.log(`trigger fired at ${event.cron}: ${wasSuccessful}`);

        const res = await getArXivInfo();
        const data = await res.json();
        const message = await parseDataForSlack(data)
        await sendMessageToSlack(env, message);

	},
} satisfies ExportedHandler<Env>;

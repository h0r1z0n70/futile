export const connect = "connect-discord-futile";
export const disconnect = "disconnect-discord-futile";

const str = 3, int = 4, user = 6, sub = 1;
const guildonly = { contexts: [0] };

export const perms = {
	admin: 8n,
	ban: 4n,
	manage: 32n,
	timeout: 1n << 40n,
};

export const defs = [
	{
		name: connect,
		description: "Link your Minecraft account and set your nickname",
		type: 1, ...guildonly,
		options: [{ type: str, name: "username", description: "Your exact Minecraft username", required: true, min_length: 3, max_length: 16 }],
	},
	{ name: disconnect, description: "Unlink your Minecraft account", type: 1, ...guildonly },
	{
		name: "timeout",
		description: "Time out a member",
		type: 1, ...guildonly,
		default_member_permissions: String(perms.timeout),
		options: [
			{ type: user, name: "user", description: "Who to time out", required: true },
			{ type: int, name: "minutes", description: "How long in minutes (max 40320, that is 28 days)", required: true, min_value: 1, max_value: 40320 },
			{ type: str, name: "reason", description: "Why", max_length: 300 },
		],
	},
	{
		name: "untimeout",
		description: "Remove a timeout",
		type: 1, ...guildonly,
		default_member_permissions: String(perms.timeout),
		options: [{ type: user, name: "user", description: "Who to free", required: true }],
	},
	{
		name: "ban",
		description: "Ban a member",
		type: 1, ...guildonly,
		default_member_permissions: String(perms.ban),
		options: [
			{ type: user, name: "user", description: "Who to ban", required: true },
			{ type: str, name: "reason", description: "Why", max_length: 300 },
			{ type: int, name: "delete_hours", description: "Delete their messages from the last X hours (0 to 168)", min_value: 0, max_value: 168 },
		],
	},
	{
		name: "unban",
		description: "Unban a user",
		type: 1, ...guildonly,
		default_member_permissions: String(perms.ban),
		options: [{ type: str, name: "user_id", description: "The user id to unban", required: true, min_length: 15, max_length: 21 }],
	},
	{
		name: "giveaway",
		description: "Run a giveaway",
		type: 1, ...guildonly,
		default_member_permissions: String(perms.manage),
		options: [
			{
				type: sub, name: "start", description: "Start a giveaway",
				options: [
					{ type: str, name: "prize", description: "What people can win", required: true, max_length: 200 },
					{ type: int, name: "minutes", description: "How long it runs in minutes", required: true, min_value: 1, max_value: 43200 },
					{ type: int, name: "winners", description: "How many winners (default 1)", min_value: 1, max_value: 20 },
				],
			},
			{
				type: sub, name: "end", description: "End the newest giveaway in this channel now",
				options: [{ type: str, name: "message_id", description: "Only if you want to end an older one" }],
			},
			{
				type: sub, name: "reroll", description: "Pick new winners for the newest ended giveaway",
				options: [{ type: str, name: "message_id", description: "Only if you want an older one" }],
			},
		],
	},
	{
		name: "goal",
		description: "Manage the team goals list",
		type: 1, ...guildonly,
		options: [
			{ type: sub, name: "add", description: "Add something we need", options: [{ type: str, name: "text", description: "What we need", required: true, max_length: 150 }] },
			{ type: sub, name: "done", description: "Mark a goal as done", options: [{ type: int, name: "number", description: "Goal number", required: true, min_value: 1 }] },
			{ type: sub, name: "undo", description: "Mark a goal as not done", options: [{ type: int, name: "number", description: "Goal number", required: true, min_value: 1 }] },
			{ type: sub, name: "remove", description: "Remove a goal", options: [{ type: int, name: "number", description: "Goal number", required: true, min_value: 1 }] },
			{ type: sub, name: "clear", description: "Remove all goals that are done" },
		],
	},
];

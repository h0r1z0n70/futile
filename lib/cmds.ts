export const connect = "connect-discord-futile";
export const disconnect = "disconnect-discord-futile";

export const defs = [
	{
		name: connect,
		description: "Link your Minecraft account and set your nickname",
		type: 1,
		options: [{ type: 3, name: "username", description: "Your exact Minecraft username", required: true, min_length: 3, max_length: 16 }],
	},
	{ name: disconnect, description: "Unlink your Minecraft account", type: 1 },
];

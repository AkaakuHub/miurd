import { type ChatInputCommandInteraction, ChannelType, type TextChannel } from "discord.js";
import type { CommandDefinition } from "../../types";
import { logError, logInfo } from "../../utils/logger";
import { dailyChannelService } from "../../services/DailyChannelService";

export const DailyConfigCommand: CommandDefinition = {
	name: "daily-config",
	description: "日次サマリー用のチャンネル設定を管理します。",
	options: [
		{
			name: "action",
			description: "実行するアクション",
			type: "STRING",
			required: true,
			choices: [
				{ name: "追加", value: "add" },
				{ name: "削除", value: "remove" },
				{ name: "一覧", value: "list" },
				{ name: "クリア", value: "clear" }
			]
		},
		{
			name: "channel",
			description: "対象のチャンネル",
			type: "CHANNEL",
			required: false
		}
	],
	execute: async (interaction: ChatInputCommandInteraction): Promise<void> => {
		try {
			if (!interaction.guild) {
				await interaction.reply({
					content: "このコマンドはサーバー内でのみ使用できます。",
					ephemeral: true
				});
				return;
			}

			const action = interaction.options.getString("action", true);
			const channel = interaction.options.getChannel("channel");

			switch (action) {
				case "add":
					if (!channel || channel.type !== ChannelType.GuildText) {
						await interaction.reply({
							content: "テキストチャンネルを指定してください。",
							ephemeral: true
						});
						return;
					}

					const added = await dailyChannelService.addChannel(
						interaction.guild.id,
						channel.id
					);

					if (added) {
						await interaction.reply({
							content: `✅ ${channel.name} を日次サマリー対象チャンネルに追加しました。`,
							ephemeral: true
						});
					} else {
						await interaction.reply({
							content: `⚠️ ${channel.name} は既に登録されています。`,
							ephemeral: true
						});
					}
					break;

				case "remove":
					if (!channel) {
						await interaction.reply({
							content: "削除するチャンネルを指定してください。",
							ephemeral: true
						});
						return;
					}

					const removed = await dailyChannelService.removeChannel(
						interaction.guild.id,
						channel.id
					);

					if (removed) {
						await interaction.reply({
							content: `✅ ${channel.name} を日次サマリー対象から削除しました。`,
							ephemeral: true
						});
					} else {
						await interaction.reply({
							content: `⚠️ ${channel.name} は登録されていません。`,
							ephemeral: true
						});
					}
					break;

				case "list":
					const channelIds = dailyChannelService.getChannels(interaction.guild.id);
					
					if (channelIds.length === 0) {
						await interaction.reply({
							content: "📝 日次サマリー対象チャンネルは設定されていません。",
							ephemeral: true
						});
						return;
					}

					const channelList = channelIds
						.map(id => {
							const ch = interaction.guild?.channels.cache.get(id);
							return ch ? `• ${ch.name}` : `• (不明なチャンネル: ${id})`;
						})
						.join("\n");

					await interaction.reply({
						content: `📝 **日次サマリー対象チャンネル一覧:**\n${channelList}`,
						ephemeral: true
					});
					break;

				case "clear":
					await dailyChannelService.clearChannels(interaction.guild.id);
					await interaction.reply({
						content: "✅ 全ての日次サマリー対象チャンネルを削除しました。",
						ephemeral: true
					});
					break;

				default:
					await interaction.reply({
						content: "無効なアクションです。",
						ephemeral: true
					});
			}

			logInfo(
				`Daily config command executed by ${interaction.user.username}: ${action}`
			);
		} catch (error) {
			logError(`Error executing daily config command: ${error}`);
			await interaction.reply({
				content: "設定の変更中にエラーが発生しました。",
				ephemeral: true
			});
		}
	},
};
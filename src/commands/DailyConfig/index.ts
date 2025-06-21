import { type ChatInputCommandInteraction, ChannelType } from "discord.js";
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
				{ name: "クリア", value: "clear" },
				{ name: "投稿チャンネル設定", value: "set-summary" },
				{ name: "投稿チャンネル削除", value: "clear-summary" },
			],
		},
		{
			name: "channel_id",
			description: "チャンネルID（例: 1234567890123456789）",
			type: "STRING",
			required: false,
		},
	],
	execute: async (interaction: ChatInputCommandInteraction): Promise<void> => {
		try {
			if (!interaction.guild) {
				await interaction.reply({
					content: "このコマンドはサーバー内でのみ使用できます。",
					ephemeral: true,
				});
				return;
			}

			const action = interaction.options.getString("action", true);
			const channelId = interaction.options.getString("channel_id");

			switch (action) {
				case "add": {
					if (!channelId) {
						await interaction.reply({
							content: "チャンネルIDを指定してください。",
							ephemeral: true,
						});
						return;
					}

					const channel = interaction.guild.channels.cache.get(channelId);
					if (!channel || channel.type !== ChannelType.GuildText) {
						await interaction.reply({
							content: "指定されたIDのテキストチャンネルが見つかりません。",
							ephemeral: true,
						});
						return;
					}

					const added = await dailyChannelService.addChannel(
						interaction.guild.id,
						channelId,
					);

					if (added) {
						await interaction.reply({
							content: `✅ ${channel.name} (${channelId}) を日次サマリー対象チャンネルに追加しました。`,
							ephemeral: true,
						});
					} else {
						await interaction.reply({
							content: `⚠️ ${channel.name} は既に登録されています。`,
							ephemeral: true,
						});
					}
					break;
				}

				case "remove": {
					if (!channelId) {
						await interaction.reply({
							content: "削除するチャンネルIDを指定してください。",
							ephemeral: true,
						});
						return;
					}

					const removed = await dailyChannelService.removeChannel(
						interaction.guild.id,
						channelId,
					);

					if (removed) {
						const channel = interaction.guild.channels.cache.get(channelId);
						const channelName = channel?.name || channelId;
						await interaction.reply({
							content: `✅ ${channelName} を日次サマリー対象から削除しました。`,
							ephemeral: true,
						});
					} else {
						await interaction.reply({
							content: "⚠️ 指定されたチャンネルは登録されていません。",
							ephemeral: true,
						});
					}
					break;
				}

				case "list": {
					const channelIds = dailyChannelService.getChannels(
						interaction.guild.id,
					);
					const summaryChannelId = dailyChannelService.getSummaryChannel(
						interaction.guild.id,
					);

					let content = "📝 **日次サマリー設定一覧:**\n\n";

					// 投稿用チャンネル
					if (summaryChannelId) {
						const summaryChannel = interaction.guild.channels.cache.get(summaryChannelId);
						const summaryChannelName = summaryChannel?.name || "不明なチャンネル";
						content += `📢 **投稿チャンネル:** ${summaryChannelName} (${summaryChannelId})\n\n`;
					} else {
						content += "📢 **投稿チャンネル:** 未設定\n\n";
					}

					// 対象チャンネル
					if (channelIds.length === 0) {
						content += "📋 **対象チャンネル:** 未設定";
					} else {
						const channelList = channelIds
							.map((id) => {
								const ch = interaction.guild?.channels.cache.get(id);
								return ch
									? `• ${ch.name} (${id})`
									: `• (不明なチャンネル: ${id})`;
							})
							.join("\n");
						content += `📋 **対象チャンネル:**\n${channelList}`;
					}

					await interaction.reply({
						content,
						ephemeral: true,
					});
					break;
				}

				case "clear": {
					await dailyChannelService.clearChannels(interaction.guild.id);
					await interaction.reply({
						content: "✅ 全ての日次サマリー対象チャンネルを削除しました。",
						ephemeral: true,
					});
					break;
				}

				case "set-summary": {
					if (!channelId) {
						await interaction.reply({
							content: "投稿用チャンネルIDを指定してください。",
							ephemeral: true,
						});
						return;
					}

					const channel = interaction.guild.channels.cache.get(channelId);
					if (!channel || channel.type !== ChannelType.GuildText) {
						await interaction.reply({
							content: "指定されたIDのテキストチャンネルが見つかりません。",
							ephemeral: true,
						});
						return;
					}

					await dailyChannelService.setSummaryChannel(
						interaction.guild.id,
						channelId,
					);

					await interaction.reply({
						content: `✅ ${channel.name} (${channelId}) を日次サマリー投稿チャンネルに設定しました。`,
						ephemeral: true,
					});
					break;
				}

				case "clear-summary": {
					await dailyChannelService.clearSummaryChannel(interaction.guild.id);
					await interaction.reply({
						content: "✅ 日次サマリー投稿チャンネルの設定を削除しました。",
						ephemeral: true,
					});
					break;
				}

				default:
					await interaction.reply({
						content: "無効なアクションです。",
						ephemeral: true,
					});
			}

			logInfo(
				`Daily config command executed by ${interaction.user.username}: ${action}`,
			);
		} catch (error) {
			logError(`Error executing daily config command: ${error}`);
			await interaction.reply({
				content: "設定の変更中にエラーが発生しました。",
				ephemeral: true,
			});
		}
	},
};

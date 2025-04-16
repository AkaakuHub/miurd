import type {
	GuildMember,
	Message,
	TextChannel,
	VoiceChannel,
} from "discord.js";
import { IyaResponse } from "../response/Iya";
import { ChannelRegistryService } from "../services/ChannelRegistryService";
import { MusicService } from "../services/MusicService";
import type { IYAKind } from "../types";
import { logInfo } from "../utils/logger";
import { isValidYoutubeUrl } from "../utils/youtubeUtils";

const iyaHandler = (message: Message, kind: IYAKind): void => {
	logInfo(`Iya! trigger detected from ${message.author.username}`);
	IyaResponse(message, kind);
};

export const messageCreateHandler = async (message: Message): Promise<void> => {
	// ボットのメッセージは無視
	if (message.author.bot) return;

	const iyaMessageDict = {
		"寝る！": ["眠くなったら"],
		"起きる！": ["お昼過ぎに", "お昼すぎに"],
		"遊ぶ！": ["遊びたくて"],
		"ご飯を食べる！": ["お腹減ったら", "お腹へったら"],
	};
	const match = Object.entries(iyaMessageDict).find(([, values]) => {
		return values.some((value) => message.content.includes(value));
	});
	if (match) {
		const [kind] = match;
		iyaHandler(message, kind as IYAKind);
		return;
	}

	if (isValidYoutubeUrl(message.content)) {
		// サーバー内のメッセージのみ処理
		if (!message.guild) return;

		// チャンネル登録サービスを取得
		const channelRegistry = ChannelRegistryService.getInstance();

		// このチャンネルが登録されているか確認
		if (!channelRegistry.isRegistered(message.guild.id, message.channelId)) {
			// 登録されていないチャンネルのメッセージは無視
			return;
		}

		const member = message.member as GuildMember;
		const voiceChannel = member?.voice.channel as VoiceChannel;

		if (!voiceChannel) {
			await message.reply(
				"YouTubeの音声を再生するにはボイスチャンネルに接続してください",
			);
			return;
		}

		const musicService = MusicService.getInstance();

		// ボットがまだボイスチャンネルに入っていない場合は参加
		const textChannel = message.channel as TextChannel;
		await musicService.joinChannel(voiceChannel, textChannel);

		// URLをキューに追加
		const response = await musicService.queueYoutubeUrl(
			message.content,
			message.guild.id,
		);
		// レスポンスが空でない場合のみ返信（埋め込みメッセージが送信済みの場合は空文字が返る）
		if (response) {
			await message.reply(response);
		}

		// キューの処理を開始（再生中でなければ再生開始）
		await musicService.processQueue(message.guild.id);

		logInfo(
			`YouTube URL検出: ${message.content}, サーバー: ${message.guild.name}`,
		);
	}
};

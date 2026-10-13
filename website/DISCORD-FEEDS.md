# DiscordSRV website feeds

The site is currently unconnected. No bot token or channel IDs have been supplied. Exchange and News display that state; they do not contain invented live records.

## Minecraft publisher

Install DuneCore 1.0.9 and DiscordSRV alongside the existing plugin suite. Create dedicated Discord text channels for exchange snapshots and public game news. Do not use a console-log or private-chat channel.

Set the following in `plugins/DuneCore/config.yml`, then restart:

```yaml
website:
  discord:
    enabled: true
    exchange-channel-id: "YOUR_EXCHANGE_CHANNEL_ID"
    news-channel-id: "YOUR_NEWS_CHANNEL_ID"
```

The bridge invokes the supported `discordsrv broadcast #ChannelID Message` command from the server console. DiscordSRV retains the sending bot credential. The bridge sends public Bukkit broadcast events, plus the delayed cross-server Guild notice after the plugin-message delivery request succeeds. It does not intercept player private messages or publish console logs. Notifications are prefixed with the backend planet. Configure the news channel on each backend whose public broadcasts you want published.

Only Arrakis publishes exchange snapshots, every 60 seconds. They contain all current local player harvesting contracts (remaining quota and open/claimed state) and the standing ordinary spice sale from DuneEss's configured base price. The current plugin does not implement a general player item buy/sell order book. The website identifies harvesting contracts separately and accepts buy/sell entries in the API schema for future offer systems.

Publication is disabled by default and changes no trade, NPC, timer or economy behavior. Existing configuration files are preserved; add the new section when enabling the bridge.

## Website reader

Use the Sites environment-variable settings to configure:

| Variable | Purpose |
| --- | --- |
| `DISCORD_BOT_TOKEN` | Server-only token for a bot allowed to read the dedicated feed channels. |
| `DISCORD_PUBLISHER_ID` | Discord user ID of the DiscordSRV publishing bot; messages from every other author are ignored. |
| `DISCORD_EXCHANGE_CHANNEL_ID` | The exchange channel configured on Arrakis. |
| `DISCORD_NEWS_CHANNEL_ID` | The public game news channel. |

The reader bot needs View Channel and Read Message History permissions, and the message-content access required by Discord. The DiscordSRV publisher needs Send Messages. Do not put the token in source, HTML, JavaScript assets, URLs or the hosting manifest. The published Site keeps its existing private audience.

## API routes and freshness

- `GET /api/exchange`: complete, author-verified exchange snapshot. Rejects partial/malformed snapshots and records older than five minutes. Returns `not_connected` until configured, or `awaiting_snapshot` if no current snapshot exists.
- `GET /api/news?before=DISCORD_MESSAGE_ID`: newest public news records. Fetches up to 100 Discord messages per page, exposes a cursor for older history, and filters to the configured publishing bot. Discord channel retention bounds available history.
- Both routes cache Discord channel reads in the Worker for 60 seconds, honor upstream failures with an unavailable state, and never return credentials. They perform read-only Discord requests.

An exchange snapshot is UTF-8 JSON, gzip-compressed and base64-encoded. Split it into payload chunks no longer than 1700 characters. Each Discord message has the format:

```text
DUNE_EXCHANGE unique-snapshot-id 1/2 base64-payload-part
```

All parts share the same snapshot ID and total count. The API assembles the newest complete snapshot regardless of Discord message order. Maximum 90 parts and 2 MB decompressed data. Large unsupported markets are skipped with a server warning rather than silently truncated.

Decoded schema:

```json
{
  "type": "dune_exchange",
  "updatedAt": "ISO-8601 UTC timestamp",
  "offers": [{
    "id": "stable-offer-id",
    "type": "buy, sell, or contract",
    "item": "Melange Spice",
    "owner": "Minecraft player name or UUID",
    "quantity": 64,
    "price": null,
    "status": "open, claimed, standing, or closed",
    "description": "Human-readable offer details"
  }]
}
```

`quantity: null` means a standing offer; `price: null` means a harvesting-contract split rather than a unit price. Trades happen in Minecraft. The website cannot accept jobs, spend Solaris or move items.

## Validation

Run `node --test tests/feed-api.test.mjs` for unconnected state, multipart assembly, author filtering, partial/stale rejection and malformed offer validation. Run the Core Gradle tests for publisher encoding and existing gameplay regressions. Live DiscordSRV delivery requires a running server and configured channels.

Primary references: [DiscordSRV broadcast command](https://docs.discordsrv.com/commands/), [Discord Get Channel Messages](https://github.com/discord/discord-api-docs/blob/main/developers/resources/message.mdx), [Discord permissions](https://github.com/discord/discord-api-docs/blob/main/developers/topics/permissions.mdx).

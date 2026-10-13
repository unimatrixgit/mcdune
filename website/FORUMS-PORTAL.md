# Community and player portal

The public website has independent Forums and Discord pages. Forums store topics, replies and reports in the hosted D1 database. Reading is public; posting requires ChatGPT sign-in. Public display names are chosen by players. The YouSMP Discord page links the verified community invitation and reads public member/online counts from Discord's invite API. Website discussions are not forwarded to Discord.

## Private player support

Open **Player portal → Your profile → Support tickets**. Sign in with ChatGPT and save a display name and optional Minecraft/Discord names. Names are self-reported, not verified account links. A Minecraft name is required for a ban appeal. Choose **Ban appeal** or **Staff support**, enter a subject and full description, then submit. Appeals should describe the ban reason, approximate date and why staff should reconsider it.

Tickets and replies persist in D1 and are accessible only to the owning account and authorised staff. The owner can reply, close and reopen a closed case. Staff can reply and set Open, In progress, Waiting on player, Resolved or Closed. Each status change appears in the private case history. Closed cases must be reopened before replying. An appeal does not automatically unban a Minecraft account. No Discord messages or notifications are sent by this ticket system; staff should check the portal queue.

The portal overview lists recent cases and the number of active tickets. The profile page links directly to support tickets. Staff access is checked server-side using trusted Sites identity headers and the secret `SUPPORT_STAFF_EMAILS` allowlist; `FORUM_ADMIN_EMAILS` also grants support access. Configure comma-separated account emails through Sites environment variables, never in source or browser code. The site owner's moderator account is configured initially. Minecraft operator status alone does not grant website permissions.

Rate limits: three new tickets per hour, five active cases per account, five replies per minute. Requests validate length, use SQL parameters and require same-origin writes. Public topics/replies can be removed by their owner or moderators; authenticated players can report them. Moderators review reports separately from private support tickets.

## Hosting

`.openai/hosting.json` declares the `DB` binding. Schema-only migrations live in `drizzle/` and are packaged into `dist/.openai/drizzle`; Sites applies them before publication. Keep applied migration history immutable. Runtime secrets are managed in Sites. Game exchange/news integration remains separately configured through the existing DiscordSRV bridge and Discord bot channels; joining YouSMP does not configure those feeds.

Build with `node scripts/build.mjs`, then run `node --test tests/*.test.mjs`. Tests use a temporary SQLite database and do not create public topics or real support requests.

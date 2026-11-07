# Live EU lobby, 18 October 2026

The live server is a Hetzner CX23 in Falkenstein, Germany: `2.28.33.142`, DNS `lobby.dunerealms.com`. It runs only the public proxy, lobby backend and Bedrock connection menu. CloudPanel belongs to the separate website host and is not installed here.

## Routing

| Entry | Port | Destination |
|---|---|---|
| Java | TCP 25565 | Velocity -> spacing-guild -> localhost:25571 |
| Bedrock direct | UDP 19132 | Geyser-Velocity + Floodgate -> lobby |
| Bedrock NetherNet | TCP 19132 signalling, UDP 19134 | Geyser-Velocity -> lobby |
| GeyserConnect menu | UDP/TCP 19133, NetherNet UDP 19135 | Standalone Geyser menu -> direct Bedrock entry |

The Paper backend binds exclusively to localhost and uses modern Velocity forwarding with a private shared secret. Velocity authenticates Java accounts. Geyser-Velocity uses Floodgate authentication; the separate GeyserConnect instance uses online authentication as required by its extension. Custom destinations and virtual hosts are disabled in the menu; its only configured destination is this lobby. No planet backends have been connected yet.

## Installed and checked versions

| Component | Version | Runtime/location |
|---|---|---|
| Velocity | 4.3.0 build 44 | Java 25, `/opt/dunerealms/proxy` |
| Paper | 1.21.4 build 232 | Java 21, `/opt/dunerealms/lobby` |
| Geyser-Velocity / Standalone | 2.12.0 build 1265 | Java 25 |
| Floodgate Velocity | 2.2.5 build 141 | proxy plugin |
| ViaVersion | 5.12.1 | lobby plugin |
| ImageFrame | 2026.1.5.4 | lobby plugin |
| DuneLobby | 1.0.0 from beta commit 56773408535da9b2615029a8d8a955873b93fb38 | lobby plugin |

Velocity 3.5.1 was incompatible with this Geyser build's Adventure API; 4.3.0 starts both plugins successfully. Upstream official downloads were used; downloaded Paper/Velocity/Geyser/Floodgate/GeyserConnect artifacts were checksum checked. Do not run the older generic network deployment scripts over this configured installation.

## Lobby world

Imported the saved `worlds/Dune-Guild-Lobby-1.0.0.zip` from the beta commit above. The initial generated lobby and old companion JAR were preserved under `/opt/dunerealms/backups/20261018/`. No planet worlds were overwritten. The new companion preserves the saved structure and restores eleven ImageFrame panels comprising 276 frames.

Runtime verification passed: `GUILD_VERIFY PASS walkable=16274 artwork=276 []`, both before and after a controlled Paper service restart. ImageFrame reloaded eleven saved image maps after restart. A real Java player connected through Velocity and the owner confirmed the connection works. An external Bedrock UDP status ping succeeded; an actual Bedrock player session has not yet been confirmed. Planet travel, paid fares and the official exchange require their future DuneCore/DuneEss/backend integrations. The smuggler merchants provide their own emerald barter goods, not redeemable Solaris resources.

## Operations

Service user: `dune`. Enabled systemd services: `dune-proxy`, `dune-lobby`, `dune-geyserconnect`. All restart after failure and start at boot. Proxy maximum heap 512 MB, Paper 2048 MB, connection menu 384 MB. A 2 GB swap file provides headroom on the 4 GB VM; this is not capacity for all five planet servers.

Shared GNU Screen session: `1358.pts-0.debian-4gb-fsn1-1`. Attach with `screen -x`; live logs use `journalctl -f -u dune-lobby -u dune-proxy -u dune-geyserconnect`. Paper accepts console commands via `/opt/dunerealms/lobby/console.fifo`, for example `printf 'dunelobby verify\n' > /opt/dunerealms/lobby/console.fifo`. The FIFO is private to the service environment/root.

UFW is enabled and allows SSH TCP 22, Java TCP 25565, TCP/UDP 19132–19133 and UDP 19134–19135. Backend TCP 25571 is not public. Forwarding secrets and Floodgate private keys stay on the host and are deliberately absent from Git. Keep private backups of those files alongside worlds and ImageFrame data. Avoid restarting while players are testing.

Update third-party plugins from official upstream builds, preserve the previous JAR, stop only the affected service, checksum the new artifact, then start and inspect logs. GitHub forks do not automatically track or deploy upstream releases; the requested remaining fork work is deferred at the owner's request. A full machine reboot and a new authenticated Bedrock session remain separate operational checks.
